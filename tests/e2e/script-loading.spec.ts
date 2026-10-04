import { expect, test } from "@playwright/test";

import { paintedPixels } from "./support/pdf-canvas";
import { tinyImage } from "./support/sample-image";
import { samplePdf } from "./support/sample-pdf";
import {
  heavyweightIn,
  recordScriptRequests,
  reportStage,
  sourcesIn,
  workspaceComponents,
  workspacesIn,
} from "./support/script-requests";

/**
 * `src/pages/tools/[slug].astro` imports every workspace component into one
 * dispatch map. That proves nothing either way about what a visitor
 * downloads, so these tests measure the built pages: each request a page makes,
 * its decoded size, and the source modules the build put in it, first on
 * arrival and then after the one interaction that needs more code.
 *
 * The sizes are reported, not budgeted. What is asserted is which code
 * arrives, and that the lazily loaded code still arrives and works when it is
 * asked for, so an absence here cannot be a loader that has stopped loading.
 *
 * Shared analytics needs only the recipe step limit, not the recipe parser or
 * its per-tool option modules. Guard that boundary on the initial requests.
 */

test.beforeEach(() => {
  // The dispatch map is read from the route's imports; an empty set would
  // make every "no other workspace" assertion below pass by default.
  expect(workspaceComponents().size).toBeGreaterThan(20);
});

test("the homepage loads shared infrastructure and no workspace", async ({ page, baseURL }, testInfo) => {
  const scripts = await recordScriptRequests(page, baseURL!);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const initial = await scripts.take();
  await reportStage(testInfo, "homepage, on arrival", initial);

  expect(initial.length).toBeGreaterThan(0);
  expect(sourcesIn(initial)).not.toContain("src/data/recipes.ts");
  expect(workspacesIn(initial)).toEqual([]);
  expect(heavyweightIn(initial)).toEqual([]);
  expect(scripts.unmapped).toEqual([]);
  expect(scripts.blocked).toEqual([]);
});

test("JSON Formatter loads only its own workspace", async ({ page, baseURL }, testInfo) => {
  const scripts = await recordScriptRequests(page, baseURL!);

  await page.goto("/tools/json-formatter/");
  await page.waitForLoadState("networkidle");
  const initial = await scripts.take();
  await reportStage(testInfo, "JSON Formatter, on arrival", initial);

  expect(sourcesIn(initial)).not.toContain("src/data/recipes.ts");
  expect(workspacesIn(initial)).toEqual(["src/components/JsonFormatterTool.astro"]);
  expect(heavyweightIn(initial)).toEqual([]);

  // Formatting is the workspace's whole job, and it needs nothing more.
  await page.getByLabel("JSON input").fill('{"b":1,"a":[true,null]}');
  await page.getByRole("button", { name: "Format JSON" }).click();
  await expect(page.locator("[data-output]")).toHaveText('{\n  "b": 1,\n  "a": [\n    true,\n    null\n  ]\n}');
  await page.waitForLoadState("networkidle");
  const formatted = await scripts.take();
  await reportStage(testInfo, "JSON Formatter, after formatting", formatted);

  expect(formatted).toEqual([]);
  expect(scripts.unmapped).toEqual([]);
  expect(scripts.blocked).toEqual([]);
});

test("Compress Image loads its image pipeline and no PDF or archive code", async ({ page, baseURL }, testInfo) => {
  const scripts = await recordScriptRequests(page, baseURL!);

  await page.goto("/tools/compress-image/");
  await page.waitForLoadState("networkidle");
  const initial = await scripts.take();
  await reportStage(testInfo, "Compress Image, on arrival", initial);

  expect(sourcesIn(initial)).not.toContain("src/data/recipes.ts");
  expect(workspacesIn(initial)).toEqual(["src/components/CompressImageTool.astro"]);
  // The canvas pipeline is this Gizlet's own code, so it is here from the start.
  expect(heavyweightIn(initial)).toEqual(["image processing"]);

  await page.getByLabel("Select an image to compress").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: tinyImage(),
  });
  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await page.getByRole("button", { name: "Compress it" }).click();
  await expect(page.getByText("Your image is ready.")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const compressed = await scripts.take();
  await reportStage(testInfo, "Compress Image, after compressing an image", compressed);

  // Choosing and compressing a picture fetches no other Gizlet's code, and
  // none of the PDF or archive libraries.
  expect(workspacesIn(compressed)).toEqual([]);
  expect(heavyweightIn(compressed)).toEqual([]);
  expect(scripts.unmapped).toEqual([]);
  expect(scripts.blocked).toEqual([]);
});

test("PDF Viewer loads pdf.js only once a PDF is opened, and then draws it", async ({ page, baseURL }, testInfo) => {
  const scripts = await recordScriptRequests(page, baseURL!);

  await page.goto("/tools/pdf-viewer/");
  await page.waitForLoadState("networkidle");
  const initial = await scripts.take();
  await reportStage(testInfo, "PDF Viewer, on arrival", initial);

  expect(sourcesIn(initial)).not.toContain("src/data/recipes.ts");
  expect(workspacesIn(initial)).toEqual(["src/components/PdfViewerTool.astro"]);
  expect(heavyweightIn(initial)).toEqual([]);

  await page.getByLabel("Select a PDF to open").setInputFiles({
    name: "statement.pdf",
    mimeType: "application/pdf",
    buffer: await samplePdf(2),
  });
  await expect(page.locator("[data-page-total]")).toHaveText("of 2");
  await expect.poll(() => paintedPixels(page)).toBeGreaterThan(500);
  await page.waitForLoadState("networkidle");
  const opened = await scripts.take();
  await reportStage(testInfo, "PDF Viewer, after opening a PDF", opened);

  // The same check that found no pdf.js on arrival finds it now — the
  // library, the module that drives it, and the worker as its own request —
  // so the absence above is a measurement, not a loader that never runs.
  const loaded = sourcesIn(opened);
  expect(loaded).toContain("pdfjs-dist/build/pdf.mjs");
  expect(loaded).toContain("src/scripts/pdf-rendering.ts");
  expect(opened.map((request) => request.sources)).toContainEqual(["pdfjs-dist/build/pdf.worker.min.mjs"]);

  // Reading a PDF needs pdf.js and nothing that writes one or opens archives.
  expect(heavyweightIn(opened)).toEqual(["pdf.js"]);
  expect(workspacesIn(opened)).toEqual([]);
  expect(scripts.unmapped).toEqual([]);
  expect(scripts.blocked).toEqual([]);
});
