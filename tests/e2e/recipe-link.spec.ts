import { expect, test } from "@playwright/test";

test("shares a flow as a settings-only recipe link and reopens it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/flows/");

  await expect(
    page.getByRole("button", { name: "Copy recipe link" }),
  ).toBeHidden();

  await page.getByLabel("Next compatible Gizlet").selectOption("resize-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Resize Image width").fill("800");
  await page.getByLabel("Resize Image height").fill("600");
  await page.getByLabel("Next compatible Gizlet").selectOption("compress-image");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Final output format").selectOption("image/jpeg");

  await page.getByRole("button", { name: "Copy recipe link" }).click();
  await expect(page.locator("[data-recipe-status]")).toContainText(
    "carries these settings only, never your image",
  );

  const recipe = "#r=v1;f=jpeg;resize-image:w=800,h=600;compress-image:q=80";
  expect(new URL(page.url()).hash).toBe(recipe);

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${new URL(page.url()).origin}/flows/${recipe}`);

  // Reopening it in a fresh page reproduces the chain, its order, and its settings.
  const reopened = await context.newPage();
  await reopened.goto(`/flows/${recipe}`);

  await expect(reopened.locator("[data-step-list] > li")).toHaveCount(2);
  await expect(reopened.getByRole("heading", { name: "Resize Image" })).toBeVisible();
  await expect(reopened.getByLabel("Resize Image width")).toHaveValue("800");
  await expect(reopened.getByLabel("Resize Image height")).toHaveValue("600");
  await expect(reopened.getByLabel("Compress Image quality")).toHaveValue("80");
  await expect(reopened.getByLabel("Final output format")).toHaveValue("image/jpeg");
});

test("ignores an unreadable recipe link instead of applying part of it", async ({
  page,
}) => {
  // A width above the resize validator's limit, in an otherwise well-formed link.
  await page.goto("/flows/#r=v1;f=jpeg;resize-image:w=99999,h=600;compress-image:q=80");

  await expect(page.locator("[data-step-list] > li")).toHaveCount(0);
  await expect(page.getByLabel("Final output format")).toHaveValue("image/webp");
  await expect(
    page.getByRole("button", { name: "Copy recipe link" }),
  ).toBeHidden();
  await expect(page.locator("[data-error]")).toBeHidden();
});
