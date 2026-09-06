import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Bundling files into an archive.
 *
 * The archive is read back apart in the browser — its central directory parsed
 * by hand — so the assertions are about what a real reader would find in it:
 * the entries, their paths, their methods, and the bytes of a file that went
 * through the compressor coming back out identical.
 */
const asFile = (name: string, body: string, mimeType = "text/plain") => ({
  name,
  mimeType,
  buffer: Buffer.from(body),
});

const chooseFiles = (page: Page) => page.getByLabel("Select files to put in the archive");

const entries = (page: Page) => page.locator("[data-entry-list] > li");

/**
 * A folder selection, made the way a browser makes one.
 *
 * A directory picker hands over files carrying `webkitRelativePath`, which is
 * not something a file chooser can be told from outside the page — so the files
 * are built in the page, given the paths a file system would have given them,
 * and put into the picker exactly as the browser would.
 */
const chooseFolder = (page: Page, files: readonly { path: string; body: string }[]) =>
  page.locator("[data-folder-input]").evaluate((element, chosen) => {
    const input = element as HTMLInputElement;
    const transfer = new DataTransfer();

    for (const entry of chosen) {
      const name = entry.path.slice(entry.path.lastIndexOf("/") + 1);
      const file = new File([entry.body], name, { type: "text/plain" });

      Object.defineProperty(file, "webkitRelativePath", { value: entry.path });
      transfer.items.add(file);
    }

    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, files);

/**
 * The archive, read the way a reader reads one: from its end-of-directory
 * record backwards. Only what a test needs — the path, the method, and the two
 * sizes of every entry.
 */
const readArchive = (link: Locator) =>
  link.evaluate(async (element) => {
    const response = await fetch((element as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const decoder = new TextDecoder();

    let end = bytes.length - 22;
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
    if (end < 0) return { total: 0, entries: [] as { name: string; method: number; compressed: number; size: number }[] };

    const count = view.getUint16(end + 10, true);
    let position = view.getUint32(end + 16, true);
    const found: { name: string; method: number; compressed: number; size: number }[] = [];

    for (let index = 0; index < count; index += 1) {
      const nameLength = view.getUint16(position + 28, true);
      const extraLength = view.getUint16(position + 30, true);
      const commentLength = view.getUint16(position + 32, true);

      found.push({
        name: decoder.decode(bytes.subarray(position + 46, position + 46 + nameLength)),
        method: view.getUint16(position + 10, true),
        compressed: view.getUint32(position + 20, true),
        size: view.getUint32(position + 24, true),
      });
      position += 46 + nameLength + extraLength + commentLength;
    }

    return { total: bytes.length, entries: found };
  });

/** The bytes of one entry, inflated with the browser's own decompressor. */
const readEntry = (link: Locator, name: string) =>
  link.evaluate(async (element, wanted) => {
    const response = await fetch((element as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const decoder = new TextDecoder();
    let position = 0;

    while (position < bytes.length - 4 && view.getUint32(position, true) === 0x04034b50) {
      const method = view.getUint16(position + 8, true);
      const compressed = view.getUint32(position + 18, true);
      const nameLength = view.getUint16(position + 26, true);
      const extraLength = view.getUint16(position + 28, true);
      const name = decoder.decode(bytes.subarray(position + 30, position + 30 + nameLength));
      const start = position + 30 + nameLength + extraLength;
      const payload = bytes.subarray(start, start + compressed);

      if (name === wanted) {
        if (method === 0) return decoder.decode(payload);

        const stream = new Blob([payload.slice()])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));

        return decoder.decode(new Uint8Array(await new Response(stream).arrayBuffer()));
      }

      position = start + compressed;
    }

    return undefined;
  }, name);

test("bundles chosen files into an archive that reads back correctly", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/create-zip/");

  await expect(page).toHaveTitle("Create ZIP | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your files are packed on this device.",
  );

  // Text that compresses, and a name that has to be kept exactly.
  const prose = "the quick brown fox jumps over the lazy dog. ".repeat(60);

  await chooseFiles(page).setInputFiles([
    asFile("notes.txt", prose),
    asFile("readme.md", "# Readme\n\nSomething short."),
  ]);

  await expect(entries(page)).toHaveCount(2);
  await expect(page.locator("[data-summary]")).toContainText("2 files");

  await page.getByRole("button", { name: "Make the ZIP" }).click();

  const download = page.getByRole("link", { name: /^Download / });
  await expect(download).toBeVisible();
  await expect(download).toHaveAttribute("download", "files.zip");

  const archive = await readArchive(download);

  expect(archive.entries.map((entry) => entry.name)).toEqual(["notes.txt", "readme.md"]);
  // Repetitive prose deflates, and the entry says so and comes back identical.
  const [notes] = archive.entries;
  expect(notes.method).toBe(8);
  expect(notes.compressed).toBeLessThan(notes.size);
  expect(notes.size).toBe(prose.length);
  expect(await readEntry(download, "notes.txt")).toBe(prose);

  await expect(page.locator("[data-result-details]")).toContainText("2 files");

  // Nothing was posted anywhere: the files never left the device.
  expect(requests).toEqual([]);
});

test("keeps two files of the same name, numbered rather than lost", async ({ page }) => {
  await page.goto("/tools/create-zip/");

  await chooseFiles(page).setInputFiles([asFile("notes.txt", "first")]);
  await page.getByRole("button", { name: "Add files" }).click();
  await chooseFiles(page).setInputFiles([asFile("notes.txt", "second")]);

  await expect(entries(page)).toHaveCount(2);
  await expect(entries(page).nth(1)).toContainText("notes-2.txt");
  await expect(page.locator("[data-note]")).toContainText("numbered rather than dropped");

  await page.getByRole("button", { name: "Make the ZIP" }).click();

  const download = page.getByRole("link", { name: /^Download / });
  const archive = await readArchive(download);

  expect(archive.entries.map((entry) => entry.name)).toEqual(["notes.txt", "notes-2.txt"]);
  // Both files are in there, and they are the two different files.
  expect(await readEntry(download, "notes.txt")).toBe("first");
  expect(await readEntry(download, "notes-2.txt")).toBe("second");
});

test("reorders and removes before building", async ({ page }) => {
  await page.goto("/tools/create-zip/");

  await chooseFiles(page).setInputFiles([
    asFile("one.txt", "1"),
    asFile("two.txt", "2"),
    asFile("three.txt", "3"),
  ]);

  await page.getByRole("button", { name: "Move three.txt up" }).click();
  await page.getByRole("button", { name: "Remove two.txt" }).click();

  await expect(entries(page)).toHaveCount(2);
  await expect(entries(page).nth(0)).toContainText("one.txt");
  await expect(entries(page).nth(1)).toContainText("three.txt");

  await page.getByRole("button", { name: "Make the ZIP" }).click();

  const archive = await readArchive(page.getByRole("link", { name: /^Download / }));

  expect(archive.entries.map((entry) => entry.name)).toEqual(["one.txt", "three.txt"]);
});

test("keeps the folders a browser reported, and names the archive after them", async ({
  page,
}) => {
  await page.goto("/tools/create-zip/");

  await chooseFolder(page, [
    { path: "holiday/beach.txt", body: "sand" },
    { path: "holiday/2024/harbour.txt", body: "boats" },
  ]);

  await expect(entries(page)).toHaveCount(2);
  await expect(page.locator("[data-summary]")).toContainText("folders kept");

  await page.getByRole("button", { name: "Make the ZIP" }).click();

  const download = page.getByRole("link", { name: /^Download / });
  await expect(download).toHaveAttribute("download", "holiday.zip");

  const archive = await readArchive(download);

  expect(archive.entries.map((entry) => entry.name)).toEqual([
    "holiday/beach.txt",
    "holiday/2024/harbour.txt",
  ]);
});

test("never writes an entry that would unpack outside its folder", async ({ page }) => {
  await page.goto("/tools/create-zip/");

  await chooseFolder(page, [{ path: "../../escape.txt", body: "nope" }]);

  await page.getByRole("button", { name: "Make the ZIP" }).click();

  const archive = await readArchive(page.getByRole("link", { name: /^Download / }));

  expect(archive.entries.map((entry) => entry.name)).toEqual(["escape.txt"]);
});
