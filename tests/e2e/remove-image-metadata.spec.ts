import { expect, test, type Page } from "@playwright/test";

/**
 * A 40x20 JPEG carrying real EXIF: a camera, a timestamp, GPS coordinates, and
 * an orientation tag asking for a quarter turn. The browser applies that turn
 * when it decodes the picture, which is what makes it worth testing here.
 */
const photograph = Buffer.from(
  "/9j/4QEJRXhpZgAATU0AKgAAAAgABQEPAAIAAAAHAAAAqgEQAAIAAAAHAAAAsQESAAMAAAABAAYAAIdpAAQAAAABAAAASoglAAQAAAABAAAAdAAAAAAAA5ADAAIAAAAUAAAAuIgnAAMAAAABAZAAAKQ0AAIAAAAFAAAAzAAAAAAABAABAAIAAAACTgAAAAACAAUAAAADAAAA0QADAAIAAAACVwAAAAAEAAUAAAADAAAA6QAAAABLYW1lcmEASy0xMDAwADIwMjY6MDg6MDEgMDk6MTU6MDAAMzVtbQAAAAAzAAAAAQAAAB4AAAABAAABCAAAAAoAAAAAAAAAAQAAAAcAAAABAAABjwAAAAr/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAUACgDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAYH/8QAGBABAAMBAAAAAAAAAAAAAAAAAAZEgsH/xAAWAQEBAQAAAAAAAAAAAAAAAAAHCAn/xAAaEQABBQEAAAAAAAAAAAAAAAAAAgQHNoKz/9oADAMBAAIRAxEAPwDPAA+WgT8sq74n1BLKu+J9cUb1VpvoshuSbU7xzQACWGZoADNI0wJ+WVd8T4LijeqtN9FkNyTaneOaAASwzP/Z",
  "base64",
);

async function choose(page: Page) {
  await page.getByLabel("Select an image to inspect").setInputFiles({
    name: "holiday.jpg",
    mimeType: "image/jpeg",
    buffer: photograph,
  });
}

test("shows what a photograph says, strips it, and checks the result", async ({
  page,
}) => {
  await page.goto("/tools/remove-image-metadata/");
  await choose(page);

  // The location is the field this Gizlet exists for, so it leads.
  await expect(
    page.getByRole("heading", { name: "It knows where you were." }),
  ).toBeVisible();
  await expect(page.getByText("This photograph says where it was taken.")).toBeVisible();
  await expect(page.getByText("51.50733, -0.12775")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Where it was taken" })).toBeVisible();
  await expect(page.getByText("Kamera")).toBeVisible();
  await expect(page.getByText("K-1000")).toBeVisible();
  await expect(page.getByText("2026:08:01 09:15:00")).toBeVisible();
  await expect(page.locator("[data-summary-line]")).toHaveText("7 fields · EXIF");

  await page.getByRole("button", { name: "Strip it out" }).click();

  await expect(page.getByText("Nothing left to read.")).toBeVisible();
  await expect(page.locator("[data-removed-count]")).toHaveText("7 entries");
  // The claim is checked by reading the downloaded bytes back, not asserted.
  await expect(page.locator("[data-verified]")).toHaveText(
    "Checked the file again: this Gizlet can read nothing in it.",
  );
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "download",
    "holiday-clean.jpg",
  );
});

test("keeps the picture the way up the visitor sees it", async ({ page }) => {
  await page.goto("/tools/remove-image-metadata/");
  await choose(page);

  // The file stores 40x20 and asks for a quarter turn, so the browser shows it
  // as 20x40. The cleaned copy has to be that picture, not the stored one:
  // stripping the tag must not put the photograph back on its side.
  const preview = page.getByAltText("Selected image preview");

  await expect(preview).toHaveJSProperty("naturalWidth", 20);
  await expect(preview).toHaveJSProperty("naturalHeight", 40);
  await expect(page.locator("[data-input-name]")).toContainText("20 × 40 px");

  await page.getByRole("button", { name: "Strip it out" }).click();

  await expect(page.locator("[data-result-dimensions]")).toHaveText("20 × 40 px");
  await expect(page.getByAltText("Cleaned image preview")).toHaveJSProperty("naturalWidth", 20);
  await expect(page.getByAltText("Cleaned image preview")).toHaveJSProperty("naturalHeight", 40);
});

test("says plainly when there is nothing to remove, and refuses a non-image", async ({
  page,
}) => {
  await page.goto("/tools/remove-image-metadata/");

  await page.getByLabel("Select an image to inspect").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("Choose a JPEG, PNG, WebP, AVIF, or BMP image."),
  ).toBeVisible();

  // A PNG written by a browser carries nothing this parser can read.
  await page.getByLabel("Select an image to inspect").setInputFiles({
    name: "plain.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
      "base64",
    ),
  });

  await expect(page.getByRole("heading", { name: "Nothing to remove." })).toBeVisible();
  await expect(page.locator("[data-summary-line]")).toContainText(
    "This Gizlet found no metadata",
  );
  // The action stops claiming to strip something that is not there.
  await expect(page.getByRole("button", { name: "Re-encode it anyway" })).toBeVisible();
});
