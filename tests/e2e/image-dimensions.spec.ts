import { expect, test } from "@playwright/test";

/** A 40x20 PNG: landscape, and exactly 2:1. */
const landscape = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAFcElEQVR4nA3NEduqMQCA4ZeiUTSKRtEoGkWjaBSNolE06npgFL0UjaLRR6NoFI2iUTTqV5xz/4F7WRY2C2JhuyAXdgtqYb+gFw4LZuG4YBdOC27hvOAXLgth4boQF24LaeG+sC48FvLCc6Es/C3UhddCW3gv9IXPwlj4LsyF38KyCDYCIdgKpGAnUIK9QAsOAiM4CqzgJHCCs8ALLoIguAqi4CZIgrtgFTwEWfAUFMGfoApegiZ4C7rgIxiCr2AKfuJ/LNlIhGQrkZKdREn2Ei05SIzkKLGSk8RJzhIvuUiC5CqJkpskSe6SVfKQZMlTUiR/kip5SZrkLemSj2RIvpIp+cn/sWKjEIqtQip2CqXYK7TioDCKo8IqTgqnOCu84qIIiqsiKm6KpLgrVsVDkRVPRVH8KaripWiKt6IrPoqh+Cqm4qf+x5qNRmi2GqnZaZRmr9Gag8ZojhqrOWmc5qzxmosmaK6aqLlpkuauWTUPTdY8NUXzp6mal6Zp3pqu+WiG5quZmp/+Hxs2BmHYGqRhZ1CGvUEbDgZjOBqs4WRwhrPBGy6GYLgaouFmSIa7YTU8DNnwNBTDn6EaXoZmeBu64WMYhq9hGn7mf2zZWIRla5GWnUVZ9hZtOViM5WixlpPFWc4Wb7lYguVqiZabJVnultXysGTL01Isf5ZqeVma5W3plo9lWL6WafnZ/7Fj4xCOrUM6dg7l2Du04+AwjqPDOk4O5zg7vOPiCI6rIzpujuS4O1bHw5EdT0dx/Dmq4+VojrejOz6O4fg6puPn/seejUd4th7p2XmUZ+/RnoPHeI4e6zl5nOfs8Z6LJ3iunui5eZLn7lk9D0/2PD3F8+epnpened6e7vl4hufrmZ6f/x8HNgER2AZkYBdQgX1ABw4BEzgGbOAUcIFzwAcugRC4BmLgFkiBe2ANPAI58AyUwF+gBl6BFngHeuATGIFvYAZ+4X8c2UREZBuRkV1ERfYRHTlETOQYsZFTxEXOER+5RELkGomRWyRF7pE18ojkyDNSIn+RGnlFWuQd6ZFPZES+kRn5xf9xYpMQiW1CJnYJldgndOKQMIljwiZOCZc4J3zikgiJayImbomUuCfWxCORE89ESfwlauKVaIl3oic+iZH4Jmbil/7HK5sVsbJdkSu7FbWyX9ErhxWzclyxK6cVt3Je8SuXlbByXYkrt5W0cl9ZVx4reeW5Ulb+VurKa6WtvFf6ymdlrHxX5spv/R9nNhmR2WZkZpdRmX1GZw4ZkzlmbOaUcZlzxmcumZC5ZmLmlkmZe2bNPDI588yUzF+mZl6ZlnlneuaTGZlvZmZ++X9c2BREYVuQhV1BFfYFXTgUTOFYsIVTwRXOBV+4FELhWoiFWyEV7oW18CjkwrNQCn+FWngVWuFd6IVPYRS+hVn4lf9xZVMRlW1FVnYVVdlXdOVQMZVjxVZOFVc5V3zlUgmVayVWbpVUuVfWyqOSK89KqfxVauVVaZV3pVc+lVH5VmblV//HjU1DNLYN2dg1VGPf0I1DwzSODds4NVzj3PCNSyM0ro3YuDVS495YG49GbjwbpfHXqI1XozXejd74NEbj25iNX/sfdzYd0dl2ZGfXUZ19R3cOHdM5dmzn1HGdc8d3Lp3QuXZi59ZJnXtn7Tw6ufPslM5fp3ZendZ5d3rn0xmdb2d2fv1/PNgMxGA7kIPdQA32Az04DMzgOLCD08ANzgM/uAzC4DqIg9sgDe6DdfAY5MFzUAZ/gzp4DdrgPeiDz2AMvoM5+I3/8WQzEZPtRE52EzXZT/TkMDGT48ROThM3OU/85DIJk+skTm6TNLlP1sljkifPSZn8TerkNWmT96RPPpMx+U7m5Df5B/cYYh0XsBHwAAAAAElFTkSuQmCC",
  "base64",
);

test("measures an image and copies the numbers a visitor came for", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/image-dimensions/");

  await page.getByLabel("Select an image to measure").setInputFiles({
    name: "banner.png",
    mimeType: "image/png",
    buffer: landscape,
  });

  await expect(page.getByAltText("Measured image preview")).toBeVisible();

  const facts = page.locator(".dimensions-fact");

  await expect(facts.nth(0)).toContainText("40 × 20");
  await expect(facts.nth(1)).toContainText("2:1");
  await expect(facts.nth(2)).toContainText("40 px");
  await expect(facts.nth(3)).toContainText("20 px");
  await expect(facts.nth(4)).toContainText("Under 0.1 MP");
  await expect(facts.nth(5)).toContainText("Landscape");
  await expect(facts.nth(6)).toContainText("PNG");

  await page.getByRole("button", { name: "Copy dimensions" }).click();
  await expect(page.getByText("Dimensions copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("40 × 20");

  await page.getByRole("button", { name: "Copy aspect ratio" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("2:1");

  // Only the values somebody pastes somewhere carry a copy button.
  await expect(page.getByRole("button", { name: /^Copy/ })).toHaveCount(4);

  await page.getByRole("button", { name: "Measure another image" }).click();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).toBeVisible();
});

test("says clearly when a file cannot be measured", async ({ page }) => {
  await page.goto("/tools/image-dimensions/");

  await page.getByLabel("Select an image to measure").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("Choose a JPEG, PNG, WebP, AVIF, or BMP image."),
  ).toBeVisible();

  // A file that claims to be an image and is not gets as far as the decoder,
  // which is where it has to fail rather than reporting nonsense.
  await page.getByLabel("Select an image to measure").setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image either"),
  });
  await expect(page.getByText("This image could not be read.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).toBeVisible();
});
