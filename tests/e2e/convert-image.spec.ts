import { expect, test } from "@playwright/test";

test("converts an image locally with an accurate download type and filename", async ({
  page,
}) => {
  await page.goto("/tools/convert-image/");

  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Select an image to convert").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: image,
  });

  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await expect(page.getByText("Detected format")).toBeVisible();
  await expect(page.getByLabel("Output format")).toHaveValue("image/png");
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Convert it" }).click();

  await expect(page.getByText("Your image is ready.")).toBeVisible();
  await expect(page.getByAltText("Converted image preview")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download image" }),
  ).toHaveAttribute("download", "tiny-converted.jpg");
});
