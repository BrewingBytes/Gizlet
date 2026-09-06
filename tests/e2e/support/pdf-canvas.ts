import type { Locator, Page } from "@playwright/test";

/**
 * Where to look for the drawn page. A Gizlet may show two of the shared viewer
 * at once — a source and a result — so the caller says which one it means by
 * passing that region rather than the whole page.
 */
type CanvasScope = Page | Locator;

/**
 * How much of a drawn PDF page is painted, as a fingerprint of what is on the
 * canvas.
 *
 * Every PDF Gizlet draws into the same `[data-page-canvas]`, because they all
 * show the same shared viewer, so a test can tell one page from another by
 * looking at the pixels rather than at the controls.
 */
export const paintedPixels = (scope: CanvasScope) =>
  scope.locator("[data-page-canvas]").evaluate((canvas) => {
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
export const paintedAspect = (scope: CanvasScope) =>
  scope
    .locator("[data-page-canvas]")
    .evaluate((canvas) => (canvas as HTMLCanvasElement).width / (canvas as HTMLCanvasElement).height);
