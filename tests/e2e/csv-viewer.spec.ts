import { expect, test, type Page } from "@playwright/test";

/**
 * A delimited file opened, read as a table, and handed back tidied, in a real
 * browser.
 *
 * The assertions that matter are the ones about the file: that choosing one
 * puts it on screen without a request leaving the tab, that a separator this
 * page detected can be overruled, and that the tidied document it offers is
 * the whole file rather than the part of it that was drawn.
 */
const field = (page: Page) => page.getByLabel("CSV to read");

const filePicker = (page: Page) => page.getByLabel("Select a CSV file to open");

const table = (page: Page) => page.locator("[data-table]");

const notes = (page: Page) => page.locator("[data-notes]");

const tidied = (page: Page) => page.locator("[data-formatted]");

const csvFile = (name: string, text: string) => [
  { name, mimeType: "text/csv", buffer: Buffer.from(text, "utf8") },
];

test("opens a file from the device as a table without sending it anywhere", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/csv-viewer/");

  await expect(page).toHaveTitle("CSV Viewer | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText("on this device");

  await filePicker(page).setInputFiles(
    csvFile(
      "contacts.csv",
      ['name,born,note', '"Lovelace, Ada",1815,first', "Hopper,1906,second"].join("\r\n"),
    ),
  );

  await expect(page.locator("[data-source]")).toHaveText("contacts.csv");
  await expect(page.locator("[data-summary]")).toHaveText("2 rows, 3 columns");
  await expect(table(page).getByRole("columnheader", { name: "name" })).toBeVisible();
  // The quoted comma is one value, which is the whole reason the row has three
  // cells rather than four.
  await expect(table(page).getByRole("cell", { name: "Lovelace, Ada" })).toBeVisible();
  await expect(table(page).getByRole("row")).toHaveCount(3);

  expect(requests).toEqual([]);
});

test("detects the separator, says so, and lets the reading be overruled", async ({
  page,
}) => {
  await page.goto("/tools/csv-viewer/");

  await field(page).fill(["name;price", "Ada;1,50", "Grace;2,75"].join("\n"));

  await expect(page.locator("[data-delimiter-hint]")).toContainText("semicolons");
  await expect(page.getByRole("radio", { name: "Semicolon" })).toBeChecked();
  await expect(page.locator("[data-summary]")).toHaveText("2 rows, 2 columns");

  // Read with commas instead, the decimal comma inside a value splits it: the
  // page does what it was told rather than quietly going back to its guess.
  await page.getByRole("radio", { name: "Comma" }).check();

  await expect(page.locator("[data-summary]")).toHaveText("2 rows, 2 columns");
  await expect(table(page).getByRole("columnheader", { name: "name;price" })).toBeVisible();
});

test("shows a row that does not match its header rather than refusing the file", async ({
  page,
}) => {
  await page.goto("/tools/csv-viewer/");

  await field(page).fill(
    ["name,born", "Ada,1815", "Grace,1906,extra", "Katherine"].join("\n"),
  );

  await expect(page.locator("[data-summary]")).toHaveText("3 rows, 3 columns");
  await expect(table(page).getByRole("cell", { name: "extra" })).toBeVisible();
  await expect(notes(page)).toContainText("Line 3");
  await expect(notes(page)).toContainText("Line 4");
  await expect(table(page).locator("tr[data-shape='long']")).toHaveCount(1);
  await expect(table(page).locator("tr[data-shape='short']")).toHaveCount(1);
  // The shading is not the only thing that says it: design.md forbids that.
  await expect(table(page).locator(".csv-viewer__flag")).toHaveText(["extra", "short"]);
});

test("reads the first row as data when told the file has no header", async ({ page }) => {
  await page.goto("/tools/csv-viewer/");

  await field(page).fill("Ada,1815\nGrace,1906");

  await expect(page.locator("[data-summary]")).toHaveText("1 row, 2 columns");

  await page.getByLabel("The first row names the columns").uncheck();

  await expect(page.locator("[data-summary]")).toHaveText("2 rows, 2 columns");
  await expect(table(page).getByRole("columnheader", { name: "Column 1" })).toBeVisible();
  await expect(table(page).getByRole("cell", { name: "Ada" })).toBeVisible();
});

test("hands back the whole document tidied, named after the file it came from", async ({
  page,
}) => {
  await page.goto("/tools/csv-viewer/");

  // More rows than the table draws, so the download is the part that has to
  // prove it is the whole file.
  const rows = Array.from({ length: 260 }, (_unused, index) => `${index + 1}; padded `);

  await filePicker(page).setInputFiles(
    csvFile("orders.csv", ["id;note", ...rows].join("\n")),
  );

  await expect(page.locator("[data-summary]")).toHaveText("260 rows, 2 columns");
  await expect(table(page).locator("tbody tr")).toHaveCount(200);
  await expect(notes(page)).toContainText("the first 200 rows of 260 rows");
  // A value with a space at the end is quoted on the way out, which is the
  // tidying nobody notices until a reader disagrees about the space.
  await expect(tidied(page)).toContainText('1;" padded "');

  const download = page.waitForEvent("download");

  await page.getByRole("button", { name: "Download .csv" }).click();

  const written = await download;

  expect(written.suggestedFilename()).toBe("orders-tidied.csv");
});

test("names a spreadsheet rather than showing its archive as a table", async ({ page }) => {
  await page.goto("/tools/csv-viewer/");

  await filePicker(page).setInputFiles([
    {
      name: "book.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("PK\u0003\u0004\u0014\u0000", "binary"),
    },
  ]);

  await expect(page.locator("[data-error]")).toContainText(".xlsx");
  await expect(page.locator("[data-result]")).toBeHidden();
});
