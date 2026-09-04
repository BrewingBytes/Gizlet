import type { Page } from "@playwright/test";

/**
 * How much of a drawn PDF page is painted, as a fingerprint of what is on the
 * canvas.
 *
 * Both PDF workspaces draw into `[data-page-canvas]` — the viewer a document
 * that was opened, Image to PDF one that was just built — so a test can tell
 * one page from another by looking at the pixels rather than at the controls.
 */
export const paintedPixels = (page: Page) =>
  page.locator("[data-page-canvas]").evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext("2d");
    if (!context) return 0;
    const { data } = context.getImageData(0, 0, element.width, element.height);
    let painted = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250) painted += 1;
    }
    return painted;
  });

/** The shape of the drawn page: wider than tall is greater than 1. */
export const paintedAspect = (page: Page) =>
  page
    .locator("[data-page-canvas]")
    .evaluate((canvas) => (canvas as HTMLCanvasElement).width / (canvas as HTMLCanvasElement).height);
