import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { maximumMergedPages } from "../../src/data/merge-pdf";
import { paintedAspect, paintedPixels } from "./support/pdf-canvas";

/**
 * Real PDFs, built with the library the PDF Gizlets already ship, so the merge
 * is tested against documents rather than fixture blobs.
 *
 * One is landscape and one is portrait, which is what lets a test tell whose
 * pages came out first: the shape of the drawn page is the order.
 */
async function samplePdf(
  pageCount: number,
  shape: "landscape" | "portrait",
): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const size: [number, number] = shape === "landscape" ? [400, 200] : [200, 400];

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage(size);

    page.drawText(`${shape} ${index + 1}`, {
      x: 20,
      y: 100,
      size: 18,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 40 + index * 20,
      height: 40,
      color: rgb(0.96, 0.65, 0),
    });
  }

  return Buffer.from(await document.save());
}

/** A PDF of blank pages, for the counts the memory guard is about. */
async function blankPdf(pageCount: number): Promise<Buffer> {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) document.addPage([200, 200]);

  return Buffer.from(await document.save());
}

const asFile = (name: string, buffer: Buffer) => ({
  name,
  mimeType: "application/pdf",
  buffer,
});

const choosePdfs = (page: Page, files: readonly { name: string; mimeType: string; buffer: Buffer }[]) =>
  page.getByLabel("Select PDFs to merge").setInputFiles([...files]);

test("joins chosen PDFs into one local document in the order set on the page", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/tools/merge-pdf/");

  await expect(page).toHaveTitle("Merge PDF | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your PDFs stay on this device.",
  );
  await expect(page.getByRole("button", { name: "Merge the PDFs" })).toBeHidden();

  await choosePdfs(page, [
    asFile("wide.pdf", await samplePdf(1, "landscape")),
    asFile("tall.pdf", await samplePdf(2, "portrait")),
  ]);

  const documents = page.getByRole("list", { name: "PDFs in the merge" });
  await expect(documents.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("2 PDFs · 3 pages · up to 20")).toBeVisible();
  await expect(documents.getByRole("listitem").first()).toContainText("wide.pdf");
  await expect(documents.getByRole("listitem").first()).toContainText("1 page");
  await expect(documents.getByRole("listitem").nth(1)).toContainText("2 pages");

  await page.getByRole("button", { name: "Merge the PDFs" }).click();

  await expect(page.locator("[data-result-details]")).toContainText("2 PDFs · 3 pages");
  const download = page.getByRole("link", { name: "Download PDF" });
  await expect(download).toHaveAttribute("download", "wide-merged.pdf");

  // The merged document is genuinely a document: it draws, it has every page,
  // and the page it opens on is the one the top of the list promised.
  await expect(page.locator("[data-page-total]")).toHaveText("of 3");
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(0);
  await expect.poll(() => paintedAspect(page)).toBeGreaterThan(1);

  const pageField = page.getByLabel("Go to page");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(pageField).toHaveValue("2");
  await expect.poll(() => paintedAspect(page)).toBeLessThan(1);

  const downloadPromise = page.waitForEvent("download");
  await download.click();
  expect((await downloadPromise).suggestedFilename()).toBe("wide-merged.pdf");

  // Nothing was posted anywhere: the merge happens on this device.
  expect(requests).toEqual([]);
});

test("rebuilds the document when the order changes", async ({ page }) => {
  await page.goto("/tools/merge-pdf/");
  await choosePdfs(page, [
    asFile("wide.pdf", await samplePdf(1, "landscape")),
    asFile("tall.pdf", await samplePdf(2, "portrait")),
  ]);

  const documents = page.getByRole("list", { name: "PDFs in the merge" });
  await page.getByRole("button", { name: "Move tall.pdf up" }).click();
  await expect(documents.getByRole("listitem").first()).toContainText("tall.pdf");
  await expect(page.getByRole("button", { name: "Move tall.pdf up" })).toBeDisabled();

  await page.getByRole("button", { name: "Merge the PDFs" }).click();

  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
    "download",
    "tall-merged.pdf",
  );
  // Reordering has to change the document, not only the list.
  await expect.poll(() => paintedAspect(page)).toBeLessThan(1);

  await page.getByRole("button", { name: "Start over" }).first().click();
  await expect(page.getByRole("button", { name: "Merge the PDFs" })).toBeHidden();
});

test("will not merge one PDF, and says why rather than leaving a dead button", async ({
  page,
}) => {
  await page.goto("/tools/merge-pdf/");
  await choosePdfs(page, [asFile("only.pdf", await samplePdf(1, "portrait"))]);

  await expect(page.getByText("One PDF is not a merge. Add another one to join it to.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Merge the PDFs" })).toBeDisabled();

  await choosePdfs(page, [asFile("second.pdf", await samplePdf(1, "landscape"))]);

  await expect(
    page.getByText("One PDF is not a merge. Add another one to join it to."),
  ).toBeHidden();
  await expect(page.getByRole("button", { name: "Merge the PDFs" })).toBeEnabled();
});

/**
 * A hand-written PDF whose trailer names an /Encrypt dictionary. It is the
 * smallest thing that is genuinely an encrypted document as far as a PDF
 * library is concerned, and pdf-lib cannot write one.
 */
const encryptedPdf = () =>
  Buffer.from(
    [
      "%PDF-1.4",
      "1 0 obj",
      "<< /Type /Catalog /Pages 2 0 R >>",
      "endobj",
      "2 0 obj",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "endobj",
      "3 0 obj",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
      "endobj",
      "4 0 obj",
      "<< /Filter /Standard /V 1 /R 2 /O <0102> /U <0304> /P -1 >>",
      "endobj",
      "trailer",
      "<< /Size 5 /Root 1 0 R /Encrypt 4 0 R >>",
      "%%EOF",
      "",
    ].join("\n"),
    "latin1",
  );

test("refuses a password-protected PDF by name and keeps the rest of the list", async ({
  page,
}) => {
  await page.goto("/tools/merge-pdf/");
  await choosePdfs(page, [asFile("statement.pdf", await samplePdf(1, "portrait"))]);
  await choosePdfs(page, [asFile("payslip.pdf", encryptedPdf())]);

  const error = page.getByRole("alert");
  await expect(error).toContainText("payslip.pdf is password-protected");
  await expect(error).toContainText("save an unlocked copy");

  // The document that was fine is still in the list, and the refused one is not.
  const documents = page.getByRole("list", { name: "PDFs in the merge" });
  await expect(documents.getByRole("listitem")).toHaveCount(1);
  await expect(documents.getByRole("listitem").first()).toContainText("statement.pdf");
});

test("refuses a file that is a PDF in name only", async ({ page }) => {
  await page.goto("/tools/merge-pdf/");
  await choosePdfs(page, [
    asFile("statement.pdf", await samplePdf(1, "portrait")),
    asFile("holiday.pdf", Buffer.from("this was a photograph until somebody renamed it")),
  ]);

  const error = page.getByRole("alert");
  await expect(error).toContainText("holiday.pdf could not be read as a PDF");
  await expect(error).toContainText("renamed from another format");
  await expect(page.getByRole("button", { name: "Merge the PDFs" })).toBeHidden();
});

test("refuses a combined page count past the memory guard", async ({ page }) => {
  const half = Math.ceil(maximumMergedPages / 2) + 1;

  await page.goto("/tools/merge-pdf/");
  await choosePdfs(page, [
    asFile("first-half.pdf", await blankPdf(half)),
    asFile("second-half.pdf", await blankPdf(half)),
  ]);

  await expect(page.getByRole("alert")).toContainText(
    `A merged document holds up to ${maximumMergedPages.toLocaleString()} pages here`,
  );
  await expect(page.getByRole("button", { name: "Merge the PDFs" })).toBeHidden();

  // Either document on its own is inside the guard, so it is the merge the
  // limit is about rather than the file that happened to cross it.
  await choosePdfs(page, [asFile("first-half.pdf", await blankPdf(half))]);
  await expect(page.getByText(`1 PDF · ${half} pages · up to 20`)).toBeVisible();
});
