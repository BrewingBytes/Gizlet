import { expect, test, type Locator, type Page } from "@playwright/test";
import { PDFDocument, degrees } from "pdf-lib";

import { encryptedPdf } from "./support/sample-pdf";

const sourceViewer = (page: Page) => page.getByRole("region", { name: "The PDF being signed" });

const resultViewer = (page: Page) => page.getByRole("region", { name: "The signed document" });

/**
 * Blank pages, so every dark pixel in a rendered page is the signature and
 * nothing else. `rotate` gives a page the rotation a scanner would have left.
 */
async function blankPdf(pageCount: number, rotate = 0): Promise<Buffer> {
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([300, 400]);

    if (rotate !== 0) page.setRotation(degrees(rotate));
  }

  return Buffer.from(await document.save());
}

/** A small black PNG: a picture of a signature, as far as a browser is concerned. */
const blackPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAFUlEQVR42mNkYPhfz0BFwDiqYVQDAM+lB/1QVvpZAAAAAElFTkSuQmCC",
  "base64",
);

const openPdf = (page: Page, buffer: Buffer, name = "contract.pdf") =>
  page.getByLabel("Select a PDF to sign").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer,
  });

const apply = (page: Page) => page.getByRole("button", { name: "Sign the PDF" });

const download = (page: Page) => page.getByRole("link", { name: /^Download / });

const handle = (page: Page) => page.locator("[data-handle]");

/** Signs the pad the way a person does: a stroke across it with a pointer. */
const drawSignature = async (page: Page) => {
  const pad = page.locator("[data-pad]");

  // The pad sits below the fold on a workspace page, and a pointer is moved in
  // viewport coordinates, so it has to be on screen before it can be signed on.
  await pad.scrollIntoViewIfNeeded();

  const box = await pad.boundingBox();

  if (!box) throw new Error("The signature pad is not on the page.");

  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.25, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.75, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.3, { steps: 8 });
  await page.mouse.up();
};

/**
 * Where the ink is on the page currently drawn in a viewer, per quadrant. The
 * source pages are blank, so this is the signature and nothing else — which is
 * how a test can tell "on the signature line" from "off the page".
 */
const inkByQuadrant = (scope: Locator) =>
  scope.locator("[data-page-canvas]").evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext("2d");
    if (!context) return { "top-left": 0, "top-right": 0, "bottom-left": 0, "bottom-right": 0 };
    const { data } = context.getImageData(0, 0, element.width, element.height);
    const counts: Record<string, number> = {
      "top-left": 0,
      "top-right": 0,
      "bottom-left": 0,
      "bottom-right": 0,
    };
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] > 240 && data[index + 1] > 240 && data[index + 2] > 240) continue;
      const pixel = index / 4;
      const x = pixel % element.width;
      const y = Math.floor(pixel / element.width);
      counts[`${y < element.height / 2 ? "top" : "bottom"}-${x < element.width / 2 ? "left" : "right"}`] += 1;
    }
    return counts;
  });

const totalInk = (counts: Record<string, number>) =>
  Object.values(counts).reduce((total, count) => total + count, 0);

/** The corner holding the most ink, which is where the signature landed. */
const busiestQuadrant = (counts: Record<string, number>) =>
  Object.entries(counts).sort(([, left], [, right]) => right - left)[0][0];

/**
 * The corner the signature landed in, waited for rather than sampled once: the
 * result panel appears before its preview has been drawn.
 */
const expectSignatureIn = async (page: Page, corner: string, because: string) => {
  await expect
    .poll(async () => busiestQuadrant(await inkByQuadrant(resultViewer(page))), { message: because })
    .toBe(corner);
};

const showResultPage = async (page: Page, pageNumber: number) => {
  await resultViewer(page).getByLabel("Go to page").fill(String(pageNumber));
  await resultViewer(page).getByLabel("Go to page").press("Enter");
  await page.waitForTimeout(600);
};

/** The produced document, reopened with pdf-lib as another reader would. */
async function openedResult(link: Locator): Promise<PDFDocument> {
  const base64 = await link.evaluate(async (element) => {
    const response = await fetch((element as HTMLAnchorElement).href);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";

    for (const byte of bytes) binary += String.fromCharCode(byte);

    return btoa(binary);
  });
  const bytes = Buffer.from(base64, "base64");

  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

  return PDFDocument.load(bytes);
}

test("draws a signature onto the page it was placed on, on this device", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/tools/sign-pdf/");

  await expect(page).toHaveTitle("Sign PDF | Gizlet");
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your PDF and your signature both stay on this device.",
  );

  await openPdf(page, await blankPdf(2));

  await expect(sourceViewer(page).locator("[data-page-total]")).toHaveText("of 2");

  // The claim the Gizlet is not allowed to drop, before anything is signed.
  await expect(page.locator("[data-disclaimer]")).toContainText(
    "not a certificate-based or cryptographic signature",
  );

  // Nothing is placed over the page until there is a signature to place.
  await expect(page.locator("[data-preview]")).toBeHidden();

  await drawSignature(page);
  // The placement is the box drawn over the page; the wrapper around it is only
  // ever as big as what it holds, so the handle is the thing to look at.
  await expect(handle(page)).toBeVisible();
  await expect(page.locator("[data-preview-image]")).toBeVisible();

  await apply(page).click();

  await expect(page.getByRole("heading", { name: "Your signed PDF is ready." })).toBeVisible();
  await expect(download(page)).toHaveAttribute("download", "contract-signed.pdf");
  await expect(page.locator("[data-result-details]")).toContainText("Signed on 1 page of 2");

  const written = await openedResult(download(page));

  // The pages were drawn onto rather than rebuilt: same count, same size.
  expect(written.getPageCount()).toBe(2);
  expect(written.getPages().map((written) => Math.round(written.getWidth()))).toEqual([300, 300]);

  // Above the bottom edge and right of centre, which is where a signature line
  // usually is and where the page on screen showed it.
  await expect(resultViewer(page)).toBeVisible();
  await expectSignatureIn(page, "bottom-right", "the default placement");

  await showResultPage(page, 2);
  await expect
    .poll(async () => totalInk(await inkByQuadrant(resultViewer(page))))
    .toBeLessThan(50);

  // Nothing was posted anywhere: the document and the signature both stayed here.
  expect(requests).toEqual([]);
});

test("puts a typed name on the pages it was given, and says so on the ones it will not", async ({
  page,
}) => {
  await page.goto("/tools/sign-pdf/");
  await openPdf(page, await blankPdf(4), "form.pdf");

  await page.getByLabel("Signature kind").selectOption("typed");
  await page.getByLabel("Signature name").fill("Ada Lovelace");
  await expect(page.locator("[data-preview-text]")).toHaveText("Ada Lovelace");

  await page.getByLabel("Pages to sign").fill("1, 3");
  await expect(page.locator("[data-pages-summary]")).toHaveText("Signed on 2 pages of 4");

  // Page 2 is not in the selection, and the page says so rather than showing a
  // signature that is not going to be there.
  await sourceViewer(page).getByLabel("Go to page").fill("2");
  await sourceViewer(page).getByLabel("Go to page").press("Enter");
  await expect(page.locator("[data-preview-note]")).toContainText("not in the selection");
  await expect(page.locator("[data-preview]")).toBeHidden();

  await apply(page).click();
  await expect(page.getByRole("heading", { name: "Your signed PDF is ready." })).toBeVisible();

  await showResultPage(page, 3);
  await expectSignatureIn(page, "bottom-right", "page 3 was named");

  await showResultPage(page, 2);
  await expect
    .poll(async () => totalInk(await inkByQuadrant(resultViewer(page))), { message: "page 2" })
    .toBeLessThan(50);
});

test("moves a picture signature from the keyboard, and writes it where it was moved to", async ({
  page,
}) => {
  await page.goto("/tools/sign-pdf/");
  await openPdf(page, await blankPdf(1), "note.pdf");

  await page.getByLabel("Signature kind").selectOption("image");
  await page.getByLabel("Signature picture").setInputFiles({
    name: "signature.png",
    mimeType: "image/png",
    buffer: blackPng,
  });

  await expect(page.locator("[data-preview-image]")).toBeVisible();

  // The placement is reachable without a pointer: the arrow keys move it, and
  // holding shift moves it faster.
  await handle(page).focus();
  for (let step = 0; step < 4; step += 1) await handle(page).press("Shift+ArrowLeft");
  for (let step = 0; step < 8; step += 1) await handle(page).press("Shift+ArrowUp");

  await apply(page).click();
  await expect(page.getByRole("heading", { name: "Your signed PDF is ready." })).toBeVisible();

  // What the page showed is what the document got.
  await expectSignatureIn(page, "top-left", "the signature was moved there");
});

test("keeps the signature where it was put on a page that arrived sideways", async ({ page }) => {
  await page.goto("/tools/sign-pdf/");
  await openPdf(page, await blankPdf(1, 90), "scan.pdf");

  await drawSignature(page);
  await apply(page).click();

  await expect(page.getByRole("heading", { name: "Your signed PDF is ready." })).toBeVisible();

  // The page keeps the rotation it arrived with, and the signature is in the
  // corner of the page as it is read rather than off the edge of it.
  const written = await openedResult(download(page));

  expect(written.getPage(0).getRotation().angle).toBe(90);
  await expectSignatureIn(page, "bottom-right", "a quarter-turned page reads the same way");
});

test("asks for a signature before it will sign anything", async ({ page }) => {
  await page.goto("/tools/sign-pdf/");
  await openPdf(page, await blankPdf(1));

  await apply(page).click();
  await expect(page.getByRole("alert")).toContainText("Draw your signature in the box first.");

  await page.getByLabel("Signature kind").selectOption("typed");
  await apply(page).click();
  await expect(page.getByRole("alert")).toContainText("Type the name you want to sign with.");
});

test("refuses a file it cannot sign, in its own words", async ({ page }) => {
  await page.goto("/tools/sign-pdf/");

  await page.getByLabel("Select a PDF to sign").setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(page.getByRole("alert")).toContainText("not a PDF");

  await openPdf(page, encryptedPdf(), "protected.pdf");
  await expect(page.getByRole("alert")).toContainText("password-protected");
});

test("never claims to be more than a picture on a page", async ({ page }) => {
  await page.goto("/tools/sign-pdf/");

  const body = await page.locator("main").innerText();

  // The words that would be a lie are absent, and the ones that keep the
  // Gizlet honest are on the page whether or not anybody opens the FAQ.
  expect(body).not.toMatch(/legally valid|digital certificate signing|verif(y|ies) who signed/i);
  expect(body).toMatch(/not certificate-based or cryptographic/i);
  expect(body).toMatch(/There is no certificate, no key/i);
});
