import { expect, test } from "@playwright/test";

test("resizes an image by dimensions or percentage and offers a local download", async ({
  page,
}) => {
  await page.goto("/tools/resize-image/");

  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Select an image to resize").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: image,
  });

  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await expect(page.getByLabel("Width")).toHaveValue("1");
  await expect(page.getByLabel("Height")).toHaveValue("1");
  await expect(page.getByLabel("Scale %")).not.toBeVisible();
  await page.getByLabel("Width").fill("2");
  await expect(page.getByLabel("Height")).toHaveValue("2");
  await expect(page.getByText("2 × 2 px")).toBeVisible();

  await page.getByLabel("Percentage").check();
  await expect(page.getByLabel("Width")).not.toBeVisible();
  await expect(page.getByLabel("Height")).not.toBeVisible();
  await expect(page.getByLabel("Scale %")).toBeVisible();
  await page.getByLabel("Scale %").fill("200");
  await expect(page.getByText("2 × 2 px")).toBeVisible();
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Resize it" }).click();

  await expect(page.getByText("Right size. Ready to go.")).toBeVisible();
  await expect(page.getByAltText("Resized image preview")).toBeVisible();
  await expect(page.getByText("Original", { exact: true })).toBeVisible();
  await expect(page.getByText("Resized", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download image" }),
  ).toHaveAttribute("download", "tiny-resized.jpg");

  await page.getByRole("button", { name: "Choose another image" }).click();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).toBeVisible();
});
