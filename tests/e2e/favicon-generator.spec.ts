import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * One picture in, an icon set out.
 *
 * The archive is read back apart in the browser, so the assertions are about
 * what somebody unzipping it would find: the file names the snippet promises,
 * an ICO whose header really is an ICO, and PNGs whose own headers say they are
 * the sizes they claim to be.
 */
const drawSource = (page: Page, width: number, height: number) =>
  page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#f6a500";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#0f172a";
      context.beginPath();
      context.arc(w / 2, h / 2, Math.min(w, h) / 3, 0, Math.PI * 2);
      context.fill();
      return canvas.toDataURL("image/png").split(",")[1];
    },
    [width, height] as const,
  );

const chooseImage = async (page: Page, width: number, height: number, name = "logo.png") => {
  const base64 = await drawSource(page, width, height);

  await page.getByLabel("Select an image to make icons from").setInputFiles({
    name,
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  });
};

/** Every entry of the produced archive, with what its own header says it is. */
const readArchive = (link: Locator) =>
  link.evaluate(async (element) => {
    const response = await fetch((element as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const decoder = new TextDecoder();
    const found: { name: string; size: number; kind: string; width?: number; height?: number }[] = [];
    let position = 0;

    while (position < bytes.length - 4 && view.getUint32(position, true) === 0x04034b50) {
      const compressed = view.getUint32(position + 18, true);
      const uncompressed = view.getUint32(position + 22, true);
      const nameLength = view.getUint16(position + 26, true);
      const extraLength = view.getUint16(position + 28, true);
      const name = decoder.decode(bytes.subarray(position + 30, position + 30 + nameLength));
      const start = position + 30 + nameLength + extraLength;
      const payload = bytes.subarray(start, start + compressed);
      const payloadView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      const isPng =
        payload.length > 24 && payload[0] === 0x89 && payload[1] === 0x50 && payload[2] === 0x4e;
      // An ICO opens with a zero, then a 1 for "icon", then a count.
      const isIco =
        payload.length > 6 &&
        payloadView.getUint16(0, true) === 0 &&
        payloadView.getUint16(2, true) === 1;

      found.push({
        name,
        size: uncompressed,
        kind: isPng ? "png" : isIco ? "ico" : "other",
        // A PNG's IHDR carries its dimensions, big-endian, at a fixed offset.
        width: isPng ? payloadView.getUint32(16) : isIco ? payloadView.getUint16(4, true) : undefined,
        height: isPng ? payloadView.getUint32(20) : undefined,
      });
      position = start + compressed;
    }

    return found;
  });

test("makes a whole icon set from one square picture, on this device", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });

  await page.goto("/tools/favicon-generator/");

  await expect(page).toHaveTitle("Favicon Generator | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your image never leaves this device.",
  );

  await chooseImage(page, 512, 512);

  // Every size is previewed at the size it will really be.
  await expect(page.locator("[data-size-list] > li")).toHaveCount(5);
  await expect(page.locator("[data-size-list] > li").first()).toContainText("16px");
  // A square picture is not asked how to be made square.
  await expect(page.locator("[data-fit-control]")).toBeHidden();

  await page.getByRole("button", { name: "Make the icon set" }).click();

  await expect(page.getByRole("heading", { name: "Your icon set is ready." })).toBeVisible();

  const download = page.getByRole("link", { name: /^Download / });
  await expect(download).toHaveAttribute("download", "favicon.zip");

  const files = await readArchive(download);

  expect(files.map((file) => file.name)).toEqual([
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
  ]);

  // The PNGs really are the sizes their names claim.
  const png = (name: string) => files.find((file) => file.name === name);
  expect(png("favicon-16x16.png")).toMatchObject({ kind: "png", width: 16, height: 16 });
  expect(png("favicon-32x32.png")).toMatchObject({ kind: "png", width: 32, height: 32 });
  expect(png("apple-touch-icon.png")).toMatchObject({ kind: "png", width: 180, height: 180 });
  expect(png("icon-512.png")).toMatchObject({ kind: "png", width: 512, height: 512 });

  // And the ICO is an ICO, holding the three sizes it says it does.
  expect(png("favicon.ico")).toMatchObject({ kind: "ico", width: 3 });

  // The snippet names files the archive really contains.
  const snippet = await page.locator("[data-snippet]").innerText();
  for (const name of ["favicon.ico", "favicon-32x32.png", "favicon-16x16.png", "apple-touch-icon.png"]) {
    expect(snippet).toContain(`/${name}`);
  }

  const manifest = await page.locator("[data-manifest]").innerText();
  expect(manifest).toContain("/icon-192.png");

  // Nothing was posted anywhere: the logo stayed here.
  expect(requests).toEqual([]);
});

test("asks a picture that is not square how it should become one", async ({ page }) => {
  await page.goto("/tools/favicon-generator/");

  await chooseImage(page, 1000, 400, "banner.png");

  await expect(page.locator("[data-fit-control]")).toBeVisible();
  await expect(page.getByLabel("How to make it square")).toHaveValue("cover");

  // Fitting the whole picture needs somewhere to put the rest of the square.
  await page.getByLabel("How to make it square").selectOption("contain");
  await expect(page.getByLabel("Background behind the picture")).toBeVisible();

  await page.getByRole("button", { name: "Make the icon set" }).click();
  await expect(page.getByRole("heading", { name: "Your icon set is ready." })).toBeVisible();

  const files = await readArchive(page.getByRole("link", { name: /^Download / }));

  // Still square, whichever way the visitor chose.
  expect(files.find((file) => file.name === "icon-512.png")).toMatchObject({
    width: 512,
    height: 512,
  });
});

test("says when the picture is too small rather than refusing it", async ({ page }) => {
  await page.goto("/tools/favicon-generator/");

  await chooseImage(page, 64, 64, "tiny.png");

  await expect(page.getByText("64 pixels on its shortest side")).toBeVisible();
  // It is a warning, not a refusal: the set can still be made.
  await expect(page.getByRole("button", { name: "Make the icon set" })).toBeEnabled();
});

test("refuses a file that is not an image", async ({ page }) => {
  await page.goto("/tools/favicon-generator/");

  await page.getByLabel("Select an image to make icons from").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(page.getByRole("alert")).toContainText("notes.txt is not a JPEG");
  await expect(page.getByRole("heading", { name: "Drop an image here" })).toBeVisible();
});
