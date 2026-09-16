# What Gizlet can and cannot measure

Gizlet's measurement is deliberately thin, and that shapes what any plan is allowed to promise. This document records the constraint so it does not have to be rediscovered.

It exists because it was rediscovered three times. Two independent reviews of the tool roadmap each worked out separately that its success criteria — recipes completed, recipe links shared, per-row click-through — described numbers the architecture cannot produce, and a later review made the same mistake again an hour after the first correction. Nothing in the repository recorded the constraint, so each attempt paid for it again.

The source of truth for the data contract is [privacy.md](privacy.md). This document only draws the consequences.

## What can be measured

Cloudflare Web Analytics reports, for a page load: **the page path, referrer, browser, operating system, device type, country, and page-performance timings** (`privacy.md:7`). That gives:

- **Per-Gizlet usage**, because every Gizlet is its own route — `/tools/compress-image/` and the rest (`privacy.md:13`).
- **Per-page interest** for any route, including `/flows/`, `/request-a-gizlet/` and any future page.
- **Where visitors arrive from**, by referrer.
- **Which browsers and devices reach the site** — the input to a capability decision, such as whether a browser API's gaps matter in practice.

All of it within a retention window of **roughly 30 days**. No criterion may be written over a longer Cloudflare window, because the data to evaluate it will not exist when the window closes.

### From Google Analytics, for consenting visitors only

Measurement was extended deliberately, through [analytics-contract.md](analytics-contract.md). Google Analytics reports page views and a **closed set of five events** — a Gizlet opening, finishing, failing with a category, a download with a kind, and a step in a Flow. That makes the following answerable for the first time:

- **Whether anyone finished anything**, per Gizlet.
- **Downloads**, and the coarse kind of output downloaded.
- **Error rates**, by category — not by message.
- **Flow steps**, including which Gizlet handed off to which.

Retention is whatever the Google Analytics property is configured to keep, which is longer than Cloudflare's window.

**Three limits apply to every one of those numbers, and none of them is optional:**

1. **It counts consenting visitors only.** A visitor who refuses, or who has not answered, sends nothing at all — not a cookieless ping. They are absent, not zero.
2. **It is blocked for an unknown share of the audience.** Gizlet's visitors are technical, and `googletagmanager.com` is among the most widely blocked hosts there is. The size of that loss is not known and is not estimated here.
3. **It is therefore not a denominator.** Cloudflare still owns totals. A criterion written on Google Analytics numbers must be a **ratio within the consenting, non-blocking cohort** — completions per opening of the same Gizlet, say — never an absolute count and never a share of Gizlet's traffic.

Reconciling a Google Analytics count against a Cloudflare page view is not a calculation; it is a category error. `growth/revenue-baseline.md` already forbids the equivalent move between AdSense and Cloudflare.

## What cannot be measured

Cloudflare Web Analytics does not support custom events, and Google Analytics is limited to the five whitelisted ones. So none of the following is observable, and none may appear in a plan as a criterion:

- **Anything about the visitor's content.** A filename, a file size, dimensions, a format, JSON contents, a generated password, a tool result, or the text of an error message. No parameter in the whitelist accepts free text, so these have no field to travel in — and an error is reported as one of four categories, never as what it said.
- **Anything a Gizlet does that is not one of the five events.** A copy-to-clipboard, a click on one row of a list, a setting changed, a preview scrubbed. Adding one means changing the whitelist in its own pull request, with the privacy consequence argued there.
- **Anything carried in a query string, from Cloudflare.** It does not log them.
- **Anything at all, for a visitor who refused.**
- **Anything older than about 30 days, from Cloudflare.**

The privacy claim now holds because the whitelist and its tests constrain what can be sent, rather than because no mechanism exists. That is a weaker guarantee than the one it replaced, and it was traded deliberately — see [analytics-contract.md](analytics-contract.md). It is weaker in one specific way worth naming: a future change *could* widen it, where previously nothing could, so widening it is a decision to be argued rather than a patch to be merged.

## Two things that stay uncountable by construction

These did not change when Google Analytics arrived, and cannot.

- **Recipe-link shares.** Recipe settings travel in the URL fragment, and a fragment is never transmitted to a server. This is stronger than the query-string case: a query string is sent and merely not logged, while a fragment does not leave the browser. The privacy claim and the uncountability are the same property, so this is a correct trade rather than a gap.
- **Anything a visitor does with a downloaded file.** It left the browser as a file, not as a request.

## The instrument nobody can block

**A GitHub issue filed through [the request form](request-form.md).** It opens a pre-filled issue in the visitor's own name — `getGizletRequestIssueUrl` builds the URL, and the browser does not send form values to Gizlet — so filing costs the visitor something public and non-zero.

That is what makes it worth more than any click count: a signal nobody spends anything to produce carries no information. It is also directly countable, without a dashboard, by reading the issue list — and it is the one signal that no consent choice and no blocker can take away.

## The rule for plans

Before a plan states a signal or a kill criterion, check it against the two lists above.

A criterion that needs a number this architecture cannot produce has two honest options, and only two:

1. **Restate it** in terms of pageviews, referrers, browser share, filed issues, or a ratio within the consenting cohort.
2. **Change the data contract first**, in its own issue, with the privacy consequences argued in the open.

What is not an option is writing the criterion anyway and discovering at evaluation time that nothing was recorded. That happened three times before this document existed.

A fourth failure is now available in a new shape, so it is named here in advance: **writing a criterion on a Google Analytics absolute count, and discovering at evaluation time that it measured the consenting, non-blocking minority rather than Gizlet's visitors.** A number being present in a dashboard is not the same as it answering the question asked.
