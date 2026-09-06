import { expect, test, type Locator, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

import { maximumOrganizePdfPages } from "../../src/data/organize-pdf";
import { chunksCarryingPdfJs, initialScripts } from "./support/initial-scripts";
import { paintedPixels } from "./support/pdf-canvas";
import { encryptedPdf, zeroPagePdf } from "./support/sample-pdf";

/**
 * The Gizlet shows two of the shared viewer — the document as it arrived and
 * the one that came out — so an assertion about "the viewer" says which.
 */
const sourceViewer = (page: Page) =>
  page.getByRole("region", { name: "The PDF being organized" });

const resultViewer = (page: Page) =>
  page.getByRole("region", { name: "The document this Gizlet produced" });

/**
 * A real PDF whose pages are each a different width.
 *
 * The width is the point: organizing is meant to copy the pages into the order
 * the visitor left them in, and a page's size is something a test can read back
 * out of the document that came out. Page 1 is 200 points across, page 2 is
 * 210, and so on, so measuring an output says which source page sits where
 * rather than only how many pages there are.
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

/** A PDF whose one page already sits sideways, the way a scanner leaves one. */
async function sidewaysPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const page = document.addPage([200, 300]);

  page.setRotation(degrees(90));

  return Buffer.from(await document.save());
}

const openPdf = (page: Page, buffer: Buffer, name = "scan.pdf") =>
  page.getByLabel("Select a PDF to organize").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer,
  });

const cards = (page: Page) =>
  page.getByRole("list", { name: "Pages in the new document" }).getByRole("listitem");

const save = (page: Page) => page.getByRole("button", { name: "Save the organized PDF" });

const download = (page: Page) => page.getByRole("link", { name: /^Download / });

/** The bytes behind the download link, read back through its own object URL. */
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
 * Opens the produced document with pdf-lib and reports what it holds: proof
 * that what the Gizlet wrote is a PDF something else can read, which source
 * pages ended up in it, in what order, and which way up.
 */
async function openedResult(
  link: Locator,
): Promise<{ pages: number; widths: number[]; rotations: number[] }> {
  const bytes = await linkBytes(link);

  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const document = await PDFDocument.load(bytes);

  return {
    pages: document.getPageCount(),
    widths: document.getPages().map((page) => Math.round(page.getWidth())),
    rotations: document.getPages().map((page) => page.getRotation().angle),
  };
}

test("rearranges a local PDF and writes the pages in the order shown, on this device", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/tools/organize-pdf/");

  await expect(page).toHaveTitle("Organize PDF | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your PDF stays on this device.",
  );

  await openPdf(page, await numberedPdf(4), "report.pdf");

  await expect(sourceViewer(page).locator("[data-document-name]")).toContainText("report.pdf");
  await expect(sourceViewer(page).locator("[data-page-total]")).toHaveText("of 4");
  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator("[data-plan-summary]")).toHaveText("4 pages");

  // Page 4 to the front, with the control beside the drag, and page 2 turned.
  await page.getByRole("button", { name: "Move position 4 earlier" }).click();
  await page.getByRole("button", { name: "Move position 3 earlier" }).click();
  await page.getByRole("button", { name: "Move position 2 earlier" }).click();
  await page.getByRole("button", { name: "Turn position 3 right" }).click();

  await expect(page.locator("[data-plan-summary]")).toHaveText("4 pages · 1 turned");
  // A card says where its page came from, so a rearranged document still
  // reports what it was made of.
  await expect(cards(page).nth(0)).toContainText("p.4");
  await expect(cards(page).nth(3)).toContainText("p.3");
  await expect(cards(page).nth(2)).toContainText("Turned right");

  await save(page).click();

  await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();
  await expect(page.locator("[data-result-details]")).toContainText("4 pages · from 4");
  await expect(download(page)).toHaveAttribute("download", "report-organized.pdf");

  // The exported document holds the pages in the visual order — 4, 1, 2, 3 —
  // and page 2, which is third now, carries the turn it was given.
  expect(await openedResult(download(page))).toEqual({
    pages: 4,
    widths: [230, 200, 210, 220],
    rotations: [0, 0, 90, 0],
  });

  // The result is drawn back in the same shared viewer, so the order can be
  // checked before the file is used.
  await expect(resultViewer(page)).toBeVisible();
  await expect(resultViewer(page).locator("[data-page-total]")).toHaveText("of 4");
  await expect.poll(() => paintedPixels(resultViewer(page))).toBeGreaterThan(200);

  // Nothing was posted anywhere: the whole rearrangement happened on this device.
  expect(requests).toEqual([]);
});

test("moves a page by dragging it onto another", async ({ page }) => {
  await page.goto("/tools/organize-pdf/");
  await openPdf(page, await numberedPdf(3));

  await expect(cards(page)).toHaveCount(3);

  // The drag is the reason this Gizlet shows pages rather than numbers.
  await cards(page).nth(2).dragTo(cards(page).nth(0));

  await expect(cards(page).nth(0)).toContainText("p.3");
  await expect(cards(page).nth(1)).toContainText("p.1");
  await expect(cards(page).nth(2)).toContainText("p.2");

  await save(page).click();

  expect(await openedResult(download(page))).toEqual({
    pages: 3,
    widths: [220, 200, 210],
    rotations: [0, 0, 0],
  });
});

test("copies a page, turns the copy on its own, and drops a page", async ({ page }) => {
  await page.goto("/tools/organize-pdf/");
  await openPdf(page, await numberedPdf(3), "notes.pdf");

  await page.getByRole("button", { name: "Copy position 1" }).click();

  await expect(cards(page)).toHaveCount(4);
  await expect(page.locator("[data-plan-summary]")).toHaveText("4 pages · 1 duplicated");
  // The copy lands directly after the page it copies.
  await expect(cards(page).nth(1)).toContainText("p.1");

  // And is a page in its own right from then on: turning it leaves the
  // original where it was.
  await page.getByRole("button", { name: "Turn position 2 right" }).click();
  await expect(cards(page).nth(0)).not.toContainText("Turned right");
  await expect(cards(page).nth(1)).toContainText("Turned right");

  await page.getByRole("button", { name: "Drop position 4" }).click();

  await expect(cards(page)).toHaveCount(3);
  await expect(page.locator("[data-plan-summary]")).toHaveText(
    "3 pages · 1 turned · 1 duplicated · 1 dropped",
  );

  await save(page).click();

  expect(await openedResult(download(page))).toEqual({
    pages: 3,
    widths: [200, 200, 210],
    rotations: [0, 90, 0],
  });
});

test("extracts the ticked pages into a document of their own", async ({ page }) => {
  await page.goto("/tools/organize-pdf/");
  await openPdf(page, await numberedPdf(5), "contract.pdf");

  const extract = page.getByRole("button", { name: "Extract the ticked pages" });

  // Nothing is ticked, so there is nothing to extract yet.
  await expect(extract).toBeDisabled();

  await cards(page).nth(3).getByRole("checkbox").check();
  await cards(page).nth(1).getByRole("checkbox").check();

  await expect(extract).toBeEnabled();
  await extract.click();

  await expect(download(page)).toHaveAttribute("download", "contract-extract.pdf");
  // In the order the pages sit in above rather than the order they were ticked.
  expect(await openedResult(download(page))).toEqual({
    pages: 2,
    widths: [210, 230],
    rotations: [0, 0],
  });

  // The document being organized is left exactly as it was.
  await expect(cards(page)).toHaveCount(5);
  await expect(page.locator("[data-plan-summary]")).toHaveText("5 pages");
});

test("turns, copies and drops every ticked page at once", async ({ page }) => {
  await page.goto("/tools/organize-pdf/");
  await openPdf(page, await numberedPdf(4));

  await page.getByRole("button", { name: "Tick every page" }).click();
  await page.getByRole("button", { name: "Turn ticked right" }).click();

  await expect(page.locator("[data-plan-summary]")).toHaveText("4 pages · 4 turned");

  await page.getByRole("button", { name: "Untick them all" }).click();
  await expect(page.getByRole("button", { name: "Turn ticked right" })).toBeDisabled();

  await cards(page).nth(0).getByRole("checkbox").check();
  await page.getByRole("button", { name: "Drop ticked" }).click();

  await expect(cards(page)).toHaveCount(3);

  await save(page).click();

  expect(await openedResult(download(page))).toEqual({
    pages: 3,
    widths: [210, 220, 230],
    rotations: [90, 90, 90],
  });
});

test("adds a turn to the one a page already had, rather than replacing it", async ({ page }) => {
  await page.goto("/tools/organize-pdf/");
  await openPdf(page, await sidewaysPdf(), "sideways.pdf");

  // The page arrived at 90 degrees, so one turn right puts it at 180 and three
  // put it back upright — which is what makes a sideways scan fixable in one
  // press rather than sending it back where it started.
  await page.getByRole("button", { name: "Turn position 1 right" }).click();
  await save(page).click();

  expect((await openedResult(download(page))).rotations).toEqual([180]);

  await page.getByRole("button", { name: "Turn position 1 left" }).click();
  await page.getByRole("button", { name: "Turn position 1 left" }).click();
  await save(page).click();

  expect((await openedResult(download(page))).rotations).toEqual([0]);
});

test("keeps the last page, because a PDF with no pages is not a PDF", async ({ page }) => {
  await page.goto("/tools/organize-pdf/");
  await openPdf(page, await numberedPdf(2));

  await page.getByRole("button", { name: "Drop position 2" }).click();
  await expect(cards(page)).toHaveCount(1);

  // The one remaining page cannot go, and the control says so rather than
  // being a button that quietly does nothing.
  await expect(page.getByRole("button", { name: "Drop position 1" })).toBeDisabled();

  await page.getByRole("button", { name: "Tick every page" }).click();
  await page.getByRole("button", { name: "Drop ticked" }).click();

  await expect(page.locator("[data-error]")).toContainText("at least one page");
  await expect(cards(page)).toHaveCount(1);

  // And the document it can still write is the one page, upright or turned.
  await save(page).click();
  expect(await openedResult(download(page))).toEqual({
    pages: 1,
    widths: [200],
    rotations: [0],
  });
});

test("explains an encrypted PDF, a corrupt one, and one with nothing in it", async ({ page }) => {
  await page.goto("/tools/organize-pdf/");
  const error = page.locator("[data-error]");

  await openPdf(page, encryptedPdf(), "payslip.pdf");
  await expect(error).toContainText("password-protected");
  await expect(error).toContainText("unlocked copy");
  await expect(error).toContainText("organize");
  await expect(page.locator("[data-editor]")).toBeHidden();

  await openPdf(page, Buffer.from("%PDF-1.7\nthis is not a real document"), "damaged.pdf");
  await expect(error).toContainText("not a PDF that can be read");
  await expect(error).toContainText("nothing to organize");
  await expect(page.locator("[data-editor]")).toBeHidden();

  await openPdf(page, zeroPagePdf(), "empty.pdf");
  await expect(error).toHaveText("This PDF has no pages, so there is nothing to organize.");
  await expect(page.locator("[data-editor]")).toBeHidden();

  // A file that is not a PDF at all is refused before anything reads it.
  await page.getByLabel("Select a PDF to organize").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(error).toHaveText("notes.txt is not a PDF. Choose a file that ends in .pdf.");

  // The Gizlet is still usable afterwards.
  await openPdf(page, await numberedPdf(2));
  await expect(cards(page)).toHaveCount(2);
  await expect(error).toBeHidden();
});

test("refuses a document longer than it will rearrange in one pass", async ({ page }) => {
  await page.goto("/tools/organize-pdf/");

  await openPdf(page, await blankPdf(maximumOrganizePdfPages + 1), "archive.pdf");

  await expect(page.locator("[data-error]")).toContainText(
    `up to ${maximumOrganizePdfPages.toLocaleString()} pages`,
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

  const workspace = await initialScripts(page, "/tools/organize-pdf/");

  expect(workspace.length).toBeGreaterThan(0);
  expect(chunksCarryingPdfJs(workspace)).toBe(0);
  expect(requested.filter((url) => url.includes("pdf.worker"))).toEqual([]);

  // And the library arrives only once there is a document to draw.
  await page.goto("/tools/organize-pdf/");
  await openPdf(page, await numberedPdf(2));
  await expect(sourceViewer(page).locator("[data-page-total]")).toHaveText("of 2");

  await expect
    .poll(() => requested.filter((url) => url.includes("pdf.worker")).length)
    .toBeGreaterThan(0);
});
