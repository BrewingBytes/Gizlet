import { expect, test, type Page } from "@playwright/test";

/**
 * Base64, both ways, over text and over a file.
 *
 * The round trips are the assertions that matter: what goes in has to come
 * back out identically, including the characters `btoa` cannot handle at all.
 */
const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });

const input = (page: Page) => page.getByLabel(/^(Text to encode|Base64 to decode)$/);

const output = (page: Page) => page.locator("[data-output]");

/** A 1x1 PNG, which is bytes that are emphatically not text. */
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

test("encodes text as its UTF-8 bytes, which btoa cannot do", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/base64-encode-decode/");

  await expect(page).toHaveTitle("Base64 Encode & Decode | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText("converted on this device");

  await input(page).fill("foobar");
  await expect(output(page)).toHaveText("Zm9vYmFy");

  // The RFC's own vectors, which exist because the padding is what people
  // get wrong.
  for (const [text, encoded] of [
    ["f", "Zg=="],
    ["fo", "Zm8="],
    ["foo", "Zm9v"],
    ["foob", "Zm9vYg=="],
    ["fooba", "Zm9vYmE="],
  ] as const) {
    await input(page).fill(text);
    await expect(output(page)).toHaveText(encoded);
  }

  // And the characters that would throw straight out of btoa. The expected
  // value comes from Node's own Buffer, so this is a check against a separate
  // implementation rather than against a string somebody typed.
  const unicode = "naïve café 日本語 👍";

  await input(page).fill(unicode);
  await expect(output(page)).toHaveText(Buffer.from(unicode, "utf8").toString("base64"));
  await expect(page.locator("[data-status]")).toContainText("larger");
  // The page never lets Base64 look like protection.
  await expect(page.locator("[data-note]")).toContainText("not a way of hiding them");

  expect(requests).toEqual([]);
});

test("writes either alphabet, with or without padding, wrapped or not", async ({ page }) => {
  await page.goto("/tools/base64-encode-decode/");

  // These three bytes produce both of the characters that separate the two
  // alphabets, which is the only difference between them.
  await input(page).fill("ûÿ¿");
  const standard = await output(page).textContent();

  await page.getByLabel("Alphabet").selectOption("url");
  const urlSafe = await output(page).textContent();

  expect(standard).not.toBe(urlSafe);
  expect(urlSafe).not.toMatch(/[+/]/);
  await expect(page.locator("[data-alphabet-summary]")).toContainText("- and _");

  await input(page).fill("f");
  await expect(output(page)).toHaveText("Zg==");
  await page.getByLabel("Write the = padding").uncheck();
  await expect(output(page)).toHaveText("Zg");

  // Wrapping breaks the output at 76 characters and changes nothing else.
  await input(page).fill("a".repeat(200));
  await page.getByLabel("Break lines at 76 characters").check();

  const wrapped = (await output(page).textContent()) ?? "";

  expect(wrapped.split("\n")[0]).toHaveLength(76);
  expect(wrapped.split("\n").length).toBeGreaterThan(1);
});

test("reads Base64 back, and says what it found", async ({ page }) => {
  await page.goto("/tools/base64-encode-decode/");

  await radio(page, "Decode").check();
  await input(page).fill("Zm9vYmFy");

  await expect(output(page)).toHaveText("foobar");
  await expect(page.locator("[data-status]")).toContainText("standard alphabet");
  // Decoding detects the alphabet, so the control that would choose one is not
  // offered: it would change nothing.
  await expect(page.getByLabel("Alphabet")).toBeHidden();

  // Whitespace and line breaks are legal between the characters, and MIME
  // puts them there.
  await input(page).fill("Zm9v\nYmFy  ");
  await expect(output(page)).toHaveText("foobar");

  // The URL-safe alphabet is detected rather than configured.
  await input(page).fill("-_-_");
  await expect(page.locator("[data-status]")).toContainText("URL-safe alphabet");

  // Missing padding is fine, and reported.
  await input(page).fill("Zg");
  await expect(output(page)).toHaveText("f");
  await expect(page.locator("[data-status]")).toContainText("no padding");
});

test("names the character that is wrong, and where", async ({ page }) => {
  await page.goto("/tools/base64-encode-decode/");

  await radio(page, "Decode").check();

  await input(page).fill("Zm9v*mFy");
  await expect(page.locator("[data-error]")).toContainText("Character 5");
  await expect(page.locator("[data-error]")).toContainText("not a Base64 character");
  await expect(output(page)).toBeEmpty();

  await input(page).fill("Zm9=YmFy");
  await expect(page.locator("[data-error]")).toContainText("very end of a Base64 string");

  await input(page).fill("Zm9vY");
  await expect(page.locator("[data-error]")).toContainText("groups of four");

  await input(page).fill("ab+cd_ef");
  await expect(page.locator("[data-error]")).toContainText("mixes the two alphabets");

  // A non-canonical last character is a note, not a refusal: the bytes are
  // not in doubt.
  await input(page).fill("QR==");
  await expect(page.locator("[data-error]")).toBeHidden();
  await expect(page.locator("[data-status]")).toContainText("non-canonical");
  await expect(output(page)).toHaveText("A");
});

test("offers bytes that are not text as a file instead", async ({ page }) => {
  await page.goto("/tools/base64-encode-decode/");

  await radio(page, "Decode").check();
  await input(page).fill(pngBase64);

  await expect(page.locator("[data-note]")).toContainText("not text");
  // There is a result, it is just not text, so the text box goes rather than
  // claiming the result will appear in it.
  await expect(page.locator("[data-output-box]")).toBeHidden();
  await expect(page.getByRole("button", { name: "Download the bytes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy result" })).toBeDisabled();

  // A data URI gives the bytes a declared type, and the download is named for it.
  await input(page).fill(`data:image/png;base64,${pngBase64}`);
  await expect(page.locator("[data-status]")).toContainText("declared as image/png");

  const download = page.waitForEvent("download");

  await page.getByRole("button", { name: "Download the bytes" }).click();
  expect((await download).suggestedFilename()).toBe("decoded.png");
});

test("encodes a file from the device, and can write it as a data URI", async ({ page }) => {
  await page.goto("/tools/base64-encode-decode/");

  await radio(page, "A file").check();
  await page.getByLabel("Select a file to encode").setInputFiles([
    { name: "dot.png", mimeType: "image/png", buffer: Buffer.from(pngBase64, "base64") },
  ]);

  await expect(page.locator("[data-file-name]")).toContainText("dot.png");
  await expect(page.locator("[data-file-name]")).toContainText("image/png");
  await expect(output(page)).toHaveText(pngBase64);

  await page.getByLabel("Write it as a data: URI").check();
  await expect(output(page)).toHaveText(`data:image/png;base64,${pngBase64}`);
});

test("refuses a file too large to become text", async ({ page }) => {
  await page.goto("/tools/base64-encode-decode/");

  await radio(page, "A file").check();
  await page.getByLabel("Select a file to encode").setInputFiles([
    { name: "big.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(600 * 1024, 7) },
  ]);

  await expect(page.locator("[data-error]")).toContainText("larger than");
  await expect(output(page)).toBeEmpty();
});

test("swaps the result back to check a round trip", async ({ page }) => {
  await page.goto("/tools/base64-encode-decode/");

  await input(page).fill("naïve café — 100% ok?");
  const encoded = await output(page).textContent();

  await page.getByRole("button", { name: "Swap" }).click();

  await expect(radio(page, "Decode")).toBeChecked();
  await expect(input(page)).toHaveValue(encoded ?? "");
  await expect(output(page)).toHaveText("naïve café — 100% ok?");
});

test("copies the result", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Clipboard permissions are granted for Chromium here.");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/base64-encode-decode/");

  await input(page).fill("foobar");
  await page.getByRole("button", { name: "Copy result" }).click();

  await expect(page.locator("[data-status]")).toContainText("copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Zm9vYmFy");
});
