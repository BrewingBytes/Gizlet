import { expect, test } from "@playwright/test";

/** A 40x20 PNG, which is big enough to have a middle to crop to. */
const gradient = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAFcElEQVR4nA3NEduqMQCA4ZeiUTSKRtEoGkWjaBSNolE06npgFL0UjaLRR6NoFI2iUTTqV5xz/4F7WRY2C2JhuyAXdgtqYb+gFw4LZuG4YBdOC27hvOAXLgth4boQF24LaeG+sC48FvLCc6Es/C3UhddCW3gv9IXPwlj4LsyF38KyCDYCIdgKpGAnUIK9QAsOAiM4CqzgJHCCs8ALLoIguAqi4CZIgrtgFTwEWfAUFMGfoApegiZ4C7rgIxiCr2AKfuJ/LNlIhGQrkZKdREn2Ei05SIzkKLGSk8RJzhIvuUiC5CqJkpskSe6SVfKQZMlTUiR/kip5SZrkLemSj2RIvpIp+cn/sWKjEIqtQip2CqXYK7TioDCKo8IqTgqnOCu84qIIiqsiKm6KpLgrVsVDkRVPRVH8KaripWiKt6IrPoqh+Cqm4qf+x5qNRmi2GqnZaZRmr9Gag8ZojhqrOWmc5qzxmosmaK6aqLlpkuauWTUPTdY8NUXzp6mal6Zp3pqu+WiG5quZmp/+Hxs2BmHYGqRhZ1CGvUEbDgZjOBqs4WRwhrPBGy6GYLgaouFmSIa7YTU8DNnwNBTDn6EaXoZmeBu64WMYhq9hGn7mf2zZWIRla5GWnUVZ9hZtOViM5WixlpPFWc4Wb7lYguVqiZabJVnultXysGTL01Isf5ZqeVma5W3plo9lWL6WafnZ/7Fj4xCOrUM6dg7l2Du04+AwjqPDOk4O5zg7vOPiCI6rIzpujuS4O1bHw5EdT0dx/Dmq4+VojrejOz6O4fg6puPn/seejUd4th7p2XmUZ+/RnoPHeI4e6zl5nOfs8Z6LJ3iunui5eZLn7lk9D0/2PD3F8+epnpened6e7vl4hufrmZ6f/x8HNgER2AZkYBdQgX1ABw4BEzgGbOAUcIFzwAcugRC4BmLgFkiBe2ANPAI58AyUwF+gBl6BFngHeuATGIFvYAZ+4X8c2UREZBuRkV1ERfYRHTlETOQYsZFTxEXOER+5RELkGomRWyRF7pE18ojkyDNSIn+RGnlFWuQd6ZFPZES+kRn5xf9xYpMQiW1CJnYJldgndOKQMIljwiZOCZc4J3zikgiJayImbomUuCfWxCORE89ESfwlauKVaIl3oic+iZH4Jmbil/7HK5sVsbJdkSu7FbWyX9ErhxWzclyxK6cVt3Je8SuXlbByXYkrt5W0cl9ZVx4reeW5Ulb+VurKa6WtvFf6ymdlrHxX5spv/R9nNhmR2WZkZpdRmX1GZw4ZkzlmbOaUcZlzxmcumZC5ZmLmlkmZe2bNPDI588yUzF+mZl6ZlnlneuaTGZlvZmZ++X9c2BREYVuQhV1BFfYFXTgUTOFYsIVTwRXOBV+4FELhWoiFWyEV7oW18CjkwrNQCn+FWngVWuFd6IVPYRS+hVn4lf9xZVMRlW1FVnYVVdlXdOVQMZVjxVZOFVc5V3zlUgmVayVWbpVUuVfWyqOSK89KqfxVauVVaZV3pVc+lVH5VmblV//HjU1DNLYN2dg1VGPf0I1DwzSODds4NVzj3PCNSyM0ro3YuDVS495YG49GbjwbpfHXqI1XozXejd74NEbj25iNX/sfdzYd0dl2ZGfXUZ19R3cOHdM5dmzn1HGdc8d3Lp3QuXZi59ZJnXtn7Tw6ufPslM5fp3ZendZ5d3rn0xmdb2d2fv1/PNgMxGA7kIPdQA32Az04DMzgOLCD08ANzgM/uAzC4DqIg9sgDe6DdfAY5MFzUAZ/gzp4DdrgPeiDz2AMvoM5+I3/8WQzEZPtRE52EzXZT/TkMDGT48ROThM3OU/85DIJk+skTm6TNLlP1sljkifPSZn8TerkNWmT96RPPpMx+U7m5Df5B/cYYh0XsBHwAAAAAElFTkSuQmCC",
  "base64",
);

/** A 1x1 PNG: the smallest image there is, and still a valid selection. */
const onePixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
  "base64",
);

test("crops the area a visitor selects and offers a local download", async ({
  page,
}) => {
  await page.goto("/tools/crop-image/");

  await page.getByLabel("Select an image to crop").setInputFiles({
    name: "gradient.png",
    mimeType: "image/png",
    buffer: gradient,
  });

  await expect(page.getByAltText("Selected image preview")).toBeVisible();

  // A fresh selection is the whole image: nothing has been thrown away yet.
  await expect(page.locator("[data-crop-preview]")).toHaveText(
    "40 × 20 px · 100% of the image",
  );

  // A ratio takes the largest rectangle of that shape, from the middle.
  await page.getByLabel("Aspect ratio").selectOption("1:1");
  await expect(page.locator("[data-crop-preview]")).toHaveText(
    "20 × 20 px · 50% of the image",
  );
  await expect(page.getByLabel("Left px")).toHaveValue("10");

  // Typed numbers are the exact path, and free crop accepts any shape.
  await page.getByLabel("Aspect ratio").selectOption("free");
  for (const [label, value] of [
    ["Width px", "16"],
    ["Height px", "8"],
    ["Left px", "4"],
    ["Top px", "2"],
  ] as const) {
    await page.getByLabel(label).fill(value);
    await page.getByLabel(label).blur();
  }
  await expect(page.locator("[data-crop-preview]")).toHaveText(
    "16 × 8 px · 16% of the image",
  );

  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Crop it" }).click();

  await expect(page.getByText("Just the part you wanted.")).toBeVisible();
  await expect(page.getByAltText("Cropped image preview")).toBeVisible();
  await expect(page.locator("[data-original-dimensions]")).toHaveText(
    "40 × 20 px",
  );
  await expect(page.locator("[data-result-dimensions]")).toHaveText(
    "16 × 8 px",
  );
  await expect(
    page.getByRole("link", { name: "Download image" }),
  ).toHaveAttribute("download", "gradient-cropped.jpg");

  await page.getByRole("button", { name: "Choose another image" }).click();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).toBeVisible();
});

test("moves and resizes the selection from the keyboard alone", async ({
  page,
}) => {
  await page.goto("/tools/crop-image/");

  await page.getByLabel("Select an image to crop").setInputFiles({
    name: "gradient.png",
    mimeType: "image/png",
    buffer: gradient,
  });

  await page.getByLabel("Aspect ratio").selectOption("1:1");
  await expect(page.getByLabel("Left px")).toHaveValue("10");

  const selection = page.getByRole("group", { name: /Crop selection/ });
  await selection.focus();

  // Ten pixels a step, one with Alt held, and the edge of the image stops it.
  await selection.press("ArrowLeft");
  await expect(page.getByLabel("Left px")).toHaveValue("0");
  await selection.press("ArrowLeft");
  await expect(page.getByLabel("Left px")).toHaveValue("0");
  await selection.press("Alt+ArrowRight");
  await expect(page.getByLabel("Left px")).toHaveValue("1");

  // Shift resizes instead of moving, and the locked shape decides the rest.
  await selection.press("Shift+ArrowLeft");
  await expect(page.getByLabel("Width px")).toHaveValue("10");
  await expect(page.getByLabel("Height px")).toHaveValue("10");
});

test("refuses a file that is not an image, and still crops a one-pixel one", async ({
  page,
}) => {
  await page.goto("/tools/crop-image/");

  await page.getByLabel("Select an image to crop").setInputFiles({
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

  await page.getByLabel("Select an image to crop").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: onePixel,
  });

  // Every ratio still has to fit inside one pixel, and one pixel is croppable.
  await page.getByLabel("Aspect ratio").selectOption("16:9");
  await expect(page.locator("[data-crop-preview]")).toHaveText(
    "1 × 1 px · 100% of the image",
  );
  await page.getByRole("button", { name: "Crop it" }).click();

  await expect(page.getByText("Just the part you wanted.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download image" }),
  ).toHaveAttribute("download", "tiny-cropped.png");
});
