import { expect, test, type Page } from "@playwright/test";

/**
 * Making UUIDs and reading them back.
 *
 * The assertions are about the bits, not about the plumbing: a value that
 * claims to be a version 7 has a 7 in the right nibble, sorts by time, and
 * decodes back to the moment it was made.
 */
const chooseKind = (page: Page, kind: string) =>
  page.getByLabel("Which kind", { exact: true }).selectOption(kind);

const lines = async (page: Page) => {
  const text = (await page.locator("[data-output]").textContent()) ?? "";

  return text.split("\n").filter((line) => line !== "");
};

/**
 * Presses Generate and waits for the batch to arrive.
 *
 * Generation imports its generator on first use and version 5 awaits a digest,
 * so the output is not populated by the time the click resolves. Pressing
 * Generate empties the output first, which is what makes polling for the count
 * unambiguous: without that, switching between two versions that each produce
 * one line would read the previous version's answer.
 */
const generate = async (page: Page, expected: number) => {
  await page.getByRole("button", { name: "Generate" }).click();
  await expect.poll(async () => (await lines(page)).length).toBe(expected);

  return lines(page);
};

/** The 32 hexadecimal digits, out of whatever style the page is writing. */
const digitsOf = (value: string) =>
  value
    .trim()
    .replace(/^urn:uuid:/i, "")
    .replace(/^[{(]|[)}]$/g, "")
    .replace(/-/g, "")
    .toLowerCase();

const versionOf = (value: string) => Number.parseInt(digitsOf(value).slice(12, 13), 16);

const variantOf = (value: string) => Number.parseInt(digitsOf(value).slice(16, 17), 16) >> 2;

test("generates a version 4 with the right bits, on this device", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/uuid-generator/");

  await expect(page).toHaveTitle("UUID Generator | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText("made on this device");

  await page.getByLabel("How many").fill("25");

  const made = await generate(page, 25);

  // Every one is a version 4 with the RFC variant, and all 25 differ.
  expect(made.every((value) => versionOf(value) === 4)).toBe(true);
  expect(made.every((value) => variantOf(value) === 2)).toBe(true);
  expect(new Set(made).size).toBe(25);
  await expect(page.locator("[data-status]")).toContainText("25 UUIDs");

  // Nothing was posted anywhere.
  expect(requests).toEqual([]);
});

test("generates a version 7 that sorts by the time it was made", async ({ page }) => {
  await page.goto("/tools/uuid-generator/");

  await chooseKind(page, "v7");
  await expect(page.locator("[data-kind-summary]")).toContainText("sort into the order they were made");
  await expect(page.locator("[data-kind-reveals]")).toContainText("millisecond it was created");

  await page.getByLabel("How many").fill("40");

  const made = await generate(page, 40);

  expect(made.every((value) => versionOf(value) === 7)).toBe(true);
  // Generated in order, so the strings must already be in order.
  expect([...made].sort()).toEqual(made);

  // And the page reads the embedded time back out of one.
  await page.getByLabel("Paste a UUID").fill(made[0]);
  await expect(page.locator("[data-facts]")).toContainText("Version 7");
  await expect(page.locator("[data-facts]")).toContainText("Made");
});

test("makes a version 1 whose node cannot identify the machine", async ({ page }) => {
  await page.goto("/tools/uuid-generator/");

  await chooseKind(page, "v1");

  const [made] = await generate(page, 1);

  expect(versionOf(made)).toBe(1);

  // The multicast bit on the first byte of the node says "not a real address".
  const firstNodeByte = Number.parseInt(digitsOf(made).slice(20, 22), 16);

  expect(firstNodeByte & 0x01).toBe(1);

  await page.getByLabel("Paste a UUID").fill(made);
  await expect(page.locator("[data-facts]")).toContainText("identifies no machine");
});

test("derives a name-based UUID that matches every other implementation", async ({ page }) => {
  await page.goto("/tools/uuid-generator/");

  // The published vector for version 5 in the DNS namespace.
  await chooseKind(page, "v5");
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("python.org");

  expect(await generate(page, 1)).toEqual(["886313e1-3b8a-5372-9b90-0c9aee199e5d"]);

  // And version 3, which needs the MD5 the platform refuses to provide.
  await chooseKind(page, "v3");

  expect(await generate(page, 1)).toEqual(["6fa459ea-ee8a-3ca4-894e-db77e160355e"]);

  // Asking for several gives several copies, and the page says why.
  await page.getByLabel("How many").fill("3");

  const made = await generate(page, 3);

  expect(made).toEqual(Array.from({ length: 3 }, () => "6fa459ea-ee8a-3ca4-894e-db77e160355e"));
  await expect(page.locator("[data-status]")).toContainText("copies of one UUID");
});

test("refuses a name-based UUID with nothing to derive it from", async ({ page }) => {
  await page.goto("/tools/uuid-generator/");

  await chooseKind(page, "v5");
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.locator("[data-error]")).toContainText("Type the name");

  // A custom namespace has to be a UUID itself, and says so when it is not.
  await page.getByLabel("Name", { exact: true }).fill("example.com");
  await page.getByLabel("Namespace", { exact: true }).selectOption("custom");
  await page.getByLabel("Your namespace UUID").fill("not-a-uuid");
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.locator("[data-error]")).toContainText("A namespace is itself a UUID");
});

test("writes the same value in every style, GUID included", async ({ page }) => {
  await page.goto("/tools/uuid-generator/");

  const [canonical] = await generate(page, 1);

  await page.getByLabel("Written as").selectOption("braces");
  await page.getByLabel("Letters").selectOption("upper");

  const [braced] = await lines(page);

  expect(braced).toBe(`{${canonical.toUpperCase()}}`);
  // Changing the style redraws the value it already has rather than making a
  // new one, so the digits underneath are the same 128 bits.
  expect(digitsOf(braced)).toBe(digitsOf(canonical));

  await page.getByLabel("Written as").selectOption("compact");
  expect((await lines(page))[0]).toBe(canonical.toUpperCase().replace(/-/g, ""));

  await page.getByLabel("Written as").selectOption("urn");
  await page.getByLabel("Letters").selectOption("lower");
  expect((await lines(page))[0]).toBe(`urn:uuid:${canonical}`);
});

test("reads a pasted UUID in any style, and explains the ones it will not make", async ({ page }) => {
  await page.goto("/tools/uuid-generator/");

  const reader = page.getByLabel("Paste a UUID");
  const facts = page.locator("[data-facts]");

  await reader.fill("{6FA459EA-EE8A-3CA4-894E-DB77E160355E}");
  await expect(facts).toContainText("Version 3");

  await reader.fill("00000000-0000-0000-0000-000000000000");
  await expect(facts).toContainText("zero bits");

  await reader.fill("ffffffff-ffff-ffff-ffff-ffffffffffff");
  await expect(facts).toContainText("every bit set");

  // A version 2 is explained rather than dismissed, which is the point of not
  // generating one.
  await reader.fill("3f2b8c1a-4d5e-2f60-8a71-9b2c3d4e5f60");
  await expect(facts).toContainText("POSIX");

  // An older layout has no version to read at all.
  await reader.fill("3f2b8c1a-4d5e-4f60-0a71-9b2c3d4e5f60");
  await expect(facts).toContainText("Apollo NCS");

  await reader.fill("not a uuid");
  await expect(facts).toHaveAttribute("data-state", "invalid");
  await expect(facts).toContainText("32 hexadecimal digits");
});

test("refuses a batch larger than it will make", async ({ page }) => {
  await page.goto("/tools/uuid-generator/");

  await page.getByLabel("How many").fill("1001");
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.locator("[data-error]")).toContainText("up to 1,000");
  await expect(page.locator("[data-output]")).toBeEmpty();

  await page.getByLabel("How many").fill("0");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.locator("[data-error]")).toContainText("at least one");
});

test("copies the batch", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Clipboard permissions are granted for Chromium here.");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/uuid-generator/");

  await page.getByLabel("How many").fill("3");
  await generate(page, 3);
  await page.getByRole("button", { name: "Copy all" }).click();

  await expect(page.locator("[data-status]")).toContainText("Copied 3");
  expect((await page.evaluate(() => navigator.clipboard.readText())).split("\n")).toEqual(
    await lines(page),
  );
});
