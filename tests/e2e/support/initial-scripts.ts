import type { Page, Response } from "@playwright/test";

/**
 * What a page ships to a visitor who only opens it, so a test can assert what
 * is in a page's initial JavaScript rather than only which files arrived.
 *
 * Two pages now load pdf.js on demand — Image to PDF and the flow builder —
 * and each has to prove the library is not in the bundle it hands out up
 * front, so the reading of it lives here rather than in each spec.
 */
export const initialScripts = async (page: Page, path: string) => {
  const bodies: Promise<string>[] = [];
  const record = (response: Response) => {
    if (response.request().resourceType() === "script") {
      bodies.push(response.text().catch(() => ""));
    }
  };

  page.on("response", record);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  page.off("response", record);

  return Promise.all(bodies);
};

/**
 * pdf.js reaches its worker through a bundled asset URL, so every chunk that
 * carries the library carries that filename.
 */
export const chunksCarryingPdfJs = (bodies: readonly string[]) =>
  bodies.filter((body) => body.includes("pdf.worker")).length;
