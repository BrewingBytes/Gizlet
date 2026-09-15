import { expect, test, type Page } from "@playwright/test";

import {
  squeezableImage,
  tinyImage,
  unsqueezableImage,
} from "./support/sample-image";

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
    page.getByRole("heading", { name: "Drop images here" }),
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

  await page.getByRole("button", { name: "Choose other images" }).click();
  await expect(
    page.getByRole("heading", { name: "Drop images here" }),
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

  // A file with an image's name that no browser will decode is refused as it is
  // chosen rather than after the button is pressed: reading it is now part of
  // taking it on, because a batch has to know which of its files are real.
  await fileInput.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "This image could not be read.",
  );
  await expect(page.getByRole("heading", { name: "Drop images here" })).toBeVisible();
});

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
  "base64",
);

/** The byte count the result panel printed, so a claim can be checked. */
async function reportedBytes(page: Page): Promise<number> {
  const outcome = (await page.locator("[data-target-outcome]").textContent()) ?? "";
  const [, digits] = /^([\d,]+) bytes/.exec(outcome) ?? [];

  expect(digits, outcome).toBeDefined();

  return Number(digits!.replace(/,/g, ""));
}

async function chooseTargetMode(page: Page) {
  await page.getByRole("radio", { name: "Target file size" }).check();
  await expect(page.getByLabel("Size limit")).toBeVisible();
}

test("compresses a single image to a chosen file-size limit", async ({ page }) => {
  await page.goto("/tools/compress-image/");

  await page.getByLabel("Select an image to compress").setInputFiles({
    name: "gradient.bmp",
    mimeType: "image/bmp",
    buffer: squeezableImage(),
  });
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await chooseTargetMode(page);
  await page.getByLabel("Size limit").selectOption("100000");
  await page.getByRole("button", { name: "Compress it" }).click();

  await expect(
    page.getByRole("heading", { name: "Your image is under the limit." }),
  ).toBeVisible();
  await expect(page.locator("[data-target-outcome]")).toHaveText(
    /^[\d,]+ bytes · within the 100 KB limit$/,
  );

  // The panel is claiming a measured file, so the number it printed has to be
  // one that actually satisfies the limit it printed beside it.
  expect(await reportedBytes(page)).toBeLessThanOrEqual(100_000);

  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    "gradient-compressed.jpg",
  );
  await expect(page.locator("[data-target-advice]")).toBeHidden();

  // The comparison slider is a single picture's, and a target run is still a
  // single picture, so it is still there.
  await expect(
    page.getByRole("heading", { name: "Original / compressed" }),
  ).toBeVisible();
});

test("says so and offers the best attempt when a limit cannot be met", async ({
  page,
}) => {
  await page.goto("/tools/compress-image/");

  await page.getByLabel("Select an image to compress").setInputFiles({
    name: "noise.bmp",
    mimeType: "image/bmp",
    buffer: unsqueezableImage(),
  });
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await chooseTargetMode(page);
  await page.getByLabel("Size limit").selectOption("custom");
  await page.getByLabel("Custom size, in KB").fill("1");
  await page.getByRole("button", { name: "Compress it" }).click();

  await expect(
    page.getByRole("heading", { name: "This is as small as it went." }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-target-outcome]")).toHaveText(
    /^[\d,]+ bytes · over the 1 KB limit$/,
  );
  expect(await reportedBytes(page)).toBeGreaterThan(1_000);

  // The file is still a file, and it is labelled as the attempt it is rather
  // than as the result that was asked for.
  await expect(
    page.getByRole("link", { name: "Download best attempt" }),
  ).toHaveAttribute("download", "noise-compressed.jpg");

  const advice = page.locator("[data-target-advice]");
  await expect(advice).toBeVisible();
  await expect(advice.getByRole("link", { name: "Resize Image" })).toHaveAttribute(
    "href",
    "/tools/resize-image/",
  );

  // Nothing was swapped out to reach the number: the format is the one chosen.
  await expect(page.locator("[data-comparison-dimensions]")).toHaveText("600 × 450 px");
});

test("applies the limit to each picture in a batch on its own", async ({ page }) => {
  await page.goto("/tools/compress-image/");

  await page.getByLabel("Select an image to compress").setInputFiles([
    { name: "small.bmp", mimeType: "image/bmp", buffer: tinyImage() },
    { name: "noise.bmp", mimeType: "image/bmp", buffer: unsqueezableImage() },
  ]);
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await chooseTargetMode(page);
  await page.getByLabel("Size limit").selectOption("custom");
  await page.getByLabel("Custom size, in KB").fill("2");
  await page.getByRole("button", { name: "Compress 2 images" }).click();

  const rows = page.locator("[data-result-list] li");
  await expect(rows).toHaveCount(2, { timeout: 20_000 });
  await expect(rows.nth(0)).toContainText("within the 2 KB limit");
  await expect(rows.nth(1)).toContainText("over the 2 KB limit");
  await expect(page.locator("[data-target-outcome]")).toHaveText(
    "1 of 2 images came in under 2 KB.",
  );
  await expect(page.locator("[data-target-advice]")).toBeVisible();

  // The batch still packs everything it made, including the one that missed.
  await expect(
    page.getByRole("link", { name: "Download all 2 as a ZIP" }),
  ).toHaveAttribute("download", "compressed-images.zip");
  await expect(page.locator("[data-comparison]")).toBeHidden();
});

test("keeps PNG on the quality slider and says why", async ({ page }) => {
  await page.goto("/tools/compress-image/");

  await page.getByLabel("Select an image to compress").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });

  const target = page.getByRole("radio", { name: "Target file size" });

  await page.getByLabel("Output format").selectOption("image/jpeg");
  await expect(target).toBeEnabled();
  await chooseTargetMode(page);

  await page.getByLabel("Output format").selectOption("image/png");
  await expect(target).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Quality" })).toBeChecked();
  await expect(page.getByLabel("Size limit")).toBeHidden();
  await expect(page.locator("[data-quality]")).toBeDisabled();
  await expect(page.locator("[data-format-note]")).toContainText(
    "PNG stores every pixel exactly",
  );

  // The choice was disabled rather than discarded, so a format that supports it
  // brings it back as it was left.
  await page.getByLabel("Output format").selectOption("image/webp");
  await expect(target).toBeEnabled();
  await expect(target).toBeChecked();
  await expect(page.getByLabel("Size limit")).toBeVisible();
});

test("stops a target run on request and keeps the settings it was given", async ({
  page,
}) => {
  await page.goto("/tools/compress-image/");

  await page.getByLabel("Select an image to compress").setInputFiles(
    Array.from({ length: 6 }, (_, index) => ({
      name: `noise-${index + 1}.bmp`,
      mimeType: "image/bmp",
      buffer: unsqueezableImage(),
    })),
  );
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.locator("[data-quality]").fill("55");
  await chooseTargetMode(page);
  await page.getByLabel("Size limit").selectOption("custom");
  await page.getByLabel("Custom size, in KB").fill("1");

  const compress = page.getByRole("button", { name: /^Compress/ });

  await compress.click();
  await expect(compress).toHaveText("Compressing 1 of 6…");
  await page.getByRole("button", { name: "Stop" }).click();

  await expect(page.getByRole("button", { name: "Stop" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Compress 6 images" })).toBeEnabled();

  // The run that was stopped must not turn up afterwards and take the panel.
  // This is the one thing a wait is the honest way to check: the failure being
  // guarded against is a result arriving later, not one arriving wrong.
  await page.waitForTimeout(3_000);
  await expect(page.locator("[data-result]")).toBeHidden();
  await expect(page.locator("[data-editor]")).toBeVisible();

  // Stopping is a pause, not a reset: everything that was set is still set.
  await expect(page.locator("[data-quality]")).toHaveValue("55");
  await expect(page.getByRole("radio", { name: "Target file size" })).toBeChecked();
  await expect(page.getByLabel("Custom size, in KB")).toHaveValue("1");
});

test("drops a run whose images were replaced while it was working", async ({
  page,
}) => {
  await page.goto("/tools/compress-image/");

  const fileInput = page.getByLabel("Select an image to compress");

  await fileInput.setInputFiles(
    Array.from({ length: 6 }, (_, index) => ({
      name: `noise-${index + 1}.bmp`,
      mimeType: "image/bmp",
      buffer: unsqueezableImage(),
    })),
  );
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await chooseTargetMode(page);
  await page.getByLabel("Size limit").selectOption("custom");
  await page.getByLabel("Custom size, in KB").fill("1");
  await page.getByRole("button", { name: /^Compress/ }).click();
  await expect(page.getByRole("button", { name: /^Compress/ })).toHaveText(
    "Compressing 1 of 6…",
  );

  await fileInput.setInputFiles({
    name: "gradient.bmp",
    mimeType: "image/bmp",
    buffer: squeezableImage(),
  });
  await expect(page.locator("[data-input-name]")).toContainText("gradient.bmp");

  await page.waitForTimeout(3_000);
  await expect(page.locator("[data-result]")).toBeHidden();
  await expect(page.getByRole("button", { name: "Compress it" })).toBeEnabled();
});
