import { expect, test, type Page } from "@playwright/test";

import { pdfZoomLevels } from "../../src/data/pdf-viewer";
import { paintedPixels } from "./support/pdf-canvas";
import { samplePdf } from "./support/sample-pdf";

const openPdf = async (page: Page, buffer: Buffer, name = "sample.pdf") => {
  await page.getByLabel("Select a PDF to open").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer,
  });
};

test("opens a local PDF and draws its pages on this device", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/tools/pdf-viewer/");

  await expect(page).toHaveTitle("PDF Viewer | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your PDF stays on this device.",
  );

  await openPdf(page, await samplePdf(3), "statement.pdf");

  await expect(page.locator("[data-document-name]")).toContainText("statement.pdf");
  await expect(page.locator("[data-document-name]")).toContainText("3 pages");
  await expect(page.locator("[data-page-total]")).toHaveText("of 3");
  await expect(page.getByLabel("Go to page")).toHaveValue("1");

  // The page is genuinely painted, not merely present.
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(500);

  // A thumbnail per page, and the current one is marked.
  const pageThumbnails = page.getByRole("navigation", { name: "Pages" });
  await expect(pageThumbnails.getByRole("button")).toHaveCount(3);
  await expect(pageThumbnails.getByRole("button").first()).toHaveAttribute(
    "aria-current",
    "true",
  );

  // Nothing was posted anywhere: reading happens on this device.
  expect(requests).toEqual([]);
});

test("moves between pages by arrow, by number, and by thumbnail", async ({ page }) => {
  await page.goto("/tools/pdf-viewer/");
  await openPdf(page, await samplePdf(4));
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(500);

  const pageField = page.getByLabel("Go to page");
  const previous = page.getByRole("button", { name: "Previous page" });
  const next = page.getByRole("button", { name: "Next page" });

  // On the first page there is nowhere back to go.
  await expect(previous).toBeDisabled();

  const firstPage = await paintedPixels(page);
  await next.click();
  await expect(pageField).toHaveValue("2");
  await expect(previous).toBeEnabled();
  // Each page paints a different amount, so this proves a redraw happened.
  await expect.poll(() => paintedPixels(page)).not.toBe(firstPage);

  await pageField.fill("4");
  await pageField.press("Enter");
  await expect(pageField).toHaveValue("4");
  await expect(next).toBeDisabled();

  // A page that is not in the document restores the field rather than jumping.
  await pageField.fill("99");
  await pageField.press("Enter");
  await expect(pageField).toHaveValue("4");

  await page.getByRole("button", { name: "Page 2 of 4" }).click();
  await expect(pageField).toHaveValue("2");
  await expect(
    page.getByRole("navigation", { name: "Pages" }).getByRole("button").nth(1),
  ).toHaveAttribute("aria-current", "true");
});

test("redraws the page at each zoom step and stops at both ends", async ({ page }) => {
  await page.goto("/tools/pdf-viewer/");
  await openPdf(page, await samplePdf(1));
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(500);

  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  const level = page.locator("[data-zoom-level]");
  const canvasWidth = () =>
    page.locator("[data-page-canvas]").evaluate((canvas) => (canvas as HTMLCanvasElement).width);

  await expect(level).toHaveText("100%");
  const naturalWidth = await canvasWidth();

  await zoomIn.click();
  await expect(level).toHaveText("125%");
  // Zoom re-renders the page larger rather than scaling a picture of it.
  await expect.poll(canvasWidth).toBeGreaterThan(naturalWidth);

  // Bounded by the number of levels, and stops as soon as the control does,
  // so the test asserts where the range ends instead of assuming it.
  for (let step = 0; step < pdfZoomLevels.length && (await zoomIn.isEnabled()); step += 1) {
    await zoomIn.click();
  }
  await expect(level).toHaveText("300%");
  await expect(zoomIn).toBeDisabled();

  for (let step = 0; step < pdfZoomLevels.length && (await zoomOut.isEnabled()); step += 1) {
    await zoomOut.click();
  }
  await expect(level).toHaveText("50%");
  await expect(zoomOut).toBeDisabled();
});

test("refuses a file that is not a PDF and one it cannot decode", async ({ page }) => {
  await page.goto("/tools/pdf-viewer/");

  await page.getByLabel("Select a PDF to open").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "notes.txt is not a PDF. Choose a file that ends in .pdf.",
  );
  await expect(page.locator("[data-reader]")).toBeHidden();

  // Named .pdf but not a PDF: this one only fails once pdf.js looks at it.
  await page.getByLabel("Select a PDF to open").setInputFiles({
    name: "damaged.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nthis is not a real document"),
  });
  await expect(page.getByRole("alert")).toContainText("not a PDF that can be read");
  await expect(page.locator("[data-reader]")).toBeHidden();

  // The Gizlet is still usable afterwards.
  await openPdf(page, await samplePdf(2));
  await expect(page.locator("[data-page-total]")).toHaveText("of 2");
  await expect(page.getByRole("alert")).toBeHidden();
});
