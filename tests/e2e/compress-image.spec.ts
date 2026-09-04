import { expect, test } from "@playwright/test";

test("compresses a selected image locally and offers it for download", async ({
  page,
}) => {
  await page.goto("/tools/compress-image/");

  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Select an image to compress").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: image,
  });

  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Output format")).toHaveValue("image/png");
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Compress it" }).click();

  const result = page.getByText("Your image is ready.");
  await expect(result).toBeVisible();
  await expect(page.getByLabel("Output format")).not.toBeVisible();
  const resultPanel = page.locator("[data-result]");
  await expect(resultPanel.getByText("Before", { exact: true })).toBeVisible();
  await expect(resultPanel.getByText("After", { exact: true })).toBeVisible();
  await expect(resultPanel.locator("[data-size-change]")).toHaveText(/(smaller|larger)/);
  await expect(
    page.getByRole("heading", { name: "Original / compressed" }),
  ).toBeVisible();
  await expect(page.getByAltText("Original image")).toBeVisible();
  const comparison = page.getByLabel("Compare original and compressed image");
  await comparison.focus();
  await page.keyboard.press("ArrowRight");
  await expect(comparison).toHaveValue("51");
  await expect(
    page.getByRole("link", { name: "Download image" }),
  ).toHaveAttribute("download", "tiny-compressed.jpg");

  await page.getByRole("button", { name: "Choose another image" }).click();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).toBeVisible();
});

test("explains unsupported and corrupt image files", async ({ page }) => {
  await page.goto("/tools/compress-image/");

  const fileInput = page.getByLabel("Select an image to compress");
  await fileInput.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Choose a JPEG, PNG, WebP, AVIF, or BMP image.",
  );

  await fileInput.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await page.getByRole("button", { name: "Compress it" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "This image could not be read.",
  );
});
