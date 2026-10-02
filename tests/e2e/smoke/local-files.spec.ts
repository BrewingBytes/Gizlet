import { readFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";

import { expect, test, type Download, type Locator, type Page } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";

import { createZipArchive } from "../../../src/data/zip-archive";
import { paintedPixels } from "../support/pdf-canvas";
import { squeezableImage } from "../support/sample-image";
import { zipEntries } from "../support/zip-entries";

/**
 * The local file workflows, on a phone.
 *
 * This is the one spec the `webkit-smoke` project runs, and Chromium runs it
 * too as the control: a failure in WebKit alone is a WebKit failure, a failure
 * in both is not. It is deliberately small — one picture, two PDFs, one
 * archive, the theme and the search — and each test goes as far as the file a
 * visitor would keep, read back in Node, rather than stopping at a page that
 * looks finished.
 *
 * Playwright's WebKit is the engine, not iOS Safari. The file picker, the share
 * sheet, the Files app and memory pressure on a real iPhone are a manual check,
 * described in docs/browser-testing.md.
 */
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

/**
 * A PDF whose pages are all one shape, so the saved merge shows whose pages
 * came first. Each page carries a block of colour for the preview to draw.
 */
const shapedPdf = async (pageCount: number, size: [number, number]) => {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    document.addPage(size).drawRectangle({ x: 20, y: 20, width: 60, height: 40, color: rgb(0.96, 0.65, 0) });
  }

  return Buffer.from(await document.save());
};

/** Picks files the way a visitor does: by tapping the visible button. */
const chooseWith = async (
  page: Page,
  button: Locator,
  files: { name: string; mimeType: string; buffer: Buffer }[],
) => {
  const chooser = page.waitForEvent("filechooser");

  await button.tap();
  await (await chooser).setFiles(files);
};

/** Taps a download link and returns the saved file with what the browser called it. */
const saveDownload = async (page: Page, link: Locator) => {
  const download: Promise<Download> = page.waitForEvent("download");

  await link.tap();

  const saved = await download;

  return { name: saved.suggestedFilename(), bytes: await readFile(await saved.path()) };
};

/** The MIME type of the Blob behind a download link, which is what a phone files it as. */
const blobType = (link: Locator) =>
  link.evaluate(async (element) => (await (await fetch((element as HTMLAnchorElement).href)).blob()).type);

/** Nothing on the page is wider than the phone. */
const fitsThePhone = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Records anything other than a GET, which a local workflow must never send. */
const recordUploads = (page: Page) => {
  const sent: string[] = [];

  page.on("request", (request) => {
    if (request.method() !== "GET") sent.push(`${request.method()} ${request.url()}`);
  });

  return sent;
};

test("converts a picture and saves a real JPEG", async ({ page }) => {
  const sent = recordUploads(page);

  await page.goto("/tools/convert-image/");
  await chooseWith(page, page.getByRole("button", { name: "Choose images" }), [
    { name: "gradient.bmp", mimeType: "image/bmp", buffer: squeezableImage(40, 30) },
  ]);

  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Convert it" }).tap();

  await expect(page.getByText("Your image is ready.")).toBeVisible();
  await expect(page.getByText("JPEG · 40 × 30 px")).toBeVisible();
  expect(await fitsThePhone(page)).toBe(true);

  const link = page.getByRole("link", { name: "Download image" });
  expect(await blobType(link)).toBe("image/jpeg");

  const saved = await saveDownload(page, link);
  expect(saved.name).toBe("gradient-converted.jpg");
  // A JPEG starts with a start-of-image marker, whatever the extension says.
  expect([...saved.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  expect(sent).toEqual([]);
});

test("converts to WebP only where the browser can encode it, and says so where it cannot", async ({
  page,
}) => {
  await page.goto("/tools/convert-image/");

  // The same question the Gizlet asks: a browser that cannot encode WebP hands
  // back a PNG instead, and that substitution is what has to be refused.
  const encodesWebP = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  });

  // Which branch ran is part of the result, so the report says so.
  test.info().annotations.push({
    type: "webp-encoding",
    description: encodesWebP ? "supported: checked the saved WebP" : "unsupported: checked the message",
  });

  await chooseWith(page, page.getByRole("button", { name: "Choose images" }), [
    { name: "gradient.bmp", mimeType: "image/bmp", buffer: squeezableImage(40, 30) },
  ]);
  await page.getByLabel("Output format").selectOption("image/webp");
  await page.getByRole("button", { name: "Convert it" }).tap();

  if (encodesWebP) {
    const saved = await saveDownload(page, page.getByRole("link", { name: "Download image" }));

    expect(saved.name).toBe("gradient-converted.webp");
    expect(saved.bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(saved.bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
  } else {
    // Not a silent PNG with a .webp name, and not a skipped test: the visitor
    // is told, the picture stays chosen, and there is nothing to download.
    await expect(page.getByRole("alert")).toHaveText("Your browser cannot create WEBP images.");
    await expect(page.getByAltText("Selected image preview")).toBeVisible();
    await expect(page.getByRole("link", { name: "Download image" })).toBeHidden();
  }
});

test("merges two PDFs, previews the result, and saves every page in order", async ({ page }) => {
  const sent = recordUploads(page);

  await page.goto("/tools/merge-pdf/");
  await chooseWith(page, page.getByRole("button", { name: "Choose PDFs" }), [
    { name: "first.pdf", mimeType: "application/pdf", buffer: await shapedPdf(1, [400, 200]) },
    { name: "second.pdf", mimeType: "application/pdf", buffer: await shapedPdf(2, [200, 400]) },
  ]);

  await expect(page.getByRole("list", { name: "PDFs in the merge" }).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: "Merge the PDFs" }).tap();

  const preview = page.getByRole("region", { name: "The merged PDF" });
  await expect(preview.locator("[data-page-total]")).toHaveText("of 3");
  await expect.poll(() => paintedPixels(preview)).toBeGreaterThan(0);
  expect(await fitsThePhone(page)).toBe(true);

  const link = page.getByRole("link", { name: "Download PDF" });
  expect(await blobType(link)).toBe("application/pdf");

  const saved = await saveDownload(page, link);
  expect(saved.name).toBe("first-merged.pdf");

  // The wide page was first in the list, so it has to be first in the file.
  const merged = await PDFDocument.load(saved.bytes);
  expect(merged.getPages().map((pdfPage) => [pdfPage.getWidth(), pdfPage.getHeight()])).toEqual([
    [400, 200],
    [200, 400],
    [200, 400],
  ]);
  expect(sent).toEqual([]);
});

test("opens a ZIP and saves the files back out of it", async ({ page }) => {
  const sent = recordUploads(page);
  const prose = "the quick brown fox jumps over the lazy dog. ".repeat(40);
  const archive = Buffer.from(
    createZipArchive(
      [
        { name: "notes/readme.txt", body: "read me first" },
        { name: "notes/long.txt", body: prose, deflate: true },
      ].map((file) => {
        const data = new TextEncoder().encode(file.body);

        return { name: file.name, data, deflated: file.deflate ? deflateRawSync(data) : undefined };
      }),
    ),
  );

  await page.goto("/tools/extract-archive/");
  await chooseWith(page, page.getByRole("button", { name: "Choose an archive" }), [
    { name: "notes.zip", mimeType: "application/zip", buffer: archive },
  ]);

  await expect(page.locator("[data-summary]")).toContainText("2 files");
  expect(await fitsThePhone(page)).toBe(true);
  await page.getByRole("button", { name: "Extract the ticked files as a ZIP" }).tap();

  const saved = await saveDownload(page, page.getByRole("link", { name: /^Download / }));
  expect(saved.name).toBe("notes-extracted.zip");
  // The deflated entry went through the browser's own decompressor and back.
  expect(zipEntries(saved.bytes)).toEqual([
    { name: "notes/readme.txt", body: "read me first" },
    { name: "notes/long.txt", body: prose },
  ]);
  expect(sent).toEqual([]);
});

test("switches theme and finds a Gizlet from the header search", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const header = page.getByRole("banner");
  await header.getByRole("button", { name: "Switch to light theme" }).tap();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await header.getByRole("button", { name: "Search Gizlet" }).tap();
  const overlay = page.getByRole("dialog", { name: "What do you need?" });
  await expect(overlay).toBeVisible();
  await overlay.getByLabel("Search Gizlets").fill("merge pdf");
  await overlay.getByRole("link", { name: /Merge PDF/ }).tap();

  await expect(page).toHaveURL(/\/tools\/merge-pdf\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await fitsThePhone(page)).toBe(true);
});
