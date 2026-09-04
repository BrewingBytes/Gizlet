import { expect, test } from "@playwright/test";

test("formats, minifies, validates, and copies JSON locally", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/json-formatter/");

  const input = page.getByLabel("JSON input");
  await input.fill('{"name":"Gizlet","enabled":true}');
  await expect(page.getByRole("status").first()).toContainText(
    "Valid JSON. Ready to format or minify.",
  );
  await page.getByRole("button", { name: "Format JSON" }).click();
  await expect(page.locator("[data-output]")).toHaveText(
    '{\n  "name": "Gizlet",\n  "enabled": true\n}',
  );
  await page.getByRole("button", { name: "Copy result" }).click();
  await expect(page.getByRole("status").last()).toContainText(
    "Result copied to your clipboard.",
  );

  await page.getByRole("button", { name: "Minify JSON" }).click();
  await expect(page.locator("[data-output]")).toHaveText(
    '{"name":"Gizlet","enabled":true}',
  );

  const invalidInput = '{\n  "name":\n}';
  await input.fill(invalidInput);
  await page.getByRole("button", { name: "Format JSON" }).click();
  await expect(page.getByRole("status").first()).toContainText("Invalid JSON:");
  await expect(input).toHaveValue(invalidInput);

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Copy result" })).toBeDisabled();
});
