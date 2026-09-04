import { expect, test, type Locator, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { maximumSplitPdfPages } from "../../src/data/split-pdf";
import { chunksCarryingPdfJs, initialScripts } from "./support/initial-scripts";
import { encryptedPdf, zeroPagePdf } from "./support/sample-pdf";

/**
 * A real PDF whose pages are each a different width, built with the library the
 * PDF Gizlets already ship.
 *
 * The width is the point: splitting is meant to copy the pages the visitor
 * named, and a page's size is something a test can read back out of the
 * document that came out. Page 1 is 200 points across, page 2 is 210, and so
 * on, so measuring an output says which source page it actually holds rather
 * than only how many.
 */
async function numberedPdf(pageCount: number): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([200 + index * 10, 300]);

    page.drawText(`Page ${index + 1}`, {
      x: 20,
      y: 200,
      size: 18,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
  }

  return Buffer.from(await document.save());
}

/** A PDF of blank pages, for the counts the memory guard is about. */
async function blankPdf(pageCount: number): Promise<Buffer> {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) document.addPage([200, 300]);

  return Buffer.from(await document.save());
}

const openPdf = (page: Page, buffer: Buffer, name = "statement.pdf") =>
  page.getByLabel("Select a PDF to split").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer,
  });

const split = (page: Page) => page.getByRole("button", { name: "Split the PDF" });

const results = (page: Page) => page.getByRole("list", { name: "Split documents" });

/** The bytes behind a download link, read back through its own object URL. */
async function linkBytes(link: Locator): Promise<Buffer> {
  const base64 = await link.evaluate(async (element) => {
    const response = await fetch((element as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";

    for (const byte of bytes) binary += String.fromCharCode(byte);

    return btoa(binary);
  });

  return Buffer.from(base64, "base64");
}

/**
 * Opens a downloaded document with pdf-lib and reports what it holds: proof
 * that what the Gizlet wrote is a PDF something else can read, and which of the
 * source pages ended up in it.
 */
async function openedResult(link: Locator): Promise<{ pages: number; widths: number[] }> {
  const bytes = await linkBytes(link);

  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const document = await PDFDocument.load(bytes);

  return {
    pages: document.getPageCount(),
    widths: document.getPages().map((page) => Math.round(page.getWidth())),
  };
}

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

test("splits a local PDF into the ranges it was given, on this device", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/tools/split-pdf/");

  await expect(page).toHaveTitle("Split PDF | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your PDF stays on this device.",
  );

  await openPdf(page, await numberedPdf(6));

  await expect(page.locator("[data-document-name]")).toContainText("statement.pdf");
  await expect(page.locator("[data-document-name]")).toContainText("6 pages");
  // The document is drawn while the pages are being chosen, not only after.
  await expect(page.locator("[data-page-total]")).toHaveText("of 6");

  await page.getByLabel("Pages to split out").fill("1-3, 5");
  await split(page).click();

  await expect(page.getByRole("heading", { name: "Your PDFs are ready." })).toBeVisible();
  await expect(page.locator("[data-result-details]")).toContainText("2 PDFs · 4 pages");
  await expect(results(page).getByRole("listitem")).toHaveCount(2);
  await expect(results(page).getByRole("listitem").first()).toContainText("Pages 1-3");
  await expect(results(page).getByRole("listitem").last()).toContainText("Page 5");

  const downloads = results(page).getByRole("link");
  await expect(downloads).toHaveCount(2);
  await expect(downloads.first()).toHaveAttribute("download", "statement-pages-1-3.pdf");
  await expect(downloads.last()).toHaveAttribute("download", "statement-page-5.pdf");

  // Each output is a PDF another reader can open, holding exactly the pages
  // that were named: pages 1 to 3 are 200, 210 and 220 points across, and page
  // 5 is 240.
  expect(await openedResult(downloads.first())).toEqual({ pages: 3, widths: [200, 210, 220] });
  expect(await openedResult(downloads.last())).toEqual({ pages: 1, widths: [240] });

  // The set is also one file, packed in this browser from those same documents.
  const archive = page.getByRole("link", { name: /Download all/ });
  await expect(archive).toHaveAttribute("download", "statement-split.zip");
  expect(await archiveEntryCount(page)).toBe(2);

  // Nothing was posted anywhere: the whole split happened on this device.
  expect(requests).toEqual([]);
});

test("gives every page a document of its own when asked to", async ({ page }) => {
  await page.goto("/tools/split-pdf/");
  await openPdf(page, await numberedPdf(4), "report.pdf");

  await page.getByLabel("Split into").selectOption("pages");
  // The field has no say in this mode, so it is disabled rather than left
  // looking like it still decides something.
  await expect(page.getByLabel("Pages to split out")).toBeDisabled();
  await expect(page.locator("[data-pages-hint]")).toContainText(
    "Every one of the 4 pages becomes its own PDF.",
  );

  await split(page).click();

  await expect(page.locator("[data-result-details]")).toContainText("4 PDFs · 4 pages");
  await expect(results(page).getByRole("listitem")).toHaveCount(4);

  const downloads = results(page).getByRole("link");
  await expect(downloads.first()).toHaveAttribute("download", "report-page-1.pdf");
  await expect(downloads.last()).toHaveAttribute("download", "report-page-4.pdf");

  expect(await openedResult(downloads.nth(2))).toEqual({ pages: 1, widths: [220] });
  expect(await archiveEntryCount(page)).toBe(4);
});

test("takes a single page out, and gives one document no archive", async ({ page }) => {
  await page.goto("/tools/split-pdf/");
  await openPdf(page, await numberedPdf(8), "contract.pdf");

  await page.getByLabel("Pages to split out").fill("7");
  await split(page).click();

  await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();
  await expect(page.locator("[data-result-details]")).toContainText("1 PDF · 1 page");

  const download = results(page).getByRole("link");
  await expect(download).toHaveAttribute("download", "contract-page-7.pdf");
  expect(await openedResult(download)).toEqual({ pages: 1, widths: [260] });

  // One file is already one download, so there is nothing to pack.
  await expect(page.getByRole("link", { name: /Download all/ })).toBeHidden();
});

test("takes every page as one range, which is the whole document copied", async ({ page }) => {
  await page.goto("/tools/split-pdf/");
  await openPdf(page, await numberedPdf(3), "notes.pdf");

  await page.getByLabel("Pages to split out").fill("1-3");
  await split(page).click();

  const download = results(page).getByRole("link");
  await expect(download).toHaveAttribute("download", "notes-pages-1-3.pdf");
  expect(await openedResult(download)).toEqual({ pages: 3, widths: [200, 210, 220] });
});

test("refuses a range it cannot read rather than splitting something else", async ({ page }) => {
  await page.goto("/tools/split-pdf/");
  await openPdf(page, await numberedPdf(5), "book.pdf");

  const error = page.locator("[data-error]");
  const pages = page.getByLabel("Pages to split out");

  for (const value of ["one to three", "1..3", "-2", "0"]) {
    await pages.fill(value);
    await split(page).click();

    await expect(error, value).toContainText("between 1 and 5");
    await expect(page.locator("[data-result]"), value).toBeHidden();
  }

  // A page past the end of the document.
  await pages.fill("4-6");
  await split(page).click();
  await expect(error).toContainText("between 1 and 5");

  // A range that runs backwards is refused rather than turned around.
  await pages.fill("4-2");
  await split(page).click();
  await expect(error).toContainText("between 1 and 5");

  // The same range twice would write one file twice.
  await pages.fill("1-2, 1-2");
  await split(page).click();
  await expect(error).toContainText("each one written once");

  // An empty field is not a shorthand for the whole document here.
  await pages.fill("");
  await split(page).click();
  await expect(error).toBeVisible();
  await expect(page.locator("[data-result]")).toBeHidden();

  // And the Gizlet still splits once it is given something it can read.
  await pages.fill("2-3");
  await split(page).click();
  await expect(error).toBeHidden();
  await expect(results(page).getByRole("listitem")).toHaveCount(1);
});

test("explains an encrypted PDF, a corrupt one, and ones with nothing to split", async ({
  page,
}) => {
  await page.goto("/tools/split-pdf/");
  const error = page.locator("[data-error]");

  await openPdf(page, encryptedPdf(), "payslip.pdf");
  await expect(error).toContainText("password-protected");
  await expect(error).toContainText("unlocked copy");
  await expect(error).toContainText("split");
  await expect(page.locator("[data-editor]")).toBeHidden();

  await openPdf(page, Buffer.from("%PDF-1.7\nthis is not a real document"), "damaged.pdf");
  await expect(error).toContainText("not a PDF that can be read");
  await expect(error).toContainText("nothing to split");
  await expect(page.locator("[data-editor]")).toBeHidden();

  await openPdf(page, zeroPagePdf(), "empty.pdf");
  await expect(error).toHaveText("This PDF has no pages, so there is nothing to split.");
  await expect(page.locator("[data-editor]")).toBeHidden();

  // A single page is a document with nothing to split it into.
  await openPdf(page, await numberedPdf(1), "receipt.pdf");
  await expect(error).toHaveText(
    "This PDF has one page, so there is nothing to split it into.",
  );
  await expect(page.locator("[data-editor]")).toBeHidden();

  // A file that is not a PDF at all is refused before anything reads it.
  await page.getByLabel("Select a PDF to split").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(error).toHaveText("notes.txt is not a PDF. Choose a file that ends in .pdf.");

  // The Gizlet is still usable afterwards.
  await openPdf(page, await numberedPdf(2));
  await expect(page.locator("[data-page-total]")).toHaveText("of 2");
  await expect(error).toBeHidden();
});

test("refuses a document longer than it will take apart in one pass", async ({ page }) => {
  await page.goto("/tools/split-pdf/");

  await openPdf(page, await blankPdf(maximumSplitPdfPages + 1), "archive.pdf");

  await expect(page.locator("[data-error]")).toContainText(
    `up to ${maximumSplitPdfPages.toLocaleString()} pages`,
  );
  await expect(page.locator("[data-editor]")).toBeHidden();
});

/**
 * A visitor who opens this page has not yet chosen a PDF, and pdf.js and its
 * worker are over a megabyte between them, so neither may be in what the page
 * hands out on arrival — asserted against the built bundles, not the source.
 */
test("keeps pdf.js out of the page until a PDF is chosen", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  const workspace = await initialScripts(page, "/tools/split-pdf/");

  expect(workspace.length).toBeGreaterThan(0);
  expect(chunksCarryingPdfJs(workspace)).toBe(0);
  expect(requested.filter((url) => url.includes("pdf.worker"))).toEqual([]);

  // And the library arrives only once there is a document to draw.
  await page.goto("/tools/split-pdf/");
  await openPdf(page, await numberedPdf(2));
  await expect(page.locator("[data-page-total]")).toHaveText("of 2");

  await expect
    .poll(() => requested.filter((url) => url.includes("pdf.worker")).length)
    .toBeGreaterThan(0);
});
