import { expect, test } from "@playwright/test";

/**
 * A 40x20 PNG of four flat ten-pixel columns, left to right: amber, ink, white,
 * red. Flat and lossless, so the value picked is exactly the value written.
 */
const swatches = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAMUlEQVR4nGP4tpQBD+IX18KD/uMFJ2w08CB8to5aPGrxqMWjFo9aPGrxqMWjFg8ziwEeqL/dcZKgnwAAAABJRU5ErkJggg==",
  "base64",
);

test("picks a pixel, reports it three ways, and copies it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/image-color-picker/");

  await page.getByLabel("Select an image to pick colours from").setInputFiles({
    name: "swatches.png",
    mimeType: "image/png",
    buffer: swatches,
  });

  // It opens on the middle pixel rather than on an empty panel.
  await expect(page.locator("[data-swatch-hex]")).toHaveText("#ffffff");
  await expect(page.locator("[data-position]")).toHaveText("Pixel 20, 10");

  const canvas = page.getByRole("application", { name: /pick a colour/ });
  const box = (await canvas.boundingBox())!;

  // The first of four columns is the amber one.
  await page.mouse.click(box.x + box.width * 0.125, box.y + box.height * 0.5);
  await expect(page.locator("[data-swatch-hex]")).toHaveText("#f6a500");
  await expect(page.locator("[data-values]")).toContainText("rgb(246, 165, 0)");
  await expect(page.locator("[data-values]")).toContainText("hsl(40, 100%, 48%)");

  await page.getByRole("button", { name: "Copy HEX" }).click();
  await expect(page.getByText("HEX copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("#f6a500");

  await page.getByRole("button", { name: "Copy HSL" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "hsl(40, 100%, 48%)",
  );
});

test("moves the pick with the keyboard alone", async ({ page }) => {
  await page.goto("/tools/image-color-picker/");

  await page.getByLabel("Select an image to pick colours from").setInputFiles({
    name: "swatches.png",
    mimeType: "image/png",
    buffer: swatches,
  });

  const canvas = page.getByRole("application", { name: /pick a colour/ });

  await canvas.focus();
  await expect(page.locator("[data-position]")).toHaveText("Pixel 20, 10");

  await canvas.press("ArrowLeft");
  await expect(page.locator("[data-position]")).toHaveText("Pixel 19, 10");
  await expect(page.locator("[data-swatch-hex]")).toHaveText("#0f172a");

  await canvas.press("ArrowUp");
  await expect(page.locator("[data-position]")).toHaveText("Pixel 19, 9");

  // Shift steps ten, which crosses a column each time.
  await canvas.press("Shift+ArrowRight");
  await expect(page.locator("[data-swatch-hex]")).toHaveText("#ffffff");
  await canvas.press("Shift+ArrowRight");
  await expect(page.locator("[data-position]")).toHaveText("Pixel 39, 9");
  await expect(page.locator("[data-swatch-hex]")).toHaveText("#c83c28");

  // The edge of the picture stops it rather than wrapping or throwing.
  await canvas.press("Shift+ArrowRight");
  await expect(page.locator("[data-position]")).toHaveText("Pixel 39, 9");
  await canvas.press("Shift+ArrowUp");
  await expect(page.locator("[data-position]")).toHaveText("Pixel 39, 0");
});

test("remembers the colours picked this visit, without repeating one", async ({
  page,
}) => {
  await page.goto("/tools/image-color-picker/");

  await page.getByLabel("Select an image to pick colours from").setInputFiles({
    name: "swatches.png",
    mimeType: "image/png",
    buffer: swatches,
  });

  const canvas = page.getByRole("application", { name: /pick a colour/ });
  const history = page.getByRole("list", { name: "Colours picked this visit" });

  await canvas.focus();
  await expect(history.getByRole("button")).toHaveCount(1);

  await canvas.press("ArrowLeft");
  await expect(history.getByRole("button")).toHaveCount(2);

  // Back to the pixel it started on: a repeat moves rather than duplicating.
  await canvas.press("ArrowRight");
  await expect(history.getByRole("button")).toHaveCount(2);
  await expect(history.getByRole("button").first()).toHaveAttribute(
    "aria-label",
    "Copy #ffffff",
  );
});

test("refuses a file that is not an image", async ({ page }) => {
  await page.goto("/tools/image-color-picker/");

  await page.getByLabel("Select an image to pick colours from").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(
    page.getByText("Choose a JPEG, PNG, WebP, AVIF, or BMP image."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).toBeVisible();
});
