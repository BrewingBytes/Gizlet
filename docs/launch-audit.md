# Pre-launch audit

The launch gate for [#26](https://github.com/BrewingBytes/Gizlet/issues/26). It records what was
checked before making Gizlet public, what was found, what was fixed, and which findings were
accepted or deferred to their own issues.

**Audited:** `https://gizlet.app` (production), 2 September 2026.
**Surface:** every published route — `/`, `/flows/`, `/request-a-gizlet/`, `/about/`, `/privacy/`,
`/terms/`, and the five launch Gizlets.
**Conditions:** headless Chromium at 1440×900, 390×844, and 320×640, in light and dark themes, with
advertising both disabled (as production serves it today) and enabled from a local production build.

## Method

Automated passes with headless Chromium, read alongside manual review of the rendered pages:

- Per-page: HTTP status, console and page errors, failed requests, document metadata, favicons,
  heading outline, landmark roles, image alternative text, accessible names for every control and
  link, duplicate `id`s, horizontal overflow, navigation timings, transfer size, and cumulative
  layout shift.
- Contrast: the computed foreground and effective background of every visible text node, scored
  against WCAG 2.1 AA (4.5:1, or 3:1 for large text).
- Keyboard: a Tab walk of every route recording the focus order, the computed focus indicator, and
  the hit-target size of each stop.
- Links: every `href` on every page, fetched and checked for its status.
- Gizlet flows: each launch Gizlet driven end to end with a real 1600×1200 JPEG or real JSON,
  including the download, with all network traffic recorded from the moment the input was supplied.

Re-running these needs no committed harness; the checks above are reproducible with Playwright,
which the repository already depends on. The regressions worth keeping are covered by
`tests/e2e/homepage.spec.ts` instead.

## Acceptance criteria

- [x] **Homepage checked on desktop and mobile sizes.** 1440×900, 390×844, and 320×640, light and
      dark. No horizontal overflow at any width; the mobile layout shift found here is fixed below.
- [x] **Each launch Gizlet gets a happy-path check.** Compress Image (325 KB JPEG → 36% smaller,
      downloaded), Resize Image (→ 640×480, downloaded), Convert Image (JPEG → PNG, downloaded),
      JSON Formatter (formats, and reports `Invalid JSON at line 1, column 8` while keeping the
      input), JSON-LD Generator (live preview parses as valid `Product` JSON-LD). Gizlet Flows and
      the request form were exercised too.
- [x] **Keyboard-only navigation reaches all primary actions.** Every route's Tab order starts with
      Skip to content, covers the header, the workspace, and the footer, and every stop paints the
      3px amber focus ring. No focus trap and no keyboard-unreachable action was found.
- [x] **No ad placement resembles a tool or download button, or blocks a workflow.** With ads
      enabled, each slot is an `aside` labelled "Advertisement", sits outside every form and upload
      area, reserves its height so nothing moves, and keeps at least 24px from any button or
      download link. Two findings came out of this pass and are fixed below: the mobile rail
      stacking, and an ad-request call that never ran at all.
- [x] **No page contains a knowingly false local-processing claim.** With a real image loaded and
      compressed, the only requests are Cloudflare's own `/cdn-cgi/` edge scripts, which fire
      identically without an upload (16,548 vs 16,550 bytes of payload) and never carry the 325 KB
      file. The privacy page's claim is correctly scoped to Gizlets marked Local.
- [x] **No known P0/P1 launch defects left unresolved.** Three P1s were found and fixed; the 404
      page needs one deployment setting to take effect, tracked below.
- [x] **Performance findings and accepted tradeoffs documented.** See below.

## Findings

Severity: **P1** must be resolved before launch, **P2** should follow soon after, **P3** is backlog.

### Fixed in this change

| # | Severity | Finding |
| - | -------- | ------- |
| 1 | P1 | The homepage scored **CLS 0.2033** at 390px, over double Google's 0.1 "good" threshold. The theme toggle rendered the label `Theme`, and the toggle script rewrote it to `Dark` after hydration. The 16px width change flipped the header's flex wrap, collapsing it from 196px to 140px and pulling the whole page up 56px. The label now follows `data-theme` in CSS, so the first paint is already correct. Measured after the fix: **0.0031**. |
| 2 | P1 | **Two inline scripts were being emitted as text and never ran.** Both were written as `<script is:inline>{\`…\`}</script>`, but Astro treats a script body as raw text, so each page shipped a block statement containing a template literal — valid JavaScript that does nothing, which is why no console error ever appeared. The theme bootstrap in `BaseLayout.astro` was dead, so a visitor whose stored choice differs from their system preference saw the wrong theme until the module script loaded (confirmed against production: `--background` was `#1b1a17` at `interactive` and `#f3efe6` at `complete`). The `adsbygoogle.push({})` call was dead too, which means **no AdSense unit would ever have filled** once ads were switched on. Both now execute; the ad slots push 2 requests on desktop and 1 on mobile. |
| 3 | P1 | Any unknown address returned an **empty body** — no heading, no navigation, no way back. `src/pages/404.astro` now renders a registry-derived list of every working Gizlet and a link home. **This needs one deployment change to take effect:** the Cloudflare Workers asset configuration must set `not_found_handling` to serve `404.html`, which lives outside this repository. Tracked on [#59](https://github.com/BrewingBytes/Gizlet/issues/59), where the Workers deploy configuration is defined. |
| 4 | P2 | The local-processing and success green failed AA in dark theme: `#257a4e` scored **3.29:1** on `#1b1a17` and 2.96:1 on `#26231e`, against the 4.5:1 minimum. It carries the "Local" badge, the tool-page "Local processing" label, the Flows local note, and JSON valid/copy confirmations — the site's main trust signal. A `--success` token now resolves to `#46a877` in dark theme (5.9:1 and 5.3:1) and keeps `--color-green` in light theme. |
| 5 | P2 | The homepage "Browse by type" strip hardcoded ten categories. Seven of them (PDF, Text, Generators, Video, Audio, Security, Calculators) had no Gizlet, the registry only defines three, and all ten linked to the same `#tools` anchor, so every one was a dead end. It also contradicted the registry-derivation rule in AGENTS.md. The strip is now built from `getToolCategoryGroups()`, shows a count per category, and links into the new index. |
| 6 | P2 | `/tools/` returned 404. The header, footer, and tool-page breadcrumbs all pointed at `/#tools`, so the collection had no crawlable index page and a guessed URL was a dead end. There is now a registry-derived `/tools/` index grouped by category, published in the sitemap, and every "Tools" link points at it. |
| 7 | P2 | With ads enabled at 390px, the inline and rail slots both collapsed into the main column and rendered back to back below the workspace: two labelled ad blocks and roughly 180px of ad space in a row. The rail is now hidden below the width where the layout stops having a rail, and no ad is requested for it there. |
| 8 | P2 | No page emitted structured data — and Gizlet ships a JSON-LD generator while publishing none itself. The home page now carries `WebSite`, the index `CollectionPage` with an `ItemList`, and each Gizlet page `SoftwareApplication` plus a `BreadcrumbList`, all derived from the registry. |
| 9 | P3 | The homepage category links were 17px tall, below the 24px minimum in WCAG 2.2 SC 2.5.8. They now use a 44px tap target. Tool-page breadcrumb links remain 14px; they are inline text in a sentence-like trail, which the success criterion exempts. |
| 10 | P3 | The viewport meta was `width=device-width` with no `initial-scale=1`. |
| 11 | P3 | `/ads.txt` returned 404, which is what the AdSense console reports as "not found". It is now generated from the publisher ID declared in `advertising.ts`, which the site-verification meta tag also uses, so the two cannot drift. |
| 12 | P3 | `docs/privacy.md` documented the Cloudflare Web Analytics beacon but not the bot-detection script the zone also injects. Nothing published was inaccurate; the documentation is now complete about what the edge adds. |

### Deferred to follow-up issues

| # | Severity | Finding |
| - | -------- | ------- |
| 13 | P2 | [#63](https://github.com/BrewingBytes/Gizlet/issues/63) — Tool pages carry 65–72 words of indexable copy. That is thin for the head terms these pages target, where the incumbents publish substantial supporting content. Worth per-Gizlet supporting copy and an FAQ, which would also earn `FAQPage` markup on top of the structured data added here. |
| 14 | P3 | [#64](https://github.com/BrewingBytes/Gizlet/issues/64) — `www.gizlet.app` does not resolve at all — the name has no DNS record, so a visitor typing it gets a resolution failure rather than a redirect to the canonical host. #25 lists `www` handling in its scope. |
| 15 | P3 | [#65](https://github.com/BrewingBytes/Gizlet/issues/65) — Every page shares `/brand/brand-board.png` as its Open Graph and Twitter image, so a shared tool link previews identically to the homepage. |

### Checked and accepted

- **Cloudflare's `/cdn-cgi/` requests.** A page load fires `speculation`, the bot-detection script,
  and a RUM beacon. They are unchanged by tool activity, so they do not weaken the local-processing
  claim. Recorded as finding 14 for documentation only.
- **A second `<header>` element on most routes.** It sits inside sectioning content, so it is not a
  second banner landmark.
- **Ad slots reserve their height.** With ads enabled, the ad-attributable layout shift is 0.
- **A residual 0.0031 layout shift on the homepage**, from the tool index settling by 12px. It is
  1/30th of the "good" threshold and not worth chasing.

## Performance

Production, cold context, no throttling. Every route is a static document with no render-blocking
third-party script.

| Route | Transfer | Requests | JS | DOMContentLoaded (desktop / mobile) | CLS after fix |
| ----- | -------- | -------- | -- | ---------------------------------- | ------------- |
| `/` | 14 KB | 10 | 3 KB | 237ms / 142ms | 0.0031 |
| `/flows/` | 13 KB | 14 | 6 KB | 226ms / 115ms | 0 |
| `/tools/compress-image/` | 12 KB | 12 | 2 KB | 189ms / 64ms | 0 |
| `/tools/resize-image/` | 8 KB | 13 | 2 KB | 201ms / 45ms | 0 |
| `/tools/convert-image/` | 7 KB | 13 | 2 KB | 184ms / 52ms | 0 |
| `/tools/json-ld-generator/` | 9 KB | 11 | 3 KB | 171ms / 54ms | 0 |
| `/tools/json-formatter/` | 6 KB | 10 | 0 KB | 125ms / 43ms | 0 |
| `/privacy/`, `/terms/`, `/about/`, `/request-a-gizlet/` | 5–6 KB | 9 | 0 KB | 109–152ms / 38–43ms | 0 |

**Accepted tradeoffs.**

- Image work runs on the main thread through Canvas rather than in a worker. It is fast enough for
  ordinary photographs, and a worker is only worth adding if a large-image complaint appears.
- Pages are served with `cache-control: public, max-age=0, must-revalidate`, so every navigation
  revalidates against the Cloudflare edge. For a site this small the extra round trip is cheaper
  than serving a stale build after a deploy.
- No fonts are downloaded; the display and body faces are the system Georgia and Arial stacks. That
  removes a whole class of layout shift at the cost of exact typographic control.

## Search visibility

Sound already: one `h1` per route, unique titles and descriptions within Google's usual limits,
canonical URLs on every page, `index, follow` throughout, Open Graph and Twitter cards, a registry-
derived `sitemap.xml` advertised from `robots.txt`, HTTPS with an HTTP redirect, `307` redirects to
the canonical trailing-slash form, a real `404` status for unknown paths, and fast, script-light
static documents.

Three of the gaps found here are closed above: the site now publishes structured data, has a
crawlable `/tools/` index in its sitemap, and no longer offers ten category links that all point at
the same anchor. What remains is content and presentation rather than plumbing — findings 13, 14,
and 15: thin tool-page copy against well-established competitors, a `www` host that does not
resolve, and one shared social image for every page.

The honest read is that the plumbing is now better than the content. Ranking for terms like
"compress image" is a content and authority problem, not a markup one.

## Re-running the audit

Before the next launch-shaped change, the cheap version is: `pnpm run build`, preview it, then walk
each route at 390px and 1440px in both themes, Tab through every page, and run one Gizlet end to end
with the network panel open. The regressions this audit found are guarded by
`tests/e2e/homepage.spec.ts`, which asserts that the homepage stays under 0.05 layout shift at
390px, that the stored theme is applied before the first paint, that the 404 page keeps its way
back, that the category strip only offers categories with Gizlets behind them, and that the
structured data parses.
