import { expect, test, type Page } from "@playwright/test";

/**
 * A digest computed, and a digest checked.
 *
 * The assertions that matter most are the negative ones: that hashing a file
 * makes no request at all, and that a match is never described as proof of
 * anything more than the file matching that one hash.
 */
const abc = {
  md5: "900150983cd24fb0d6963f7d28e17f72",
  sha1: "a9993e364706816aba3e25717850c26c9cd0d89d",
  sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  sha512:
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
} as const;

const chooseFile = (page: Page) => page.getByLabel("Select a file to hash");

const expected = (page: Page) => page.getByLabel("Expected hash");

const verdict = (page: Page) => page.locator("[data-verdict]");

const rowFor = (page: Page, algorithm: string) =>
  page.locator(`[data-digests] [data-algorithm="${algorithm}"]`);

const give = (page: Page, body: string, name = "gizlet.txt") =>
  chooseFile(page).setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(body) });

test("hashes a file five ways without sending it anywhere", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/file-hash-generator/");

  await expect(page).toHaveTitle("File Hash Generator | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText("hashed on this device");
  // The claim the page must not let a reader miss.
  await expect(page.locator(".hash-tool__notice")).toContainText(
    "nothing about where the hash came from",
  );

  await give(page, "abc");

  await expect(page.locator("[data-file-name]")).toHaveText("gizlet.txt");
  await expect(rowFor(page, "sha256").locator("[data-digest-value]")).toHaveText(abc.sha256);
  await expect(rowFor(page, "sha512").locator("[data-digest-value]")).toHaveText(abc.sha512);
  await expect(rowFor(page, "sha1").locator("[data-digest-value]")).toHaveText(abc.sha1);
  await expect(rowFor(page, "md5").locator("[data-digest-value]")).toHaveText(abc.md5);
  await expect(page.locator("[data-status]")).toContainText("The file was not uploaded");

  // The two that cannot prove authenticity say so beside their own answer.
  await expect(rowFor(page, "sha1").locator("[data-digest-badge]")).toBeVisible();
  await expect(rowFor(page, "md5").locator("[data-digest-badge]")).toBeVisible();
  await expect(rowFor(page, "sha256").locator("[data-digest-badge]")).toBeHidden();
  await expect(rowFor(page, "md5")).toContainText("Broken for authenticity");

  expect(requests).toEqual([]);
});

test("answers a pasted checksum in one word, in either order", async ({ page }) => {
  await page.goto("/tools/file-hash-generator/");

  // The checksum is usually copied before the download has finished, so it is
  // pasted first here on purpose.
  await expected(page).fill(abc.sha256);
  await expect(verdict(page)).toBeHidden();

  await give(page, "abc");

  await expect(verdict(page)).toHaveAttribute("data-state", "match");
  await expect(page.locator("[data-verdict-headline]")).toHaveText("Match");
  await expect(page.locator("[data-verdict-algorithm]")).toContainText("SHA-256, from the length");
  await expect(page.locator("[data-verdict-summary]")).toContainText(
    "the same file those bytes were hashed from",
  );
  await expect(page.locator("[data-verdict-actual]")).toHaveText(abc.sha256);
  // The row the verdict used is marked, so the two cannot be read as being
  // about different digests.
  await expect(rowFor(page, "sha256")).toHaveAttribute("data-compared", "true");
});

test("says no match without guessing at the cause", async ({ page }) => {
  await page.goto("/tools/file-hash-generator/");

  await give(page, "abd");
  await expected(page).fill(abc.sha256);

  await expect(verdict(page)).toHaveAttribute("data-state", "mismatch");
  await expect(page.locator("[data-verdict-headline]")).toHaveText("No match");
  await expect(page.locator("[data-verdict-summary]")).toContainText("cannot tell you which");
  await expect(page.locator("[data-verdict-expected]")).toHaveText(abc.sha256);
  await expect(page.locator("[data-verdict-actual]")).not.toHaveText(abc.sha256);
});

test("takes a checksum line as it was copied, and warns about the file it names", async ({
  page,
}) => {
  await page.goto("/tools/file-hash-generator/");

  await give(page, "abc");
  await expected(page).fill(`${abc.md5}  gizlet-1.0.0.tar.gz`);

  // The length picks MD5 without anybody choosing it.
  await expect(verdict(page)).toHaveAttribute("data-state", "match");
  await expect(page.locator("[data-verdict-algorithm]")).toContainText("MD5");
  await expect(rowFor(page, "md5")).toHaveAttribute("data-compared", "true");
  await expect(page.locator("[data-expected-notes]")).toContainText(
    "The line names a file, gizlet-1.0.0.tar.gz",
  );
  await expect(page.locator("[data-verdict-warning]")).toContainText(
    "written for gizlet-1.0.0.tar.gz",
  );
});

test("refuses a hash it cannot read, and keeps the digests on screen", async ({ page }) => {
  await page.goto("/tools/file-hash-generator/");

  await give(page, "abc");
  await expected(page).fill("nowhere near a hash");

  await expect(page.locator("[data-expected-error]")).toContainText("hexadecimal");
  await expect(verdict(page)).toBeHidden();
  await expect(rowFor(page, "sha256").locator("[data-digest-value]")).toHaveText(abc.sha256);

  await expected(page).fill(abc.sha256.slice(0, 63));

  await expect(page.locator("[data-expected-error]")).toContainText("32, 40, 64, 96, 128");

  await expected(page).fill(`${abc.sha256}  one\n${abc.md5}  two`);

  await expect(page.locator("[data-expected-error]")).toContainText(
    "2 checksums rather than one",
  );
});

test("starts over on request", async ({ page }) => {
  await page.goto("/tools/file-hash-generator/");

  await give(page, "abc");
  await expect(rowFor(page, "sha256").locator("[data-digest-value]")).toHaveText(abc.sha256);

  await page.getByRole("button", { name: "Hash another file" }).click();

  await expect(page.locator("[data-results]")).toBeHidden();
  await expect(chooseFile(page)).toBeAttached();

  await give(page, "abc", "again.txt");

  await expect(page.locator("[data-file-name]")).toHaveText("again.txt");
  await expect(page.locator("[data-digests] > li")).toHaveCount(5);
});
