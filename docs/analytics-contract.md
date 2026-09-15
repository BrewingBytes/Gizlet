# The analytics data contract

**Status: proposed, not accepted.** This document decides nothing on its own. It records what changing Gizlet's measurement would cost, so the decision is made once, in the open, with the consequences written down rather than rediscovered.

It ships no provider script, no tracking code, no dependency, and no `PUBLIC_*` variable.

## Why this document exists

[signals.md](signals.md) records that Gizlet cannot observe completions, downloads, copies, clicks, or anything older than roughly 30 days, and that a plan needing those numbers has exactly two honest options: restate the criterion, or change the data contract first, in its own issue, with the privacy consequences argued in the open. This is the second option.

[AGENTS.md](../AGENTS.md) requires the same thing from the other direction: a provider script or tracking API is not reintroduced without an issue that requires it.

## What is true today

Analytics is Cloudflare Web Analytics, injected by Cloudflare at the edge for the proxied `gizlet.app` zone. There is no script tag, no analytics module, and no client event call in this repository ([privacy.md](privacy.md)).

That is a deliberate position, not an accident of history. Plausible was added, then replaced by Cloudflare, and the `tool_opened`, `tool_action_completed`, and `tool_error` events were removed with it.

Gizlet also ships **no consent banner at all**, because the Cloudflare beacon is cookieless and advertising is disabled. The Google consent management platform described in [privacy.md](privacy.md) is documented but not live.

## What Google Analytics 4 would change

| Claim | Where it is made | After GA4 |
| --- | --- | --- |
| "Gizlet ships no analytics module, no provider script tag, and no client event calls" | [privacy.md](privacy.md) | False, and must be rewritten |
| "there is no code path that could put a file's contents … into analytics, because no such path exists at all" | [privacy.md](privacy.md), [AGENTS.md](../AGENTS.md) | Weakens from *impossible* to *not permitted*, enforced by a whitelist and its tests rather than by the absence of any path |
| "It uses no cookies or other client-side state" | `src/data/legal.ts`, Cloudflare entry | Still true of Cloudflare. A new GA4 entry must state the opposite about itself |
| The "What cannot be measured" list | [signals.md](signals.md) | Materially rewritten, under stated caveats |

The second row is the one to argue about. Today the privacy claim holds because no mechanism exists. Afterwards it holds because a mechanism exists and is constrained. Those are different promises, and only the first is unbreakable by a future change.

The third row is the one that costs the visitor something. GA4 sets cookies, so visitors in the EEA, the United Kingdom, and Switzerland need a consent gate before it loads: a banner on every page of a site whose pitch is speed.

## The consent delivery constraint

Google's Privacy & Messaging documentation states that its consent message rides on tags the publisher already has:

> For most cases, you don't need to re-tag at all — your existing Google Publisher Tag or AdSense tag deploys user messages once the message is published in the relevant product.

Gizlet emits the AdSense tag only when `PUBLIC_ADS_ENABLED=true` with a valid client and at least one valid slot (`src/data/advertising.ts`). **With advertising off, there is no tag for the Google CMP to ride on, so it would not load.** That has a direct consequence:

- **GA4 while advertising stays off** needs a first-party consent banner, written and legally reviewed here, or the AdSense tag emitted purely to carry a consent dialog — which pulls `googlesyndication.com` onto every page to serve no advertisement.
- **GA4 and advertising enabled together** can share Google's certified CMP as a single consent surface, which is the cheaper path by a wide margin.

The consent gate, not the measurement tag, is the expensive half of this change.

## Decisions to record

Each carries a recommendation. None is settled.

1. **Alongside Cloudflare, or instead of it?** — *Recommended: alongside.* GA4 is consent-biased and heavily ad-blocked by a technical audience, so it cannot serve as a traffic denominator. Cloudflare stays the unbiased pageview baseline. [revenue-baseline.md](growth/revenue-baseline.md) already forbids reconciling two sources' page views as if they counted the same event; this adds a third source, not a replacement.
2. **Pageviews only, or whitelisted events?** — *Recommended: events.* Pageview-only GA4 buys longer retention and better segmentation while paying the entire privacy and consent cost. The only justification for that cost is the measurements [signals.md](signals.md) currently rules out.
3. **Google's CMP, or a first-party banner?** — *Deferred to decision 4.* Per the constraint above, this is not a free choice: it follows from whether advertising is enabled in the same period.
4. **Is the trade accepted at all?** — Declining is a legitimate outcome, and this document is worth writing either way: a recorded, dated refusal stops the question being reopened from scratch a fourth time.

## The proposed event whitelist

For the follow-up issue to implement verbatim, if decision 2 is answered with events. Values are enums, bounded integers, or tool slugs resolved against `toolRegistry` — **never free-form strings**.

| Event | Parameters | Value rule |
| --- | --- | --- |
| `tool_opened` | `tool_slug` | Must resolve in `toolRegistry`, or the event is dropped |
| `tool_completed` | `tool_slug` | As above |
| `tool_error` | `tool_slug`, `error_category` | `error_category` is a closed enum; an error message is never a parameter |
| `tool_download` | `tool_slug`, `output_format` | `output_format` is a closed enum |
| `flow_step` | `from_slug`, `to_slug`, `step_index` | Slugs resolve in `toolRegistry`; `step_index` is a bounded integer |

No parameter carries a filename, file size, dimension, MIME type from user input, clipboard content, generated password, tool result, or URL. An unrecognised key drops the whole event rather than sending it partly — the same strictness `src/data/recipes.ts` already applies to recipe links.

## What must not be claimed afterwards

- GA4 counts are **not** a traffic denominator. Criteria are written as ratios within the consented, non-blocking cohort, and totals continue to come from Cloudflare.
- A visitor who refuses consent is **not** counted as zero. They are not counted at all, and are unlikely to be a random sample.
- Server-side GA4 is **not** a way around the consent analysis, and would require the backend [AGENTS.md](../AGENTS.md) forbids.

## If accepted, the work splits four ways

1. **Consent foundation.** Consent Mode v2 defaults denied for `analytics_storage`, `ad_storage`, `ad_user_data`, and `ad_personalization`; the consent surface chosen by decisions 3 and 4; `src/data/consent.ts` as a pure module with Vitest coverage and the DOM work in a component. Has standalone value for advertising even if GA4 never ships.
2. **The tag, pageviews only, off by default.** `src/data/analytics.ts` mirroring `src/data/advertising.ts`: measurement-ID validation, disabled in development, malformed configuration treated as disabled. Wired into `src/layouts/BaseLayout.astro` beside the AdSense block.
3. **The event whitelist above**, with unit tests asserting that filename-, size-, and content-shaped inputs are rejected.
4. **Docs and gates.** Rewrite [privacy.md](privacy.md) and [signals.md](signals.md); add the GA4 entry to `src/data/legal.ts`; update `src/pages/privacy.astro`. Playwright: a default build issues zero requests to `googletagmanager.com`, and a refused-consent load sets no `_ga` cookie.
