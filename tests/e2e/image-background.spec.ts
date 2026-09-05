import { expect, test } from "@playwright/test";

/** A 40x20 PNG with a transparent border around an opaque middle. */
const transparent = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAYAAAD/Rn+7AAAANElEQVR4nO3OMREAMAgEMORURP2rwEurguOHDNlTfU8lWw8IJgTfMEFBQUFBQcFg6wHBaR+b8wcsIzh87wAAAABJRU5ErkJggg==",
  "base64",
);

async function choose(page: import("@playwright/test").Page) {
  await page.getByLabel("Select an image to put on a background").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: transparent,
  });
}

test("puts an image on a chosen canvas and offers a local download", async ({
  page,
}) => {
  await page.goto("/tools/image-background/");
  await choose(page);

  const preview = page.getByLabel("Image on its background");

  // The canvas starts as the picture's own size: nothing has been asked for yet.
  await expect(preview).toHaveJSProperty("width", 40);
  await expect(page.locator("[data-plan-summary]")).toHaveText(
    "40 × 20 px canvas · image at 40 × 20 px",
  );
  await expect(page.getByLabel("Canvas size")).toHaveValue("source");

  // A preset sets the fields, and the fit decides how the picture is scaled.
  await page.getByLabel("Canvas size").selectOption("square");
  await expect(page.getByLabel("Width px")).toHaveValue("1080");
  await expect(page.locator("[data-plan-summary]")).toHaveText(
    "1080 × 1080 px canvas · image at 1080 × 540 px",
  );

  await page.getByLabel("Fit").selectOption("original");
  await expect(page.locator("[data-plan-summary]")).toHaveText(
    "1080 × 1080 px canvas · image at 40 × 20 px",
  );

  // Typing a size of its own moves the preset to custom rather than leaving
  // the two disagreeing.
  await page.getByLabel("Width px").fill("600");
  await page.getByLabel("Height px").fill("400");
  await expect(page.getByLabel("Canvas size")).toHaveValue("custom");

  await page.getByRole("button", { name: "Put it on the background" }).click();

  await expect(page.getByText("Sitting on something.")).toBeVisible();
  await expect(page.locator("[data-original-dimensions]")).toHaveText("40 × 20 px");
  await expect(page.locator("[data-result-dimensions]")).toHaveText("600 × 400 px");
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    "logo-background.png",
  );
});

test("says what JPEG will do to a transparent background before the download", async ({
  page,
}) => {
  await page.goto("/tools/image-background/");
  await choose(page);

  const note = page.locator("[data-transparency-note]");

  // PNG is the default for a picture that may carry transparency, and it keeps
  // it, so there is nothing to warn about.
  await expect(page.getByLabel("Output format")).toHaveValue("image/png");
  await page.getByLabel("Keep it transparent").check();
  await expect(note).toBeHidden();
  await expect(page.getByLabel("Background", { exact: true })).toBeDisabled();

  await page.getByLabel("Output format").selectOption("image/jpeg");
  await expect(note).toContainText("JPEG cannot hold transparency");

  await page.getByLabel("Output format").selectOption("image/webp");
  await expect(note).toBeHidden();
});

test("refuses a canvas it will not draw, and a file that is not an image", async ({
  page,
}) => {
  await page.goto("/tools/image-background/");

  await page.getByLabel("Select an image to put on a background").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("Choose a JPEG, PNG, WebP, AVIF, or BMP image."),
  ).toBeVisible();

  await choose(page);
  await page.getByLabel("Width px").fill("20000");
  await expect(page.locator("[data-plan-summary]")).toContainText(
    "Keep each side of the canvas",
  );
  await expect(
    page.getByRole("button", { name: "Put it on the background" }),
  ).toBeDisabled();

  await page.getByLabel("Width px").fill("1200");
  await expect(
    page.getByRole("button", { name: "Put it on the background" }),
  ).toBeEnabled();
});
