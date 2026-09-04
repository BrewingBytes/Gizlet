import { expect, test } from "@playwright/test";

test("builds and runs a local image flow", async ({ page }) => {
  await page.goto("/flows/");

  await expect(page).toHaveTitle("Gizlet Flows | Gizlet");
  await expect(page.getByRole("heading", { name: "Make a little assembly line." })).toBeVisible();
  await expect(page.getByLabel("Flow category")).toHaveValue("images");
  await expect(page.locator("[data-result]")).toBeHidden();

  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Choose images for this flow").setInputFiles({
    name: "tiny.webp",
    mimeType: "image/webp",
    buffer: image,
  });
  await expect(page.getByText("tiny.webp")).toBeVisible();

  const nextTool = page.getByLabel("Next compatible Gizlet");
  await nextTool.selectOption("convert-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await expect(page.getByRole("heading", { name: "Convert Image" })).toBeVisible();
  await expect(page.getByLabel("Final output format")).toHaveValue("image/webp");

  await nextTool.selectOption("resize-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Resize Image width").fill("500");
  await page.getByLabel("Resize Image height").fill("500");

  await nextTool.selectOption("compress-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await expect(page.getByLabel("Compress Image quality")).toHaveValue("80");
  await page.getByRole("button", { name: "Run flow" }).click();

  await expect(page.locator("[data-status]")).toContainText("final image is ready");
  await expect(page.locator("[data-result]")).toBeVisible();
  await expect(page.getByAltText("Final flow result")).toBeVisible();
  await expect(page.getByAltText("Final flow result")).toHaveJSProperty("naturalWidth", 500);
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    "tiny-converted-resized-compressed.webp",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("explains unsupported and unreadable flow inputs when they are chosen", async ({ page }) => {
  await page.goto("/flows/");

  const input = page.getByLabel("Choose images for this flow");
  await input.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Choose a JPEG, PNG, WebP, AVIF, or BMP image to start this flow.",
  );

  // The source is decoded when it is chosen, so an unreadable file is refused
  // before a chain is built on top of it rather than at the end of a run.
  await input.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toHaveText("This image could not be read.");

  await page.getByLabel("Next compatible Gizlet").selectOption("convert-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await expect(page.getByRole("button", { name: "Run flow" })).toBeDisabled();
});
