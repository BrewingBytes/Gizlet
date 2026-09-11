import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { fixedPdfPageSizes } from "../../src/data/jpg-to-pdf";
import { samplePdf } from "./support/sample-pdf";

/**
 * A 40 x 20 gradient, so the widescreen crop has a rectangle to take and the
 * resize has something to redraw. The same picture the flow's own crop test
 * uses, for the same reason: its shape is known.
 */
const gradientPng =
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAFcElEQVR4nA3NEduqMQCA4ZeiUTSKRtEoGkWjaBSNolE06npgFL0UjaLRR6NoFI2iUTTqV5xz/4F7WRY2C2JhuyAXdgtqYb+gFw4LZuG4YBdOC27hvOAXLgth4boQF24LaeG+sC48FvLCc6Es/C3UhddCW3gv9IXPwlj4LsyF38KyCDYCIdgKpGAnUIK9QAsOAiM4CqzgJHCCs8ALLoIguAqi4CZIgrtgFTwEWfAUFMGfoApegiZ4C7rgIxiCr2AKfuJ/LNlIhGQrkZKdREn2Ei05SIzkKLGSk8RJzhIvuUiC5CqJkpskSe6SVfKQZMlTUiR/kip5SZrkLemSj2RIvpIp+cn/sWKjEIqtQip2CqXYK7TioDCKo8IqTgqnOCu84qIIiqsiKm6KpLgrVsVDkRVPRVH8KaripWiKt6IrPoqh+Cqm4qf+x5qNRmi2GqnZaZRmr9Gag8ZojhqrOWmc5qzxmosmaK6aqLlpkuauWTUPTdY8NUXzp6mal6Zp3pqu+WiG5quZmp/+Hxs2BmHYGqRhZ1CGvUEbDgZjOBqs4WRwhrPBGy6GYLgaouFmSIa7YTU8DNnwNBTDn6EaXoZmeBu64WMYhq9hGn7mf2zZWIRla5GWnUVZ9hZtOViM5WixlpPFWc4Wb7lYguVqiZabJVnultXysGTL01Isf5ZqeVma5W3plo9lWL6WafnZ/7Fj4xCOrUM6dg7l2Du04+AwjqPDOk4O5zg7vOPiCI6rIzpujuS4O1bHw5EdT0dx/Dmq4+VojrejOz6O4fg6puPn/seejUd4th7p2XmUZ+/RnoPHeI4e6zl5nOfs8Z6LJ3iunui5eZLn7lk9D0/2PD3F8+epnpened6e7vl4hufrmZ6f/x8HNgER2AZkYBdQgX1ABw4BEzgGbOAUcIFzwAcugRC4BmLgFkiBe2ANPAI58AyUwF+gBl6BFngHeuATGIFvYAZ+4X8c2UREZBuRkV1ERfYRHTlETOQYsZFTxEXOER+5RELkGomRWyRF7pE18ojkyDNSIn+RGnlFWuQd6ZFPZES+kRn5xf9xYpMQiW1CJnYJldgndOKQMIljwiZOCZc4J3zikgiJayImbomUuCfWxCORE89ESfwlauKVaIl3oic+iZH4Jmbil/7HK5sVsbJdkSu7FbWyX9ErhxWzclyxK6cVt3Je8SuXlbByXYkrt5W0cl9ZVx4reeW5Ulb+VurKa6WtvFf6ymdlrHxX5spv/R9nNhmR2WZkZpdRmX1GZw4ZkzlmbOaUcZlzxmcumZC5ZmLmlkmZe2bNPDI588yUzF+mZl6ZlnlneuaTGZlvZmZ++X9c2BREYVuQhV1BFfYFXTgUTOFYsIVTwRXOBV+4FELhWoiFWyEV7oW18CjkwrNQCn+FWngVWuFd6IVPYRS+hVn4lf9xZVMRlW1FVnYVVdlXdOVQMZVjxVZOFVc5V3zlUgmVayVWbpVUuVfWyqOSK89KqfxVauVVaZV3pVc+lVH5VmblV//HjU1DNLYN2dg1VGPf0I1DwzSODds4NVzj3PCNSyM0ro3YuDVS495YG49GbjwbpfHXqI1XozXejd74NEbj25iNX/sfdzYd0dl2ZGfXUZ19R3cOHdM5dmzn1HGdc8d3Lp3QuXZi59ZJnXtn7Tw6ufPslM5fp3ZendZ5d3rn0xmdb2d2fv1/PNgMxGA7kIPdQA32Az04DMzgOLCD08ANzgM/uAzC4DqIg9sgDe6DdfAY5MFzUAZ/gzp4DdrgPeiDz2AMvoM5+I3/8WQzEZPtRE52EzXZT/TkMDGT48ROThM3OU/85DIJk+skTm6TNLlP1sljkifPSZn8TerkNWmT96RPPpMx+U7m5Df5B/cYYh0XsBHwAAAAAElFTkSuQmCC";

/** The two photographs the PDF flow tests use: one wide, one tall. */
const wideJpeg =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAYADADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAcI/8QAGBABAAMBAAAAAAAAAAAAAAAAABdmpOP/xAAXAQEBAQEAAAAAAAAAAAAAAAAABQYE/8QAKBEAAQEFBQkAAAAAAAAAAAAAAAEEBRESUQIDE6HRBhQVFiExUlNh/9oADAMBAAIRAxEAPwDKguUCWTD0IEsmHoicxu325WtDv4W1eGaakNbjQ6BLJh6Liyu0ryZm7C3e1NLNHoqd4VRKFh1Mt6zz4qQjCn0AMsVwAAAAAAD/2Q==";
const tallJpeg =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAwABgDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAYHCP/EABgQAQADAQAAAAAAAAAAAAAAAAAHRYPC/8QAGQEAAgMBAAAAAAAAAAAAAAAAAAIDBAUG/8QAIREAAQMCBwEAAAAAAAAAAAAAAAECEQMEEhMxM2GBseH/2gAMAwEAAhEDEQA/AOVF9Flpl2gV9Flpl2V+hUvth3XqF6AgOdMEX0WWmXa9Dq+Ug0a9/nU1ZhiefgAIZwAAAAAf/9k=";

const asJpeg = (name: string, base64: string) => ({
  name,
  mimeType: "image/jpeg",
  buffer: Buffer.from(base64, "base64"),
});

const asPdf = (name: string, buffer: Buffer) => ({
  name,
  mimeType: "application/pdf",
  buffer,
});

/** Opens a card by its heading, which is what a visitor actually clicks. */
const openRecipe = async (page: Page, title: string) => {
  await page.goto("/flows/");
  await page
    .locator(".starter-recipe", { has: page.getByRole("heading", { name: title }) })
    .getByRole("link", { name: `Open this recipe: ${title}` })
    .click();
  await page.waitForLoadState("load");
};

const savedBytes = async (page: Page, linkName: string) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: linkName }).click();
  const saved = await downloadPromise;

  return readFile(await saved.path());
};

test("loads a recipe's settings and then waits, rather than running anything", async ({
  page,
}) => {
  await page.goto("/flows/");

  // Nothing about the gallery is a claim the builder has not made: an empty
  // builder is what a visitor arrives at.
  await expect(page.locator("[data-step-list] > li")).toHaveCount(0);

  await openRecipe(page, "Make a photograph web-ready");

  expect(new URL(page.url()).hash).toBe(
    "#r=v1;f=webp;crop-image:a=16x9;resize-image:w=1600,h=900",
  );

  // The chain, its order and its settings arrived.
  await expect(page.locator("[data-step-list] > li")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Crop Image" })).toBeVisible();
  await expect(page.getByLabel("Crop Image aspect ratio")).toHaveValue("16:9");
  await expect(page.getByLabel("Resize Image width")).toHaveValue("1600");
  await expect(page.getByLabel("Resize Image height")).toHaveValue("900");
  await expect(page.getByLabel("Final output format")).toHaveValue("image/webp");

  // And nothing ran. There is no result, no status, and no way to start one
  // until a file is chosen on this device.
  await expect(page.locator("[data-result]")).toBeHidden();
  await expect(page.locator("[data-status]")).toBeHidden();
  await expect(page.locator("[data-error]")).toBeHidden();
  await expect(page.getByRole("button", { name: "Run flow" })).toBeDisabled();

  // The link is an ordinary one: it survives being opened cold, in a tab that
  // never saw the gallery.
  const direct = await page.context().newPage();
  await direct.goto(`/flows/${new URL(page.url()).hash}`);
  await expect(direct.locator("[data-step-list] > li")).toHaveCount(2);
  await expect(direct.getByLabel("Resize Image width")).toHaveValue("1600");
  await direct.close();

  // And a modified click is still a request for a new tab rather than a
  // gesture the card intercepts.
  await page.goto("/flows/");
  const opened = page.context().waitForEvent("page");
  await page
    .getByRole("link", { name: "Open this recipe: Join documents and clear their fields" })
    .click({ modifiers: ["ControlOrMeta"] });
  const tab = await opened;

  await expect(tab.locator("[data-step-list] > li")).toHaveCount(2);
  await expect(tab.getByLabel("Flow category")).toHaveValue("pdf");
  expect(new URL(tab.url()).hash).toBe("#r=v1;c=pdf;merge-pdf;clean-pdf-metadata");
});

test("completes the web-ready image recipe on a local picture", async ({ page }) => {
  await openRecipe(page, "Make a photograph web-ready");

  await page.getByLabel("Choose images for this flow").setInputFiles({
    name: "gradient.png",
    mimeType: "image/png",
    buffer: Buffer.from(gradientPng, "base64"),
  });

  await page.getByRole("button", { name: "Run flow" }).click();

  await expect(page.locator("[data-status]")).toContainText("final image is ready");

  const result = page.getByAltText("Final flow result");
  await expect(result).toHaveJSProperty("naturalWidth", 1600);
  await expect(result).toHaveJSProperty("naturalHeight", 900);
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    /\.webp$/,
  );
});

test("completes the photographs-into-a-document recipe on local pictures", async ({
  page,
}) => {
  await openRecipe(page, "Bind photographs into one document");

  await expect(page.getByLabel("Compress Image quality")).toHaveValue("80");
  await expect(page.getByLabel("Image to PDF page size")).toHaveValue("a4");
  await expect(page.getByLabel("Image to PDF orientation")).toHaveValue("portrait");
  await expect(page.getByLabel("Page image format")).toHaveValue("image/jpeg");

  await page
    .getByLabel("Choose images for this flow")
    .setInputFiles([asJpeg("wide.jpg", wideJpeg), asJpeg("tall.jpg", tallJpeg)]);

  await page.getByRole("button", { name: "Run flow" }).click();
  await expect(page.locator("[data-result]")).toBeVisible();

  const pdf = await PDFDocument.load(await savedBytes(page, "Download PDF"));

  // One page per photograph, each on the A4 portrait sheet the recipe names.
  expect(pdf.getPageCount()).toBe(2);

  for (const size of pdf.getPages().map((pdfPage) => pdfPage.getSize())) {
    expect(size.width).toBeCloseTo(fixedPdfPageSizes.a4.width, 1);
    expect(size.height).toBeCloseTo(fixedPdfPageSizes.a4.height, 1);
  }
});

test("completes the join-and-clear recipe on local documents", async ({ page }) => {
  await openRecipe(page, "Join documents and clear their fields");

  await expect(page.getByLabel("Flow category")).toHaveValue("pdf");
  await expect(page.getByRole("heading", { name: "Merge PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clean PDF Metadata" })).toBeVisible();

  await page
    .getByLabel("Choose PDFs for this flow")
    .setInputFiles([asPdf("first.pdf", await samplePdf(2)), asPdf("second.pdf", await samplePdf(1))]);

  await page.getByRole("button", { name: "Run flow" }).click();
  await expect(page.locator("[data-result]")).toBeVisible();

  // Read without `updateMetadata`, which would stamp the library's own name on
  // the document being examined for exactly that name.
  const pdf = await PDFDocument.load(await savedBytes(page, "Download PDF"), {
    updateMetadata: false,
  });

  // Both documents, joined in the order they were chosen.
  expect(pdf.getPageCount()).toBe(3);

  // And the fields the joined document would have inherited are gone. Every
  // document this flow produced carried the library's name until the last
  // block ran, so their absence is that block having done its work.
  expect(pdf.getProducer()).toBeUndefined();
  expect(pdf.getCreator()).toBeUndefined();
  expect(pdf.getTitle()).toBeUndefined();
});
