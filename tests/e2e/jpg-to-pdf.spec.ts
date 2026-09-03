import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { fixedPdfPageSizes } from "../../src/data/jpg-to-pdf";

/**
 * Two tiny JPEGs drawn by Chromium, one wider than it is tall and one taller
 * than it is wide, so the assembled document proves the page order and the
 * automatic orientation rather than only that a file arrived.
 */
const wideJpeg =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAYADADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAcI/8QAGBABAAMBAAAAAAAAAAAAAAAAABdmpOP/xAAXAQEBAQEAAAAAAAAAAAAAAAAABQYE/8QAKBEAAQEFBQkAAAAAAAAAAAAAAAEEBRESUQIDE6HRBhQVFiExUlNh/9oADAMBAAIRAxEAPwDKguUCWTD0IEsmHoicxu325WtDv4W1eGaakNbjQ6BLJh6Liyu0ryZm7C3e1NLNHoqd4VRKFh1Mt6zz4qQjCn0AMsVwAAAAAAD/2Q==";
const tallJpeg =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAwABgDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAYHCP/EABgQAQADAQAAAAAAAAAAAAAAAAAHRYPC/8QAGQEAAgMBAAAAAAAAAAAAAAAAAAIDBAUG/8QAIREAAQMCBwEAAAAAAAAAAAAAAAECEQMEEhMxM2GBseH/2gAMAwEAAhEDEQA/AOVF9Flpl2gV9Flpl2V+hUvth3XqF6AgOdMEX0WWmXa9Dq+Ug0a9/nU1ZhiefgAIZwAAAAAf/9k=";

const asFile = (name: string, base64: string) => ({
  name,
  mimeType: "image/jpeg",
  buffer: Buffer.from(base64, "base64"),
});

test("assembles chosen images into one local PDF in the order set on the page", async ({
  page,
}) => {
  await page.goto("/tools/jpg-to-pdf/");

  await expect(page).toHaveTitle("JPG to PDF | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your images stay on this device.",
  );
  await expect(page.getByRole("button", { name: "Make the PDF" })).toBeHidden();

  await page
    .getByLabel("Select images to put in a PDF")
    .setInputFiles([asFile("wide.jpg", wideJpeg), asFile("tall.jpg", tallJpeg)]);

  const pages = page.getByRole("list", { name: "Pages in the PDF" });
  await expect(pages.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("2 pages · up to 100")).toBeVisible();
  await expect(pages.getByRole("listitem").first()).toContainText("wide.jpg");
  await expect(pages.getByRole("listitem").first()).toContainText("48 × 24 px");

  // Reordering has to change the document, not only the list.
  await page.getByRole("button", { name: "Move tall.jpg up" }).click();
  await expect(pages.getByRole("listitem").first()).toContainText("tall.jpg");
  await expect(
    page.getByRole("button", { name: "Move tall.jpg up" }),
  ).toBeDisabled();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Make the PDF" }).click();
  await expect(page.getByText("2 pages · A4")).toBeVisible();

  const download = page.getByRole("link", { name: "Download PDF" });
  await expect(download).toHaveAttribute("download", "tall-and-1-more.pdf");
  await download.click();

  const saved = await downloadPromise;
  expect(saved.suggestedFilename()).toBe("tall-and-1-more.pdf");

  const path = await saved.path();
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  const document = await PDFDocument.load(bytes);
  expect(document.getPageCount()).toBe(2);

  // Page one is the tall image, so auto orientation leaves A4 upright; page
  // two is the wide one, which turns the sheet on its side.
  const [first, second] = document.getPages().map((pdfPage) => pdfPage.getSize());
  expect(first.width).toBeCloseTo(fixedPdfPageSizes.a4.width, 2);
  expect(first.height).toBeCloseTo(fixedPdfPageSizes.a4.height, 2);
  expect(second.width).toBeCloseTo(fixedPdfPageSizes.a4.height, 2);
  expect(second.height).toBeCloseTo(fixedPdfPageSizes.a4.width, 2);
});

test("refuses a file that is not an image and names it", async ({ page }) => {
  await page.goto("/tools/jpg-to-pdf/");

  await page.getByLabel("Select images to put in a PDF").setInputFiles([
    asFile("holiday.jpg", wideJpeg),
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
  ]);

  const error = page.getByRole("alert");
  await expect(error).toContainText("notes.txt");
  await expect(error).toContainText("is not an image this Gizlet can read");
  await expect(error).toContainText("JPEG, PNG, WebP, AVIF, or BMP");

  // Nothing was accepted, so there is no half-built document to download.
  await expect(page.getByRole("button", { name: "Make the PDF" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeHidden();
});
