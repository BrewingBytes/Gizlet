# CI performance

This records where the `Validate` jobs in [ci.yml](../.github/workflows/ci.yml) and [release.yml](../.github/workflows/release.yml) spend their time, what was tried, and why the validation jobs run the way they do (BRE-46). Every number here is a measured GitHub Actions timing, taken from the job and step timestamps the API reports and from the job logs. Where a figure is inferred rather than measured, the text says so.

## Where the time went before

Six successful CI `Validate` runs and the `v0.12.1` Release `Validate` run, all with the workflow as it stood after BRE-40 (Chromium, then WebKit, each installed with `playwright install --with-deps`). The runner is `ubuntu-latest` (Ubuntu 24.04), which has four vCPUs because the repository is public. Times are in seconds.

| Run | Commit | Queue | Setup | Install deps | Check | Unit | Build + site check | Chromium install | Chromium tests | Env-specific browser tests | WebKit install | WebKit tests | Job |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [37017641606](https://github.com/BrewingBytes/Gizlet/actions/runs/37017641606) | `ba76044` (main) | 2 | 10 | 2 | 12 | 5 | 2 | 32 | 91 | 14 | 22 | 14 | 207 |
| [37017091251](https://github.com/BrewingBytes/Gizlet/actions/runs/37017091251) | `5227a48` (PR) | 4 | 15 | 1 | 16 | 8 | 4 | 35 | 111 | 22 | 38 | 17 | 271 |
| [37016264822](https://github.com/BrewingBytes/Gizlet/actions/runs/37016264822) | `6731845` (main) | 3 | 11 | 2 | 15 | 7 | 3 | 26 | 110 | 19 | 31 | 22 | 250 |
| [37015793557](https://github.com/BrewingBytes/Gizlet/actions/runs/37015793557) | `c9da2db` (PR) | 4 | 11 | 1 | 14 | 6 | 3 | 30 | 98 | 20 | 32 | 12 | 231 |
| [37014409091](https://github.com/BrewingBytes/Gizlet/actions/runs/37014409091) | `48db4e2` (main) | 2 | 7 | 1 | 10 | 5 | 2 | 21 | 83 | 13 | 21 | 7 | 173 |
| [37013946207](https://github.com/BrewingBytes/Gizlet/actions/runs/37013946207) | `c105644` (PR) | 3 | 9 | 2 | 16 | 7 | 3 | 24 | 108 | 21 | 25 | 10 | 227 |
| [37017679287](https://github.com/BrewingBytes/Gizlet/actions/runs/37017679287) | `v0.12.1` (Release) | 2 | 7 | 1 | 12 | 6 | 4 | 26 | 92 | — | 52 | 15 | 217 |

"Setup" is the runner's job setup, checkout, pnpm and Node. "Build + site check" includes Release's tag and sitemap-date checks. Each Playwright step also builds the site before it starts its preview; that build takes one to two seconds and is counted inside the step.

What this shows:

- **Queueing and dependencies are not the problem.** Queue time was 2–4 s. `pnpm install --frozen-lockfile` took 1–2 s, because setup-node's pnpm cache hit on every run (`Cache hit for: node-cache-Linux-x64-pnpm-4c27…`).
- **Installing browsers took 43–78 s a run**, a fifth to a third of the job. Most of that is OS packages, not browsers. In run 37017641606 the Chromium step spent about 22 s in `apt` (10 packages, 32 MB, after a cold `apt-get update`) and 9 s downloading Chrome for Testing, ffmpeg and the headless shell. The WebKit step spent about 18 s in `apt` (171 packages, 93 MB) and 4 s downloading WebKit.
- **The Chromium suite was the longest step, 83–111 s.** Playwright ran its 340 tests on two workers, its default of half the CPUs, which left two of the runner's four idle.

## What was tried

Both candidates were measured on [PR #244](https://github.com/BrewingBytes/Gizlet/pull/244), on the same commit, in three attempts each. The real `Validate` job ran with four workers. A temporary trial workflow, since removed, ran two more jobs beside it: the current runner setup with two workers, and the official Playwright image with two workers, so worker count did not blur the image comparison.

| Chromium suite (340 tests), as Playwright reports it | Attempt 1 | Attempt 2 | Attempt 3 | Median |
| --- | --- | --- | --- | --- |
| Runner, 4 workers | 1.1 min | 1.7 min | 1.2 min | 1.2 min |
| Runner, 2 workers | 1.9 min | 1.4 min | 1.9 min | 1.9 min |
| Playwright image, 2 workers | 2.0 min | 1.5 min | 1.9 min | 1.9 min |

| Everything before the first test, in seconds | Attempt 1 | Attempt 2 | Attempt 3 | Median |
| --- | --- | --- | --- | --- |
| Runner: setup, deps, Chromium and WebKit installs | 83 | 50 | 83 | 83 |
| Playwright image: setup, container pull, deps | 37 | 49 | 39 | 39 |

| Whole trial job, in seconds | Attempt 1 | Attempt 2 | Attempt 3 | Median |
| --- | --- | --- | --- | --- |
| Runner, 2 workers | 215 | 143 | 217 | 215 |
| Playwright image, 2 workers | 198 | 151 | 166 | 166 |

The jobs are noisy. The same step on the same commit varies by a third between attempts (Typecheck alone ranged 11–17 s), so a single run proves nothing either way. Across three attempts:

- **Four workers** shortened the Chromium suite in two attempts out of three, with a median of 1.2 min against 1.9 min. No test was retried in any four-worker run.
- **The image** took 27–37 s to initialise the container. That replaces 43–75 s of browser and OS-package installs. Its first attempt on a fresh cache also spent 27 s saving the pnpm cache under the container's path, which later attempts did not repeat.

### The options compared

| Option | Measured effect | Cost |
| --- | --- | --- |
| Tune what exists: more Playwright workers | Chromium suite median 1.9 → 1.2 min | One line in `playwright.config.ts`. Reverting it is one line. |
| Tune what exists: cache `~/.cache/ms-playwright` | Not trialed. From the logs, browser downloads are about 13 s of the 43–78 s, and `--with-deps` would still run `apt` for the rest. | A cache key that must follow the Playwright version, and a cache restore of several hundred MB on every run. |
| Official version-pinned image `mcr.microsoft.com/playwright:v1.62.1-noble` | Pre-test setup median 83 → 39 s | Its tag has to equal the locked `@playwright/test` version. Steps run as root, so git needs the checkout marked safe. Updates come from Microsoft and Renovate. |
| Custom image | Not built | Its own build, registry, publishing credentials and security updates. Gizlet would own patching it. Not warranted while the official image already carries exactly the browsers and packages the suite uses. |

## What CI does now

Both validation jobs run in the official image, with Playwright on every core. The two changes act on different parts of the job — the image on setup, the workers on the longest test step — so they were adopted together.

- **The image.** `container: image: mcr.microsoft.com/playwright:v<version>-noble` in both workflows, and no `playwright install` step. Dependencies still come from `pnpm install --frozen-lockfile`, so the project's packages match `pnpm-lock.yaml` as before; the image provides the operating system, the browsers and their OS packages. Node is still set up by `actions/setup-node` at version 24.
- **Keeping the tag in step.** `tests/unit/ci-workflows.test.ts` fails if either workflow's image tag differs from the `@playwright/test` version in `pnpm-lock.yaml`, or if a workflow installs browsers again. It runs in the unit-test step, before any browser test, so a mismatch is reported in seconds and names the file to change. A `Playwright` group in [renovate.json](../renovate.json) updates the npm package and the image in one pull request. Renovate's `github-actions` manager reads `container` images.
- **Git inside the container.** The container runs as root over a checkout owned by the runner's user, so git refuses the repository (`fatal: detected dubious ownership`). `release.yml` marks the workspace safe right after checkout, because its tag check and `sitemap:dates --check` read the history. This path was trialed on the pull request, since Release itself only runs on a tag. Without the step, git failed with that error; with it, the fetch-and-ancestor check and `Sitemap dates are current for 47 pages.` both passed. CI's `Validate` runs no git command after checkout, so it needs no such step.
- **Workers.** `playwright.config.ts` sets `workers: '100%'` when `CI` is set. Local runs keep Playwright's default.

Every gate is unchanged: the same checks, the same Chromium suite, the same analytics and advertising configurations, the WebKit smoke set in its own step, and Release's tag, changelog, version and sitemap checks before promotion. Nothing is cached between runs except the pnpm store, as before, and every Playwright step still builds the site it tests.

### After

AFTER_PLACEHOLDER

## Keeping this true

- When Playwright is updated by hand, change both image tags in the same commit. The unit test will say so if one is missed.
- If a test fails only in CI, reproduce it locally with `--workers=4` before suspecting the image. The one flaky test seen during these measurements failed with two workers as well; it is a clock race in the test itself (BRE-49).
- To go back to installing browsers on the runner, remove the `container` block from both workflows and restore the `playwright install --with-deps` steps. Then delete the image half of `tests/unit/ci-workflows.test.ts` and the Renovate group. To go back to two workers, delete the `workers` line.
