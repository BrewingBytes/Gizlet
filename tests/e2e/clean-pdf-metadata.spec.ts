import { expect, test, type Locator, type Page } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";

import { encryptedPdf } from "./support/sample-pdf";

/**
 * A document carrying what a real one carries: the fields a word processor
 * fills in without being asked, one a writer invented, and the XMP packet that
 * records most of it a second time.
 */
async function documentWithMetadata(pageCount = 2): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([300, 400]);

    page.drawText(`Page ${index + 1}`, { x: 40, y: 340, size: 20, font, color: rgb(0.06, 0.09, 0.16) });
  }

  pdf.setTitle("Offer - final v3");
  pdf.setAuthor("Ada Lovelace");
  pdf.setSubject("Numbers");
  pdf.setKeywords(["one", "two"]);
  pdf.setCreator("Microsoft Word");
  pdf.setProducer("Acrobat Distiller 23");
  pdf.setCreationDate(new Date("2024-01-15T10:30:00Z"));
  pdf.setModificationDate(new Date("2024-02-20T08:15:00Z"));

  const info = pdf.context.lookup(pdf.context.trailerInfo.Info, PDFDict);

  info.set(PDFName.of("Company"), PDFString.of("Analytical Engines"));
  pdf.catalog.set(
    PDFName.of("Metadata"),
    pdf.context.register(pdf.context.flateStream("<x:xmpmeta><dc:creator>Ada Lovelace</dc:creator></x:xmpmeta>")),
  );

  return Buffer.from(await pdf.save());
}

/** A document with nothing to clear, which is a case and not an error. */
async function bareDocument(): Promise<Buffer> {
  const pdf = await PDFDocument.create({ updateMetadata: false });

  pdf.addPage([300, 400]);

  return Buffer.from(await pdf.save());
}

const openPdf = (page: Page, buffer: Buffer, name = "offer.pdf") =>
  page.getByLabel("Select a PDF to read").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer,
  });

const download = (page: Page) => page.getByRole("link", { name: /^Download / });

const fieldValue = (page: Page, label: string) =>
  page.locator("[data-field-label]", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd[1]");

/** The produced document, reopened as another reader would — and left as it is. */
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
  // Reading it must not be what puts a producer back into it, which is what
  // this option is for here as much as in the Gizlet itself.
  return PDFDocument.load(bytes, { updateMetadata: false });
}

test("lists what a document is carrying, then clears it, on this device", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/tools/clean-pdf-metadata/");

  await expect(page).toHaveTitle("Clean PDF Metadata | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your PDF and everything it says about you stay on this device.",
  );

  await openPdf(page, await documentWithMetadata());

  // Everything the document says about itself, before anything is changed.
  await expect(page.locator("[data-summary]")).toHaveText(
    "8 named fields and 1 more entry in the document information and an XMP packet.",
  );
  await expect(fieldValue(page, "Author")).toHaveText("Ada Lovelace");
  await expect(fieldValue(page, "Title")).toHaveText("Offer - final v3");
  await expect(fieldValue(page, "Written in")).toHaveText("Microsoft Word");
  // A date is shown as the document recorded it, not shifted into this clock.
  await expect(fieldValue(page, "Created")).toHaveText("15 January 2024 at 10:30 UTC");
  await expect(page.locator("[data-unnamed]")).toContainText("1 more entry");

  // The pages are drawn beside the fields, so the thing that is not changing is
  // in front of the visitor while they decide.
  await expect(page.getByRole("region", { name: "The PDF being read" })).toBeVisible();

  await page.getByRole("button", { name: "Clear the metadata" }).click();

  await expect(page.getByRole("heading", { name: "Your cleaned PDF is ready." })).toBeVisible();
  await expect(download(page)).toHaveAttribute("download", "offer-clean.pdf");
  await expect(page.locator("[data-result-details]")).toContainText(
    "Metadata cleared · 2 pages kept exactly as they were",
  );
  await expect(page.locator("[data-result-check]")).toContainText(
    "it carries no document metadata at all",
  );

  const written = await openedResult(download(page));

  // The fields are gone, including the one nobody named, and the XMP packet
  // that recorded them a second time.
  expect(written.getTitle()).toBeUndefined();
  expect(written.getAuthor()).toBeUndefined();
  expect(written.getSubject()).toBeUndefined();
  expect(written.getKeywords()).toBeUndefined();
  expect(written.getCreator()).toBeUndefined();
  expect(written.getProducer()).toBeUndefined();
  expect(written.getCreationDate()).toBeUndefined();
  expect(written.getModificationDate()).toBeUndefined();
  expect(written.catalog.get(PDFName.of("Metadata"))).toBeUndefined();

  const info = written.context.lookupMaybe(written.context.trailerInfo.Info, PDFDict);
  expect(info ? info.keys().map((key) => key.asString()) : []).toEqual([]);

  // The pages came through untouched.
  expect(written.getPageCount()).toBe(2);
  expect(written.getPages().map((written) => Math.round(written.getWidth()))).toEqual([300, 300]);

  // Nothing was posted anywhere: the name being cleared never left the device.
  expect(requests).toEqual([]);
});

test("says a document with nothing to clear has nothing to clear", async ({ page }) => {
  await page.goto("/tools/clean-pdf-metadata/");
  await openPdf(page, await bareDocument(), "empty.pdf");

  await expect(page.locator("[data-summary]")).toHaveText(
    "This PDF carries no document metadata. There is nothing here to clear.",
  );
  // A button that would produce an identical file is not offered.
  await expect(page.getByRole("button", { name: "Clear the metadata" })).toBeHidden();
});

test("never claims to touch what is on the pages", async ({ page }) => {
  await page.goto("/tools/clean-pdf-metadata/");
  await openPdf(page, await documentWithMetadata(1));

  await expect(page.locator("[data-clean-pdf-tool] .clean-pdf-tool__notice")).toContainText(
    "does not touch what is on the pages",
  );

  const body = await page.locator("main").innerText();

  expect(body).toMatch(/Redaction is a different job/i);
  expect(body).not.toMatch(/removes? (all|any) hidden (text|content)/i);
});

test("refuses a file it cannot read, in its own words", async ({ page }) => {
  await page.goto("/tools/clean-pdf-metadata/");

  await page.getByLabel("Select a PDF to read").setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(page.getByRole("alert")).toContainText("not a PDF");

  await openPdf(page, encryptedPdf(), "protected.pdf");
  await expect(page.getByRole("alert")).toContainText("password-protected");
});

test("clears the metadata of a document a flow produced", async ({ page }) => {
  await page.goto("/flows/");
  await page.getByLabel("Flow category").selectOption("pdf");

  await page.getByLabel("Next compatible Gizlet").selectOption("clean-pdf-metadata");
  await page.getByRole("button", { name: "Add step" }).click();

  await page.getByLabel("Choose PDFs for this flow").setInputFiles({
    name: "offer.pdf",
    mimeType: "application/pdf",
    buffer: await documentWithMetadata(2),
  });
  await page.getByRole("button", { name: "Run flow" }).click();

  const link = page.getByRole("link", { name: "Download PDF" });
  await expect(link).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-result-details]")).toContainText("2 pages");

  const written = await openedResult(link);

  expect(written.getAuthor()).toBeUndefined();
  expect(written.getProducer()).toBeUndefined();
  expect(written.getPageCount()).toBe(2);
});
