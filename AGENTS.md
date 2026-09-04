# Gizlet Agent Guide

## Project intent

Gizlet is a static-first collection of small browser utilities. It prioritizes fast loading, accessible interactions, and local processing. For tools marked local, user files and entered content must stay on-device.

Read [docs/architecture.md](docs/architecture.md) before changing the application stack or adding a dependency, and read [design.md](design.md) before visual UI work. GitHub issues define the scope and acceptance criteria for each unit of work.

## Repository map

- `src/data/` — pure, dependency-free TypeScript modules: the tool registry, per-tool logic, metadata, flows, advertising configuration, legal copy. These are the units under test and must not touch `window`, `document`, or `import.meta.env` directly.
- `src/scripts/` — browser-only modules (`theme`, `image-processing`, `pdf-generation`, `pdf-page-view`, `pdf-rendering`, `tool-search`, `gizlet-request`). Imported from component `<script>` blocks, never from Astro frontmatter.
- `src/components/` — one Astro component per Gizlet workspace plus the shared shell (`SiteHeader`, `SiteFooter`, `ToolPageLayout`, `AdvertisementSlot`, `ToolSearchOverlay`, `FlowBuilder`). Each keeps its own markup, scoped CSS, and `<script>` module.
- `src/layouts/BaseLayout.astro` — document shell, metadata, theme bootstrap, and the env-gated ads tag.
- `src/pages/` — static routes, including `tools/[slug].astro` (generated from the registry) and the generated `sitemap.xml`, `robots.txt`, `tools.json`, and `llms.txt`.
- `tests/unit/` — Vitest, one file per `src/data` module. `tests/e2e/` — Playwright smoke coverage.
- `docs/` — architecture baseline, privacy data contract, measurement constraints, request-form behavior, release procedure.
- `changelog.d/` — one file per unreleased changelog entry. A change writes its entry here rather than editing `CHANGELOG.md`, so two pull requests never edit the same lines; the release collects them.

## Architecture constraints

- Use Astro with static output, TypeScript strict mode, pnpm, and custom CSS.
- Prefer Astro components and small browser-side TypeScript modules. Do not add a UI framework, state library, router, server adapter, or backend unless the relevant issue explicitly requires it.
- Prefer browser-native APIs such as `File`, `Blob`, Canvas, Clipboard, Web Crypto, Web Workers, and native JSON APIs.
- Do not add Rust/WASM without satisfying the adoption rule in `docs/architecture.md`.
- Keep all browser-only code out of Astro frontmatter and build-time execution paths.
- Keep decision logic in `src/data` so it can be unit tested, and keep DOM wiring in components and `src/scripts`.

## The tool registry

`src/data/tools.ts` is the single source of truth for tool names, slugs, routes, categories, keywords, local-processing status, launch status, and agent-facing input/output descriptions. Navigation, homepage listings, search, related tools, `sitemap.xml`, `tools.json`, and `llms.txt` all derive from it. Never hardcode a tool list, route, or label in a page or component.

Adding or changing a Gizlet:

1. Add or update its `toolRegistry` entry, keeping `id` stable and `path` in the `/tools/<slug>/` form with the trailing slash.
2. Keep `processesLocally` and `launchStatus` truthful. Only `available` tools are published to the agent catalogue; a planned tool renders the placeholder workspace on its tool page.
3. Put the tool's deterministic logic in a `src/data/<tool>.ts` module and its UI in `src/components/<Tool>Tool.astro`, then wire the slug into `src/pages/tools/[slug].astro`.
4. If the tool can hand its output to another Gizlet, add its contract to `src/data/tool-flows.ts`; that registry is executable compatibility data, separate from the editorial related-tool recommendations. Declare only the payload kinds it reads and writes — compatibility is derived from those, so there is no adjacency list to update, and a Gizlet becomes available after every Gizlet whose output it accepts. A Gizlet that only shows the visitor something reads and writes nothing another Gizlet can use, so it is not a pipeline step: name it in `flowlessToolSlugs` instead, and do not give it a contract that hands its input back.
5. Add Vitest coverage for the logic module and registry rules, and Playwright coverage when a browser flow matters.

## Privacy and UX

- Never send user file contents, JSON contents, generated passwords, or other tool payloads to analytics or third parties. Gizlet ships no analytics script or client event calls at all: aggregate measurement is Cloudflare Web Analytics, injected at the edge. Do not reintroduce a provider script or a tracking API without an issue that requires it.
- Before writing a success signal or a kill criterion into a plan, read [docs/signals.md](docs/signals.md). Cloudflare Web Analytics supports no custom events and does not log query strings, so completions, error rates, downloads, and click-through are not observable; a criterion that needs them has to be restated.
- Do not claim a tool is local unless its implementation actually processes its input on-device. Tool-page processing copy must come from `getToolProcessingStatus`, which reads the registry.
- Advertising is opt-in through `PUBLIC_*` environment variables, stays disabled in development, and treats malformed configuration as disabled. Do not enable it by default, and keep [docs/privacy.md](docs/privacy.md) accurate when advertising or analytics behavior changes.
- Preserve keyboard access, visible focus states, semantic controls, sufficient contrast, and responsive layouts.
- Advertisements must be clearly labeled and must not appear in a form/upload area or resemble a primary or download action.

## Changes and dependencies

- Keep changes within the active issue's scope. Create a follow-up issue rather than folding unrelated work into the change.
- Justify every runtime dependency in the issue or pull request. Prefer a browser API or a small local module.
- Do not add or update multiple package-manager lockfiles. The project uses `pnpm-lock.yaml`.
- Match the surrounding file's existing style rather than reformatting it.

## Quality gates

Node.js 24 LTS and pnpm 10 (`corepack enable`, then `pnpm install --frozen-lockfile`).

- `pnpm run check` — Astro and TypeScript diagnostics. It runs with `--minimumFailingSeverity hint`, so hints and warnings fail too; fix them rather than lowering the threshold.
- `pnpm test` — Vitest over `tests/unit`.
- `pnpm run build` — production build.
- `pnpm run test:e2e` — Playwright against a preview of the production build, when browser behavior changes. First run needs `pnpm exec playwright install chromium`.

Add focused Vitest coverage for deterministic logic and Playwright coverage for important browser flows. Run the relevant checks before handing work off. CI runs all four on pull requests and on `main`, plus a Conventional Commit title check. If an expected command or test layer does not exist yet, say so plainly rather than inventing a substitute.

## Git and release conventions

- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), for example `feat: add image resize tool` or `fix(json): retain invalid input`. CI rejects any other subject line.
- A commit message is the title only. Do not add a body, and do not add trailers such as `Co-Authored-By` or any other authorship or tool attribution.
- Use [Semantic Versioning](https://semver.org/spec/v2.0.0.html). A user- or contributor-visible change adds its changelog entry as a file in [changelog.d/](changelog.d/), named `<section>-<slug>.md`; see [changelog.d/README.md](changelog.d/README.md). Do not edit `CHANGELOG.md` outside a release.
- Releases follow [docs/releasing.md](docs/releasing.md). Deployment is gated on a `v*` version tag, not on a merge to `main`, and a tag is never created without the matching changelog section and `package.json` bump in the same commit. Follow that document instead of improvising a release, and do not tag or push the `release` branch unless the user explicitly asks for a release.
- Before creating a pull request, fetch `origin`, rebase the feature branch directly onto the latest `origin/main`, and verify that no unrelated, unmerged issue commits remain in the branch history.
- After completing a change, create a pull request unless the user explicitly asks not to.
- A pull request that changes anything a visitor can see shows it. Include a screenshot of the workspace or page it touches, and a before-and-after pair when it changes something that already existed, because a description of a layout is not a review of one.
- Screenshots belong to the pull request, never to the repository. Do not commit them to `main` or to the feature branch, whose diff should carry only the change itself. Dragging the files into the description in the browser is the simplest route; a tool that has no browser session cannot reach that uploader, and pushes them to the `pr-assets` orphan branch under a directory named for the pull request instead, linking them by their `raw.githubusercontent.com` URL. That branch holds nothing but images and is never merged.
- `pnpm run pr:assets -- <image>…` does that push, and prints the markdown to paste into the description. It reads the pull request number from the current branch, or takes `--pr <number>`; `--dry-run` builds the commit without pushing. It checks nothing out and switches no branch, and it commits on top of what the branch already holds, so another pull request's images survive.
- Do not amend, reset, force-push, close issues, or modify GitHub settings unless the user explicitly requests it.
