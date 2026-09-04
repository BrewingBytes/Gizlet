import { readFile } from "node:fs/promises";

import { expect, test, type Page, type Response } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { fixedPdfPageSizes } from "../../src/data/jpg-to-pdf";
import { paintedAspect, paintedPixels } from "./support/pdf-canvas";

/**
 * Two tiny JPEGs drawn by Chromium, one wider than it is tall and one taller
 * than it is wide, so the assembled document proves the page order and the
 * automatic orientation rather than only that a file arrived.
 */
const wideJpeg =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAYADADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAcI/8QAGBABAAMBAAAAAAAAAAAAAAAAABdmpOP/xAAXAQEBAQEAAAAAAAAAAAAAAAAABQYE/8QAKBEAAQEFBQkAAAAAAAAAAAAAAAEEBRESUQIDE6HRBhQVFiExUlNh/9oADAMBAAIRAxEAPwDKguUCWTD0IEsmHoicxu325WtDv4W1eGaakNbjQ6BLJh6Liyu0ryZm7C3e1NLNHoqd4VRKFh1Mt6zz4qQjCn0AMsVwAAAAAAD/2Q==";
const tallJpeg =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAwABgDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAYHCP/EABgQAQADAQAAAAAAAAAAAAAAAAAHRYPC/8QAGQEAAgMBAAAAAAAAAAAAAAAAAAIDBAUG/8QAIREAAQMCBwEAAAAAAAAAAAAAAAECEQMEEhMxM2GBseH/2gAMAwEAAhEDEQA/AOVF9Flpl2gV9Flpl2V+hUvth3XqF6AgOdMEX0WWmXa9Dq+Ug0a9/nU1ZhiefgAIZwAAAAAf/9k=";

const asFile = (name: string, base64: string) => ({
  name,
  mimeType: "image/jpeg",
  buffer: Buffer.from(base64, "base64"),
});

test("assembles chosen images into one local PDF in the order set on the page", async ({
  page,
}) => {
  await page.goto("/tools/jpg-to-pdf/");

  await expect(page).toHaveTitle("Image to PDF | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your images stay on this device.",
  );
  await expect(page.getByRole("button", { name: "Make the PDF" })).toBeHidden();

  await page
    .getByLabel("Select images to put in a PDF")
    .setInputFiles([asFile("wide.jpg", wideJpeg), asFile("tall.jpg", tallJpeg)]);

  const pages = page.getByRole("list", { name: "Pages in the PDF" });
  await expect(pages.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("2 pages · up to 100")).toBeVisible();
  await expect(pages.getByRole("listitem").first()).toContainText("wide.jpg");
  await expect(pages.getByRole("listitem").first()).toContainText("48 × 24 px");

  // Reordering has to change the document, not only the list.
  await page.getByRole("button", { name: "Move tall.jpg up" }).click();
  await expect(pages.getByRole("listitem").first()).toContainText("tall.jpg");
  await expect(
    page.getByRole("button", { name: "Move tall.jpg up" }),
  ).toBeDisabled();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Make the PDF" }).click();
  await expect(page.getByText("2 pages · A4")).toBeVisible();

  const download = page.getByRole("link", { name: "Download PDF" });
  await expect(download).toHaveAttribute("download", "tall-and-1-more.pdf");
  await download.click();

  const saved = await downloadPromise;
  expect(saved.suggestedFilename()).toBe("tall-and-1-more.pdf");

  const path = await saved.path();
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const document = await PDFDocument.load(bytes);
  expect(document.getPageCount()).toBe(2);

  // Page one is the tall image, so auto orientation leaves A4 upright; page
  // two is the wide one, which turns the sheet on its side.
  const [first, second] = document.getPages().map((pdfPage) => pdfPage.getSize());
  expect(first.width).toBeCloseTo(fixedPdfPageSizes.a4.width, 2);
  expect(first.height).toBeCloseTo(fixedPdfPageSizes.a4.height, 2);
  expect(second.width).toBeCloseTo(fixedPdfPageSizes.a4.height, 2);
  expect(second.height).toBeCloseTo(fixedPdfPageSizes.a4.width, 2);
});

test("refuses a file that is not an image and names it", async ({ page }) => {
  await page.goto("/tools/jpg-to-pdf/");

  await page.getByLabel("Select images to put in a PDF").setInputFiles([
    asFile("holiday.jpg", wideJpeg),
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
  ]);

  const error = page.getByRole("alert");
  await expect(error).toContainText("notes.txt");
  await expect(error).toContainText("is not an image this Gizlet can read");
  await expect(error).toContainText("JPEG, PNG, WebP, AVIF, or BMP");

  // Nothing was accepted, so there is no half-built document to download.
  await expect(page.getByRole("button", { name: "Make the PDF" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeHidden();
});

test("shows the assembled PDF in the result panel before it is downloaded", async ({
  page,
}) => {
  await page.goto("/tools/jpg-to-pdf/");

  await page
    .getByLabel("Select images to put in a PDF")
    .setInputFiles([asFile("tall.jpg", tallJpeg), asFile("wide.jpg", wideJpeg)]);
  await page.getByRole("button", { name: "Make the PDF" }).click();

  // The summary and the download are still what they were; the preview is
  // added to the panel rather than standing in for either.
  await expect(page.getByText("2 pages · A4")).toBeVisible();
  const download = page.getByRole("link", { name: "Download PDF" });
  await expect(download).toBeVisible();

  const pageField = page.getByLabel("Go to page");
  await expect(page.locator("[data-preview]")).toBeVisible();
  await expect(page.locator("[data-page-total]")).toHaveText("of 2");
  await expect(pageField).toHaveValue("1");

  // A page that was genuinely drawn, and drawn from the document that was
  // built: auto orientation turned the second sheet, so page one is upright
  // and page two is on its side. Re-rendering the source images could not
  // produce that.
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(0);
  await expect.poll(() => paintedAspect(page)).toBeLessThan(1);

  const next = page.getByRole("button", { name: "Next page" });
  await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await next.click();
  await expect(pageField).toHaveValue("2");
  await expect(next).toBeDisabled();
  await expect.poll(() => paintedAspect(page)).toBeGreaterThan(1);

  // A page that is not in the document restores the field rather than jumping.
  await pageField.fill("9");
  await pageField.press("Enter");
  await expect(pageField).toHaveValue("2");

  // Reading the preview left the download exactly where it was.
  const downloadPromise = page.waitForEvent("download");
  await download.click();
  const saved = await downloadPromise;
  expect(saved.suggestedFilename()).toBe("tall-and-1-more.pdf");

  // Starting over takes the preview with it.
  await page.getByRole("button", { name: "Start over" }).first().click();
  await expect(page.locator("[data-preview]")).toBeHidden();
});

/**
 * The bodies of the scripts a page loads for itself, so a test can ask what is
 * in a page's initial JavaScript rather than only which files arrived.
 */
const initialScripts = async (page: Page, path: string) => {
  const bodies: Promise<string>[] = [];
  const record = (response: Response) => {
    if (response.request().resourceType() === "script") {
      bodies.push(response.text().catch(() => ""));
    }
  };

  page.on("response", record);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  page.off("response", record);

  return Promise.all(bodies);
};

/**
 * pdf.js reaches its worker through a bundled asset URL, so every chunk that
 * carries the library carries that filename.
 */
const chunksCarryingPdfJs = (bodies: readonly string[]) =>
  bodies.filter((body) => body.includes("pdf.worker")).length;

test("keeps pdf.js out of the page until a PDF has been made", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  const workspace = await initialScripts(page, "/tools/jpg-to-pdf/");
  expect(workspace.length).toBeGreaterThan(0);
  expect(chunksCarryingPdfJs(workspace)).toBe(0);
  expect(requested.filter((url) => url.includes("pdf.worker"))).toEqual([]);

  // The control: the PDF Viewer does import pdf.js up front, so the check
  // above is looking for something it would genuinely find.
  expect(
    chunksCarryingPdfJs(await initialScripts(page, "/tools/pdf-viewer/")),
  ).toBeGreaterThan(0);

  // And on this page the library arrives only once there is a document to draw.
  await page.goto("/tools/jpg-to-pdf/");
  await page
    .getByLabel("Select images to put in a PDF")
    .setInputFiles([asFile("wide.jpg", wideJpeg)]);
  await page.getByRole("button", { name: "Make the PDF" }).click();
  await expect(page.locator("[data-preview]")).toBeVisible();

  await expect
    .poll(() => requested.filter((url) => url.includes("pdf.worker")).length)
    .toBeGreaterThan(0);
});
