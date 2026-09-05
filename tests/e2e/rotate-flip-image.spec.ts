import { expect, test } from "@playwright/test";

/** A 40x20 PNG: landscape, so a quarter turn is visible in the numbers. */
const landscape = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAFcElEQVR4nA3NEduqMQCA4ZeiUTSKRtEoGkWjaBSNolE06npgFL0UjaLRR6NoFI2iUTTqV5xz/4F7WRY2C2JhuyAXdgtqYb+gFw4LZuG4YBdOC27hvOAXLgth4boQF24LaeG+sC48FvLCc6Es/C3UhddCW3gv9IXPwlj4LsyF38KyCDYCIdgKpGAnUIK9QAsOAiM4CqzgJHCCs8ALLoIguAqi4CZIgrtgFTwEWfAUFMGfoApegiZ4C7rgIxiCr2AKfuJ/LNlIhGQrkZKdREn2Ei05SIzkKLGSk8RJzhIvuUiC5CqJkpskSe6SVfKQZMlTUiR/kip5SZrkLemSj2RIvpIp+cn/sWKjEIqtQip2CqXYK7TioDCKo8IqTgqnOCu84qIIiqsiKm6KpLgrVsVDkRVPRVH8KaripWiKt6IrPoqh+Cqm4qf+x5qNRmi2GqnZaZRmr9Gag8ZojhqrOWmc5qzxmosmaK6aqLlpkuauWTUPTdY8NUXzp6mal6Zp3pqu+WiG5quZmp/+Hxs2BmHYGqRhZ1CGvUEbDgZjOBqs4WRwhrPBGy6GYLgaouFmSIa7YTU8DNnwNBTDn6EaXoZmeBu64WMYhq9hGn7mf2zZWIRla5GWnUVZ9hZtOViM5WixlpPFWc4Wb7lYguVqiZabJVnultXysGTL01Isf5ZqeVma5W3plo9lWL6WafnZ/7Fj4xCOrUM6dg7l2Du04+AwjqPDOk4O5zg7vOPiCI6rIzpujuS4O1bHw5EdT0dx/Dmq4+VojrejOz6O4fg6puPn/seejUd4th7p2XmUZ+/RnoPHeI4e6zl5nOfs8Z6LJ3iunui5eZLn7lk9D0/2PD3F8+epnpened6e7vl4hufrmZ6f/x8HNgER2AZkYBdQgX1ABw4BEzgGbOAUcIFzwAcugRC4BmLgFkiBe2ANPAI58AyUwF+gBl6BFngHeuATGIFvYAZ+4X8c2UREZBuRkV1ERfYRHTlETOQYsZFTxEXOER+5RELkGomRWyRF7pE18ojkyDNSIn+RGnlFWuQd6ZFPZES+kRn5xf9xYpMQiW1CJnYJldgndOKQMIljwiZOCZc4J3zikgiJayImbomUuCfWxCORE89ESfwlauKVaIl3oic+iZH4Jmbil/7HK5sVsbJdkSu7FbWyX9ErhxWzclyxK6cVt3Je8SuXlbByXYkrt5W0cl9ZVx4reeW5Ulb+VurKa6WtvFf6ymdlrHxX5spv/R9nNhmR2WZkZpdRmX1GZw4ZkzlmbOaUcZlzxmcumZC5ZmLmlkmZe2bNPDI588yUzF+mZl6ZlnlneuaTGZlvZmZ++X9c2BREYVuQhV1BFfYFXTgUTOFYsIVTwRXOBV+4FELhWoiFWyEV7oW18CjkwrNQCn+FWngVWuFd6IVPYRS+hVn4lf9xZVMRlW1FVnYVVdlXdOVQMZVjxVZOFVc5V3zlUgmVayVWbpVUuVfWyqOSK89KqfxVauVVaZV3pVc+lVH5VmblV//HjU1DNLYN2dg1VGPf0I1DwzSODds4NVzj3PCNSyM0ro3YuDVS495YG49GbjwbpfHXqI1XozXejd74NEbj25iNX/sfdzYd0dl2ZGfXUZ19R3cOHdM5dmzn1HGdc8d3Lp3QuXZi59ZJnXtn7Tw6ufPslM5fp3ZendZ5d3rn0xmdb2d2fv1/PNgMxGA7kIPdQA32Az04DMzgOLCD08ANzgM/uAzC4DqIg9sgDe6DdfAY5MFzUAZ/gzp4DdrgPeiDz2AMvoM5+I3/8WQzEZPtRE52EzXZT/TkMDGT48ROThM3OU/85DIJk+skTm6TNLlP1sljkifPSZn8TerkNWmT96RPPpMx+U7m5Df5B/cYYh0XsBHwAAAAAElFTkSuQmCC",
  "base64",
);

test("rotates an image, swaps its sides, and offers a local download", async ({
  page,
}) => {
  await page.goto("/tools/rotate-flip-image/");

  await page.getByLabel("Select an image to rotate or flip").setInputFiles({
    name: "sideways.png",
    mimeType: "image/png",
    buffer: landscape,
  });

  const preview = page.getByLabel("Image preview in its current orientation");

  await expect(preview).toBeVisible();
  await expect(page.locator("[data-orientation-summary]")).toHaveText(
    "Unchanged · 40 × 20 px",
  );
  await expect(page.getByRole("button", { name: "Put it back" })).toBeDisabled();

  await page.getByRole("button", { name: "Rotate right" }).click();
  await expect(page.locator("[data-orientation-summary]")).toHaveText(
    "Rotated right 90° · 20 × 40 px",
  );
  await expect(preview).toHaveJSProperty("width", 20);
  await expect(preview).toHaveJSProperty("height", 40);

  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Save it" }).click();

  await expect(page.getByText("The right way up.")).toBeVisible();
  await expect(page.getByAltText("Turned image preview")).toBeVisible();
  await expect(page.locator("[data-original-dimensions]")).toHaveText("40 × 20 px");
  await expect(page.locator("[data-result-dimensions]")).toHaveText("20 × 40 px");
  await expect(page.locator("[data-result-orientation]")).toHaveText("Rotated right 90°");
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    "sideways-rotated.jpg",
  );
});

test("folds every press into one orientation rather than stacking transforms", async ({
  page,
}) => {
  await page.goto("/tools/rotate-flip-image/");

  await page.getByLabel("Select an image to rotate or flip").setInputFiles({
    name: "sideways.png",
    mimeType: "image/png",
    buffer: landscape,
  });

  const summary = page.locator("[data-orientation-summary]");
  const rotateRight = page.getByRole("button", { name: "Rotate right" });

  // Four quarter turns are not four transforms: they are none.
  for (let press = 0; press < 4; press += 1) await rotateRight.click();
  await expect(summary).toHaveText("Unchanged · 40 × 20 px");

  // A flip pressed twice comes back too, whatever rotation is already applied.
  await page.getByRole("button", { name: "Rotate left" }).click();
  await page.getByRole("button", { name: "Flip horizontally" }).click();
  await expect(summary).toHaveText("Rotated right 90° · flipped horizontally · 20 × 40 px");
  await page.getByRole("button", { name: "Flip horizontally" }).click();
  await expect(summary).toHaveText("Rotated left 90° · 20 × 40 px");

  await page.getByRole("button", { name: "Flip vertically" }).click();
  await page.getByRole("button", { name: "Save it" }).click();
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    "sideways-rotated-flipped.png",
  );

  await page.getByRole("button", { name: "Keep turning it" }).click();
  await page.getByRole("button", { name: "Put it back" }).click();
  await expect(summary).toHaveText("Unchanged · 40 × 20 px");
});

test("refuses a file that is not an image", async ({ page }) => {
  await page.goto("/tools/rotate-flip-image/");

  await page.getByLabel("Select an image to rotate or flip").setInputFiles({
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
