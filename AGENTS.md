# Gizlet Agent Guide

## Project intent

Gizlet is a static-first collection of small browser utilities. It prioritizes fast loading, accessible interactions, and local processing. For tools marked local, user files and entered content must stay on-device.

Read [docs/architecture.md](docs/architecture.md) before changing the application stack or adding a dependency, and read [design.md](design.md) before visual UI work. GitHub issues define the scope and acceptance criteria for each unit of work.

## Architecture constraints

- Use Astro with static output, TypeScript strict mode, pnpm, and custom CSS.
- Prefer Astro components and small browser-side TypeScript modules. Do not add a UI framework, state library, router, server adapter, or backend unless the relevant issue explicitly requires it.
- Prefer browser-native APIs such as `File`, `Blob`, Canvas, Clipboard, Web Crypto, Web Workers, and native JSON APIs.
- Do not add Rust/WASM without satisfying the adoption rule in `docs/architecture.md`.
- Keep all browser-only code out of Astro frontmatter and build-time execution paths.

## Privacy and UX

- Never send user file contents, JSON contents, generated passwords, or other tool payloads to analytics or third parties.
- Do not claim a tool is local unless its implementation actually processes its input on-device.
- Preserve keyboard access, visible focus states, semantic controls, sufficient contrast, and responsive layouts.
- Advertisements must be clearly labeled and must not appear in a form/upload area or resemble a primary or download action.

## Changes and dependencies

- Keep changes within the active issue's scope. Create a follow-up issue rather than folding unrelated work into the change.
- Use the typed tool registry as the source of truth for tool names, routes, categories, and search data once it exists.
- Justify every runtime dependency in the issue or pull request. Prefer a browser API or a small local module.
- Do not add or update multiple package-manager lockfiles. The project uses `pnpm-lock.yaml`.

## Quality gates

- Add focused Vitest coverage for deterministic logic and Playwright coverage for important browser flows.
- Run the relevant checks before handing work off. Once the app is initialized, the standard commands are `pnpm run check`, `pnpm test`, `pnpm run build`, and `pnpm run test:e2e` when browser behavior changes.
- If an expected command or test layer does not exist yet, say so plainly rather than inventing a substitute.

## Git and release conventions

- Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), for example `feat: add image resize tool` or `fix(json): retain invalid input`.
- Use [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Keep `CHANGELOG.md` current for user- or contributor-visible changes.
- Do not amend, reset, force-push, close issues, or modify GitHub settings unless the user explicitly requests it.
