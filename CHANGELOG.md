# Changelog

All notable changes to Gizlet are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Gizlet pages now choose their workspace from a registry-derived slug map and decide on launch status before the slug, so a planned Gizlet reaches the placeholder by rule rather than by falling off the end of a chain of conditions. Adding a Gizlet without a workspace, or without a related-Gizlet entry, now fails `pnpm run check` instead of crashing the production build.
- The JSON Formatter's processing sentence moved from the tool page into `src/data/tool-page-status.ts`, so the copy comes from the data layer like every other registry-backed claim.

### Added

- A `TODOS.md` recording deferred work with the condition that would revisit it.

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
