import { expect, test, type Locator, type Page } from "@playwright/test";
import { PDFDocument, degrees } from "pdf-lib";

import { maximumWatermarkPdfPages } from "../../src/data/watermark-pdf";
import { chunksCarryingPdfJs, initialScripts } from "./support/initial-scripts";
import { encryptedPdf, zeroPagePdf } from "./support/sample-pdf";

const sourceViewer = (page: Page) =>
  page.getByRole("region", { name: "The PDF being watermarked" });

const resultViewer = (page: Page) =>
  page.getByRole("region", { name: "The watermarked document" });

/**
 * Blank pages, so every dark pixel in a rendered page is the mark and nothing
 * else. `rotate` gives a page the rotation a scanner would have left on it.
 */
async function blankPdf(pageCount: number, rotate = 0): Promise<Buffer> {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([300, 400]);

    if (rotate !== 0) page.setRotation(degrees(rotate));
  }

  return Buffer.from(await document.save());
}

/**
 * The 1x1 PNG the image specs already use, which is a picture this browser
 * really decodes. Its size does not matter: a picture mark is sized as a share
 * of the page rather than by its own pixels.
 */
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
  "base64",
);

const openPdf = (page: Page, buffer: Buffer, name = "contract.pdf") =>
  page.getByLabel("Select a PDF to watermark").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer,
  });

const apply = (page: Page) => page.getByRole("button", { name: "Add the watermark" });

const download = (page: Page) => page.getByRole("link", { name: /^Download / });

/** A slider set the way a visitor sets one, with the input the page listens for. */
const setSlider = (field: Locator, value: number) =>
  field.evaluate((element, next) => {
    const input = element as HTMLInputElement;
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);

/**
 * Where the ink is on the page currently drawn in a viewer, as a count per
 * quadrant. The source pages are blank, so this is the watermark and nothing
 * else — which is how a test can tell "bottom left" from "off the page".
 */
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

/** The corner holding the most ink, which is where the mark actually landed. */
const busiestQuadrant = (counts: Record<string, number>) =>
  Object.entries(counts).sort(([, left], [, right]) => right - left)[0][0];

const showResultPage = async (page: Page, pageNumber: number) => {
  await resultViewer(page).getByLabel("Go to page").fill(String(pageNumber));
  await resultViewer(page).getByLabel("Go to page").press("Enter");
  await page.waitForTimeout(600);
};

/**
 * The corner the mark landed in, waited for rather than sampled once: the
 * result panel appears before its preview has been drawn, so reading the canvas
 * immediately reads whatever was there a moment ago.
 */
const expectMarkIn = async (page: Page, corner: string, because: string) => {
  await expect
    .poll(async () => busiestQuadrant(await inkByQuadrant(resultViewer(page))), { message: because })
    .toBe(corner);
};

/** The produced document, reopened with pdf-lib as another reader would. */
async function openedResult(link: Locator): Promise<PDFDocument> {
  const base64 = await link.evaluate(async (element) => {
    const response = await fetch((element as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";

    for (const byte of bytes) binary += String.fromCharCode(byte);

    return btoa(binary);
  });
  const bytes = Buffer.from(base64, "base64");

  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  return PDFDocument.load(bytes);
}

test("stamps text onto every page, on this device", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/tools/watermark-pdf/");

  await expect(page).toHaveTitle("Watermark PDF | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your PDF stays on this device.",
  );

  await openPdf(page, await blankPdf(3));

  await expect(sourceViewer(page).locator("[data-page-total]")).toHaveText("of 3");
  await expect(page.locator("[data-pages-summary]")).toHaveText("Every page · 3 pages");

  // The mark is shown over the page before anything is written.
  await expect(page.locator("[data-preview-text]")).toBeVisible();
  await expect(page.locator("[data-preview-text]")).toHaveText("DRAFT");

  await page.getByLabel("Watermark text", { exact: true }).fill("CONFIDENTIAL");
  await setSlider(page.getByLabel("Watermark strength"), 100);
  await expect(page.locator("[data-preview-text]")).toHaveText("CONFIDENTIAL");

  await apply(page).click();

  await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();
  await expect(download(page)).toHaveAttribute("download", "contract-watermarked.pdf");
  await expect(page.locator("[data-result-details]")).toContainText("Every page · 3 pages");

  const written = await openedResult(download(page));
  expect(written.getPageCount()).toBe(3);

  // Every page came back marked, and the pages themselves are still the size
  // they were: the mark was drawn onto them rather than the pages rebuilt.
  await expect(resultViewer(page)).toBeVisible();
  expect(written.getPages().map((written) => Math.round(written.getWidth()))).toEqual([300, 300, 300]);

  for (const pageNumber of [1, 2, 3]) {
    await showResultPage(page, pageNumber);
    await expect
      .poll(async () => totalInk(await inkByQuadrant(resultViewer(page))), { message: `page ${pageNumber}` })
      .toBeGreaterThan(200);
  }

  // Nothing was posted anywhere: the whole stamp happened on this device.
  expect(requests).toEqual([]);
});

test("stamps only the pages it was given", async ({ page }) => {
  await page.goto("/tools/watermark-pdf/");
  await openPdf(page, await blankPdf(4), "report.pdf");

  await setSlider(page.getByLabel("Watermark strength"), 100);
  await page.getByLabel("Pages to watermark").fill("1, 3");

  await expect(page.locator("[data-pages-summary]")).toHaveText("2 of 4 pages");
  // Page 1 is in the selection, so the mark is shown over it.
  await expect(page.locator("[data-preview-text]")).toBeVisible();

  // Page 2 is not, and the preview says so rather than showing a mark that is
  // not going to be there.
  await sourceViewer(page).getByLabel("Go to page").fill("2");
  await sourceViewer(page).getByLabel("Go to page").press("Enter");
  await expect(page.locator("[data-preview-note]")).toContainText("not in the selection");
  await expect(page.locator("[data-preview]")).toBeHidden();

  await apply(page).click();
  await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();

  await showResultPage(page, 1);
  await expect.poll(async () => totalInk(await inkByQuadrant(resultViewer(page)))).toBeGreaterThan(200);

  // Page 2 was not in the selection, so it came back exactly as it went in.
  await showResultPage(page, 2);
  expect(totalInk(await inkByQuadrant(resultViewer(page)))).toBe(0);

  await showResultPage(page, 3);
  await expect.poll(async () => totalInk(await inkByQuadrant(resultViewer(page)))).toBeGreaterThan(200);
});

test("puts the mark in the corner it was told to, and turns it", async ({ page }) => {
  await page.goto("/tools/watermark-pdf/");
  await openPdf(page, await blankPdf(1));

  await setSlider(page.getByLabel("Watermark strength"), 100);
  await setSlider(page.getByLabel("Watermark turn"), 0);
  await page.getByLabel("Watermark text size").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "24";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByLabel("Watermark position").selectOption("bottom-left");
  await apply(page).click();

  await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();
  await expectMarkIn(page, "bottom-left", "placed bottom left");

  // The same request, the other corner.
  await page.getByLabel("Watermark position").selectOption("top-right");
  await apply(page).click();
  await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();
  await expectMarkIn(page, "top-right", "placed top right");
});

/**
 * The reason the placement carries a page-rotation correction at all. A page
 * that arrives sideways — from a scanner, or from Organize PDF — is displayed
 * with its sides swapped, and a mark put in the corner the visitor is looking
 * at has to be drawn somewhere else entirely on the page itself.
 */
test("lands in the visible corner of a page that carries its own rotation", async ({ page }) => {
  for (const rotation of [90, 180, 270]) {
    await page.goto("/tools/watermark-pdf/");
    await openPdf(page, await blankPdf(1, rotation), `sideways-${rotation}.pdf`);

    await setSlider(page.getByLabel("Watermark strength"), 100);
    await setSlider(page.getByLabel("Watermark turn"), 0);
    await page.getByLabel("Watermark text size").evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = "24";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.getByLabel("Watermark position").selectOption("bottom-left");
    await apply(page).click();

    await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();
    await expectMarkIn(page, "bottom-left", `page rotated ${rotation}`);
  }
});

test("stamps a picture from the device, sized against the page", async ({ page }) => {
  await page.goto("/tools/watermark-pdf/");
  await openPdf(page, await blankPdf(1), "invoice.pdf");

  await page.getByLabel("Watermark kind").selectOption("image");

  // The text controls give way to the picture ones.
  await expect(page.getByLabel("Watermark text", { exact: true })).toBeHidden();
  await expect(page.getByLabel("Watermark picture width")).toBeVisible();

  await page.getByLabel("Watermark picture", { exact: true }).setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  await expect(page.locator("[data-preview-image]")).toBeVisible();

  await setSlider(page.getByLabel("Watermark strength"), 100);
  await setSlider(page.getByLabel("Watermark picture width"), 40);
  await page.getByLabel("Watermark position").selectOption("top-left");
  await apply(page).click();

  await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();
  await expect(download(page)).toHaveAttribute("download", "invoice-watermarked.pdf");
  await expectMarkIn(page, "top-left", "a picture placed top left");
});

test("refuses what it cannot stamp, and says what to do about it", async ({ page }) => {
  await page.goto("/tools/watermark-pdf/");
  const error = page.locator("[data-error]");

  await openPdf(page, encryptedPdf(), "payslip.pdf");
  await expect(error).toContainText("password-protected");
  await expect(error).toContainText("unlocked copy");
  await expect(page.locator("[data-editor]")).toBeHidden();

  await openPdf(page, Buffer.from("%PDF-1.7\nthis is not a real document"), "damaged.pdf");
  await expect(error).toContainText("not a PDF that can be read");
  await expect(page.locator("[data-editor]")).toBeHidden();

  await openPdf(page, zeroPagePdf(), "empty.pdf");
  await expect(error).toHaveText("This PDF has no pages, so there is nothing to watermark.");

  await page.getByLabel("Select a PDF to watermark").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(error).toHaveText("notes.txt is not a PDF. Choose a file that ends in .pdf.");

  // A readable document, and the two things it can still refuse.
  await openPdf(page, await blankPdf(3));
  await expect(error).toBeHidden();

  await page.getByLabel("Watermark text", { exact: true }).fill("   ");
  await apply(page).click();
  await expect(error).toHaveText("Write the text you want stamped on the pages.");
  await expect(page.locator("[data-result]")).toBeHidden();

  await page.getByLabel("Watermark text", { exact: true }).fill("DRAFT");
  await page.getByLabel("Pages to watermark").fill("4-9");
  await apply(page).click();
  await expect(error).toContainText("between 1 and 3");
  await expect(page.locator("[data-result]")).toBeHidden();

  // And it still stamps once it is given something it can read.
  await page.getByLabel("Pages to watermark").fill("2");
  await apply(page).click();
  await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();
});

test("refuses a document longer than it will stamp in one pass", async ({ page }) => {
  await page.goto("/tools/watermark-pdf/");

  await openPdf(page, await blankPdf(maximumWatermarkPdfPages + 1), "archive.pdf");

  await expect(page.locator("[data-error]")).toContainText(
    `up to ${maximumWatermarkPdfPages.toLocaleString()} pages`,
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

  const workspace = await initialScripts(page, "/tools/watermark-pdf/");

  expect(workspace.length).toBeGreaterThan(0);
  expect(chunksCarryingPdfJs(workspace)).toBe(0);
  expect(requested.filter((url) => url.includes("pdf.worker"))).toEqual([]);

  await page.goto("/tools/watermark-pdf/");
  await openPdf(page, await blankPdf(2));
  await expect(sourceViewer(page).locator("[data-page-total]")).toHaveText("of 2");

  await expect
    .poll(() => requested.filter((url) => url.includes("pdf.worker")).length)
    .toBeGreaterThan(0);
});
