import { expect, test, type Page } from "@playwright/test";

/**
 * A flow that carries records rather than pixels or pages.
 *
 * The two things worth proving in a browser are the ones the graph cannot
 * prove on its own: that a document chosen here is read here — no request
 * leaves the tab — and that the converter runs in whichever direction the
 * payload reaching it asks for, with nothing asked of the visitor and nothing
 * carried in the link.
 */
const chooseCsv = (page: Page) => page.getByLabel("Choose a CSV for this flow");

const chooseJson = (page: Page) => page.getByLabel("Choose a JSON file for this flow");

const addStep = async (page: Page, toolSlug: string) => {
  await page.getByLabel("Next compatible Gizlet").selectOption(toolSlug);
  await page.getByRole("button", { name: "Add step" }).click();
};

const csvFile = (name: string, text: string) => [
  { name, mimeType: "text/csv", buffer: Buffer.from(text, "utf8") },
];

const jsonFile = (name: string, value: unknown) => [
  {
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value), "utf8"),
  },
];

const startFlow = async (page: Page, category: "csv" | "json") => {
  await page.goto("/flows/");
  await page.getByLabel("Flow category").selectOption(category);
};

const resultText = (page: Page) => page.locator("[data-result-text-content]");

test("offers a CSV and a JSON category, each starting from the Gizlets that read it", async ({
  page,
}) => {
  await startFlow(page, "csv");

  await expect(page.getByLabel("Next compatible Gizlet").locator("option")).toHaveText([
    "Choose the next Gizlet",
    "JSON and CSV Converter",
    "CSV Viewer",
  ]);
  await expect(page.locator("[data-source-title]")).toHaveText("Your CSV");

  await page.getByLabel("Flow category").selectOption("json");

  // JSON-LD Generator reads a form rather than a document, so it can write
  // into this lineage and never start a chain in it.
  await expect(page.getByLabel("Next compatible Gizlet").locator("option")).toHaveText([
    "Choose the next Gizlet",
    "JSON Formatter",
    "JSON and CSV Converter",
  ]);
  await expect(page.locator("[data-source-title]")).toHaveText("Your JSON");
});

test("tidies a table and hands it on as JSON, without a request leaving the tab", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await startFlow(page, "csv");

  await addStep(page, "csv-viewer");
  await addStep(page, "json-csv-converter");

  // What each block hands on, said in the block: the viewer tidies a table and
  // the converter reads the table it is handed.
  await expect(page.locator("[data-step-list] li").first()).toContainText(
    "Your CSV → CSV result",
  );
  await expect(page.locator("[data-step-list] li").last()).toContainText(
    "CSV Viewer result → JSON result",
  );

  await chooseCsv(page).setInputFiles(
    csvFile("orders.csv", ['order;customer', '1001;"Lovelace, Ada"', "1002;Hopper"].join("\n")),
  );

  // The separator is read off the document rather than asked for.
  await expect(page.locator("[data-source-details]")).toContainText("2 rows, 2 columns");

  await page.getByRole("button", { name: "Run flow" }).click();

  const download = page.getByRole("link", { name: "Download JSON" });
  await expect(download).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-result-title]")).toHaveText("Your JSON is ready.");
  await expect(download).toHaveAttribute("download", "orders.json");
  expect(JSON.parse((await resultText(page).textContent()) ?? "")).toEqual([
    { order: "1001", customer: "Lovelace, Ada" },
    { order: "1002", customer: "Hopper" },
  ]);

  expect(requests).toEqual([]);
});

test("runs the converter the other way when the flow starts from JSON", async ({ page }) => {
  await startFlow(page, "json");

  await addStep(page, "json-csv-converter");

  // Handed JSON it writes a table, so what may follow it is what reads a
  // table — including itself, going back.
  await expect(page.locator("[data-step-list] li").first()).toContainText(
    "Your JSON → CSV result",
  );
  await expect(page.getByLabel("Next compatible Gizlet").locator("option")).toHaveText([
    "Choose the next Gizlet",
    "JSON and CSV Converter",
    "CSV Viewer",
  ]);

  await addStep(page, "csv-viewer");

  await chooseJson(page).setInputFiles(
    jsonFile("people.json", [
      { name: "Ada", note: "first, and a comma" },
      { name: "Grace" },
    ]),
  );
  await page.getByRole("button", { name: "Run flow" }).click();

  const download = page.getByRole("link", { name: "Download CSV" });
  await expect(download).toBeVisible({ timeout: 15000 });
  await expect(download).toHaveAttribute("download", "people-tidied.csv");
  // The comma inside a value is quoted, and the row missing a key still has a
  // cell under every column.
  await expect(resultText(page)).toHaveText(
    ['name,note', 'Ada,"first, and a comma"', "Grace,"].join("\n"),
  );
});

test("shares a text chain as a link that carries no document", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startFlow(page, "csv");

  await addStep(page, "csv-viewer");
  await addStep(page, "json-csv-converter");

  await page.getByRole("button", { name: "Copy recipe link" }).click();

  const recipe = "#r=v1;c=csv;csv-viewer;json-csv-converter";

  expect(new URL(page.url()).hash).toBe(recipe);

  const reopened = await context.newPage();

  await reopened.goto(`/flows/${recipe}`);

  await expect(reopened.getByLabel("Flow category")).toHaveValue("csv");
  await expect(reopened.locator("[data-step-list] li")).toHaveCount(2);
  await reopened.close();
});

test("refuses a spreadsheet, and a file that is not the JSON it claims to be", async ({
  page,
}) => {
  await startFlow(page, "csv");

  await chooseCsv(page).setInputFiles([
    {
      name: "book.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("PK\u0003\u0004", "binary"),
    },
  ]);

  await expect(page.getByRole("alert")).toContainText(".xlsx");
  await expect(page.getByRole("button", { name: "Run flow" })).toBeDisabled();

  await page.getByLabel("Flow category").selectOption("json");
  await chooseJson(page).setInputFiles([
    { name: "half.json", mimeType: "application/json", buffer: Buffer.from('{"a": ', "utf8") },
  ]);

  await expect(page.getByRole("alert")).toContainText("not valid JSON");
  await expect(page.getByRole("button", { name: "Run flow" })).toBeDisabled();
});
