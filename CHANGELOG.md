# Changelog

All notable changes to Gizlet are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Fixed

- Keep the Gizlet wordmark visible on dark theme backgrounds.

## Release policy

- Releases use `MAJOR.MINOR.PATCH` version numbers.
- Before `1.0.0`, a minor version may introduce breaking changes; patch versions are for backward-compatible fixes.
- The first usable public release will be `0.1.0`.
- Changelog entries describe user- or contributor-visible changes. Internal maintenance that has no meaningful external impact does not need an entry.
