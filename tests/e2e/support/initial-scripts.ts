import type { Page, Response } from "@playwright/test";

/**
 * What a page ships to a visitor who only opens it, so a test can assert what
 * is in a page's initial JavaScript rather than only which files arrived.
 *
 * Every PDF surface now loads pdf.js on demand — the reader included, since it
 * became the same shared surface as the rest — so each page has to prove the
 * library is not in the bundle it hands out up front. The reading of it lives
 * here rather than in each spec.
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

/**
 * Every script body a page fetches, initial or lazy, for as long as the
 * recorder is running.
 *
 * The absence of pdf.js from a page's initial JavaScript is only worth
 * asserting if the same check can find it when it does arrive. Nothing loads
 * the library eagerly any more, so that proof is no longer another page: it is
 * this page, a moment later, once a document exists to draw.
 */
export const recordScriptBodies = (page: Page) => {
  const bodies: Promise<string>[] = [];

  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      bodies.push(response.text().catch(() => ""));
    }
  });

  return () => Promise.all([...bodies]);
};
