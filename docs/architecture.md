# Gizlet Architecture and Stack

This document defines the production baseline for Gizlet v1. It is intentionally conservative: Gizlet is a static collection of small browser tools, not a server-rendered application or a multi-package platform.

## Baseline

| Area | Decision |
| --- | --- |
| Framework | Astro 7, with `output: "static"` explicitly configured. |
| Runtime | Node.js 24 LTS. |
| Package manager | pnpm 10, pinned with the `packageManager` field. Commit `pnpm-lock.yaml`. |
| Language | TypeScript using Astro's strict configuration. |
| Styling | Custom CSS, design tokens, and Astro component-scoped styles. |
| Unit tests | Vitest for pure tool logic and small utility modules. |
| Browser tests | Playwright for the homepage smoke test and critical tool happy paths. |

## Rendering and interactivity

All public routes are pre-rendered at build time. Gizlet does not use a server adapter, server-rendered routes, accounts, or an application backend in v1.

Use Astro components for layouts and static content. Add interactivity through small browser-side TypeScript modules and standard HTML controls. Do not add React, Vue, Svelte, a UI component library, client router, or global state library by default.

This keeps content pages fast and crawlable while allowing each Gizlet to ship only the JavaScript needed for its own form, processing, and result UI.

## Local processing and browser APIs

Gizlets marked as local must process user input in the browser. Prefer platform APIs such as `File`, `Blob`, `URL`, Canvas, Clipboard, Web Crypto, Web Workers, and native JSON handling before introducing a dependency.

No file content, JSON content, generated password, or other user-entered tool payload may be sent to analytics. Any third-party analytics or advertising request is separate from tool processing and must be documented accurately.

## Rust and WebAssembly

Rust/WASM is supported as a future implementation option; it is not part of the initial toolchain.

Adopt WASM only when all of the following are true:

1. A browser-native implementation has been measured and cannot meet the required performance, memory, compatibility, or algorithmic need.
2. The improvement is material for a user-facing Gizlet rather than speculative infrastructure.
3. The WASM artifact is isolated behind a small TypeScript adapter and is loaded only by browser-side code.
4. Heavy work runs in a Web Worker when it would otherwise block input or rendering.
5. The added artifact size, browser support, build-tool complexity, and fallback behavior are documented and tested.

Do not import browser-only WASM code from Astro frontmatter or other build-time code. A future WASM Gizlet should load its module only when the user reaches or uses that tool.

## Testing policy

Test transformations, validation, filenames, registry rules, and other deterministic behavior with Vitest. Browser tests use Playwright against a local Vite preview of the Astro production build and cover the homepage plus high-value user paths such as a tool's primary action and download/copy result.

The project uses these scripts once initialized:

- `dev` for the Astro development server
- `build` for the production build
- `preview` for the production-build preview server
- `check` for Astro/TypeScript checks
- `test` for Vitest
- `test:e2e` for Playwright

GitHub Actions validates pull requests and pushes to `main`. The pull-request-only `Commit Title` job requires Conventional Commit subjects. The validation job installs from the lockfile and runs checks, tests, the production build, and Playwright smoke tests without deployment secrets.

## Dependency policy

Every runtime dependency needs a concrete compatibility, security, or maintenance justification. The default answer is to use a browser API or a small local module instead.

Before adding a dependency:

1. Confirm that Astro, TypeScript, or the browser platform cannot reasonably provide the capability.
2. Prefer a small, maintained package with a clear license and narrow purpose.
3. Avoid packages that duplicate native APIs, introduce a UI framework, or create an application-wide abstraction for one Gizlet.
4. Add a focused test for the behavior the dependency enables.
5. Record the reason in the pull request or issue.

## Deferred decisions

Hosting, analytics, advertising, consent requirements, user accounts, billing, and server-side processing are not part of this baseline. They require separate product and implementation decisions when their roadmap issues are reached.
