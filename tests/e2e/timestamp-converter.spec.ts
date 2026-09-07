import { expect, test, type Page } from "@playwright/test";

/**
 * A number read as a moment, and a moment read back as a number.
 *
 * The assertion that matters most is the one about the unit: the page must show
 * the reading it was asked for, however unlikely it looks, because a converter
 * that overrules you is one you cannot use to confirm a suspicion.
 */
const numberField = (page: Page) => page.getByLabel("A count of seconds or milliseconds");

const dateField = (page: Page) => page.getByLabel("A date, and a time if you have one");

const numberRow = (page: Page, row: string) =>
  page.locator(`[data-number-rows] [data-row="${row}"]`);

const dateRow = (page: Page, row: string) =>
  page.locator(`[data-date-rows] [data-row="${row}"]`);

const value = (page: Page, rows: "number" | "date", row: string) =>
  (rows === "number" ? numberRow(page, row) : dateRow(page, row)).locator("[data-row-value]");

test("reads a timestamp as a moment without sending it anywhere", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/timestamp-converter/");

  await expect(page).toHaveTitle("Timestamp Converter | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText("on this device");

  await numberField(page).fill("1788772500");

  await expect(value(page, "number", "utc")).toHaveText("2026-09-07 09:15:00 UTC");
  await expect(numberRow(page, "utc")).toContainText("Monday");
  await expect(value(page, "number", "iso")).toHaveText("2026-09-07T09:15:00Z");
  await expect(value(page, "number", "milliseconds")).toHaveText("1788772500000");
  // The device's own reading is labelled with the offset it was made at.
  await expect(numberRow(page, "local")).toContainText("UTC");

  expect(requests).toEqual([]);
});

test("shows the reading you asked for and offers the other unit instead of switching", async ({
  page,
}) => {
  await page.goto("/tools/timestamp-converter/");

  await numberField(page).fill("1788772500000");

  // Thirteen digits read as seconds is a moment in the year 58653, and that is
  // what the page must show, because that is what was asked for.
  await expect(value(page, "number", "utc")).toContainText("58653-");
  await expect(page.locator("[data-number-notes]")).toContainText("usually milliseconds");
  await expect(page.locator("[data-number-notes]")).toContainText("Nothing was changed for you");

  await page.getByRole("radio", { name: "Milliseconds" }).check();

  await expect(value(page, "number", "utc")).toHaveText("2026-09-07 09:15:00 UTC");
  await expect(page.locator("[data-number-notes]")).toBeHidden();
});

test("reads the epoch and a moment before it", async ({ page }) => {
  await page.goto("/tools/timestamp-converter/");

  await numberField(page).fill("0");

  await expect(value(page, "number", "utc")).toHaveText("1970-01-01 00:00:00 UTC");
  await expect(numberRow(page, "utc")).toContainText("Thursday");

  await numberField(page).fill("-14182940");

  await expect(value(page, "number", "utc")).toHaveText("1969-07-20 20:17:40 UTC");
  await expect(value(page, "number", "seconds")).toHaveText("-14182940");
});

test("turns a written date back into a timestamp, in the clock it was told", async ({ page }) => {
  await page.goto("/tools/timestamp-converter/");

  await dateField(page).fill("2026-09-07 09:15:00");

  await expect(value(page, "date", "seconds")).toHaveText("1788772500");
  await expect(value(page, "date", "milliseconds")).toHaveText("1788772500000");
  await expect(value(page, "date", "iso")).toHaveText("2026-09-07T09:15:00Z");
  await expect(dateRow(page, "read-as")).toContainText("UTC, as chosen above");

  // An offset in the text answers the question the control was asking.
  await dateField(page).fill("2026-09-07T12:15:00+03:00");

  await expect(value(page, "date", "seconds")).toHaveText("1788772500");
  await expect(value(page, "date", "read-as")).toHaveText("+03:00");
  await expect(page.locator("[data-date-notes]")).toContainText("rather than the setting above");
});

test("refuses an impossible date by name and keeps the other panel working", async ({ page }) => {
  await page.goto("/tools/timestamp-converter/");

  await numberField(page).fill("1788772500");
  await dateField(page).fill("2026-02-30");

  await expect(page.locator("[data-date-error]")).toHaveText(
    "February 2026 has 28 days, so there is no 30th.",
  );
  await expect(page.locator("[data-date-rows]")).toBeHidden();
  // The complaint is about one box, so the other keeps its answer.
  await expect(value(page, "number", "utc")).toHaveText("2026-09-07 09:15:00 UTC");

  await dateField(page).fill("2026-09-07T23:59:60Z");

  await expect(page.locator("[data-date-error]")).toContainText("A leap second is real");

  await numberField(page).fill("yesterday");

  await expect(page.locator("[data-number-error]")).toContainText("a date belongs in the other box");
  await expect(page.locator("[data-number-rows]")).toBeHidden();
});

test("fills either box with now, and clears it again", async ({ page }) => {
  await page.goto("/tools/timestamp-converter/");

  await page.locator("[data-number-now]").click();

  const seconds = await numberField(page).inputValue();

  expect(Number(seconds)).toBeGreaterThan(1_700_000_000);
  await expect(numberRow(page, "utc")).toContainText("in a moment");

  await page.locator("[data-date-now]").click();

  await expect(value(page, "date", "seconds")).toHaveText(seconds);

  await page.locator("[data-number-clear]").click();

  await expect(page.locator("[data-number-rows]")).toBeHidden();
  await expect(page.locator("[data-number-error]")).toBeHidden();
});

test("copies a value to the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/timestamp-converter/");

  await numberField(page).fill("1788772500");
  await numberRow(page, "iso").getByRole("button", { name: "Copy the iso 8601" }).click();

  await expect(page.locator("[data-status]")).toContainText("copied to your clipboard");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("2026-09-07T09:15:00Z");
});
