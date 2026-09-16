import { expect, test, type Page } from "@playwright/test";

import { samplePdf } from "./support/sample-pdf";

/**
 * Carrying a result on to the next Gizlet.
 *
 * The assertions are the three claims the panel makes: that these are the
 * Gizlets which take what you just made, that the result arrives in the one you
 * pick without being saved and chosen again, and that nothing leaves the device
 * on the way.
 */
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
  "base64",
);

/** A 16x8 PNG, so a second file in a batch is visibly a different one. */
const widePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAHUlEQVR42mNkYPhfz0BFwDiqYVTDqIZRDaMaKNQAAOaVB/1A9L2SAAAAAElFTkSuQmCC",
  "base64",
);

const asImage = (name: string, buffer: Buffer) => ({
  name,
  mimeType: "image/png",
  buffer,
});

const destinations = (page: Page) => page.locator("[data-send-destinations] > li");

const watchUploads = (page: Page) => {
  const requests: string[] = [];

  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  return requests;
};

test("offers the Gizlets that take a result, and carries it into one", async ({
  page,
}) => {
  const uploads = watchUploads(page);

  await page.goto("/tools/resize-image/");

  await page.getByLabel("Select an image to resize").setInputFiles(asImage("holiday.png", tinyPng));
  await page.getByLabel("Width").fill("2");
  await page.getByRole("button", { name: "Resize it" }).click();

  await expect(page.getByText("Right size. Ready to go.")).toBeVisible();

  // The panel names what it is holding, and the chooser stays away while there
  // is only one file to hold.
  await expect(
    page.getByRole("heading", { name: "Send it to another Gizlet" }),
  ).toBeVisible();
  await expect(page.locator("[data-send-summary]")).toContainText(
    "holiday-resized.png can go straight into another Gizlet",
  );
  await expect(page.locator("[data-send-chooser]")).toBeHidden();

  // The destinations are the image Gizlets, never the document ones, and never
  // the Gizlet that just made the file.
  const names = await destinations(page).locator("[data-send-name]").allTextContents();

  expect(names).toContain("Crop Image");
  expect(names).toContain("Compress Image");
  expect(names).toContain("Image Dimensions");
  expect(names).not.toContain("Merge PDF");
  expect(names).not.toContain("Resize Image");

  await page
    .getByRole("link", { name: "Send holiday-resized.png to Crop Image" })
    .click();

  // The next Gizlet opens with the result already chosen: no download, no
  // second upload, and no fragment left behind to repeat on a reload.
  await expect(page).toHaveURL("/tools/crop-image/");
  await expect(page.locator("[data-handoff-note]")).toContainText(
    "holiday-resized.png",
  );
  await expect(page.getByAltText("Selected image preview")).toBeVisible();

  expect(uploads).toEqual([]);
});

test("offers a send per file when a result is several of them", async ({ page }) => {
  const uploads = watchUploads(page);

  await page.goto("/tools/resize-image/");

  await page
    .getByLabel("Select an image to resize")
    .setInputFiles([asImage("first.png", tinyPng), asImage("second.png", widePng)]);
  await page.getByLabel("Percentage").check();
  await page.getByLabel("Scale %").fill("200");
  await page.getByRole("button", { name: "Resize 2 images" }).click();

  await expect(page.locator("[data-result-list] > li")).toHaveCount(2);

  // A batch hands back an archive as well, and an archive is not a payload any
  // Gizlet reads: the files inside it are what can travel.
  await expect(page.locator("[data-send-summary]")).toContainText("2 files came out of this");
  await expect(page.locator("[data-send-chooser]")).toBeVisible();

  const chooser = page.getByLabel("Which one to send");

  await expect(chooser.locator("option")).toHaveText([
    "first-resized.png",
    "second-resized.png",
  ]);

  await chooser.selectOption({ label: "second-resized.png" });
  await page
    .getByRole("link", { name: "Send second-resized.png to Compress Image" })
    .click();

  await expect(page).toHaveURL("/tools/compress-image/");
  await expect(page.locator("[data-handoff-note]")).toContainText("second-resized.png");

  expect(uploads).toEqual([]);
});

test("carries a document into the Gizlets that read one", async ({ page }) => {
  const uploads = watchUploads(page);

  await page.goto("/tools/watermark-pdf/");

  await page.getByLabel("Select a PDF to watermark").setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: await samplePdf(2),
  });
  await page.getByRole("button", { name: "Add the watermark" }).click();

  await expect(page.getByRole("heading", { name: "Your PDF is ready." })).toBeVisible();

  const names = await destinations(page).locator("[data-send-name]").allTextContents();

  expect(names).toContain("Split PDF");
  expect(names).toContain("PDF Viewer");
  expect(names).not.toContain("Watermark PDF");
  expect(names).not.toContain("Crop Image");

  await page
    .getByRole("link", { name: "Send contract-watermarked.pdf to Split PDF" })
    .click();

  await expect(page).toHaveURL("/tools/split-pdf/");
  await expect(page.locator("[data-handoff-note]")).toContainText("contract-watermarked.pdf");

  expect(uploads).toEqual([]);
});

test("offers nothing when the result is an archive it cannot hand on", async ({
  page,
}) => {
  await page.goto("/tools/favicon-generator/");

  await page
    .getByLabel("Select an image to make icons from")
    .setInputFiles(asImage("logo.png", widePng));
  await page.getByRole("button", { name: "Make the icon set" }).click();

  await expect(page.getByRole("heading", { name: "Your icon set is ready." })).toBeVisible();
  await expect(page.locator("[data-send-to]")).toBeHidden();
});
