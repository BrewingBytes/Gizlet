import { expect, test, type Page } from "@playwright/test";

import { maximumPdfToImagePages } from "../../src/data/pdf-to-jpg";
import { chunksCarryingPdfJs, initialScripts } from "./support/initial-scripts";
import { paintedPixels } from "./support/pdf-canvas";
import { encryptedPdf, samplePdf, zeroPagePdf } from "./support/sample-pdf";

const openPdf = (page: Page, buffer: Buffer, name = "statement.pdf") =>
  page.getByLabel("Select a PDF to convert").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer,
  });

const convert = (page: Page) => page.getByRole("button", { name: "Make the images" });

const results = (page: Page) => page.getByRole("list", { name: "Converted pages" });

/**
 * Reads the archive back out of the browser, through the same object URL the
 * download link points at. The end-of-central-directory record is the last 22
 * bytes of a ZIP with no comment, and it is what an unpacker reads first, so
 * the file count it declares is the one any tool would see.
 */
const archiveEntryCount = (page: Page) =>
  page.getByRole("link", { name: /Download all/ }).evaluate(async (link) => {
    const response = await fetch((link as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const end = bytes.length - 22;

    return view.getUint32(end, true) === 0x06054b50 ? view.getUint16(end + 10, true) : -1;
  });

test("turns every page of a local PDF into an image on this device", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/tools/pdf-to-jpg/");

  await expect(page).toHaveTitle("PDF to Image | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your PDF stays on this device.",
  );

  await openPdf(page, await samplePdf(3));

  await expect(page.locator("[data-document-name]")).toContainText("statement.pdf");
  await expect(page.locator("[data-document-name]")).toContainText("3 pages");
  // The document is drawn while the pages are being chosen, not only after.
  await expect(page.locator("[data-page-total]")).toHaveText("of 3");
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(500);

  await convert(page).click();

  await expect(page.getByRole("heading", { name: "Your images are ready." })).toBeVisible();
  await expect(page.locator("[data-result-details]")).toContainText("All 3 pages · JPEG");
  await expect(results(page).getByRole("listitem")).toHaveCount(3);

  const downloads = results(page).getByRole("link");
  await expect(downloads).toHaveCount(3);
  await expect(downloads.first()).toHaveAttribute("download", "statement-page-1.jpg");
  await expect(downloads.last()).toHaveAttribute("download", "statement-page-3.jpg");

  // The set is also one file, packed in this browser from those same images.
  const archive = page.getByRole("link", { name: /Download all/ });
  await expect(archive).toHaveAttribute("download", "statement-pages.zip");
  expect(await archiveEntryCount(page)).toBe(3);

  // Nothing was posted anywhere: the whole conversion happened on this device.
  expect(requests).toEqual([]);
});

test("converts only the pages that were asked for", async ({ page }) => {
  await page.goto("/tools/pdf-to-jpg/");
  await openPdf(page, await samplePdf(4), "report.pdf");

  await page.getByLabel("Pages to convert").fill("1, 3-4");
  await convert(page).click();

  await expect(page.locator("[data-result-details]")).toContainText("3 of 4 pages");
  await expect(results(page).getByRole("listitem")).toHaveCount(3);
  await expect(results(page).getByRole("link").nth(1)).toHaveAttribute(
    "download",
    "report-page-3.jpg",
  );

  // A page that is not in this document is refused rather than converted
  // silently to something else.
  await page.getByLabel("Pages to convert").fill("9");
  await convert(page).click();

  await expect(page.locator("[data-error]")).toContainText("between 1 and 4");
  await expect(page.locator("[data-result]")).toBeHidden();
});

test("gives one page one download and no archive", async ({ page }) => {
  await page.goto("/tools/pdf-to-jpg/");
  await openPdf(page, await samplePdf(1), "receipt.pdf");

  await convert(page).click();

  await expect(page.getByRole("heading", { name: "Your image is ready." })).toBeVisible();
  await expect(results(page).getByRole("listitem")).toHaveCount(1);
  await expect(results(page).getByRole("link")).toHaveAttribute(
    "download",
    "receipt-page-1.jpg",
  );
  // One file is already one download, so there is nothing to pack.
  await expect(page.getByRole("link", { name: /Download all/ })).toBeHidden();
});

test("writes the chosen format at the chosen resolution", async ({ page }) => {
  await page.goto("/tools/pdf-to-jpg/");
  await openPdf(page, await samplePdf(1), "page.pdf");

  await page.getByLabel("Image format").selectOption("image/png");
  await page.getByLabel("Resolution", { exact: true }).selectOption("screen");
  await convert(page).click();

  await expect(results(page).getByRole("link")).toHaveAttribute("download", "page-page-1.png");
  // 72 dpi is the A4 page at its own size in points, so it is drawn 595 across.
  await expect(results(page).getByRole("listitem").first()).toContainText("595 × 841 px");

  await page.getByLabel("Resolution", { exact: true }).selectOption("print");
  await convert(page).click();

  await expect(results(page).getByRole("listitem").first()).toContainText("1785 × 2525 px");
});

test("explains an encrypted PDF, a corrupt one, and one with no pages", async ({ page }) => {
  await page.goto("/tools/pdf-to-jpg/");
  const error = page.locator("[data-error]");

  await openPdf(page, encryptedPdf(), "payslip.pdf");
  await expect(error).toContainText("password-protected");
  await expect(error).toContainText("unlocked copy");
  await expect(page.locator("[data-editor]")).toBeHidden();

  await openPdf(page, Buffer.from("%PDF-1.7\nthis is not a real document"), "damaged.pdf");
  await expect(error).toContainText("not a PDF that can be read");
  await expect(page.locator("[data-editor]")).toBeHidden();

  await openPdf(page, zeroPagePdf(), "empty.pdf");
  await expect(error).toHaveText("This PDF has no pages, so there is nothing to convert.");
  await expect(page.locator("[data-editor]")).toBeHidden();

  // A file that is not a PDF at all is refused before anything reads it.
  await page.getByLabel("Select a PDF to convert").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(error).toHaveText("notes.txt is not a PDF. Choose a file that ends in .pdf.");

  // The Gizlet is still usable afterwards.
  await openPdf(page, await samplePdf(2));
  await expect(page.locator("[data-page-total]")).toHaveText("of 2");
  await expect(error).toBeHidden();
});

/**
 * A visitor who opens this page has not yet chosen a PDF, and pdf.js and its
 * worker are over a megabyte between them, so neither may be in what the page
 * hands out on arrival — asserted against the built bundles, not the source.
 */
test("keeps pdf.js out of the page until a PDF is chosen", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  const workspace = await initialScripts(page, "/tools/pdf-to-jpg/");

  expect(workspace.length).toBeGreaterThan(0);
  expect(chunksCarryingPdfJs(workspace)).toBe(0);
  expect(requested.filter((url) => url.includes("pdf.worker"))).toEqual([]);

  // The control: the PDF Viewer page does import pdf.js up front, so the check
  // above is looking for something it would genuinely find.
  expect(
    chunksCarryingPdfJs(await initialScripts(page, "/tools/pdf-viewer/")),
  ).toBeGreaterThan(0);

  // And here the library arrives only once there is a document to read.
  await page.goto("/tools/pdf-to-jpg/");
  await openPdf(page, await samplePdf(1));
  await expect(page.locator("[data-page-total]")).toHaveText("of 1");

  await expect
    .poll(() => requested.filter((url) => url.includes("pdf.worker")).length)
    .toBeGreaterThan(0);
});

test("refuses a document longer than it will convert in one pass", async ({ page }) => {
  await page.goto("/tools/pdf-to-jpg/");

  await openPdf(page, await samplePdf(maximumPdfToImagePages + 1), "book.pdf");

  await expect(page.locator("[data-error]")).toContainText(
    `converts up to ${maximumPdfToImagePages} pages at a time`,
  );
  await expect(page.locator("[data-editor]")).toBeHidden();
});
