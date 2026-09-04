import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * A flow that starts from a document rather than an image.
 *
 * Three published Gizlets declared `pdf-file` as their input before this was
 * buildable, so the graph already allowed these chains and only the workspace
 * refused to offer them.
 */
async function samplePdf(pageCount: number, label: string): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([300, 200]);

    page.drawText(`${label} ${index + 1}`, {
      x: 20,
      y: 100,
      size: 18,
      font,
      color: rgb(0.06, 0.09, 0.16),
    });
  }

  return Buffer.from(await document.save());
}

const asFile = (name: string, buffer: Buffer) => ({
  name,
  mimeType: "application/pdf",
  buffer,
});

const choosePdfs = (page: Page) => page.getByLabel("Choose PDFs for this flow");

const addStep = async (page: Page, toolSlug: string) => {
  await page.getByLabel("Next compatible Gizlet").selectOption(toolSlug);
  await page.getByRole("button", { name: "Add step" }).click();
};

const startPdfFlow = async (page: Page) => {
  await page.goto("/flows/");
  await page.getByLabel("Flow category").selectOption("pdf");
};

test("offers a PDF category, and the Gizlets that declare they read a document", async ({
  page,
}) => {
  await page.goto("/flows/");

  const category = page.getByLabel("Flow category");
  await expect(category.locator("option")).toHaveText(["Images", "PDF"]);
  await expect(category).toHaveValue("images");

  await category.selectOption("pdf");

  // Exactly the published Gizlets whose input is a PDF, in registry order.
  await expect(page.getByLabel("Next compatible Gizlet").locator("option")).toHaveText([
    "Choose the next Gizlet",
    "Merge PDF",
    "PDF to Image",
    "Split PDF",
  ]);

  await expect(page.getByRole("heading", { name: "Your PDF" })).toBeVisible();
  await expect(page.locator("[data-source-details]")).toHaveText("PDF.");
});

test("splits a chosen document and converts every piece, all on this device", async ({
  page,
}) => {
  await startPdfFlow(page);

  await addStep(page, "split-pdf");
  await addStep(page, "pdf-to-jpg");

  await choosePdfs(page).setInputFiles([asFile("report.pdf", await samplePdf(3, "page"))]);

  // The document is read as it is chosen, so its page count is known before a
  // chain is built on it.
  await expect(page.locator("[data-source-details]")).toContainText("report.pdf");

  await page.getByRole("button", { name: "Run flow" }).click();

  const results = page.locator("[data-result-list] > li");
  await expect(results).toHaveCount(3, { timeout: 15000 });
  await expect(page.locator("[data-result-title]")).toContainText("ready");
});

test("merges the documents it was given, and says why one is not a merge yet", async ({
  page,
}) => {
  await startPdfFlow(page);

  await addStep(page, "merge-pdf");

  // A merge takes several documents, so the picker asks for several.
  await expect(choosePdfs(page)).toHaveJSProperty("multiple", true);

  await choosePdfs(page).setInputFiles([asFile("first.pdf", await samplePdf(2, "first"))]);

  // One document is not a merge, and the flow says so rather than leaving a
  // button that does nothing.
  await expect(page.locator("[data-source-details]")).toContainText(
    "One PDF is not a merge",
  );
  await expect(page.getByRole("button", { name: "Run flow" })).toBeDisabled();

  await choosePdfs(page).setInputFiles([asFile("second.pdf", await samplePdf(3, "second"))]);
  await expect(page.locator("[data-source-list] > li")).toHaveCount(2);

  const run = page.getByRole("button", { name: "Run flow" });
  await expect(run).toBeEnabled();
  await run.click();

  await expect(page.locator("[data-result-details]")).toContainText("5 pages", {
    timeout: 15000,
  });
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
});

test("refuses a file that is not a PDF rather than starting a chain on it", async ({
  page,
}) => {
  await startPdfFlow(page);

  await addStep(page, "split-pdf");
  await choosePdfs(page).setInputFiles([
    { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("not a pdf") },
  ]);

  await expect(page.locator("[data-flow-builder] [data-error]")).toContainText("PDF");
});

test("clears a chain the new starting payload could not feed", async ({ page }) => {
  await page.goto("/flows/");

  await addStep(page, "compress-image");
  await expect(page.locator("[data-step-list] > li")).toHaveCount(1);

  await page.getByLabel("Flow category").selectOption("pdf");

  // An image chain cannot read a document, and half of it would be a flow the
  // visitor never assembled.
  await expect(page.locator("[data-step-list] > li")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your PDF" })).toBeVisible();
});

test("shares a PDF flow as a recipe link that names its category", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startPdfFlow(page);

  await addStep(page, "split-pdf");
  await addStep(page, "pdf-to-jpg");
  await page.getByLabel("PDF to Image resolution").selectOption("screen");

  await page.getByRole("button", { name: "Copy recipe link" }).click();

  const recipe = await page.evaluate(() => window.location.hash);
  expect(recipe).toContain("c=pdf");

  await page.goto(`/flows/${recipe}`);

  // The chooser and the chain agree: the link rebuilt a PDF-started flow.
  await expect(page.getByLabel("Flow category")).toHaveValue("pdf");
  await expect(page.getByRole("heading", { name: "Split PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PDF to Image" })).toBeVisible();
  await expect(page.getByLabel("PDF to Image resolution")).toHaveValue("screen");
});

test("keeps pdf.js out of the page when a document is only chosen", async ({
  page,
}) => {
  await startPdfFlow(page);

  await addStep(page, "split-pdf");
  await choosePdfs(page).setInputFiles([asFile("report.pdf", await samplePdf(2, "page"))]);

  await expect(page.locator("[data-source-details]")).toContainText("report.pdf");

  // Reading a page count is pdf-lib's job, so nothing has fetched a renderer.
  const requested = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /pdf.*worker|pdfjs/i.test(name)),
  );

  expect(requested).toEqual([]);
});
