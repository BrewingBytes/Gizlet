import { expect, test, type Page } from "@playwright/test";

/**
 * A token read, and deliberately not checked.
 *
 * The assertions that matter most here are the negative ones: that the page
 * never claims a token is valid, and that reading one makes no request at all.
 * A token is usually a live credential, so "nothing was uploaded" is the claim
 * this Gizlet has to keep.
 */
const segment = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const signature = Buffer.from("thirty-two bytes of nothing at a", "utf8").toString("base64url");

const build = (header: unknown, payload: unknown, tail: string = signature) =>
  `${segment(header)}.${segment(payload)}.${tail}`;

const input = (page: Page) => page.getByLabel("Token to decode");

const error = (page: Page) => page.locator("[data-error]");

const warnings = (page: Page) => page.locator("[data-warnings]");

test("decodes a token without sending it anywhere", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/jwt-decoder/");

  await expect(page).toHaveTitle("JWT Decoder | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText("read on this device");
  // The one claim the page must never let a reader miss.
  await expect(page.locator(".jwt-tool__notice")).toContainText("Decoding is not verifying");

  await input(page).fill(build({ alg: "RS256", typ: "JWT", kid: "key-1" }, { sub: "1234", name: "Ada" }));

  await expect(page.locator("[data-header-json]")).toContainText('"alg": "RS256"');
  await expect(page.locator("[data-payload-json]")).toContainText('"name": "Ada"');
  await expect(page.locator("[data-header-summary]")).toContainText("kid key-1");
  await expect(page.locator("[data-header-summary]")).toContainText("32-byte signature");
  await expect(page.locator("[data-algorithm]")).toContainText("only the issuer");
  await expect(page.locator("[data-status]")).toContainText("Nothing was sent anywhere");

  // The three parts are shown as three parts, which is how a person finds the
  // dot they lost when they copied the token.
  await expect(page.locator("[data-split] .header")).not.toBeEmpty();
  await expect(page.locator("[data-split] .signature")).toHaveText(signature);

  expect(requests).toEqual([]);
});

test("explains the claims and reads the dates both ways", async ({ page }) => {
  await page.goto("/tools/jwt-decoder/");

  await input(page).fill(
    build(
      { alg: "HS256", typ: "JWT" },
      { iss: "https://accounts.example.com", aud: "gizlet", exp: 1_749_903_600, iat: 1_749_900_000, plan: "free" },
    ),
  );

  const claims = page.locator("[data-claims] li");

  await expect(claims).toHaveCount(4);
  // The raw seconds a bug report needs, and the moment a person needs.
  await expect(claims.filter({ hasText: "Expires" })).toContainText("1749903600");
  await expect(claims.filter({ hasText: "Expires" })).toContainText("2025-06-14 12:20:00 UTC");
  await expect(claims.filter({ hasText: "Issuer" })).toContainText("Who says they made this token");
  // A claim nobody standardised is left in the JSON rather than given an
  // invented meaning.
  await expect(page.locator("[data-claims-note]")).toContainText("1 other field is");
  await expect(claims.filter({ hasText: "plan" })).toHaveCount(0);

  await expect(page.locator("[data-window-label]")).toHaveText("EXPIRED");
  await expect(page.locator("[data-window]")).toContainText("expiry passed");
});

test("reads the example token it offers, expiry and all", async ({ page }) => {
  await page.goto("/tools/jwt-decoder/");

  await page.getByRole("button", { name: "Try an example" }).click();

  await expect(page.locator("[data-payload-json]")).toContainText("Ada Lovelace");
  await expect(page.locator("[data-window-label]")).toHaveText("EXPIRED");
  await expect(page.locator("[data-claims] li").first()).toContainText("Issuer");

  await page.getByRole("button", { name: "Clear" }).click();

  await expect(input(page)).toHaveValue("");
  await expect(page.locator("[data-results]")).toBeHidden();
  await expect(page.locator("[data-status]")).toContainText("Paste a token");
});

test("never calls a token in date valid", async ({ page }) => {
  await page.goto("/tools/jwt-decoder/");

  const future = Math.floor(Date.now() / 1000) + 3600;

  await input(page).fill(build({ alg: "HS256" }, { sub: "1", exp: future }));

  const window = page.locator("[data-window]");

  await expect(page.locator("[data-window-label]")).toHaveText("IN DATE");
  await expect(window).toContainText("in 1 hour");
  await expect(window).not.toContainText("valid");
  await expect(warnings(page)).toBeHidden();
});

test("says which of the three parts is wrong", async ({ page }) => {
  await page.goto("/tools/jwt-decoder/");

  // A JWE has five parts and no readable payload, and is named as one rather
  // than blamed on its Base64.
  await input(page).fill("a.b.c.d.e");
  await expect(error(page)).toContainText("encrypted token");

  await input(page).fill(`${segment({ alg: "HS256" })}.${segment({ sub: "1" })}`);
  await expect(error(page)).toContainText("ends with a dot");

  await input(page).fill("Zm9vYmFy");
  await expect(error(page)).toContainText("Base64 Encode & Decode");

  // A payload that will not decode does not make the header unreadable, and
  // the header that read is still shown.
  await input(page).fill(`${segment({ alg: "HS256" })}.not!a!segment.${signature}`);
  await expect(error(page)).toContainText("payload is not Base64URL");
  await expect(page.locator("[data-header-json]")).toContainText('"alg": "HS256"');
  await expect(page.locator("[data-results]")).toBeHidden();
});

test("warns about a token that says it is unsigned", async ({ page }) => {
  await page.goto("/tools/jwt-decoder/");

  await input(page).fill(build({ alg: "none", typ: "JWT" }, { sub: "1" }, ""));

  await expect(warnings(page)).toContainText("proves nothing");
  await expect(page.locator("[data-header-summary]")).toContainText("no signature");
  // Readable all the same: the complaint never replaces the answer.
  await expect(page.locator("[data-payload-json]")).toContainText('"sub": "1"');
});

test("catches a date written in milliseconds", async ({ page }) => {
  await page.goto("/tools/jwt-decoder/");

  await input(page).fill(build({ alg: "HS256" }, { exp: Date.now() }));

  await expect(warnings(page)).toContainText("that is milliseconds");
  await expect(page.locator("[data-window-label]")).toHaveText("NO EXPIRY");
  await expect(page.locator("[data-claims] li")).toContainText("Too large to be seconds");
});

test("takes a token out of whatever it was copied from", async ({ page }) => {
  await page.goto("/tools/jwt-decoder/");

  const token = build({ alg: "HS256" }, { sub: "1" });

  await input(page).fill(`Authorization: Bearer ${token.slice(0, 30)}\n${token.slice(30)}`);

  await expect(page.locator("[data-payload-json]")).toContainText('"sub": "1"');
  await expect(warnings(page)).toContainText("Bearer prefix was ignored");
});

test("copies the header and the payload", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Clipboard permissions are granted for Chromium here.");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/jwt-decoder/");

  await input(page).fill(build({ alg: "HS256" }, { sub: "1234" }));

  await page.getByRole("button", { name: "Copy payload" }).click();

  await expect(page.locator("[data-status]")).toContainText("Payload copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('{\n  "sub": "1234"\n}');
});
