import { expect, test, type Page } from "@playwright/test";

/**
 * Campaign links, built as text and never visited.
 *
 * The destination host below is one this suite watches for: a request to it
 * at any point would mean the page fetched, previewed or opened the address,
 * which is the one thing it promises not to do.
 */
const destinationHost = "campaign-destination.example";

const destination = (page: Page) => page.getByLabel("Destination address");

const field = (page: Page, label: string) => page.getByRole("textbox", { name: new RegExp(`^${label} utm_`) });

const result = (page: Page) => page.getByRole("textbox", { name: "Campaign link" });

const status = (page: Page) => page.locator("[data-status]");

async function fillRequired(page: Page) {
  await field(page, "Source").fill("newsletter");
  await field(page, "Medium").fill("email");
  await field(page, "Campaign").fill("autumn launch");
}

/** Every request the page makes to the destination, which should stay empty. */
function watchDestination(page: Page): string[] {
  const requests: string[] = [];

  page.on("request", (request) => {
    if (new URL(request.url()).hostname.endsWith(destinationHost)) requests.push(request.url());
  });

  return requests;
}

test("builds the link as you type, and never visits the destination", async ({ page }) => {
  const visits = watchDestination(page);
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") posts.push(request.url());
  });

  await page.goto("/tools/utm-builder/");

  await expect(page).toHaveTitle("UTM Builder | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText("Your link is built on this device");
  await expect(page.getByRole("button", { name: "Copy link" })).toBeDisabled();

  await destination(page).fill(`https://${destinationHost}/shop?ref=home&flag#reviews`);
  await expect(status(page)).toHaveText("Add a source, a medium and a campaign to build the link.");

  await fillRequired(page);

  await expect(result(page)).toHaveValue(
    `https://${destinationHost}/shop?ref=home&flag&utm_source=newsletter&utm_medium=email&utm_campaign=autumn%20launch#reviews`,
  );
  await expect(status(page)).toContainText("Built on this device. Nothing was opened or fetched.");

  await field(page, "Term").fill("rain boots");
  await field(page, "Content").fill("salt & pepper");

  await expect(result(page)).toHaveValue(
    `https://${destinationHost}/shop?ref=home&flag&utm_source=newsletter&utm_medium=email&utm_campaign=autumn%20launch&utm_term=rain%20boots&utm_content=salt%20%26%20pepper#reviews`,
  );

  // The result is text in a box, not a link anyone could follow by accident.
  await expect(page.locator(`[data-utm-builder] a[href*="${destinationHost}"]`)).toHaveCount(0);

  expect(visits).toEqual([]);
  expect(posts).toEqual([]);
});

test("replaces the utm_ keys a link already had, each exactly once", async ({ page }) => {
  await page.goto("/tools/utm-builder/");

  await destination(page).fill(
    `https://${destinationHost}/?utm_source=old&id=7&utm_source=older&utm_term=stale`,
  );
  await fillRequired(page);

  await expect(result(page)).toHaveValue(
    `https://${destinationHost}/?id=7&utm_source=newsletter&utm_medium=email&utm_campaign=autumn%20launch`,
  );
  await expect(status(page)).toContainText("Replaced the utm_source the address already had.");
  await expect(status(page)).toContainText("Removed the old utm_term, because that field is empty.");
  await expect(status(page)).toContainText("One repeated utm_ key was dropped");
});

test("refuses an address that is not a web page, and says why", async ({ page }) => {
  await page.goto("/tools/utm-builder/");
  await fillRequired(page);

  for (const [address, message] of [
    ["javascript:alert(1)", "A javascript: link is not a web page"],
    ["data:text/html,<b>hi</b>", "A data: link is not a web page"],
    ["/pricing", "That is not a whole address"],
  ] as const) {
    await destination(page).fill(address);

    await expect(page.locator("[data-destination-problem]")).toContainText(message);
    await expect(destination(page)).toHaveAttribute("aria-invalid", "true");
    await expect(result(page)).toHaveValue("");
    await expect(page.getByRole("button", { name: "Copy link" })).toBeDisabled();
  }

  await destination(page).fill(`${destinationHost}/pricing`);
  await expect(page.locator("[data-destination-problem]")).toContainText(
    `for example https://${destinationHost}/pricing`,
  );

  await destination(page).fill(`https://${destinationHost}/pricing`);
  await expect(destination(page)).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator("[data-destination-problem]")).toBeEmpty();
});

test("renders what was typed as text, never as markup", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });

  await page.goto("/tools/utm-builder/");

  const markup = '<img src=x onerror="alert(1)">';

  await destination(page).fill(`https://${destinationHost}/`);
  await fillRequired(page);
  await field(page, "Campaign").fill(markup);

  await expect(result(page)).toHaveValue(/utm_campaign=%3Cimg%20src%3Dx%20onerror%3D%22alert%281%29%22%3E$/);

  await destination(page).fill(`javascript:${markup}`);
  await expect(page.locator("[data-destination-problem]")).toContainText("A javascript: link");

  expect(await page.locator("[data-utm-builder] img").count()).toBe(0);
  expect(dialogs).toEqual([]);
});

test("points out a capital letter, and keeps the value as typed", async ({ page }) => {
  await page.goto("/tools/utm-builder/");

  await destination(page).fill(`https://${destinationHost}/`);
  await fillRequired(page);
  await field(page, "Source").fill("Newsletter");

  await expect(page.locator("[data-case-note]")).toContainText("Source has a capital letter.");
  await expect(result(page)).toHaveValue(/utm_source=Newsletter/);
});

test("says where the campaign is counted, and that Gizlet does not count it", async ({ page }) => {
  await page.goto("/tools/utm-builder/");

  const note = page.locator(".utm-builder__note");

  await expect(note).toContainText("read by the analytics on the destination site");
  await expect(note).toContainText("Cloudflare Web Analytics does not report UTM parameters");
});

test("copies the link to the clipboard", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Clipboard permissions are granted for Chromium here.");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/utm-builder/");

  await destination(page).fill(`https://${destinationHost}/`);
  await fillRequired(page);
  await page.getByRole("button", { name: "Copy link" }).click();

  await expect(status(page)).toHaveText("Link copied to your clipboard.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `https://${destinationHost}/?utm_source=newsletter&utm_medium=email&utm_campaign=autumn%20launch`,
  );
});

test("selects the link for a manual copy when the clipboard is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "clipboard", { configurable: true, get: () => undefined });
  });
  await page.goto("/tools/utm-builder/");

  await destination(page).fill(`https://${destinationHost}/`);
  await fillRequired(page);
  await page.getByRole("button", { name: "Copy link" }).click();

  await expect(status(page)).toContainText("Copying is blocked in this browser. The link is selected");
  await expect(result(page)).toBeFocused();

  const selection = await result(page).evaluate((box: HTMLTextAreaElement) =>
    box.value.slice(box.selectionStart, box.selectionEnd),
  );

  expect(selection).toBe(
    `https://${destinationHost}/?utm_source=newsletter&utm_medium=email&utm_campaign=autumn%20launch`,
  );
});

test("clears every field and returns focus to the address", async ({ page }) => {
  await page.goto("/tools/utm-builder/");

  await destination(page).fill(`https://${destinationHost}/`);
  await fillRequired(page);
  await page.getByRole("button", { name: "Clear" }).click();

  await expect(destination(page)).toBeFocused();
  await expect(destination(page)).toHaveValue("");
  await expect(field(page, "Source")).toHaveValue("");
  await expect(result(page)).toHaveValue("");
  await expect(status(page)).toBeEmpty();
});
