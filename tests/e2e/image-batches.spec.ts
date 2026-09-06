import { expect, test, type Page } from "@playwright/test";

/**
 * One settings panel, several pictures.
 *
 * The pictures are real files a browser really decodes rather than fixtures on
 * disk, and the assertions are about the two things a batch has to get right:
 * every chosen file comes out with its own name, and one broken file costs one
 * row rather than the run.
 */
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
  "base64",
);

/** A 16x8 PNG, so a resize has something with proportions to keep. */
const widePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAHUlEQVR42mNkYPhfz0BFwDiqYVTDqIZRDaMaKNQAAOaVB/1A9L2SAAAAAElFTkSuQmCC",
  "base64",
);

const asImage = (name: string, buffer: Buffer) => ({
  name,
  mimeType: "image/png",
  buffer,
});

const brokenImage = (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from("not an image"),
});

const rows = (page: Page) => page.locator("[data-result-list] > li");

test("compresses a whole batch and hands it back as one archive", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/compress-image/");

  await page.getByLabel("Select an image to compress").setInputFiles([
    asImage("first.png", tinyPng),
    asImage("second.png", widePng),
    asImage("third.png", tinyPng),
  ]);

  // The panel says what it is holding before anything is done to it.
  await expect(page.locator("[data-input-name]")).toContainText("3 images");

  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Compress 3 images" }).click();

  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(0)).toContainText("first-compressed.jpg");
  await expect(rows(page).nth(1)).toContainText("second-compressed.jpg");
  await expect(rows(page).nth(2)).toContainText("third-compressed.jpg");

  // Every row is its own download, and the whole batch is one more.
  await expect(
    rows(page).nth(0).getByRole("link", { name: "Download first-compressed.jpg" }),
  ).toBeVisible();

  const archive = page.getByRole("link", { name: /Download all 3 as a ZIP/ });
  await expect(archive).toHaveAttribute("download", "compressed-images.zip");

  // The archive really is a ZIP, with an entry per picture, written here.
  const entries = await archive.evaluate(async (element) => {
    const response = await fetch((element as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);

    return {
      signature: text.slice(0, 2),
      names: [...text.matchAll(/(first|second|third)-compressed\.jpg/g)].map((match) => match[0]),
    };
  });

  expect(entries.signature).toBe("PK");
  expect([...new Set(entries.names)].sort()).toEqual([
    "first-compressed.jpg",
    "second-compressed.jpg",
    "third-compressed.jpg",
  ]);

  // A batch is still local: nothing was posted anywhere.
  expect(requests).toEqual([]);
});

test("finishes the pictures it can and says which one it could not", async ({ page }) => {
  await page.goto("/tools/convert-image/");

  await page.getByLabel("Select an image to convert").setInputFiles([
    asImage("good.png", tinyPng),
    brokenImage("broken.png"),
    asImage("also-good.png", widePng),
  ]);

  // The unreadable file is named as it is chosen, and the batch carries on.
  await expect(page.getByRole("alert")).toContainText("broken.png");
  await expect(page.locator("[data-input-name]")).toContainText("2 images");

  await page.getByRole("button", { name: "Convert 2 images" }).click();

  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator("[data-result-summary]")).toContainText("2 images");
  await expect(page.getByRole("link", { name: /Download all 2 as a ZIP/ })).toHaveAttribute(
    "download",
    "converted-images.zip",
  );
});

test("resizes every picture against its own proportions", async ({ page }) => {
  await page.goto("/tools/resize-image/");

  await page.getByLabel("Select an image to resize").setInputFiles([
    asImage("wide.png", widePng),
    asImage("square.png", tinyPng),
  ]);

  await expect(page.locator("[data-batch-note]")).toContainText("keeps its own proportions");

  await page.locator("[data-width]").fill("8");
  await expect(page.locator("[data-dimension-preview]")).toContainText("(first image)");

  await page.getByRole("button", { name: "Resize 2 images" }).click();

  await expect(rows(page)).toHaveCount(2);
  // The wide one keeps 2:1 and the square one stays square, from one width.
  await expect(rows(page).nth(0)).toContainText("8 × 4 px");
  await expect(rows(page).nth(1)).toContainText("8 × 8 px");
  await expect(page.getByRole("link", { name: /Download all 2 as a ZIP/ })).toHaveAttribute(
    "download",
    "resized-images.zip",
  );

  // Forcing the same box is the other half of the rule, and it says so.
  await page.getByRole("button", { name: "Choose other images" }).click();
  await page.getByLabel("Select an image to resize").setInputFiles([
    asImage("wide.png", widePng),
    asImage("square.png", tinyPng),
  ]);
  await page.getByLabel("Keep proportions").uncheck();
  await expect(page.locator("[data-batch-note]")).toContainText("forced to exactly these dimensions");
});

test("refuses more images than one batch takes", async ({ page }) => {
  await page.goto("/tools/compress-image/");

  await page.getByLabel("Select an image to compress").setInputFiles(
    Array.from({ length: 26 }, (_, index) => asImage(`photo-${index}.png`, tinyPng)),
  );

  await expect(page.getByRole("alert")).toContainText("up to 25 images");
  await expect(page.getByRole("heading", { name: "Drop images here" })).toBeVisible();
});

test("runs a flow over a batch of images and packs the results", async ({ page }) => {
  await page.goto("/flows/");

  await page.getByLabel("Next compatible Gizlet").selectOption("convert-image");
  await page.getByRole("button", { name: "Add step" }).click();

  // An image flow takes a batch whether or not its chain combines anything.
  await page.getByLabel("Choose images for this flow").setInputFiles([
    asImage("one.png", tinyPng),
    asImage("two.png", widePng),
  ]);
  await expect(page.locator("[data-source-details]")).toContainText("2 images");

  await page.getByLabel("Final output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Run flow" }).click();

  await expect(page.locator("[data-result-list] > li")).toHaveCount(2, { timeout: 15000 });
  await expect(page.getByRole("link", { name: /Download all 2 as a ZIP/ })).toHaveAttribute(
    "download",
    "flow-images.zip",
  );
});
