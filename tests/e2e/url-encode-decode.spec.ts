import { expect, test, type Page } from "@playwright/test";

/**
 * Percent-encoding, both ways.
 *
 * The three modes disagree about characters people type, so each assertion
 * here is about a character that actually differs between them rather than
 * about the machinery being wired up.
 */
const input = (page: Page) => page.getByLabel(/^Text to (encode|decode)$/);

const output = (page: Page) => page.locator("[data-output]");

const status = (page: Page) => page.locator("[data-status]");

/** The radios are addressed by role: "Decode" also occurs in the page's prose. */
const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });

const chooseMode = (page: Page, label: string) => radio(page, label).check();

test("encodes and decodes as you type, and says what it did", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/url-encode-decode/");

  await expect(page).toHaveTitle("URL Encode & Decode | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your text is converted on this device.",
  );
  await expect(status(page)).toContainText("Type or paste something above");

  await input(page).fill("tea & biscuits?");

  await expect(output(page)).toHaveText("tea%20%26%20biscuits%3F");
  await expect(status(page)).toContainText("4 characters were escaped");

  await radio(page, "Decode").check();
  await input(page).fill("caf%C3%A9%20%F0%9F%91%8D");

  await expect(output(page)).toHaveText("café 👍");
  // Seven escapes for six characters: é is two of them and the emoji is four.
  await expect(status(page)).toContainText("7 escapes were read back");

  // Nothing was posted anywhere: the text never left the page.
  expect(requests).toEqual([]);
});

test("the three encodings disagree, and the page says how", async ({ page }) => {
  await page.goto("/tools/url-encode-decode/");

  await input(page).fill("https://example.com/a b?x=1&y=2");

  await expect(output(page)).toHaveText(
    "https%3A%2F%2Fexample.com%2Fa%20b%3Fx%3D1%26y%3D2",
  );

  await chooseMode(page, "A whole URL");
  // The characters that hold a URL together survive; the space does not.
  await expect(output(page)).toHaveText("https://example.com/a%20b?x=1&y=2");
  await expect(page.locator("[data-mode-summary]")).toContainText("already assembled");

  await chooseMode(page, "A form field");
  await input(page).fill("it's (that) ~ok!");
  await expect(output(page)).toHaveText("it%27s+%28that%29+%7Eok%21");
  await expect(page.locator("[data-mode-summary]")).toContainText("space becomes a plus");
});

test("reads a plus as a space only where a plus means a space", async ({ page }) => {
  await page.goto("/tools/url-encode-decode/");

  await radio(page, "Decode").check();
  await input(page).fill("aGVsbG8+d29ybGQ=");

  // In a URL piece a plus is a plus, which is what keeps base64 intact.
  await expect(output(page)).toHaveText("aGVsbG8+d29ybGQ=");

  await chooseMode(page, "A form field");
  await expect(output(page)).toHaveText("aGVsbG8 d29ybGQ=");
});

test("says where a broken escape is rather than that something is wrong", async ({ page }) => {
  await page.goto("/tools/url-encode-decode/");

  await radio(page, "Decode").check();
  await input(page).fill("ok%20then%ZZ");

  await expect(status(page)).toHaveAttribute("data-state", "invalid");
  await expect(status(page)).toContainText("Character 10, %ZZ");
  await expect(status(page)).toContainText("%25");
  await expect(output(page)).toBeEmpty();
  await expect(page.getByRole("button", { name: "Copy result" })).toBeDisabled();

  // Legal escapes whose bytes are not a character are caught too, and placed.
  await input(page).fill("caf%C3%28");
  await expect(status(page)).toContainText("Character 4, %C3%28");
  await expect(status(page)).toContainText("not a character in UTF-8");

  await input(page).fill("100%");
  await expect(status(page)).toContainText("ends before it finishes");
});

test("swaps the result back into the box to check a round trip", async ({ page }) => {
  await page.goto("/tools/url-encode-decode/");

  await input(page).fill("naïve café — 100% ok?");
  await expect(output(page)).toHaveText("na%C3%AFve%20caf%C3%A9%20%E2%80%94%20100%25%20ok%3F");

  await page.getByRole("button", { name: "Swap" }).click();

  await expect(radio(page, "Decode")).toBeChecked();
  await expect(input(page)).toHaveValue("na%C3%AFve%20caf%C3%A9%20%E2%80%94%20100%25%20ok%3F");
  await expect(output(page)).toHaveText("naïve café — 100% ok?");

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(input(page)).toHaveValue("");
  await expect(status(page)).toContainText("Type or paste something above");
});

test("copies the result", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Clipboard permissions are granted for Chromium here.");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/url-encode-decode/");

  await input(page).fill("a b");
  await page.getByRole("button", { name: "Copy result" }).click();

  await expect(status(page)).toContainText("copied to your clipboard");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("a%20b");
});

test("says so when there was nothing to do", async ({ page }) => {
  await page.goto("/tools/url-encode-decode/");

  await input(page).fill("plain-text_only.txt");

  await expect(output(page)).toHaveText("plain-text_only.txt");
  await expect(status(page)).toContainText("Nothing here needed escaping");
});
