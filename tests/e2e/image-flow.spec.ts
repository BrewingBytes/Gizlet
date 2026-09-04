import { expect, test } from "@playwright/test";

test("builds and runs a local image flow", async ({ page }) => {
  await page.goto("/flows/");

  await expect(page).toHaveTitle("Gizlet Flows | Gizlet");
  await expect(page.getByRole("heading", { name: "Make a little assembly line." })).toBeVisible();
  await expect(page.getByLabel("Flow category")).toHaveValue("images");
  await expect(page.locator("[data-result]")).toBeHidden();

  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Choose images for this flow").setInputFiles({
    name: "tiny.webp",
    mimeType: "image/webp",
    buffer: image,
  });
  await expect(page.getByText("tiny.webp")).toBeVisible();

  const nextTool = page.getByLabel("Next compatible Gizlet");
  await nextTool.selectOption("convert-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await expect(page.getByRole("heading", { name: "Convert Image" })).toBeVisible();
  await expect(page.getByLabel("Final output format")).toHaveValue("image/webp");

  await nextTool.selectOption("resize-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Resize Image width").fill("500");
  await page.getByLabel("Resize Image height").fill("500");

  await nextTool.selectOption("compress-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await expect(page.getByLabel("Compress Image quality")).toHaveValue("80");
  await page.getByRole("button", { name: "Run flow" }).click();

  await expect(page.locator("[data-status]")).toContainText("final image is ready");
  await expect(page.locator("[data-result]")).toBeVisible();
  await expect(page.getByAltText("Final flow result")).toBeVisible();
  await expect(page.getByAltText("Final flow result")).toHaveJSProperty("naturalWidth", 500);
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    "tiny-converted-resized-compressed.webp",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("crops to a shape inside a flow, where there is nobody to draw one", async ({ page }) => {
  await page.goto("/flows/");

  await page.getByLabel("Choose images for this flow").setInputFiles({
    name: "gradient.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAFcElEQVR4nA3NEduqMQCA4ZeiUTSKRtEoGkWjaBSNolE06npgFL0UjaLRR6NoFI2iUTTqV5xz/4F7WRY2C2JhuyAXdgtqYb+gFw4LZuG4YBdOC27hvOAXLgth4boQF24LaeG+sC48FvLCc6Es/C3UhddCW3gv9IXPwlj4LsyF38KyCDYCIdgKpGAnUIK9QAsOAiM4CqzgJHCCs8ALLoIguAqi4CZIgrtgFTwEWfAUFMGfoApegiZ4C7rgIxiCr2AKfuJ/LNlIhGQrkZKdREn2Ei05SIzkKLGSk8RJzhIvuUiC5CqJkpskSe6SVfKQZMlTUiR/kip5SZrkLemSj2RIvpIp+cn/sWKjEIqtQip2CqXYK7TioDCKo8IqTgqnOCu84qIIiqsiKm6KpLgrVsVDkRVPRVH8KaripWiKt6IrPoqh+Cqm4qf+x5qNRmi2GqnZaZRmr9Gag8ZojhqrOWmc5qzxmosmaK6aqLlpkuauWTUPTdY8NUXzp6mal6Zp3pqu+WiG5quZmp/+Hxs2BmHYGqRhZ1CGvUEbDgZjOBqs4WRwhrPBGy6GYLgaouFmSIa7YTU8DNnwNBTDn6EaXoZmeBu64WMYhq9hGn7mf2zZWIRla5GWnUVZ9hZtOViM5WixlpPFWc4Wb7lYguVqiZabJVnultXysGTL01Isf5ZqeVma5W3plo9lWL6WafnZ/7Fj4xCOrUM6dg7l2Du04+AwjqPDOk4O5zg7vOPiCI6rIzpujuS4O1bHw5EdT0dx/Dmq4+VojrejOz6O4fg6puPn/seejUd4th7p2XmUZ+/RnoPHeI4e6zl5nOfs8Z6LJ3iunui5eZLn7lk9D0/2PD3F8+epnpened6e7vl4hufrmZ6f/x8HNgER2AZkYBdQgX1ABw4BEzgGbOAUcIFzwAcugRC4BmLgFkiBe2ANPAI58AyUwF+gBl6BFngHeuATGIFvYAZ+4X8c2UREZBuRkV1ERfYRHTlETOQYsZFTxEXOER+5RELkGomRWyRF7pE18ojkyDNSIn+RGnlFWuQd6ZFPZES+kRn5xf9xYpMQiW1CJnYJldgndOKQMIljwiZOCZc4J3zikgiJayImbomUuCfWxCORE89ESfwlauKVaIl3oic+iZH4Jmbil/7HK5sVsbJdkSu7FbWyX9ErhxWzclyxK6cVt3Je8SuXlbByXYkrt5W0cl9ZVx4reeW5Ulb+VurKa6WtvFf6ymdlrHxX5spv/R9nNhmR2WZkZpdRmX1GZw4ZkzlmbOaUcZlzxmcumZC5ZmLmlkmZe2bNPDI588yUzF+mZl6ZlnlneuaTGZlvZmZ++X9c2BREYVuQhV1BFfYFXTgUTOFYsIVTwRXOBV+4FELhWoiFWyEV7oW18CjkwrNQCn+FWngVWuFd6IVPYRS+hVn4lf9xZVMRlW1FVnYVVdlXdOVQMZVjxVZOFVc5V3zlUgmVayVWbpVUuVfWyqOSK89KqfxVauVVaZV3pVc+lVH5VmblV//HjU1DNLYN2dg1VGPf0I1DwzSODds4NVzj3PCNSyM0ro3YuDVS495YG49GbjwbpfHXqI1XozXejd74NEbj25iNX/sfdzYd0dl2ZGfXUZ19R3cOHdM5dmzn1HGdc8d3Lp3QuXZi59ZJnXtn7Tw6ufPslM5fp3ZendZ5d3rn0xmdb2d2fv1/PNgMxGA7kIPdQA32Az04DMzgOLCD08ANzgM/uAzC4DqIg9sgDe6DdfAY5MFzUAZ/gzp4DdrgPeiDz2AMvoM5+I3/8WQzEZPtRE52EzXZT/TkMDGT48ROThM3OU/85DIJk+skTm6TNLlP1sljkifPSZn8TerkNWmT96RPPpMx+U7m5Df5B/cYYh0XsBHwAAAAAElFTkSuQmCC",
      "base64",
    ),
  });

  await page.getByLabel("Next compatible Gizlet").selectOption("crop-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await expect(page.getByLabel("Crop Image aspect ratio")).toHaveValue("1:1");
  await page.getByLabel("Crop Image aspect ratio").selectOption("16:9");
  await page.getByRole("button", { name: "Run flow" }).click();

  // 40x20 has no 16:9 rectangle wider than 36 pixels, taken from its middle.
  await expect(page.locator("[data-result]")).toBeVisible();
  await expect(page.getByAltText("Final flow result")).toHaveJSProperty("naturalWidth", 36);
  await expect(page.getByAltText("Final flow result")).toHaveJSProperty("naturalHeight", 20);
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    "gradient-cropped.png",
  );

  await page.getByRole("button", { name: "Copy recipe link" }).click();
  await expect(page).toHaveURL(/#r=v1;f=png;crop-image:a=16x9$/);
});

test("arranges the images a flow is carrying into one collage", async ({ page }) => {
  await page.goto("/flows/");

  const nextTool = page.getByLabel("Next compatible Gizlet");
  await nextTool.selectOption("collage-maker");
  await page.getByRole("button", { name: "Add step" }).click();

  // The ceiling belongs to the block rather than to the category: assembling
  // pages and arranging a collage take different numbers of pictures.
  await expect(page.locator("[data-source-details]")).toContainText("Up to 12 images");
  await expect(page.getByText("Your images → one image")).toBeVisible();
  await expect(page.getByLabel("Collage Maker layout")).toHaveValue("grid");

  await page.getByLabel("Choose images for this flow").setInputFiles(
    Array.from({ length: 3 }, (_value, index) => ({
      name: `photo-${index + 1}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAFcElEQVR4nA3NEduqMQCA4ZeiUTSKRtEoGkWjaBSNolE06npgFL0UjaLRR6NoFI2iUTTqV5xz/4F7WRY2C2JhuyAXdgtqYb+gFw4LZuG4YBdOC27hvOAXLgth4boQF24LaeG+sC48FvLCc6Es/C3UhddCW3gv9IXPwlj4LsyF38KyCDYCIdgKpGAnUIK9QAsOAiM4CqzgJHCCs8ALLoIguAqi4CZIgrtgFTwEWfAUFMGfoApegiZ4C7rgIxiCr2AKfuJ/LNlIhGQrkZKdREn2Ei05SIzkKLGSk8RJzhIvuUiC5CqJkpskSe6SVfKQZMlTUiR/kip5SZrkLemSj2RIvpIp+cn/sWKjEIqtQip2CqXYK7TioDCKo8IqTgqnOCu84qIIiqsiKm6KpLgrVsVDkRVPRVH8KaripWiKt6IrPoqh+Cqm4qf+x5qNRmi2GqnZaZRmr9Gag8ZojhqrOWmc5qzxmosmaK6aqLlpkuauWTUPTdY8NUXzp6mal6Zp3pqu+WiG5quZmp/+Hxs2BmHYGqRhZ1CGvUEbDgZjOBqs4WRwhrPBGy6GYLgaouFmSIa7YTU8DNnwNBTDn6EaXoZmeBu64WMYhq9hGn7mf2zZWIRla5GWnUVZ9hZtOViM5WixlpPFWc4Wb7lYguVqiZabJVnultXysGTL01Isf5ZqeVma5W3plo9lWL6WafnZ/7Fj4xCOrUM6dg7l2Du04+AwjqPDOk4O5zg7vOPiCI6rIzpujuS4O1bHw5EdT0dx/Dmq4+VojrejOz6O4fg6puPn/seejUd4th7p2XmUZ+/RnoPHeI4e6zl5nOfs8Z6LJ3iunui5eZLn7lk9D0/2PD3F8+epnpened6e7vl4hufrmZ6f/x8HNgER2AZkYBdQgX1ABw4BEzgGbOAUcIFzwAcugRC4BmLgFkiBe2ANPAI58AyUwF+gBl6BFngHeuATGIFvYAZ+4X8c2UREZBuRkV1ERfYRHTlETOQYsZFTxEXOER+5RELkGomRWyRF7pE18ojkyDNSIn+RGnlFWuQd6ZFPZES+kRn5xf9xYpMQiW1CJnYJldgndOKQMIljwiZOCZc4J3zikgiJayImbomUuCfWxCORE89ESfwlauKVaIl3oic+iZH4Jmbil/7HK5sVsbJdkSu7FbWyX9ErhxWzclyxK6cVt3Je8SuXlbByXYkrt5W0cl9ZVx4reeW5Ulb+VurKa6WtvFf6ymdlrHxX5spv/R9nNhmR2WZkZpdRmX1GZw4ZkzlmbOaUcZlzxmcumZC5ZmLmlkmZe2bNPDI588yUzF+mZl6ZlnlneuaTGZlvZmZ++X9c2BREYVuQhV1BFfYFXTgUTOFYsIVTwRXOBV+4FELhWoiFWyEV7oW18CjkwrNQCn+FWngVWuFd6IVPYRS+hVn4lf9xZVMRlW1FVnYVVdlXdOVQMZVjxVZOFVc5V3zlUgmVayVWbpVUuVfWyqOSK89KqfxVauVVaZV3pVc+lVH5VmblV//HjU1DNLYN2dg1VGPf0I1DwzSODds4NVzj3PCNSyM0ro3YuDVS495YG49GbjwbpfHXqI1XozXejd74NEbj25iNX/sfdzYd0dl2ZGfXUZ19R3cOHdM5dmzn1HGdc8d3Lp3QuXZi59ZJnXtn7Tw6ufPslM5fp3ZendZ5d3rn0xmdb2d2fv1/PNgMxGA7kIPdQA32Az04DMzgOLCD08ANzgM/uAzC4DqIg9sgDe6DdfAY5MFzUAZ/gzp4DdrgPeiDz2AMvoM5+I3/8WQzEZPtRE52EzXZT/TkMDGT48ROThM3OU/85DIJk+skTm6TNLlP1sljkifPSZn8TerkNWmT96RPPpMx+U7m5Df5B/cYYh0XsBHwAAAAAElFTkSuQmCC",
        "base64",
      ),
    })),
  );
  await expect(page.locator("[data-source-details]")).toContainText("3 images");

  await page.getByRole("button", { name: "Run flow" }).click();

  // Three landscape pictures make a 2x2 grid with a gap, at the collage's own
  // default width: one image out of several, which is the whole block.
  await expect(page.getByAltText("Final flow result")).toHaveJSProperty("naturalWidth", 1600);
  await expect(page.getByAltText("Final flow result")).toHaveJSProperty("naturalHeight", 824);
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    "photo-1-collage.png",
  );
});

test("explains unsupported and unreadable flow inputs when they are chosen", async ({ page }) => {
  await page.goto("/flows/");

  const input = page.getByLabel("Choose images for this flow");
  await input.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Choose a JPEG, PNG, WebP, AVIF, or BMP image to start this flow.",
  );

  // The source is decoded when it is chosen, so an unreadable file is refused
  // before a chain is built on top of it rather than at the end of a run.
  await input.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toHaveText("This image could not be read.");

  await page.getByLabel("Next compatible Gizlet").selectOption("convert-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await expect(page.getByRole("button", { name: "Run flow" })).toBeDisabled();
});
