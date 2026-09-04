# Releasing Gizlet

A release of gizlet.app happens when a maintainer pushes a version tag, and only then. Merging to `main` builds and tests the site but deploys nothing. This document is the procedure: follow it rather than improvising, and change it here when the procedure changes.

## The rule

**No tag is created without the matching changelog section and version bump in the same commit.** The tag, `package.json`, and `CHANGELOG.md` must agree about what `x.y.z` contains. [.github/workflows/release.yml](../.github/workflows/release.yml) enforces this and refuses to promote a tag that disagrees, but the rule exists so the changelog stays trustworthy, not so the check passes.

Version numbers follow the release policy at the bottom of [CHANGELOG.md](../CHANGELOG.md): `MAJOR.MINOR.PATCH`, and before `1.0.0` a minor version may break things while a patch stays backward compatible.

## How a tag reaches production

Cloudflare Workers Builds is the source of the production build. It can only trigger on a branch — [it has no git-tag trigger](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/) — so the tag drives a branch that Cloudflare watches:

1. A maintainer pushes `vx.y.z`.
2. `Release` runs on the tag. Its `validate` job checks that the tag matches `package.json`, that `CHANGELOG.md` has the matching release section, and that the tagged commit is on `origin/main`, then runs the same gates as CI: `check`, `test`, `build`, and `test:e2e`.
3. Only if all of that passes, the `promote` job fast-forwards the `release` branch onto the tagged commit.
4. Cloudflare Workers Builds sees the push to `release`, runs `pnpm run build`, and deploys with `pnpm run deploy`.

Nothing reaches `release` without passing the gates, so a tagged deploy runs exactly the validation a pull request does.

`release` is an ordinary fast-forward of `main`; no history is rewritten and no force push is involved. It is deliberately left unprotected: a ruleset that restricted pushes would have to name a bypass actor, and [`github-actions[bot]` cannot be one](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository) — only a dedicated GitHub App could, which is more moving parts than the branch is worth. Treat `release` as machine-owned and do not push it by hand.

### Cloudflare settings this repository cannot hold

[wrangler.toml](../wrangler.toml) is committed so the asset behavior is reviewable in Git, including `not_found_handling = "404-page"`, which is what makes an unknown address serve the built `404.html` instead of an empty body. The trigger itself lives in the Cloudflare dashboard, under **Workers & Pages → gizlet → Settings → Build**:

| Setting | Value |
| --- | --- |
| Git repository | `BrewingBytes/Gizlet` |
| Production branch | `release` |
| Builds for non-production branches | off |
| Build command | `pnpm run build` |
| Deploy command | `pnpm run deploy` |
| Root directory | `/` |

The production branch must stay `release`. Setting it back to `main` restores deploy-on-merge and defeats this whole document.

Workers Builds authenticates with a Cloudflare API token stored in Cloudflare, not in this repository, so no repository secret is needed and none should be added. The `Release` workflow uses only the built-in `GITHUB_TOKEN` with `contents: write` on its `promote` job.

## Cutting a release

1. **Confirm `main` is ready.** Fetch `origin`, check that `origin/main` is green in Actions, and confirm it holds everything intended for the release and nothing that is not.
2. **Bump the version.** Set `version` in `package.json` to `x.y.z` by hand. It is not automated, and the next step reads it.
3. **Collect the changelog entries.** Run `pnpm run changelog:collect` to see the release section the entries in `changelog.d/` make, then `pnpm run changelog:collect -- --write` to write it into `CHANGELOG.md` as `## [x.y.z] - YYYY-MM-DD` and delete the collected files. Read the result as a whole: entries were written one at a time, months apart, and the release is where they are read together (see below).
4. **Commit.** One commit carrying the changelog, the deleted fragments, and the version bump, with a Conventional Commit title and no body or trailers, per [AGENTS.md](../AGENTS.md) — for example `chore(release): release 0.1.0`. Open it as a pull request and merge it the normal way; the release commit is reviewed like any other.
5. **Tag the merged commit and push the tag.**

   ```sh
   git fetch origin
   git checkout main && git pull --ff-only
   git tag v0.1.0
   git push origin v0.1.0
   ```

6. **Verify.** Watch `Release` in Actions, then the build in the Cloudflare dashboard, then the live site (below).

## Writing the changelog

Entries are not written in `CHANGELOG.md`. A change that is user- or contributor-visible adds a file to [changelog.d/](../changelog.d/) instead, named `<section>-<slug>.md` and holding the markdown bullets the changelog should show:

```
changelog.d/added-image-to-pdf-preview.md
changelog.d/fixed-image-conversion-search-ranking.md
```

Every pull request then writes a new file rather than editing the same lines of the same file, which is what stops the changelog from conflicting on every rebase. `## [Unreleased]` in `CHANGELOG.md` is a pointer to that directory and holds no entries; `changelog.d/README.md` documents the format for whoever is writing one.

```sh
pnpm run changelog:draft                          # print what the commits would say
pnpm run changelog:draft -- --since origin/main   # just this branch
pnpm run changelog:draft -- --write               # write one fragment per drafted entry
pnpm run changelog:collect                        # print the release section, write nothing
pnpm run changelog:collect -- --write             # write it and delete the fragments
pnpm run changelog:collect -- --version 0.4.0 --date 2026-09-10
```

`changelog:draft` reads the Conventional Commit titles between the previous `v*` tag and `HEAD` and maps them onto Keep a Changelog sections: `feat` to Added, `fix` to Fixed, `perf`, `docs`, and `revert` to Changed, and `refactor`, `build`, `chore`, `ci`, `style`, and `test` to nothing, because internal maintenance needs no entry. A breaking change is always kept and prefixed with `**Breaking:**`.

**Its output is a draft to review, not a changelog to trust.** A commit subject is an instruction to a reader of the git history; a changelog entry tells a visitor what changed for them, and the existing entries are written that way. Expect to rewrite most drafted lines, merge several files into one, and delete the ones describing work that is invisible from outside. The commit titles that produced a line are still in `git log` if you need the context. Run it at release time with no `--write` to check that nothing landed without an entry.

`changelog:collect` groups the files by section, orders them within a section by file name, and inserts them under a fresh `## [Unreleased]`. Three things make it safe to run:

- It refuses when `## [Unreleased]` holds anything but its pointer, rather than overwriting an entry someone wrote there by hand.
- It refuses when `CHANGELOG.md` already has a section for the version, which is what a forgotten `package.json` bump looks like.
- It reports every unreadable fragment at once — a name it cannot place, an empty file, a file that does not start with a bullet — instead of one per run.

Nothing in the release depends on either script. Delete the fragments, write the section by hand, and the release proceeds unchanged.

The parsing, the section mapping, and the fragment rules live in [scripts/lib/changelog.mjs](../scripts/lib/changelog.mjs) as a pure module, covered by `tests/unit/changelog.test.ts`.

## Verifying a deployment

```sh
# The release is live.
curl -s https://gizlet.app/ | grep -c 'Gizlet'

# Unknown addresses serve the 404 page and keep the 404 status.
curl -s -o /dev/null -w '%{http_code}\n' https://gizlet.app/does-not-exist/   # 404
curl -s https://gizlet.app/does-not-exist/ | head -5                          # not empty
```

A `200` on that second command means `not_found_handling` regressed to `single-page-application`; an empty body with a `404` means it regressed to `none`. Both are wrong.

Also spot-check a Gizlet page, the `/tools/` index, and that measurement still reaches the page as described in [privacy.md](privacy.md).

## When something goes wrong

[AGENTS.md](../AGENTS.md) forbids rewriting history without an explicit request, and that applies to tags: a pushed tag is public. Prefer moving forward.

**The tag failed validation.** Nothing was promoted and nothing deployed, which is the workflow working. Fix the problem on `main` through a normal pull request, then cut the next patch version with a new tag. Delete the failed tag locally and on the remote (`git tag -d vx.y.z && git push origin :refs/tags/vx.y.z`) only if it never promoted, so the version number can be reused without two commits ever having claimed it.

**The tag deployed, but the release is bad.** Do not retag. Fix forward: land the fix on `main` and cut `x.y.z+1` through the same procedure. If the site must be restored immediately, roll back to the previous deployment in the Cloudflare dashboard, which is faster than any git operation, and then cut the patch release.

**A tag was pushed by mistake.** If `promote` has not finished, cancel the workflow run in Actions, then delete the tag on the remote. If it has, the deploy has happened: treat it as a real release, and if the code should not be live, roll back in Cloudflare and cut a patch release that removes it.

**`promote` could not fast-forward `release`.** That means `release` points at a commit that is not an ancestor of the tag, which should not happen if nobody pushes it by hand. Confirm the tagged commit is on `main`, then reset `release` onto it deliberately, as an explicit decision rather than something the workflow does silently.
