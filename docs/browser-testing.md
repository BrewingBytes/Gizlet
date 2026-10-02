# Browser testing

Gizlet's Playwright suite runs against a fresh production build served on its own port (see `playwright.config.ts`). It has two projects.

| Project | What it runs | Why |
| --- | --- | --- |
| `chromium` | Everything in `tests/e2e/`, including `tests/e2e/smoke/` | The full suite. Running the smoke spec here too gives every WebKit result a Chromium result to compare against. |
| `webkit-smoke` | Only `tests/e2e/smoke/` | A small set of local file workflows on WebKit at phone size: choose, convert and save an image; merge, preview and save PDFs; open a ZIP and save its contents; switch the theme and search for a Gizlet. |

The smoke spec sets a 390 × 844 touch viewport. It picks files by tapping the visible button and reads each saved download back in Node: JPEG and WebP magic bytes, the merged PDF's pages in order, and the extracted ZIP's entries and contents. It also checks that nothing except GET requests left the page.

## Commands

```sh
pnpm exec playwright install chromium webkit   # once
pnpm run test:e2e                              # both projects
pnpm exec playwright test --project=chromium   # the full Chromium suite
pnpm exec playwright test --project=webkit-smoke
```

Every invocation builds the site again before it starts the preview, so no run can test an out-of-date `dist/`.

## Reading a failure

- If a test fails in both projects, it is a Gizlet bug or a test bug. It is not a WebKit compatibility problem.
- If a test fails only in `webkit-smoke`, it is WebKit-specific. Reproduce it locally with `--project=webkit-smoke --headed`. If the fix is more than small, open a separately scoped issue for it rather than widening the change at hand.
- In CI, WebKit has its own install step and its own test step, placed after every Chromium step. A WebKit failure therefore never hides a Chromium result, and the step timings show what WebKit adds.

## Unsupported formats are a result, not a skip

Browsers differ in which image formats a canvas can encode. Safari, for example, cannot encode WebP. In that case `canvas.toBlob` quietly returns a PNG, and Gizlet refuses to save it under a `.webp` name. The WebP smoke test first asks the browser the same question, then checks one of two outcomes:

- If the browser can encode WebP, the saved file must be a real WebP.
- If it cannot, the visitor must see "Your browser cannot create WEBP images.", the chosen picture must stay on screen, and there must be no download.

The test records which branch it took as a `webp-encoding` annotation, which you can see in the HTML and JSON reports. Do not replace either branch with a skip. If you add another capability check, give it the same shape.

## Manual check on a real iPhone

Playwright's WebKit is the WebKit engine on macOS or Linux. It is not iOS Safari. It has no iOS file picker, no share sheet, no Files app, and none of iOS's memory limits. Before a release that changes a file workflow, or when an iPhone bug is reported, check these on a real iPhone in Safari against a preview or production build:

1. **File picker.** On Convert Image, Merge PDF and Extract Archive, tap the choose button. Pick from Photos (for an image), then from Files (for a PDF and a ZIP). Confirm that the chosen files appear and that Gizlet reads them.
2. **Download.** Tap each Download link. Confirm that Safari offers the file under the name the page shows, that it lands in Files › Downloads, and that it opens there: the JPEG in Photos or Quick Look, the merged PDF with every page in order, and the extracted ZIP with its contents.
3. **Share.** From the saved file in Files, use the share sheet (for example Save to Photos, or AirDrop). Confirm that the file arrives intact.
4. **Unsupported format.** Convert to WebP. Confirm that the page shows "Your browser cannot create WEBP images." and offers no download.
5. **Memory pressure.** Merge several large PDFs (tens of megabytes, a hundred pages or more), then convert a full-resolution camera photo. Confirm that the page either finishes or shows its own size message, and that the tab does not reload or go blank. A tab that silently reloads is what an iPhone out-of-memory kill looks like.
6. **Theme and search.** Switch the theme, reload, and use the header search to open a Gizlet. Confirm the theme persists and nothing scrolls sideways.

Record the iPhone model, the iOS version and anything that failed in the pull request or issue. A pass in `webkit-smoke` does not count as this check.
