import { expect, test, type Locator, type Page } from "@playwright/test";
import { PDFDocument, degrees } from "pdf-lib";

import { maximumPageNumberPdfPages } from "../../src/data/pdf-page-numbers";
import { chunksCarryingPdfJs, initialScripts } from "./support/initial-scripts";
import { encryptedPdf } from "./support/sample-pdf";

const sourceViewer = (page: Page) =>
  page.getByRole("region", { name: "The PDF being numbered" });

const resultViewer = (page: Page) =>
  page.getByRole("region", { name: "The numbered document" });

/** Blank pages, so every dark pixel in a rendered page is a number. */
async function blankPdf(pageCount: number, rotate = 0): Promise<Buffer> {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([300, 400]);

    if (rotate !== 0) page.setRotation(degrees(rotate));
  }

  return Buffer.from(await document.save());
}

const openPdf = (page: Page, buffer: Buffer, name = "report.pdf") =>
  page.getByLabel("Select a PDF to number").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer,
  });

const apply = (page: Page) => page.getByRole("button", { name: "Add the numbers" });

/** Where the ink is on the page a viewer is drawing, counted per quadrant. */
const inkByQuadrant = (scope: Locator) =>
  scope.locator("[data-page-canvas]").evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext("2d");
    if (!context) return { "top-left": 0, "top-right": 0, "bottom-left": 0, "bottom-right": 0 };
    const { data } = context.getImageData(0, 0, element.width, element.height);
    const counts: Record<string, number> = {
      "top-left": 0,
      "top-right": 0,
      "bottom-left": 0,
      "bottom-right": 0,
    };
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] > 240 && data[index + 1] > 240 && data[index + 2] > 240) continue;
      const pixel = index / 4;
      const x = pixel % element.width;
      const y = Math.floor(pixel / element.width);
      counts[`${y < element.height / 2 ? "top" : "bottom"}-${x < element.width / 2 ? "left" : "right"}`] += 1;
    }
    return counts;
  });

const totalInk = (counts: Record<string, number>) =>
  Object.values(counts).reduce((total, count) => total + count, 0);

const busiestQuadrant = (counts: Record<string, number>) =>
  Object.entries(counts).sort(([, left], [, right]) => right - left)[0][0];

const showResultPage = async (page: Page, pageNumber: number) => {
  await resultViewer(page).getByLabel("Go to page").fill(String(pageNumber));
  await resultViewer(page).getByLabel("Go to page").press("Enter");
  await page.waitForTimeout(600);
};

test("writes numbers onto the pages and shows the result", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/tools/pdf-page-numbers/");

  await expect(page).toHaveTitle("PDF Page Numbers | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your PDF stays on this device.",
  );

  await openPdf(page, await blankPdf(3));

  await expect(sourceViewer(page).locator("[data-document-name]")).toContainText("report.pdf");
  await expect(page.locator("[data-plan-summary]")).toHaveText("3 pages numbered.");
  // The preview says what this page will get, before anything is written.
  await expect(page.locator("[data-preview]")).toHaveText("1");

  await apply(page).click();

  await expect(page.getByText("Numbered, page by page.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
    "download",
    "report-numbered.pdf",
  );
  await expect(resultViewer(page).locator("[data-page-total]")).toHaveText("of 3");

  // The page really carries ink now, and it is at the bottom where it was sent.
  await expect
    .poll(async () => totalInk(await inkByQuadrant(resultViewer(page))))
    .toBeGreaterThan(0);
  expect(busiestQuadrant(await inkByQuadrant(resultViewer(page)))).toMatch(/^bottom/);

  // Nothing was posted anywhere: the numbering happens on this device.
  expect(requests).toEqual([]);
});

test("leaves the skipped pages alone and counts from the number it was given", async ({
  page,
}) => {
  await page.goto("/tools/pdf-page-numbers/");
  await openPdf(page, await blankPdf(4));

  await page.getByLabel("Pages to leave unnumbered at the front").fill("1");
  await page.getByLabel("Start numbering at").fill("5");
  await page.getByLabel("Number format").selectOption("page-number-of");

  await expect(page.locator("[data-plan-summary]")).toHaveText(
    "3 pages numbered · 1 left alone.",
  );
  // Page 1 is skipped, so it has nothing to preview and says so.
  await expect(page.locator("[data-preview]")).toBeHidden();
  await expect(page.locator("[data-preview-note]")).toHaveText("Page 1 is not numbered.");

  await sourceViewer(page).getByRole("button", { name: "Next page" }).click();
  // The total counts the numbers printed, not the document's pages: 5, 6, 7.
  await expect(page.locator("[data-preview]")).toHaveText("Page 5 of 7");

  await apply(page).click();
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();

  // The first page came out untouched, and the second carries a number.
  await expect
    .poll(async () => totalInk(await inkByQuadrant(resultViewer(page))))
    .toBe(0);
  await showResultPage(page, 2);
  await expect
    .poll(async () => totalInk(await inkByQuadrant(resultViewer(page))))
    .toBeGreaterThan(0);
});

test("puts the number in the corner it was sent to, on a sideways page too", async ({
  page,
}) => {
  await page.goto("/tools/pdf-page-numbers/");
  await openPdf(page, await blankPdf(1));

  await page.getByLabel("Number position").selectOption("top-right");
  await apply(page).click();
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
  await expect
    .poll(async () => busiestQuadrant(await inkByQuadrant(resultViewer(page))))
    .toBe("top-right");

  // A page carrying its own quarter turn is displayed sideways, and the number
  // still has to be readable in the corner the visitor asked for.
  await page.getByRole("button", { name: "Start over" }).first().click();
  await openPdf(page, await blankPdf(1, 90), "scan.pdf");
  await page.getByLabel("Number position").selectOption("bottom-right");
  await apply(page).click();
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
  await expect
    .poll(async () => busiestQuadrant(await inkByQuadrant(resultViewer(page))))
    .toBe("bottom-right");
});

test("refuses what it cannot number, and says which refusal it is", async ({ page }) => {
  await page.goto("/tools/pdf-page-numbers/");

  await page.getByLabel("Select a PDF to number").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(page.getByRole("alert")).toContainText("is not a PDF");

  await openPdf(page, encryptedPdf(), "locked.pdf");
  await expect(page.getByRole("alert")).toContainText("password-protected");

  await openPdf(page, await blankPdf(3));
  await page.getByLabel("Pages to number").fill("9-12");
  await expect(page.locator("[data-plan-summary]")).toHaveText("No pages numbered.");
  await expect(apply(page)).toBeDisabled();

  await page.getByLabel("Pages to number").fill("");
  await page.getByLabel("Pages to leave unnumbered at the front").fill("3");
  await expect(apply(page)).toBeDisabled();
  await expect(page.locator("[data-preview-note]")).toContainText("Every page is skipped");

  await page.getByLabel("Pages to leave unnumbered at the front").fill("1");
  await expect(apply(page)).toBeEnabled();
});

test("refuses a document longer than it will number in one pass", async ({ page }) => {
  await page.goto("/tools/pdf-page-numbers/");
  await openPdf(page, await blankPdf(maximumPageNumberPdfPages + 1), "long.pdf");

  await expect(page.getByRole("alert")).toContainText(
    `${maximumPageNumberPdfPages.toLocaleString()} pages`,
  );
});

test("keeps pdf.js out of the page until a PDF is chosen", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  const workspace = await initialScripts(page, "/tools/pdf-page-numbers/");

  expect(workspace.length).toBeGreaterThan(0);
  expect(chunksCarryingPdfJs(workspace)).toBe(0);
  expect(requested.filter((url) => url.includes("pdf.worker"))).toEqual([]);

  await page.goto("/tools/pdf-page-numbers/");
  await openPdf(page, await blankPdf(1));
  await expect(sourceViewer(page).locator("[data-page-total]")).toHaveText("of 1");

  await expect
    .poll(() => requested.filter((url) => url.includes("pdf.worker")).length)
    .toBeGreaterThan(0);
});
