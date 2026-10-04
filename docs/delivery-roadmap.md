# Implementation and release roadmap

Prepared 2026-10-04 for [BRE-54](https://linear.app/brewingbytes/issue/BRE-54/docs-plan-implementation-priorities-and-release-cadence), corrected against merged feature evidence in [BRE-56](https://linear.app/brewingbytes/issue/BRE-56/docs-reconcile-delivery-roadmap-with-merged-features). This is a maintainer delivery plan. The public [roadmap](roadmap.md) continues to describe dependency order; its tool names and status remain in `src/data/roadmap.ts`.

Fix data integrity first, document the useful image capability that already exists, then add local named recipes. Broader format support and acquisition spending wait for evidence. The priorities below are recommendations, not changes to Linear issue priorities.

## Starting point

- Latest published release at initial preparation: [v0.12.1](https://github.com/BrewingBytes/Gizlet/releases/tag/v0.12.1), published 2026-10-02. Recheck the latest tag before using the version candidates below.
- Current main at preparation: `87f733e`. Since that tag, [#249](https://github.com/BrewingBytes/Gizlet/pull/249) adds actual and cumulative archive extraction limits, [#250](https://github.com/BrewingBytes/Gizlet/pull/250) removes unrelated recipe code from the shared analytics bundle, and [#244](https://github.com/BrewingBytes/Gizlet/pull/244) reduces CI setup work. All three are merged. A merge alone does not deploy them.
- The target-size image compression engine (BRE-29), target-size control (BRE-30, merged [#220](https://github.com/BrewingBytes/Gizlet/pull/220)) and starter Flow recipes (BRE-32) are shipped. Worked guides (BRE-33) remain unfinished; both their code prerequisites are satisfied.
- Universal image/PDF result handoff (BRE-14) is shipped in [#228](https://github.com/BrewingBytes/Gizlet/pull/228), alongside the older homepage file handoff. Local named recipes (BRE-15) remain unfinished. The tool registry still marks QR Code Generator and the three video tools as planned.
- Linear's Backlog status for BRE-30 and BRE-14 was stale when this plan was prepared. Their merged PRs and current source establish implementation status; do not implement them again. Any gaps found in shipped behavior need a separately scoped defect issue.
- Search and revenue baseline documents are delivered templates, with account values still unknown in the repository. A Done documentation ticket does not establish demand, earnings, or permission to spend.

## Capacity and dates

Target windows assume one implementer, one active code issue at a time, and review within one working day. Dates use Europe/Bucharest. They are planning targets, not delivery promises; if capacity or review differs, retain the order and move the dates. Release only completed, reviewed changes. Never weaken a gate to meet a date.

| Order | Target window | Work | Release decision |
| --- | --- | --- | --- |
| 0 | 4–5 October | Release the already merged archive safety fix, shared-script improvement and CI change | Recommend `0.12.2` within 24 hours of release review; do not wait for new features |
| 1 | 5–9 October | JSON/CSV data-integrity fixes, then the timestamp test race | Recommend `0.12.3` as soon as the first reviewed integrity fix is ready; include the other fixes if already ready |
| 2 | 12–18 October | Worked guides using shipped target-size compression and starter recipes | Include completed content in the next patch; do not reserve a minor for an already shipped feature |
| 3 | 19 October–1 November | Local named Flow recipes | Recommend `0.13.0` when the complete recipe-library feature is ready |
| 4 | November review | QR generation or a format-support spike, selected using observed demand and feasibility | Schedule the next minor only after selecting and completing the feature; a spike alone needs no product release |

Version numbers assume the previous release has shipped. If an urgent fix needs another patch, take the next unused patch number. If the work slips, change the target date rather than assigning a version to unfinished code.

## What to implement next

### Data integrity and dependable validation

Work through these separately and sequentially: the first three share `src/data/json-csv.ts`, so simultaneous edits add avoidable integration risk.

1. [BRE-51 — preserve JSON number tokens](https://linear.app/brewingbytes/issue/BRE-51/fixjson-prevent-silent-numeric-corruption-when-formatting-or). Formatting currently changes some large numbers or converts them to null. Preserve tokens during format/minify; JSON-to-CSV must preserve the value or refuse with a precise explanation. Check the Flow callers too. This is first because a successful-looking corrupted result is a trust defect.
2. [BRE-53 — reject unclosed CSV quotes](https://linear.app/brewingbytes/issue/BRE-53/fixcsv-report-unterminated-quoted-fields-instead-of-silently). An unterminated field currently absorbs later rows. Report its opening location in the Converter and Viewer, clear stale successful output, and preserve valid multiline fields and recovery.
3. [BRE-52 — export only own JSON properties](https://linear.app/brewingbytes/issue/BRE-52/fixcsv-treat-absent-json-keys-as-empty-cells-instead-of-inherited). Missing keys become empty cells, including when another record explicitly uses `toString` or `__proto__`. Preserve those legitimate keys rather than blacklisting them.
4. [BRE-49 — fix the timestamp test clock](https://linear.app/brewingbytes/issue/BRE-49/testtimestamp-freeze-the-clock-in-the-fills-either-box-with-now). Freeze time and meet the ticket's 50-repeat, four-worker acceptance check. This improves release confidence without changing the tool.

Each integrity fix needs its specified unit/browser regressions and a changelog fragment. Do not hold a verified corruption fix for the rest of the batch or wait for the next minor. If more than 48 hours separates completed fixes, release the earlier one and use a subsequent patch for the rest. BRE-49 can join a release but is not a reason to delay an urgent fix.

### Document the shipped target-size capability

[BRE-30](https://linear.app/brewingbytes/issue/BRE-30/featimage-add-under-this-file-size-to-compress-image) is already implemented in [#220](https://github.com/BrewingBytes/Gizlet/pull/220), merged 2026-09-15. `CompressImageTool.astro` contains Quality and Target file size modes, decimal-unit presets/custom limits, met/unmet results, batch handling, PNG guidance, cancellation and replacement protection. These are existing capabilities, not a future milestone. Target-size settings in shared Flow links remain outside the original ticket's scope.

Implement [BRE-33 — two worked guides](https://linear.app/brewingbytes/issue/BRE-33/featcontent-publish-two-worked-guides-with-real-before-and-after). Its target-size and starter-recipe prerequisites are both merged. Record reproducible example files, settings, output sizes and limitations, and wire metadata and sitemap inputs. Include completed content in a routine patch when it introduces no new tool behavior. Do not hold an integrity patch for unfinished guides.

### Improve composition before adding more heavy tools

[BRE-14 — Send to another Gizlet](https://linear.app/brewingbytes/issue/BRE-14/featflows-add-a-universal-send-to-another-gizlet-action) is already implemented in [#228](https://github.com/BrewingBytes/Gizlet/pull/228). `SendToGizlet.astro` and `src/data/send-to-gizlet.ts` offer image/PDF result destinations through the existing local file handoff. Use this shipped behavior; there is no new handoff milestone in this plan.

The next composition feature is [BRE-15 — save named Flow recipes locally](https://linear.app/brewingbytes/issue/BRE-15/featflows-save-named-flow-recipes-locally), using its linked [#108 scope](https://github.com/BrewingBytes/Gizlet/issues/108). Persist validated settings only; implement reopen, rename and delete, bounded storage, and visible storage failure. Files, filenames and outputs must not enter the recipe library. Update the local-storage disclosure.

Deliver BRE-15 in its own PR and release it as the next minor candidate, `0.13.0`, once its full acceptance criteria pass. The product step is repeat use of existing composition, rather than rebuilding the already shipped discovery surface. Recheck whether any intervening feature release has consumed that version.

### Conditional work

| Candidate | When to pick it up | Required result before shipping |
| --- | --- | --- |
| [BRE-13 — QR Code Generator](https://linear.app/brewingbytes/issue/BRE-13/featdata-add-qr-code-generator) | First small-tool candidate after the above milestones, if request evidence or an explicit owner priority supports it | Review the dependency, verify scan fixtures and local processing, and update registry, public roadmap, related tools and social asset together. Do not assume low implementation cost proves demand |
| [BRE-24 — publisher consistency](https://linear.app/brewingbytes/issue/BRE-24/fixads-prevent-the-serving-publisher-from-disagreeing-with-adstxt), then [BRE-25 — ad reservation and initialization](https://linear.app/brewingbytes/issue/BRE-25/fixads-match-inline-reservation-to-its-format-and-initialize-visible) | Before any ad enablement or paid pilot; advance ahead of feature work if an owner confirms production already serves affected ads | BRE-23 is merged, so BRE-24's original prerequisite is satisfied. Complete BRE-24 before BRE-25; verify mismatches disable ads and use provider stubs for layout/once-only tests. Live configuration and serving status are unknown here |
| [BRE-19 — PDF compression spike](https://linear.app/brewingbytes/issue/BRE-19/spikepdf-measure-on-device-pdf-compression) | After integrity fixes, when PDF request/page evidence makes it worth the investigation | Measure size, quality, selectable text, time and memory on real documents and desktop/phone. Deliver go/no-go. No production spike code or public compression promise |
| [BRE-5 — RAR support](https://linear.app/brewingbytes/issue/BRE-5/featarchive-read-rar-archives-in-extract-archive) | After archive guards are released and a concrete RAR request justifies the decoder cost | License/dependency review first; verify lazy loading, bounded local extraction and browser fixtures. Defer if the decoder cannot satisfy the adoption requirements |
| [BRE-18 — Trim Video](https://linear.app/brewingbytes/issue/BRE-18/featvideo-add-trim-video), then BRE-17 frames, then BRE-16 GIF | After reviewing current browser/device usage and a supported/fallback product decision | Recheck current codec capabilities instead of relying on old issue claims. Justify each runtime dependency and test supported and unsupported paths. GIF encoding needs a separate review; none of these has a firm release date |

## Demand and acquisition review

During October, obtain account exports for the existing [search baseline](growth/search-baseline.md) and [revenue baseline](growth/revenue-baseline.md), and review recent filed requests. Record dates, property, window and unknown values explicitly. Missing account access leaves the evidence task pending; it does not block the integrity fixes or prove that nobody uses a tool.

Use [signals.md](signals.md) for interpretation: Cloudflare route/device data supports interest and compatibility decisions. Existing Google Analytics completion/download ratios describe consenting, non-blocking visitors only; verify configuration and usable observations before citing them. Do not divide that cohort by Cloudflare totals or claim recipe-link shares are observable.

Reconcile [BRE-28 — campaign measurement](https://linear.app/brewingbytes/issue/BRE-28/docsmeasurement-define-the-minimum-data-contract-for-paid-campaign)'s older assumptions with the current closed analytics contract before picking it up. Decide how to evaluate acquisition with the existing instruments; any contract expansion is separate work. Campaign pages, Search campaign preparation, sponsorship and an ad-free pass follow their own dependency and owner-decision gates. Paid acquisition should wait until the revenue/readiness evidence and an explicit budget/stop rule exist. This roadmap predicts no ROI or ranking improvement.

Review feature direction 14–30 days after each minor, using the available observation window and filed issues. Prioritize reproducible defects immediately. If the reviewed data does not support video or another decoder, keep those candidates deferred and improve existing jobs. Calendar time passing is not a go decision.

## When to release

- **Urgent patches:** backward-compatible safety, privacy, data-integrity or broken-workflow fixes, within 24 hours after the reviewed fix and release gates are green. A safety patch containing an unrelated completed improvement does not imply the other known defects are resolved.
- **Routine patches:** batch completed backward-compatible fixes and performance/content improvements for a weekly review. Release when there is a meaningful shipped change; documentation-only planning and test-only maintenance do not require a version bump by themselves.
- **Minor releases:** a complete new tool or useful capability, reviewed on a roughly two-week cadence. One coherent feature is enough; a calendar deadline alone is not. Publish the working subset only when every included ticket is complete.
- **Version 1.0:** no date yet. Decide after a stable supported-browser/privacy contract, no known high-severity integrity defects, and repeatable release/rollback verification. It should mark an explicit stability commitment, not an arbitrary tool count.

Before preparing each release, fetch main and inspect the actual changes since the latest version tag. Resolve newly introduced high-severity regressions; record any pre-existing known defects and their scheduled fixes. Check tool/roadmap consistency and every included issue's acceptance evidence. Keep one issue per implementation PR.

Follow [releasing.md](releasing.md): prepare a release PR containing the version bump, collected and edited changelog fragments, and regenerated sitemap dates. Validate with Node 24/pnpm 10: `check`, `test`, `build`, `site:check`, Chromium/configured-browser cases and WebKit smoke as applicable to the workflows. Review and merge that PR, then an explicitly authorized release action tags the merged commit. Verify Release validation, promotion, deployment and public routes. The full Release run in the new Playwright container has not yet been exercised by a version tag; verify it on the first authorized patch release.

Only a version tag triggers release promotion; merging this plan or a feature is not deployment. This document schedules release decisions and does not itself authorize tagging, deployment, production settings, spending or external outreach.

## Keep the plan current

At each weekly review, record the latest tag, main commit, completed milestones and remaining blockers here. Consult Linear descriptions for scope, then verify implementation status against merged PRs and current source: ticket status and blocked labels can lag shipped work. Update dates and version candidates when intervening releases happen. Public roadmap status still changes in the same PR that makes a planned tool available.
