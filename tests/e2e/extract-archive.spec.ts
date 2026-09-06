import { deflateRawSync } from "node:zlib";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { createZipArchive } from "../../src/data/zip-archive";

/**
 * Opening an archive and taking things back out of it.
 *
 * The fixtures are built with the writing half of the same pair, which is the
 * point of the pair: what Create ZIP writes, this reads. The ones that cannot
 * be written honestly — an encrypted entry, a method no browser has, a path
 * that escapes its folder — are made by patching the archive's own index,
 * because an archive tool has to be right about the archives it did not make.
 */
const archiveOf = (files: readonly { name: string; body: string; deflate?: boolean }[]) =>
  Buffer.from(
    createZipArchive(
      files.map((file) => {
        const data = new TextEncoder().encode(file.body);

        return { name: file.name, data, deflated: file.deflate ? deflateRawSync(data) : undefined };
      }),
    ),
  );

/** Every central header in an archive, in the order the index lists them. */
const centralHeaders = (archive: Buffer) => {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const found: number[] = [];

  for (let position = 0; position < archive.length - 4; position += 1) {
    if (view.getUint32(position, true) === 0x02014b50) found.push(position);
  }

  return found;
};

/** An archive whose index says something about an entry that the writer cannot. */
const patched = (archive: Buffer, index: number, patch: { flags?: number; method?: number }) => {
  const copy = Buffer.from(archive);
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  const header = centralHeaders(copy)[index];

  if (patch.flags !== undefined) view.setUint16(header + 8, patch.flags, true);
  if (patch.method !== undefined) view.setUint16(header + 10, patch.method, true);

  return copy;
};

const asArchive = (name: string, archive: Buffer) => ({
  name,
  mimeType: "application/zip",
  buffer: archive,
});

const chooseArchive = (page: Page) => page.getByLabel("Select an archive to look inside");

const rows = (page: Page) => page.locator("[data-tree] > li");

const openArchive = async (page: Page, name: string, archive: Buffer) => {
  await page.goto("/tools/extract-archive/");
  await chooseArchive(page).setInputFiles([asArchive(name, archive)]);
};

/** What the download holds, read as text the way the file itself would be. */
const readDownload = (link: Locator) =>
  link.evaluate(async (element) => {
    const response = await fetch((element as HTMLAnchorElement).href);

    return await response.text();
  });

/** The download read as an archive, which is what several ticked files become. */
const readDownloadedArchive = (link: Locator) =>
  link.evaluate(async (element) => {
    const response = await fetch((element as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const decoder = new TextDecoder();
    const found: { name: string; body: string }[] = [];
    let position = 0;

    while (position < bytes.length - 4 && view.getUint32(position, true) === 0x04034b50) {
      const method = view.getUint16(position + 8, true);
      const compressed = view.getUint32(position + 18, true);
      const nameLength = view.getUint16(position + 26, true);
      const extraLength = view.getUint16(position + 28, true);
      const name = decoder.decode(bytes.subarray(position + 30, position + 30 + nameLength));
      const start = position + 30 + nameLength + extraLength;
      const payload = bytes.subarray(start, start + compressed);

      if (method === 0) {
        found.push({ name, body: decoder.decode(payload) });
      } else {
        const stream = new Blob([payload.slice()])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));

        found.push({ name, body: decoder.decode(new Uint8Array(await new Response(stream).arrayBuffer())) });
      }

      position = start + compressed;
    }

    return found;
  });

test("opens an archive, shows what is inside, and hands it all back", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  const prose = "the quick brown fox jumps over the lazy dog. ".repeat(60);

  await openArchive(
    page,
    "holiday.zip",
    archiveOf([
      { name: "readme.txt", body: "read me first" },
      { name: "holiday/beach.txt", body: prose, deflate: true },
      { name: "holiday/2024/pier.txt", body: "wooden" },
    ]),
  );

  await expect(page).toHaveTitle("Extract Archive | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your archive is opened and unpacked on this device.",
  );

  // Folders come from the paths, and the rows read as a file manager reads.
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).nth(0)).toContainText("holiday/");
  await expect(rows(page).nth(1)).toContainText("2024/");
  await expect(rows(page).nth(2)).toContainText("pier.txt");
  await expect(rows(page).nth(3)).toContainText("beach.txt");
  await expect(rows(page).nth(4)).toContainText("readme.txt");
  await expect(page.locator("[data-summary]")).toContainText("3 files");
  await expect(page.locator("[data-summary]")).toContainText("everything ticked");
  // The archive says how each entry was packed, which is what the row shows.
  await expect(rows(page).nth(3)).toContainText("deflated");
  await expect(rows(page).nth(4)).toContainText("stored");

  await page.getByRole("button", { name: "Extract the ticked files as a ZIP" }).click();

  const download = page.getByRole("link", { name: /^Download / });

  await expect(download).toBeVisible();
  await expect(download).toHaveAttribute("download", "holiday-extracted.zip");

  const extracted = await readDownloadedArchive(download);

  expect(extracted.map((entry) => entry.name)).toEqual([
    "readme.txt",
    "holiday/beach.txt",
    "holiday/2024/pier.txt",
  ]);
  // The deflated file came back through the browser's decompressor identical.
  expect(extracted[1].body).toBe(prose);
  expect(extracted[0].body).toBe("read me first");

  // Nothing was posted anywhere: the archive never left the device.
  expect(requests).toEqual([]);
});

test("hands one ticked file back as itself", async ({ page }) => {
  await openArchive(
    page,
    "holiday.zip",
    archiveOf([
      { name: "readme.txt", body: "read me first" },
      { name: "holiday/beach.txt", body: "sand and sea" },
    ]),
  );

  await page.getByRole("button", { name: "Untick everything" }).click();
  await expect(page.locator("[data-summary]")).toContainText("nothing ticked yet");
  await expect(page.getByRole("button", { name: /^Extract the ticked/ })).toBeDisabled();

  await page.getByLabel("Tick holiday/beach.txt").check();
  await page.getByRole("button", { name: "Extract the ticked file" }).click();

  const download = page.getByRole("link", { name: /^Download / });

  await expect(download).toHaveAttribute("download", "beach.txt");
  expect(await readDownload(download)).toBe("sand and sea");
  await expect(page.locator("[data-result-details]")).toContainText("1 file");
});

test("ticks everything under a folder with one tick", async ({ page }) => {
  await openArchive(
    page,
    "holiday.zip",
    archiveOf([
      { name: "readme.txt", body: "read me" },
      { name: "holiday/beach.txt", body: "sand" },
      { name: "holiday/2024/pier.txt", body: "wood" },
    ]),
  );

  await page.getByRole("button", { name: "Untick everything" }).click();
  await page.getByLabel("Tick everything in holiday", { exact: true }).check();

  await expect(page.locator("[data-summary]")).toContainText("2 of 3 ticked");
  await expect(page.getByLabel("Tick holiday/beach.txt")).toBeChecked();
  await expect(page.getByLabel("Tick holiday/2024/pier.txt")).toBeChecked();
  await expect(page.getByLabel("Tick readme.txt")).not.toBeChecked();

  await page.getByRole("button", { name: "Extract the ticked files as a ZIP" }).click();

  const extracted = await readDownloadedArchive(page.getByRole("link", { name: /^Download / }));

  expect(extracted.map((entry) => entry.name)).toEqual(["holiday/beach.txt", "holiday/2024/pier.txt"]);
});

test("corrects a path written to unpack outside its folder, and says so", async ({ page }) => {
  await openArchive(
    page,
    "suspect.zip",
    archiveOf([
      { name: "../../etc/passwd", body: "root:x:0:0" },
      { name: "readme.txt", body: "read me" },
    ]),
  );

  await expect(page.locator("[data-note]")).toContainText("corrected");
  await expect(page.locator("[data-node-renamed]").first()).toContainText("../../etc/passwd");
  await expect(page.locator("[data-node-renamed]").first()).toContainText("stays inside the folder");

  await page.getByRole("button", { name: "Extract the ticked files as a ZIP" }).click();

  const extracted = await readDownloadedArchive(page.getByRole("link", { name: /^Download / }));

  // The entry comes out under a path that cannot escape anything.
  expect(extracted.map((entry) => entry.name)).toEqual(["etc/passwd", "readme.txt"]);
});

test("lists what it cannot unpack rather than skipping it", async ({ page }) => {
  const archive = patched(
    patched(
      archiveOf([
        { name: "secret.txt", body: "encrypted, supposedly" },
        { name: "exotic.txt", body: "packed with something else" },
        { name: "plain.txt", body: "ordinary" },
      ]),
      0,
      { flags: 0x0801 },
    ),
    1,
    { method: 93 },
  );

  await openArchive(page, "mixed.zip", archive);

  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByLabel("Tick secret.txt")).toBeDisabled();
  await expect(page.getByLabel("Tick exotic.txt")).toBeDisabled();
  await expect(page.getByLabel("Tick plain.txt")).toBeEnabled();
  await expect(rows(page).filter({ hasText: "secret.txt" })).toContainText("Encrypted");
  await expect(rows(page).filter({ hasText: "exotic.txt" })).toContainText("method 93");
  await expect(page.locator("[data-note]")).toContainText("2 files cannot be unpacked here");

  // Only the one that can come out is ticked, so the extraction is honest.
  await expect(page.locator("[data-summary]")).toContainText("1 of 3 ticked");
  await page.getByRole("button", { name: "Extract the ticked file" }).click();

  const download = page.getByRole("link", { name: /^Download / });

  await expect(download).toHaveAttribute("download", "plain.txt");
  expect(await readDownload(download)).toBe("ordinary");
});

test("names a format it cannot read instead of failing vaguely", async ({ page }) => {
  await page.goto("/tools/extract-archive/");

  // A RAR's own signature, which is how the file is recognised as one.
  await chooseArchive(page).setInputFiles([
    {
      name: "archive.rar",
      mimeType: "application/vnd.rar",
      buffer: Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00, 0x00, 0x00]),
    },
  ]);

  await expect(page.locator("[data-error]")).toContainText("That is a RAR");
  await expect(page.locator("[data-error]")).toContainText("ZIP archives only");
  await expect(page.locator("[data-viewer]")).toBeHidden();

  // And something that is not an archive at all says that instead.
  await chooseArchive(page).setInputFiles([
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("just some prose, at length") },
  ]);

  await expect(page.locator("[data-error]")).toContainText("does not begin like an archive");
});
