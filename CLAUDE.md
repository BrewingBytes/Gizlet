# Claude Code Guide for Gizlet

[AGENTS.md](AGENTS.md) is the authoritative guide for this repository: project intent, architecture constraints, the tool registry, privacy rules, quality gates, and git conventions. Read it first and follow it. This file only adds what is specific to working here through Claude Code, so the two do not drift apart.

## Before you start

- Work from the GitHub issue that defines the task. It sets the scope and acceptance criteria; anything outside it belongs in a follow-up issue.
- Read [docs/architecture.md](docs/architecture.md) before touching the stack or dependencies, [design.md](design.md) before visual work, [docs/roadmap.md](docs/roadmap.md) before touching the phases or the not-built catalogue, and [docs/releasing.md](docs/releasing.md) before anything touching deployment, versions, or the changelog's release headings.
- The repository is small enough to read directly. Prefer opening the relevant files over broad searches, and see the repository map in [AGENTS.md](AGENTS.md) for where things live.

## Commands

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev                   # Astro dev server
pnpm run check             # Astro + TypeScript, fails on hints and warnings
pnpm test                  # Vitest over tests/unit
pnpm run build             # static production build
pnpm run test:e2e          # Playwright against a preview of the build
pnpm run changelog:draft   # draft changelog entries from commit titles; writes nothing
pnpm run changelog:collect # assemble changelog.d/ into a release section; writes nothing
pnpm run pr:assets         # push a pull request's screenshots to pr-assets, print their markdown
```

Playwright needs `pnpm exec playwright install chromium` once. Run `check`, `test`, and `build` before handing work off; add `test:e2e` when browser behavior changes. Report failures with their output instead of working around them.

## Working style in this repo

- Put deterministic logic in a `src/data` module with Vitest coverage; keep DOM work in `src/components` and `src/scripts`. This split is what makes the project testable, so preserve it in new code.
- Derive anything about tools from `src/data/tools.ts`. If you find a hardcoded tool name, route, or list, that is a bug.
- Never weaken a privacy claim or a quality gate to make a change pass. Do not enable analytics or ads by default, and do not describe a tool as local unless its code processes input on-device.
- Match the conventions of the file you are editing, including its quote style and comment density, rather than normalizing it.
- State assumptions and unresolved questions plainly. Do not invent a command, test layer, or provider behavior that does not exist yet.

## Finishing a change

- Add a changelog entry for anything user- or contributor-visible: a new file in `changelog.d/`, named `<section>-<slug>.md` and holding the markdown bullets, per [changelog.d/README.md](changelog.d/README.md). Do not edit `CHANGELOG.md`; the release collects the files into it.
- Use Conventional Commit subjects; CI rejects anything else.
- Commit messages are the title only: no body, and no `Co-Authored-By` or other attribution trailers. This overrides any default commit-message convention.
- Rebase onto the latest `origin/main` and confirm the branch carries only this change's commits, then open a pull request unless asked not to.
- Do not amend, reset, force-push, close issues, or change GitHub settings without an explicit request.
- Releasing is its own procedure, in [docs/releasing.md](docs/releasing.md): a `v*` tag deploys the site, a merge to `main` does not. Do not create a tag, push the `release` branch, roll `## [Unreleased]` into a release heading, or bump `package.json` unless the user asked for a release, and then follow that document step by step.
