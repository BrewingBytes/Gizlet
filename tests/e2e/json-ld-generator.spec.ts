import { expect, test } from "@playwright/test";

test("creates, previews, and copies JSON-LD locally", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/json-ld-generator/");

  await expect(
    page.getByRole("heading", { level: 1, name: "JSON-LD Generator" }),
  ).toBeVisible();
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your file stays on this device.",
  );
  await expect(page.getByText("Schema.org errors")).toBeVisible();

  await page.getByLabel("Schema type").selectOption("Organization");
  await expect(
    page.getByRole("heading", { name: "Organization details" }),
  ).toBeVisible();
  await page.getByLabel("Organization name").fill("Gizlet");
  await expect(page.locator("[data-preview]")).toContainText(
    '"@type": "Organization"',
  );
  await expect(page.locator("[data-preview]")).toContainText(
    '"name": "Gizlet"',
  );

  await page.getByLabel("Schema type").selectOption("Product");
  const productForm = page.locator('[data-schema-form="Product"]');
  await productForm.getByLabel("Product name").fill("Trail Mug");
  await productForm.getByText("Advanced: offer details").click();
  await productForm.getByLabel("Price").fill("24.00");
  await expect(page.locator("[data-preview]")).toContainText('"offers"');
  await page.getByRole("button", { name: "Copy JSON-LD" }).click();
  await expect(page.getByRole("status")).toContainText(
    "JSON-LD copied to your clipboard.",
  );
});
