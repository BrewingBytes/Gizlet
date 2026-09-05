import { expect, test, type Page } from "@playwright/test";

/** A 40x20 PNG. Small, and landscape, so the cells come out landscape too. */
const gradient = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAFcElEQVR4nA3NEduqMQCA4ZeiUTSKRtEoGkWjaBSNolE06npgFL0UjaLRR6NoFI2iUTTqV5xz/4F7WRY2C2JhuyAXdgtqYb+gFw4LZuG4YBdOC27hvOAXLgth4boQF24LaeG+sC48FvLCc6Es/C3UhddCW3gv9IXPwlj4LsyF38KyCDYCIdgKpGAnUIK9QAsOAiM4CqzgJHCCs8ALLoIguAqi4CZIgrtgFTwEWfAUFMGfoApegiZ4C7rgIxiCr2AKfuJ/LNlIhGQrkZKdREn2Ei05SIzkKLGSk8RJzhIvuUiC5CqJkpskSe6SVfKQZMlTUiR/kip5SZrkLemSj2RIvpIp+cn/sWKjEIqtQip2CqXYK7TioDCKo8IqTgqnOCu84qIIiqsiKm6KpLgrVsVDkRVPRVH8KaripWiKt6IrPoqh+Cqm4qf+x5qNRmi2GqnZaZRmr9Gag8ZojhqrOWmc5qzxmosmaK6aqLlpkuauWTUPTdY8NUXzp6mal6Zp3pqu+WiG5quZmp/+Hxs2BmHYGqRhZ1CGvUEbDgZjOBqs4WRwhrPBGy6GYLgaouFmSIa7YTU8DNnwNBTDn6EaXoZmeBu64WMYhq9hGn7mf2zZWIRla5GWnUVZ9hZtOViM5WixlpPFWc4Wb7lYguVqiZabJVnultXysGTL01Isf5ZqeVma5W3plo9lWL6WafnZ/7Fj4xCOrUM6dg7l2Du04+AwjqPDOk4O5zg7vOPiCI6rIzpujuS4O1bHw5EdT0dx/Dmq4+VojrejOz6O4fg6puPn/seejUd4th7p2XmUZ+/RnoPHeI4e6zl5nOfs8Z6LJ3iunui5eZLn7lk9D0/2PD3F8+epnpened6e7vl4hufrmZ6f/x8HNgER2AZkYBdQgX1ABw4BEzgGbOAUcIFzwAcugRC4BmLgFkiBe2ANPAI58AyUwF+gBl6BFngHeuATGIFvYAZ+4X8c2UREZBuRkV1ERfYRHTlETOQYsZFTxEXOER+5RELkGomRWyRF7pE18ojkyDNSIn+RGnlFWuQd6ZFPZES+kRn5xf9xYpMQiW1CJnYJldgndOKQMIljwiZOCZc4J3zikgiJayImbomUuCfWxCORE89ESfwlauKVaIl3oic+iZH4Jmbil/7HK5sVsbJdkSu7FbWyX9ErhxWzclyxK6cVt3Je8SuXlbByXYkrt5W0cl9ZVx4reeW5Ulb+VurKa6WtvFf6ymdlrHxX5spv/R9nNhmR2WZkZpdRmX1GZw4ZkzlmbOaUcZlzxmcumZC5ZmLmlkmZe2bNPDI588yUzF+mZl6ZlnlneuaTGZlvZmZ++X9c2BREYVuQhV1BFfYFXTgUTOFYsIVTwRXOBV+4FELhWoiFWyEV7oW18CjkwrNQCn+FWngVWuFd6IVPYRS+hVn4lf9xZVMRlW1FVnYVVdlXdOVQMZVjxVZOFVc5V3zlUgmVayVWbpVUuVfWyqOSK89KqfxVauVVaZV3pVc+lVH5VmblV//HjU1DNLYN2dg1VGPf0I1DwzSODds4NVzj3PCNSyM0ro3YuDVS495YG49GbjwbpfHXqI1XozXejd74NEbj25iNX/sfdzYd0dl2ZGfXUZ19R3cOHdM5dmzn1HGdc8d3Lp3QuXZi59ZJnXtn7Tw6ufPslM5fp3ZendZ5d3rn0xmdb2d2fv1/PNgMxGA7kIPdQA32Az04DMzgOLCD08ANzgM/uAzC4DqIg9sgDe6DdfAY5MFzUAZ/gzp4DdrgPeiDz2AMvoM5+I3/8WQzEZPtRE52EzXZT/TkMDGT48ROThM3OU/85DIJk+skTm6TNLlP1sljkifPSZn8TerkNWmT96RPPpMx+U7m5Df5B/cYYh0XsBHwAAAAAElFTkSuQmCC",
  "base64",
);

/** A 1x1 PNG, for the collage that is one picture and a background. */
const onePixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
  "base64",
);

async function choose(page: Page, count: number) {
  await page.getByLabel("Select images for a collage").setInputFiles(
    Array.from({ length: count }, (_value, index) => ({
      name: `photo-${index + 1}.png`,
      mimeType: "image/png",
      buffer: gradient,
    })),
  );
}

test("arranges several local images into one picture and offers a download", async ({
  page,
}) => {
  await page.goto("/tools/collage-maker/");

  await choose(page, 4);

  await expect(page.getByText("4 images · stays on this device")).toBeVisible();
  await expect(page.getByRole("list", { name: "Images in this collage" }).getByRole("listitem")).toHaveCount(4);

  // The preview is the collage: a 2x2 grid of landscape cells at the width set.
  const preview = page.getByLabel("Collage preview");
  await expect(preview).toHaveJSProperty("width", 1600);
  await expect(page.locator("[data-plan-summary]")).toContainText("1600 × 824 px · grid · 4 images");

  await page.getByLabel("Layout").selectOption("row");
  await expect(page.locator("[data-plan-summary]")).toContainText("single row");
  await page.getByLabel("Layout").selectOption("grid");

  await page.getByLabel("Width px").fill("800");
  await expect(preview).toHaveJSProperty("width", 800);

  await page.getByLabel("Output format").selectOption("image/png");
  await page.getByRole("button", { name: "Make the collage" }).click();

  await expect(page.getByText("One picture out of many.")).toBeVisible();
  await expect(page.getByAltText("Finished collage preview")).toBeVisible();
  await expect(page.locator("[data-result-count]")).toHaveText("4 images");
  await expect(page.getByRole("link", { name: "Download collage" })).toHaveAttribute(
    "download",
    "photo-1-collage.png",
  );
});

test("keeps the order the list shows, and lets it be changed", async ({ page }) => {
  await page.goto("/tools/collage-maker/");

  await choose(page, 3);

  const names = page.getByRole("list", { name: "Images in this collage" }).getByRole("listitem");

  await expect(names.nth(0)).toContainText("photo-1.png");
  await expect(names.nth(2)).toContainText("photo-3.png");

  await names.nth(2).getByRole("button", { name: "↑" }).click();
  await expect(names.nth(1)).toContainText("photo-3.png");
  await expect(names.nth(2)).toContainText("photo-2.png");

  await names.nth(0).getByRole("button", { name: "Remove" }).click();
  await expect(names).toHaveCount(2);
  await expect(names.nth(0)).toContainText("photo-3.png");

  // The download is named for the first image, which is now a different one.
  await page.getByRole("button", { name: "Make the collage" }).click();
  await expect(page.getByRole("link", { name: "Download collage" })).toHaveAttribute(
    "download",
    "photo-3-collage.webp",
  );
});

test("refuses a file that is not an image, more than it will hold, and a collage too large to draw", async ({
  page,
}) => {
  await page.goto("/tools/collage-maker/");

  await page.getByLabel("Select images for a collage").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(page.getByRole("alert")).toContainText(
    "Only JPEG, PNG, WebP, AVIF, and BMP images can go in a collage.",
  );
  await expect(page.getByRole("heading", { name: "Drop your images here" })).toBeVisible();

  await choose(page, 13);

  await expect(page.getByRole("alert")).toContainText("A collage holds up to 12 images.");
  await expect(page.getByText("12 images · stays on this device")).toBeVisible();

  // The pixel ceiling is about the whole composition, not one picture: twelve
  // small images at this width add up to more than a canvas will hand back.
  await page.getByLabel("Layout").selectOption("column");
  await page.getByLabel("Width px").fill("16000");
  await expect(page.locator("[data-plan-summary]")).toContainText("Keep each side of the collage");
  await expect(page.getByRole("button", { name: "Make the collage" })).toBeDisabled();

  await page.getByLabel("Width px").fill("1600");
  await expect(page.getByRole("button", { name: "Make the collage" })).toBeEnabled();
});

test("makes a collage out of a single one-pixel image", async ({ page }) => {
  await page.goto("/tools/collage-maker/");

  await page.getByLabel("Select images for a collage").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: onePixel,
  });

  await expect(page.getByText("1 image · stays on this device")).toBeVisible();
  await page.getByRole("button", { name: "Make the collage" }).click();

  await expect(page.getByText("One picture out of many.")).toBeVisible();
  await expect(page.locator("[data-result-count]")).toHaveText("1 image");
  await expect(page.getByRole("link", { name: "Download collage" })).toHaveAttribute(
    "download",
    "tiny-collage.webp",
  );
});
