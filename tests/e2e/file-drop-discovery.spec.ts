import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

/**
 * Starting from the file.
 *
 * The assertions are about the two claims the panel makes: that these are the
 * Gizlets which take this file, and that the file goes with you when you pick
 * one — both without anything leaving the device.
 */
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAHUlEQVR42mNkYPhfz0BFwDiqYVTDqIZRDaMaKNQAAOaVB/1A9L2SAAAAAElFTkSuQmCC",
  "base64",
);

async function samplePdf(): Promise<Buffer> {
  const document = await PDFDocument.create();

  document.addPage([300, 400]);

  return Buffer.from(await document.save());
}

const chooseFile = (page: Page) =>
  page.getByLabel("Choose a file to see which Gizlets take it");

const destinations = (page: Page) => page.locator("[data-destinations] > li");

test("offers the Gizlets that take a dropped image, and carries it into one", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Drop a file here" })).toBeVisible();

  await chooseFile(page).setInputFiles({
    name: "holiday.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  // What it is, read here, including the shape a picture is free to report.
  await expect(page.locator("[data-file-line]")).toHaveText(
    /holiday\.png · an image · .* · 16 × 8 px/,
  );
  await expect(page.locator("[data-summary]")).toContainText("take an image");

  // The destinations are the image Gizlets, and not the document ones.
  await expect(destinations(page).first()).toBeVisible();

  const names = await destinations(page).locator("[data-destination-name]").allTextContents();
  expect(names).toContain("Compress Image");
  expect(names).toContain("Image Dimensions");
  expect(names).not.toContain("Split PDF");

  await expect(page.locator("[data-note]")).toContainText("goes with you");

  // Picking one opens it with the file already chosen: no second picker, and
  // the workspace behaves as though the visitor had chosen it there.
  await destinations(page)
    .filter({ hasText: "Compress Image" })
    .getByRole("link")
    .click();

  await expect(page).toHaveURL(/\/tools\/compress-image\/$/);
  await expect(page.locator("[data-handoff-note]")).toContainText("holiday.png");
  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await expect(page.locator("[data-input-name]")).toContainText("holiday.png");

  // The whole journey happened on this device.
  expect(requests).toEqual([]);
});

test("offers the document Gizlets for a dropped PDF", async ({ page }) => {
  await page.goto("/");

  await chooseFile(page).setInputFiles({
    name: "report.pdf",
    mimeType: "application/pdf",
    buffer: await samplePdf(),
  });

  await expect(page.locator("[data-file-line]")).toContainText("report.pdf · a PDF");
  await expect(destinations(page).first()).toBeVisible();

  const names = await destinations(page).locator("[data-destination-name]").allTextContents();
  expect(names).toContain("PDF Viewer");
  expect(names).toContain("Split PDF");
  expect(names).not.toContain("Compress Image");

  // A page count is not shown, because reading one would mean fetching a PDF
  // library for a file nobody has chosen a Gizlet for yet.
  const requested = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /pdf.*worker|pdfjs|pdf-lib/i.test(name)),
  );

  expect(requested).toEqual([]);
});

test("says what to do about a file no Gizlet reads, and leaves search alone", async ({
  page,
}) => {
  await page.goto("/");

  await chooseFile(page).setInputFiles({
    name: "archive.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("PK not really"),
  });

  await expect(page.getByRole("alert")).toContainText(
    "archive.zip is not an image, a PDF, a CSV or a JSON file",
  );
  await expect(page.locator("[data-destinations] > li")).toHaveCount(0);

  // The ordinary way in still works.
  await page.getByLabel("I need to…").fill("compress");
  await expect(page.locator("[data-tool-search-results] li").first()).toContainText(
    "Compress Image",
  );
});

test("ignores a handoff fragment this site did not write", async ({ page }) => {
  await page.goto("/tools/compress-image/#handoff=../../etc/passwd");

  // Nothing is adopted and nothing breaks: the workspace is its ordinary self.
  await expect(page.getByRole("heading", { name: "Drop images here" })).toBeVisible();
  await expect(page.locator("[data-handoff-note]")).toBeHidden();
});
