import { expect, test, type Page } from "@playwright/test";

/**
 * Records moved between JSON and CSV, both ways, in a real browser.
 *
 * The assertions that matter most are the ones about quoting and about what
 * the page refuses. A converter that writes an unquoted comma produces a file
 * a spreadsheet opens wrongly, and one that flattens or truncates on your
 * behalf loses data in a way nobody notices until much later.
 */
const jsonField = (page: Page) => page.getByLabel("Records as JSON");

const csvField = (page: Page) => page.getByLabel("Records as CSV");

const jsonResult = (page: Page) => page.locator("[data-json-output]");

const csvResult = (page: Page) => page.locator("[data-csv-output]");

const records = JSON.stringify([
  { name: "Lovelace, Ada", born: 1815 },
  { name: "Hopper", born: 1906 },
]);

test("turns JSON into a quoted table without sending it anywhere", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/json-csv-converter/");

  await expect(page).toHaveTitle("JSON and CSV Converter | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText("on this device");

  await jsonField(page).fill(records);

  // The comma inside a value is quoted, which is the whole reason a spreadsheet
  // opens this as two columns rather than three.
  await expect(jsonResult(page)).toHaveText(
    ['name,born', '"Lovelace, Ada",1815', "Hopper,1906"].join("\n"),
  );
  await expect(page.locator("[data-json-summary]")).toHaveText("2 rows, 2 columns");

  expect(requests).toEqual([]);
});

test("reads a table back, including a quoted comma, a quote and a line break", async ({ page }) => {
  await page.goto("/tools/json-csv-converter/");

  await csvField(page).fill(
    ['who,note', '"Lovelace, Ada","she said ""no"""', '"two\nlines",plain'].join("\n"),
  );

  await expect(page.locator("[data-csv-summary]")).toHaveText("2 rows, 2 columns");
  expect(JSON.parse((await csvResult(page).textContent()) ?? "")).toEqual([
    { who: "Lovelace, Ada", note: 'she said "no"' },
    { who: "two\nlines", note: "plain" },
  ]);
});

test("converts with the delimiter that was chosen, and offers the one the file wants", async ({
  page,
}) => {
  await page.goto("/tools/json-csv-converter/");

  await jsonField(page).fill(records);
  await page
    .locator("[data-json-delimiter]")
    .and(page.getByRole("radio", { name: "Semicolon" }))
    .check();

  await expect(jsonResult(page)).toContainText("name;born");

  // Read with the wrong delimiter, the same file is one column, and the page
  // names the delimiter it should have been read with rather than guessing.
  await csvField(page).fill("name;born\nAda;1815");

  await expect(page.locator("[data-csv-summary]")).toHaveText("1 row, 1 column");
  await expect(page.locator("[data-csv-notes]")).toContainText("semicolon");

  await page
    .locator("[data-csv-delimiter]")
    .and(page.getByRole("radio", { name: "Semicolon" }))
    .check();

  await expect(page.locator("[data-csv-summary]")).toHaveText("1 row, 2 columns");
  expect(JSON.parse((await csvResult(page).textContent()) ?? "")).toEqual([
    { name: "Ada", born: "1815" },
  ]);
});

test("leaves every cell text until it is asked to read values", async ({ page }) => {
  await page.goto("/tools/json-csv-converter/");

  await csvField(page).fill("code,count,ok\n00713,42,true");

  expect(JSON.parse((await csvResult(page).textContent()) ?? "")).toEqual([
    { code: "00713", count: "42", ok: "true" },
  ]);

  await page.getByRole("radio", { name: "Numbers and true, false, null" }).check();

  // The leading zero survives even here, because 00713 is not a JSON number.
  expect(JSON.parse((await csvResult(page).textContent()) ?? "")).toEqual([
    { code: "00713", count: 42, ok: true },
  ]);
});

test("fails visibly, and never touches what was typed", async ({ page }) => {
  await page.goto("/tools/json-csv-converter/");

  const broken = '[{"a":1,}]';

  await jsonField(page).fill(broken);

  await expect(page.locator("[data-json-error]")).toContainText("Invalid JSON");
  await expect(page.locator("[data-json-result]")).toBeHidden();
  await expect(jsonField(page)).toHaveValue(broken);

  // Nested JSON is refused by name rather than flattened into invented columns.
  await jsonField(page).fill('[{"a":1,"address":{"city":"Bath"}}]');

  await expect(page.locator("[data-json-error]")).toContainText("“address”");
  await expect(page.locator("[data-json-error]")).toContainText("will not guess");

  // A row with more fields than the header is refused rather than truncated.
  const ragged = "a,b\n1,2\n3,4,5";

  await csvField(page).fill(ragged);

  await expect(page.locator("[data-csv-error]")).toContainText("Line 3");
  await expect(page.locator("[data-csv-error]")).toContainText("nothing was dropped");
  await expect(page.locator("[data-csv-result]")).toBeHidden();
  await expect(csvField(page)).toHaveValue(ragged);
});

test("says what it filled in rather than filling it in quietly", async ({ page }) => {
  await page.goto("/tools/json-csv-converter/");

  await jsonField(page).fill('[{"a":1,"b":2},{"a":3}]');

  await expect(page.locator("[data-json-notes]")).toContainText("Item 2");
  await expect(jsonResult(page)).toContainText("3,");

  await csvField(page).fill("a,b,c\n1,2,3\n4,5");

  await expect(page.locator("[data-csv-notes]")).toContainText("Line 3");
});

test("hands back both formats as a file", async ({ page }) => {
  await page.goto("/tools/json-csv-converter/");

  await jsonField(page).fill(records);

  const csvDownload = page.waitForEvent("download");

  await page.getByRole("button", { name: "Download .csv" }).click();
  expect((await csvDownload).suggestedFilename()).toBe("records.csv");

  await csvField(page).fill("name,born\nAda,1815");

  const jsonDownload = page.waitForEvent("download");

  await page.getByRole("button", { name: "Download .json" }).click();
  expect((await jsonDownload).suggestedFilename()).toBe("records.json");
});

test("round-trips a table through JSON and back to the same table", async ({ page }) => {
  await page.goto("/tools/json-csv-converter/");

  const table = ['name,note', '"Lovelace, Ada","she said ""no"""', "Grace,"].join("\r\n");

  await csvField(page).fill(table);

  const json = (await csvResult(page).textContent()) ?? "";

  await jsonField(page).fill(json);

  // The page writes CRLF, and the box was filled with CRLF, so the document
  // that comes back out is the document that went in.
  await expect(jsonResult(page)).toHaveText(table.replaceAll("\r\n", "\n"));
});
