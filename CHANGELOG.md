# Changelog

All notable changes to Gizlet are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The Image to PDF Gizlet now shows the document it has just made, before anything is downloaded. The result panel draws the assembled PDF page by page, with previous, next, and a page jump, so the page order, the page size, and what automatic orientation did to each sheet are all visible while there is still time to change them. It is the finished document that is drawn, not a re-rendering of the source images. pdf.js is loaded only once a PDF exists, so the page's initial JavaScript is unchanged for a visitor who never presses the button, and a preview that will not draw says so and leaves the download alone, because a document can be perfectly good even when drawing it is not.

### Changed

- Pull requests that change something a visitor can see now carry screenshots, and a before-and-after pair when the change replaces something that already existed. [AGENTS.md](AGENTS.md) records where the files live: on a `pr-assets` orphan branch, never in `main` or in the change's own diff.
- Page turning in the two PDF workspaces now comes from one module, `src/scripts/pdf-page-view.ts`, rather than being wired separately in each. It imports pdf.js only as a type, which is what lets Image to PDF reach it without shipping the library.
- The JPG to PDF Gizlet is now called Image to PDF, accurately reflecting that it accepts JPEG, PNG, WebP, AVIF, and BMP images. Its `jpg-to-pdf` URL and recipe-link slug remain unchanged, so existing links continue to work.
- The Convert Image Gizlet's description now names the formats it takes, on its card, in its metadata, and on its regenerated preview card: “Convert JPG, PNG, WebP, AVIF, and BMP images to another format in your browser.” The previous wording, “common file formats”, left unanswered the one question a converter is asked.

### Fixed

- Searching for an image conversion no longer sends people to Image to PDF. Its `png to pdf`, `webp to pdf`, `avif to pdf`, and `bmp to pdf` keywords made it match `jpg to png` — the keyword Convert Image declares for itself — on every term, and the connector `to` scored three times over, once for its name, once for its description, and once for its keywords. It outranked the converter on the converter's own query, and was the only result for `webp`, `avif`, and `bmp`. Connector words are now dropped from a query before it is scored, an exact keyword phrase earns the same kind of bonus an exact name match already did, and the three image Gizlets declare the formats they genuinely accept. `jpg to png` and `avif to jpg` rank Convert Image first; `png to pdf` still returns Image to PDF alone.
- The Image to PDF page's format question no longer asks “or only JPG?”. The Gizlet stopped claiming to be JPG-only when it was renamed, so the question raised a doubt its own page no longer invited.

## [0.3.0] - 2026-09-03

### Added

- A JPG to PDF Gizlet, and with it a PDF category: choose JPEG, PNG, WebP, AVIF, or BMP images, put them in the page order you want, pick A4, US Letter, US Legal, or a page fitted to each image, and download one PDF with one image per page. It assembles the document in the browser, so the passports, bank statements, and signed contracts people turn into PDFs are never uploaded. A JPEG or PNG page is embedded byte for byte; a WebP, AVIF, or BMP page is re-encoded as a high-quality JPEG first, because that is what a PDF can carry. One document holds up to 100 pages, each image is held to the pixel ceiling the Resize Image Gizlet already enforces, and past 20 pages the Gizlet says it is building a big document rather than looking stalled.
- A PDF Viewer Gizlet: open a PDF and read it page by page, with a thumbnail per page, previous and next, a page jump, and zoom from 50% to 300%. Every page is drawn onto a canvas by this browser, so it works the same on a phone — where most browsers refuse to show a PDF inline and download it instead — as on a laptop. The document is never uploaded, which matters for the payslips, tenancy agreements, and passport scans people would otherwise hand to an upload-a-PDF site to read them. A page opens fitted to its column and is redrawn at each zoom step rather than stretched, so text stays sharp. A password-protected PDF, a file that is not really a PDF, and a single page the engine cannot draw are each explained rather than left blank. It cannot select or search text yet, and says so.
- Gizlet Flows can end by making a PDF. A chain that reaches JPG to PDF takes several starting images in a reorderable list, runs every earlier block on each of them, and combines the results into one document — one page per image, in the order shown — with page size and orientation on the block itself and one download at the end. Removing the PDF block resolves the extra pages and says which image it kept, rather than dropping them quietly.
- PDF blocks in Gizlet Flows. The PDF Viewer is the first Gizlet that reads a PDF, so a chain can now end `… → JPG to PDF → PDF Viewer`. It needed no change to the flow graph: the viewer declares `pdf-file` in and `pdf-file` out, and the payload-kind rule below did the rest. Its contract also declares itself an inspection step, so a flow runs it and carries the same document forward untouched.
- A `pdf-file` payload kind in the flow contract, so every image Gizlet now hands its result to JPG to PDF and each links to it from its related Gizlets.
- A recipe link can carry a PDF flow, including its page size and orientation. The format gained closed-list values alongside its whole numbers, so the settings-only guarantee is unchanged: every accepted value is still one of a fixed set of names, and no key can carry file content, a filename, or a URL.
- `pdf-lib` as the project's first runtime dependency besides `astro`. There is no browser API for programmatic PDF creation — no platform equivalent of writing a page tree and embedding an image — so condition 1 of the dependency policy in [docs/architecture.md](docs/architecture.md) is genuinely met rather than asserted. It is pure JavaScript with no worker and no WASM, is imported only from `src/scripts/pdf-generation.ts`, and ships only on the JPG to PDF page.
- `pdfjs-dist` as a runtime dependency, with no dependencies of its own. There is no browser API that parses and renders a PDF, and the native alternative — handing the file to the browser's own viewer — does not render inline on iOS Safari or most Android browsers, so it cannot be the basis of a viewer. It ships only on the PDF Viewer page, and its 1.2 MB worker is fetched only when a PDF is actually opened, not when the page loads.

### Changed

- Flow compatibility is now derived from the payload kinds a Gizlet declares, rather than from a per-Gizlet `nextToolSlugs` list. That list only restated what the `input` and `output` contracts already said and could drift from them. A block is offered when it accepts what the block before it produces, so declaring a Gizlet that reads a PDF makes it available after JPG to PDF, and one that turns a PDF back into images makes the image Gizlets available after itself — with no edit to the flow graph. Covered by tests that run the graph over contracts the catalogue does not have yet.
- The flow builder's step dropdown lists Gizlets in tool-registry order, and no longer from a hardcoded array of image slugs. The visible order of the first three options changes as a result.
- A flow's starting image is now decoded when it is chosen rather than when the flow runs, so an unreadable file is refused before a chain is built on top of it.

### Fixed

- The home page now has its own 1200x630 preview card instead of falling back to the brand board. The brand board is 1536x1024, 1.79 MB, and a collage of small screenshots, so a Google result or a chat unfurl for the site's most important URL rendered as noise. The new card is drawn by the same script as the Gizlet cards, and its category line comes from the registry so it cannot advertise a kind of Gizlet that does not exist. The brand board stays the fallback for pages that have no card yet.
- The home page's meta description no longer repeats its own title. It opened with the title verbatim, so Google discarded it and assembled a snippet from the page's visible text — the eyebrow, the heading, and the intro paragraph, read as three stitched fragments. The description now names what the Gizlets actually do. Both title and description moved into `src/data/home-page.ts` with tests asserting they share no phrase, that the description fits the length a result shows, and that its local-processing claim holds only while every published Gizlet is local.

## [0.2.0] - 2026-09-03

### Added

- A Gizlet Flow can now be shared as a recipe link: `Copy recipe link` writes the chain, its order, and each step's settings into the page's URL fragment, and opening that link rebuilds the same flow. Settings travel in the fragment rather than a query string, so they are never transmitted to a server at all, and only whitelisted setting keys exist — no key can carry file content, a filename, or a URL. A link that does not parse and validate is ignored whole rather than partly applied.
- [docs/signals.md](docs/signals.md), recording which signals Gizlet can measure and which it cannot. Cloudflare Web Analytics supports no custom events and does not log query strings, so completions, error rates, downloads, and click-through are unobservable, and a plan that needs those numbers has to restate its criteria or change the data contract first. Linked from `AGENTS.md` and [docs/privacy.md](docs/privacy.md).

### Fixed

- The home page's search field no longer suggests searches that find nothing. Two of its three examples returned no Gizlet — one named a tool that does not exist, and one was phrased in a way the search cannot match — and the examples now live in `src/data` with a test asserting each returns an available Gizlet, so they cannot drift as the catalogue changes.

## [0.1.1] - 2026-09-03

### Added

- A `TODOS.md` recording deferred work with the condition that would revisit it.

### Changed

- Gizlet pages now choose their workspace from a registry-derived slug map and decide on launch status before the slug, so a planned Gizlet reaches the placeholder by rule rather than by falling off the end of a chain of conditions. Adding a Gizlet without a workspace, or without a related-Gizlet entry, now fails `pnpm run check` instead of crashing the production build.
- The JSON Formatter's processing sentence moved from the tool page into `src/data/tool-page-status.ts`, so the copy comes from the data layer like every other registry-backed claim.

### Removed

- The Gizlet Pro strip on the home page, and the "Pro" links to it in the header and footer. Gizlet Pro does not exist, and the strip described it in the present tense — the same class of untruth as an inaccurate local-processing claim. It returns when there is something to return to.

### Fixed

- The Gizlet Flows page is now listed in `sitemap.xml`. It was linked from the header but absent from the sitemap, so the page that chains Gizlets together was invisible to crawlers and answer engines.

## [0.1.0] - 2026-09-03

### Added

- Tag-gated production deployments: gizlet.app deploys from a `v*` version tag that has passed the full validation suite, and no longer from a merge to `main`.
- A documented release procedure in [docs/releasing.md](docs/releasing.md), covering the ordered steps, the rule that a tag never disagrees with the changelog and the version, and what to do when a release has to be re-cut.
- A `pnpm run changelog:draft` script that drafts changelog entries from the Conventional Commit titles since the previous tag, previewing by default and only ever appending beneath hand-written entries.
- A committed [wrangler.toml](wrangler.toml), so the production asset behavior is reviewable in Git rather than only visible in the Cloudflare dashboard.
- A social preview card for every available Gizlet and for the Gizlet index, selected from the registry so a shared tool link previews as that tool instead of the home page, with the brand board still covering every other page.
- Per-Gizlet supporting content and an FAQ below every Gizlet workspace, written for that Gizlet, keyed by registry slug, and published as `FAQPage` markup from the same copy the page renders.
- Registry-derived JSON-LD structured data: `WebSite` on the home page, `CollectionPage` on the Gizlet index, and `SoftwareApplication` with a `BreadcrumbList` on each Gizlet page.
- An `/ads.txt` file generated from the declared AdSense publisher account, which AdSense requires before it can approve the site.
- A browsable `/tools/` index that groups every available Gizlet by category, linked from the header, footer, and tool-page breadcrumbs.
- A page for unknown addresses that lists every working Gizlet and links back to the home page, replacing an empty response.
- A recorded pre-launch accessibility, performance, search-visibility, and UX audit of the production site in [docs/launch-audit.md](docs/launch-audit.md).
- Local Gizlet Flows for chaining compatible image Gizlets in a configurable, reorderable browser-only pipeline with one final download.
- Clear Google CMP consent disclosures for advertising, including accept, refuse, and manage-options choices for EEA, UK, and Swiss visitors when ads are enabled.
- A browser-validated Gizlet request form that prepares a visitor-reviewed GitHub Issue without adding a Gizlet backend or form service.
- Static, registry-derived `/tools.json` and `/llms.txt` discovery documents for AI agents, search systems, and developers, with available Gizlet routes, usage guidance, and local-processing privacy details.
- Privacy, terms, and about pages with scoped local-processing disclosures and configurable provider information.
- Optional Google AdSense integration with centrally configured responsive banner, inline, and rail placements that stay disabled during development.
- Local JSON Formatter Gizlet with validation, location-aware parse errors, formatting, minification, and copy actions.
- Privacy-conscious aggregate analytics through Cloudflare Web Analytics, measured at the Cloudflare edge with no analytics script, configuration, or event calls in the site itself.
- Local JSON-LD Generator Gizlet for Product, Organization, Article, LocalBusiness, Event, and BreadcrumbList markup with live previews, copy actions, and separate validation guidance.
- Static sitemap.xml and robots.txt generated from the launch-ready Gizlet registry routes.
- Local Convert Image Gizlet with drag/drop, source-format detection, JPEG/PNG/WebP output, transparency-loss warnings, and verified downloads.
- Reusable page metadata with deterministic canonical URLs, Open Graph and Twitter previews, social-image fallbacks, robots defaults, and registry-driven tool-page defaults.
- Local Resize Image Gizlet with exact dimensions, an aspect-ratio lock, percentage scaling, output format choices, large-image feedback, and downloads.
- Local Compress Image Gizlet with drag/drop, JPEG/PNG/WebP/AVIF/BMP input, previews, quality and format controls, output-size comparison, and downloads.
- Reusable tool-page layout with breadcrumbs, truthful processing status, responsive ad placements, workspace slots, and registry-driven related Gizlets.
- Reusable, responsive advertisement slots for banner, inline, and right-rail placements.
- Local registry search on the homepage and through the keyboard-accessible global search overlay, with a visible Ctrl/Cmd+K hint.
- Project documentation and Apache-2.0 licensing.
- Production architecture and stack decision record, plus repository agent guidance.
- Minimal Astro application foundation with strict TypeScript and pnpm.
- Renovate dependency-update policy.
- Approved Gizlet brand assets and design system reference.
- Vitest and Playwright test foundations.
- GitHub Actions validation for Conventional Commit titles, type checks, tests, builds, and browser smoke tests.
- Reusable Gizlet design tokens and accessible base styles, including warm dark-mode support.
- Reusable header, navigation, footer, and page layout shell.
- Typed registry for the planned launch Gizlets, including their routes, categories, search terms, local-processing status, and launch status.
- Add a light and dark theme toggle that follows the system preference by default and persists an explicit choice locally.
- Editorial homepage with an intent-led search field, labeled ad reservation, registry-driven popular Gizlets, category navigation, and a Gizlet Pro explanation.

### Changed

- Repository agent guidance now documents the repository map, the tool-registry workflow, the current quality gates, and the title-only commit-message rule, alongside a Claude Code specific guide.

### Fixed

- Serve the built not-found page for unknown addresses, with its `404` status, instead of the empty body production returned.
- Build the homepage category strip from the registry, so it can no longer advertise a category with no Gizlet behind it, and give each category link a full-size tap target.
- Raise the dark-theme contrast of local-processing and success copy to meet WCAG AA.
- Keep the theme toggle's label out of the toggle script, so the header no longer resizes after load and shifts the page on narrow screens.
- Link Gizlet cards and search results to Astro’s required trailing-slash routes.
- Keep the Gizlet wordmark visible on dark theme backgrounds.

## Release policy

- Releases use `MAJOR.MINOR.PATCH` version numbers.
- Before `1.0.0`, a minor version may introduce breaking changes; patch versions are for backward-compatible fixes.
- The first usable public release will be `0.1.0`.
- Changelog entries describe user- or contributor-visible changes. Internal maintenance that has no meaningful external impact does not need an entry.
