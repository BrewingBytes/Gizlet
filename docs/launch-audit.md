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
      download link. The mobile stacking noted below is a density problem, not interference.
- [x] **No page contains a knowingly false local-processing claim.** With a real image loaded and
      compressed, the only requests are Cloudflare's own `/cdn-cgi/` edge scripts, which fire
      identically without an upload (16,548 vs 16,550 bytes of payload) and never carry the 325 KB
      file. The privacy page's claim is correctly scoped to Gizlets marked Local.
- [x] **No known P0/P1 launch defects left unresolved.** Two P1s were found and fixed; the 404 page
      needs one deployment setting to take effect, tracked below.
- [x] **Performance findings and accepted tradeoffs documented.** See below.

## Findings

Severity: **P1** must be resolved before launch, **P2** should follow soon after, **P3** is backlog.

### Fixed in this change

| # | Severity | Finding |
| - | -------- | ------- |
| 1 | P1 | The homepage scored **CLS 0.2033** at 390px, over double Google's 0.1 "good" threshold. The theme toggle rendered the label `Theme`, and the toggle script rewrote it to `Dark` after hydration. The 16px width change flipped the header's flex wrap, collapsing it from 196px to 140px and pulling the whole page up 56px. The label now follows `data-theme` in CSS, so the first paint is already correct. Measured after the fix: **0.0031**. |
| 2 | P1 | Any unknown address returned an **empty body** — no heading, no navigation, no way back. `src/pages/404.astro` now renders a registry-derived list of every working Gizlet and a link home. **This needs one deployment change to take effect:** the Cloudflare Workers asset configuration must set `not_found_handling` to serve `404.html`, which lives outside this repository. |
| 3 | P2 | The local-processing and success green failed AA in dark theme: `#257a4e` scored **3.29:1** on `#1b1a17` and 2.96:1 on `#26231e`, against the 4.5:1 minimum. It carries the "Local" badge, the tool-page "Local processing" label, the Flows local note, and JSON valid/copy confirmations — the site's main trust signal. A `--success` token now resolves to `#46a877` in dark theme (5.9:1 and 5.3:1) and keeps `--color-green` in light theme. |

### Deferred to follow-up issues

| # | Severity | Finding |
| - | -------- | ------- |
| 4 | P2 | The homepage "Browse by type" strip hardcodes ten categories. Seven of them (PDF, Text, Generators, Video, Audio, Security, Calculators) have no Gizlet, the registry only defines three, and all ten link to the same `#tools` anchor, so every one of them is a dead end. It also contradicts the registry-derivation rule in AGENTS.md. |
| 5 | P2 | With ads enabled at 390px, the inline and rail slots both collapse into the main column and render back to back below the workspace: two labelled ad blocks and roughly 180px of ad space in a row. The rail placement should not render below its breakpoint. |
| 6 | P2 | No page emits structured data. `SoftwareApplication`, `BreadcrumbList`, and `FAQPage` markup are the obvious rich-result opportunities — and Gizlet ships a JSON-LD generator while publishing none itself. |
| 7 | P2 | `/tools/` returns 404. The header's "Tools" link points at `/#tools`, so there is no crawlable index page for the collection and a guessed URL is a dead end. |
| 8 | P2 | Tool pages carry 65–72 words of indexable copy. That is thin for the head terms these pages target, where the incumbents publish substantial supporting content. |
| 9 | P3 | The homepage category links are 17px tall, and tool-page breadcrumb links 14px, below the 24px minimum in WCAG 2.2 SC 2.5.8. The breadcrumbs are inline text and likely exempt; the category strip is a standalone control group and is not. |
| 10 | P3 | The viewport meta is `width=device-width` with no `initial-scale=1`. |
| 11 | P3 | `www.gizlet.app` does not resolve at all — the name has no DNS record, so a visitor typing it gets a resolution failure rather than a redirect to the canonical host. #25 lists `www` handling in its scope. |
| 12 | P3 | Every page shares `/brand/brand-board.png` as its Open Graph and Twitter image, so a shared tool link previews identically to the homepage. |
| 13 | P3 | `/ads.txt` returns 404, which is what the AdSense console reports as "not found". AdSense wants `google.com, pub-…, DIRECT, f08c47fec0942fa0` for the publisher ID already declared in `BaseLayout.astro`. |
| 14 | P3 | `docs/privacy.md` documents the Cloudflare Web Analytics beacon but not the Cloudflare bot-detection script that also runs on the zone. Nothing published is inaccurate; the documentation is simply incomplete about what the edge adds. |

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

The gaps that would move rankings are findings 6, 7, 8, and 12: no structured data, no `/tools/`
index, thin tool-page copy, and one shared social image. Findings 4 and 11 matter here too — ten
category links that all point at the same anchor, and a `www` host that does not resolve.

## Re-running the audit

Before the next launch-shaped change, the cheap version is: `pnpm run build`, preview it, then walk
each route at 390px and 1440px in both themes, Tab through every page, and run one Gizlet end to end
with the network panel open. The two regressions this audit found are guarded by
`tests/e2e/homepage.spec.ts`, which asserts the homepage stays under 0.05 layout shift at 390px and
that the 404 page keeps its way back.
