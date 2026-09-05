import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { fixedPdfPageSizes } from "../../src/data/jpg-to-pdf";
import { chunksCarryingPdfJs, initialScripts } from "./support/initial-scripts";
import { paintedAspect, paintedPixels } from "./support/pdf-canvas";

/**
 * The same two tiny JPEGs the Image to PDF workspace uses: one wider than it is
 * tall, one taller than it is wide, so the assembled document proves the page
 * order and the automatic orientation.
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

const chooseImages = (page: Page) =>
  page.getByLabel("Choose images for this flow");

const addStep = async (page: Page, toolSlug: string) => {
  await page.getByLabel("Next compatible Gizlet").selectOption(toolSlug);
  await page.getByRole("button", { name: "Add step" }).click();
};

test("offers a block only when it accepts what the block before it produces", async ({
  page,
}) => {
  await page.goto("/flows/");

  const nextTool = page.getByLabel("Next compatible Gizlet");
  const options = nextTool.locator("option");

  // From an image, every Gizlet that reads an image is offered — including the
  // one that makes a PDF. The JSON Gizlets never are.
  await expect(options).toHaveText([
    "Choose the next Gizlet",
    "Compress Image",
    "Resize Image",
    "Convert Image",
    "Image to PDF",
    "Crop Image",
    "Collage Maker",
    "Rotate & Flip Image",
  ]);

  await addStep(page, "jpg-to-pdf");

  // A PDF is followed by exactly the Gizlets that declare they read one: the
  // converter and the splitter. Merge PDF is not among them, because the one
  // document the block before it made is already a single payload, and a block
  // that would only look at what the result panel already shows is not offered.
  await expect(options).toHaveText([
    "Choose the next Gizlet",
    "PDF to Image",
    "Split PDF",
  ]);

  await addStep(page, "pdf-to-jpg");

  // And a Gizlet that turns a PDF back into images reopens the image half of
  // the graph, which no adjacency list was edited to allow.
  await expect(options).toHaveText([
    "Choose the next Gizlet",
    "Compress Image",
    "Resize Image",
    "Convert Image",
    "Image to PDF",
    "Crop Image",
    "Collage Maker",
    "Rotate & Flip Image",
  ]);
});

test("turns several local images into one PDF in the order shown", async ({
  page,
}) => {
  await page.goto("/flows/");

  // The source takes one image until a combining block asks for more.
  await expect(chooseImages(page)).not.toHaveJSProperty("multiple", true);
  await chooseImages(page).setInputFiles(asFile("wide.jpg", wideJpeg));

  await addStep(page, "jpg-to-pdf");
  await expect(chooseImages(page)).toHaveJSProperty("multiple", true);
  await expect(page.getByRole("heading", { name: "Your images" })).toBeVisible();
  // With no image step in the chain there is no image encoding to choose.
  await expect(page.getByLabel("Final output format")).toBeHidden();

  await chooseImages(page).setInputFiles([
    asFile("wide.jpg", wideJpeg),
    asFile("tall.jpg", tallJpeg),
  ]);

  const rows = page.getByRole("list", { name: "Starting files" });
  await expect(rows.getByRole("listitem")).toHaveCount(3);
  await expect(rows.getByRole("listitem").nth(2)).toContainText("tall.jpg");

  // Reordering the starting images has to reorder the pages.
  await page.getByRole("button", { name: "Move tall.jpg up" }).click();
  await page.getByRole("button", { name: "Move tall.jpg up" }).click();
  await expect(rows.getByRole("listitem").first()).toContainText("tall.jpg");

  await page.getByRole("button", { name: "Remove wide.jpg" }).first().click();
  await expect(rows.getByRole("listitem")).toHaveCount(2);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Run flow" }).click();

  await expect(page.locator("[data-status]")).toContainText("PDF is ready");
  await expect(
    page.getByRole("heading", { name: "Your PDF is ready." }),
  ).toBeVisible();
  await expect(page.locator("[data-result-details]")).toContainText("2 pages · A4");
  // The result is a document, so the image element steps aside for the pages.
  await expect(page.getByAltText("Final flow result")).toBeHidden();
  await expect(page.locator("[data-preview]")).toBeVisible();

  const download = page.getByRole("link", { name: "Download PDF" });
  await expect(download).toHaveAttribute("download", "tall-and-1-more.pdf");
  await download.click();

  const saved = await downloadPromise;
  const bytes = await readFile(await saved.path());
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);

  // Page one is the tall image and stays upright; page two is the wide one and
  // turns the sheet, which is the page order the list showed.
  const [first, second] = pdf.getPages().map((pdfPage) => pdfPage.getSize());
  expect(first.width).toBeCloseTo(fixedPdfPageSizes.a4.width, 2);
  expect(second.width).toBeCloseTo(fixedPdfPageSizes.a4.height, 2);
});

test("shows the pages of the PDF a flow made, before anything is downloaded", async ({
  page,
}) => {
  await page.goto("/flows/");

  await addStep(page, "jpg-to-pdf");
  await chooseImages(page).setInputFiles([
    asFile("tall.jpg", tallJpeg),
    asFile("wide.jpg", wideJpeg),
  ]);
  await page.getByRole("button", { name: "Run flow" }).click();

  // The summary and the download are still what they were; the preview is
  // added to the result panel rather than standing in for either.
  await expect(page.locator("[data-result-details]")).toContainText("2 pages · A4");
  const download = page.getByRole("link", { name: "Download PDF" });
  await expect(download).toBeVisible();

  const pageField = page.getByLabel("Go to page");
  await expect(page.locator("[data-preview]")).toBeVisible();
  await expect(page.locator("[data-page-total]")).toHaveText("of 2");
  await expect(pageField).toHaveValue("1");

  // A page that was genuinely drawn, and drawn from the document the flow
  // produced: automatic orientation turned the second sheet, so page one is
  // upright and page two is on its side. Re-rendering the starting images
  // could not produce that.
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

  const pdf = await PDFDocument.load(await readFile(await saved.path()));
  expect(pdf.getPageCount()).toBe(2);

  // Clearing the result takes the preview with it.
  await page.getByRole("button", { name: "Clear result" }).click();
  await expect(page.locator("[data-preview]")).toBeHidden();
});

test("runs every image step on every page before combining them", async ({
  page,
}) => {
  await page.goto("/flows/");

  await chooseImages(page).setInputFiles(asFile("wide.jpg", wideJpeg));
  await addStep(page, "resize-image");
  await page.getByLabel("Resize Image width").fill("240");
  await page.getByLabel("Resize Image height").fill("120");
  await addStep(page, "jpg-to-pdf");

  // The chain still re-encodes images, so the format control stays — renamed,
  // because the format is now the one used inside the document.
  await expect(page.getByLabel("Page image format")).toBeVisible();
  await page.getByLabel("Image to PDF page size").selectOption("letter");

  await chooseImages(page).setInputFiles([
    asFile("wide.jpg", wideJpeg),
    asFile("tall.jpg", tallJpeg),
  ]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Run flow" }).click();
  await expect(page.locator("[data-result-details]")).toContainText(
    "3 pages · US Letter",
  );
  await page.getByRole("link", { name: "Download PDF" }).click();

  const pdf = await PDFDocument.load(await readFile(await (await downloadPromise).path()));

  expect(pdf.getPageCount()).toBe(3);
  // Every page was resized to 240x120 first, so auto orientation turned all
  // three sheets — including the one whose source was portrait.
  for (const size of pdf.getPages().map((pdfPage) => pdfPage.getSize())) {
    expect(size.width).toBeCloseTo(fixedPdfPageSizes.letter.height, 2);
    expect(size.height).toBeCloseTo(fixedPdfPageSizes.letter.width, 2);
  }
});

test("shares a PDF flow as a settings-only recipe link and reopens it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/flows/");

  await addStep(page, "resize-image");
  await page.getByLabel("Resize Image width").fill("300");
  await page.getByLabel("Resize Image height").fill("150");
  await addStep(page, "jpg-to-pdf");
  await page.getByLabel("Image to PDF page size").selectOption("legal");
  await page.getByLabel("Image to PDF orientation").selectOption("portrait");

  await page.getByRole("button", { name: "Copy recipe link" }).click();
  await expect(page.locator("[data-recipe-status]")).toContainText(
    "never your files",
  );

  const recipe = await page.evaluate(() => window.location.hash);
  // JPEG rather than WebP: the chain ends in a document, and a page image is
  // embedded as it is only when it is a JPEG or a PNG.
  expect(recipe).toBe(
    "#r=v1;f=jpeg;resize-image:w=300,h=150;jpg-to-pdf:p=legal,o=portrait",
  );

  await page.goto(`/flows/${recipe}`);
  await expect(page.getByRole("heading", { name: "Resize Image" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Image to PDF" })).toBeVisible();
  await expect(page.getByLabel("Resize Image width")).toHaveValue("300");
  await expect(page.getByLabel("Image to PDF page size")).toHaveValue("legal");
  await expect(page.getByLabel("Image to PDF orientation")).toHaveValue("portrait");
  // The chain combines, so the reopened flow already asks for several images.
  await expect(chooseImages(page)).toHaveJSProperty("multiple", true);
});

test("resolves the extra pages when the combining block is removed", async ({
  page,
}) => {
  await page.goto("/flows/");

  await addStep(page, "jpg-to-pdf");
  await chooseImages(page).setInputFiles([
    asFile("first.jpg", wideJpeg),
    asFile("second.jpg", tallJpeg),
    asFile("third.jpg", wideJpeg),
  ]);
  await expect(page.locator("[data-source-details]")).toContainText("3 pages");

  await page.getByRole("button", { name: "Remove", exact: true }).click();

  // Nothing is dropped quietly: the flow says which image it kept.
  await expect(page.locator("[data-status]")).toHaveText(
    "This flow makes one file, so it kept first.jpg and removed 2 other images.",
  );
  await expect(page.locator("[data-source-details]")).toContainText("first.jpg");
  await expect(page.getByRole("list", { name: "Starting files" })).toBeHidden();
  await expect(chooseImages(page)).not.toHaveJSProperty("multiple", true);
});

test("refuses a non-image and a selection larger than one document", async ({
  page,
}) => {
  await page.goto("/flows/");

  await addStep(page, "jpg-to-pdf");
  await chooseImages(page).setInputFiles([
    asFile("holiday.jpg", wideJpeg),
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
  ]);

  const error = page.getByRole("alert");
  await expect(error).toContainText("notes.txt");
  await expect(error).toContainText("is not an image this Gizlet can read");
  await expect(page.getByRole("list", { name: "Starting files" })).toBeHidden();

  await chooseImages(page).setInputFiles(
    Array.from({ length: 101 }, (_, index) =>
      asFile(`page-${index}.jpg`, wideJpeg),
    ),
  );
  await expect(error).toContainText("One PDF holds up to 100 pages here");
  await expect(page.getByRole("button", { name: "Run flow" })).toBeDisabled();
});


/**
 * The flow builder draws a PDF result, but a flow that never makes one has no
 * use for pdf.js, so the library has to stay out of what this page hands a
 * visitor on arrival — asserted against the built bundles, not the source.
 */
test("keeps pdf.js out of the flows page until a run has made a PDF", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));

  const builder = await initialScripts(page, "/flows/");
  expect(builder.length).toBeGreaterThan(0);
  expect(chunksCarryingPdfJs(builder)).toBe(0);
  expect(requested.filter((url) => url.includes("pdf.worker"))).toEqual([]);

  // The control: the PDF Viewer page does import pdf.js up front, so the check
  // above is looking for something it would genuinely find.
  expect(
    chunksCarryingPdfJs(await initialScripts(page, "/tools/pdf-viewer/")),
  ).toBeGreaterThan(0);

  // And on this page the library arrives only once a run has a PDF to draw.
  await page.goto("/flows/");
  await addStep(page, "jpg-to-pdf");
  await chooseImages(page).setInputFiles(asFile("wide.jpg", wideJpeg));
  await page.getByRole("button", { name: "Run flow" }).click();
  await expect(page.locator("[data-preview]")).toBeVisible();

  await expect
    .poll(() => requested.filter((url) => url.includes("pdf.worker")).length)
    .toBeGreaterThan(0);
});

test("turns a PDF back into images and runs the rest of the chain on each", async ({
  page,
}) => {
  await page.goto("/flows/");

  await addStep(page, "jpg-to-pdf");
  await addStep(page, "pdf-to-jpg");
  await addStep(page, "compress-image");

  // The chain ends with images again, so the format control is the flow's own
  // output rather than the format used inside a document.
  await expect(page.getByLabel("Final output format")).toBeVisible();
  await expect(page.getByLabel("PDF to Image resolution")).toHaveValue("sharp");
  await page.getByLabel("PDF to Image resolution").selectOption("screen");

  await chooseImages(page).setInputFiles([
    asFile("wide.jpg", wideJpeg),
    asFile("tall.jpg", tallJpeg),
  ]);
  await page.getByRole("button", { name: "Run flow" }).click();

  await expect(
    page.getByRole("heading", { name: "Your images are ready." }),
  ).toBeVisible();
  await expect(page.locator("[data-result-details]")).toContainText("2 images");

  // One image per page of the document the flow built, each of which then went
  // through the block after it.
  const files = page.getByRole("list", { name: "Final results" });
  await expect(files.getByRole("listitem")).toHaveCount(2);
  await expect(files.getByRole("link").first()).toHaveAttribute(
    "download",
    "wide-and-1-more-page-1-compressed.jpg",
  );
  await expect(files.getByRole("link").last()).toHaveAttribute(
    "download",
    "wide-and-1-more-page-2-compressed.jpg",
  );

  // Still one download at the end: the set is packed into one archive here.
  const archive = page.getByRole("link", { name: "Download all 2 pages" });
  await expect(archive).toHaveAttribute("download", "wide-and-1-more-pages.zip");
  expect(
    await archive.evaluate(async (link) => {
      const bytes = new Uint8Array(
        await (await fetch((link as HTMLAnchorElement).href)).arrayBuffer(),
      );
      const view = new DataView(bytes.buffer);

      // The number of files the archive's end record declares.
      return view.getUint16(bytes.length - 12, true);
    }),
  ).toBe(2);
});

test("shares a flow that converts a PDF back to images as a recipe link", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/flows/");

  await addStep(page, "jpg-to-pdf");
  await addStep(page, "pdf-to-jpg");
  await page.getByLabel("PDF to Image resolution").selectOption("print");
  await page.getByRole("button", { name: "Copy recipe link" }).click();

  const recipe = await page.evaluate(() => window.location.hash);
  expect(recipe).toBe("#r=v1;f=webp;jpg-to-pdf:p=a4,o=auto;pdf-to-jpg:r=print");

  await page.goto(`/flows/${recipe}`);
  await expect(page.getByRole("heading", { name: "PDF to Image" })).toBeVisible();
  await expect(page.getByLabel("PDF to Image resolution")).toHaveValue("print");
});

test("splits the PDF a flow made, and hands every piece to the next block", async ({
  page,
}) => {
  await page.goto("/flows/");

  // The combining block goes in first, because that is what makes the source
  // take more than one image.
  await addStep(page, "jpg-to-pdf");
  await chooseImages(page).setInputFiles([
    asFile("wide.jpg", wideJpeg),
    asFile("tall.jpg", tallJpeg),
  ]);
  await addStep(page, "split-pdf");

  // The block says what it does to the payload rather than borrowing the
  // wording of the other splitting Gizlet.
  await expect(page.getByText("Image to PDF result → one PDF per page")).toBeVisible();

  await page.getByRole("button", { name: "Run flow" }).click();

  await expect(page.getByRole("heading", { name: "Your PDFs are ready." })).toBeVisible();
  await expect(page.locator("[data-result-details]")).toContainText("2 PDFs · 2 pages");

  const results = page.getByRole("list", { name: "Final results" });
  await expect(results.getByRole("listitem")).toHaveCount(2);
  await expect(results.getByRole("link").first()).toHaveAttribute(
    "download",
    "wide-and-1-more-page-1.pdf",
  );

  // Each piece is a one-page PDF another reader can open.
  const bytes = await results
    .getByRole("link")
    .first()
    .evaluate(async (link) => {
      const response = await fetch((link as HTMLAnchorElement).href);
      const values = new Uint8Array(await response.arrayBuffer());
      let binary = "";

      for (const value of values) binary += String.fromCharCode(value);

      return btoa(binary);
    });
  const part = await PDFDocument.load(Buffer.from(bytes, "base64"));
  expect(part.getPageCount()).toBe(1);

  // Still one download at the end: the set of documents is packed here.
  const archive = page.getByRole("link", { name: "Download all 2 PDFs" });
  await expect(archive).toHaveAttribute("download", "wide-and-1-more-split.zip");

  // And a converter after the splitter runs over every piece, so the flow
  // finishes with one image per page of the document it took apart.
  await addStep(page, "pdf-to-jpg");
  await page.getByRole("button", { name: "Run flow" }).click();

  await expect(page.getByRole("heading", { name: "Your images are ready." })).toBeVisible();
  await expect(page.locator("[data-result-details]")).toContainText("2 images");
  await expect(results.getByRole("listitem")).toHaveCount(2);
});

test("says what a one-page document cannot be split into", async ({ page }) => {
  await page.goto("/flows/");

  await addStep(page, "jpg-to-pdf");
  await chooseImages(page).setInputFiles([asFile("wide.jpg", wideJpeg)]);
  await addStep(page, "split-pdf");
  await page.getByRole("button", { name: "Run flow" }).click();

  // One image makes a one-page PDF, and a refusal that says exactly that is
  // more use than a set of one.
  await expect(page.getByRole("alert")).toContainText(
    "one page, so there is nothing to split it into",
  );
});

test("asks for a page image format, not an output format, when the flow ends in a PDF", async ({
  page,
}) => {
  await page.goto("/flows/");

  // Nothing re-encodes an image yet, so there is no format to choose.
  await addStep(page, "jpg-to-pdf");
  await expect(page.locator("[data-final-format-label]")).toBeHidden();

  await page.goto("/flows/");
  await addStep(page, "compress-image");

  const control = page.locator("[data-final-format-label]");
  await expect(control).toBeVisible();
  await expect(control).toContainText("Final output format");
  await expect(page.getByLabel("Final output format")).toHaveValue("image/webp");

  // Ending the chain in a document renames the control and drops the format a
  // PDF cannot carry, rather than leaving WebP selected for a file that has none.
  await addStep(page, "jpg-to-pdf");
  await expect(control).toContainText("Page image format");

  const format = page.getByLabel("Page image format");
  await expect(format).toHaveValue("image/jpeg");
  await expect(format.locator("option")).toHaveCount(2);
  await expect(format.locator("option")).toHaveText(["JPEG", "PNG"]);
});

test("keeps naming the page format when a split follows the document", async ({
  page,
}) => {
  await page.goto("/flows/");

  await addStep(page, "compress-image");
  await addStep(page, "jpg-to-pdf");
  await addStep(page, "split-pdf");

  // The chain still hands over documents, so the earlier "final output format"
  // wording named a file this flow never writes.
  await expect(page.locator("[data-final-format-label]")).toContainText(
    "Page image format",
  );
  await expect(page.getByLabel("Page image format").locator("option")).toHaveText([
    "JPEG",
    "PNG",
  ]);

  // Converting the pages back to images makes the output format real again.
  await addStep(page, "pdf-to-jpg");
  await expect(page.locator("[data-final-format-label]")).toContainText(
    "Final output format",
  );
  await expect(
    page.getByLabel("Final output format").locator("option"),
  ).toHaveText(["JPEG", "PNG", "WebP"]);
});
