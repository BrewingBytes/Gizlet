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

All of it within a retention window of **roughly 30 days** (`privacy.md:13`). No criterion may be written over a longer window, because the data to evaluate it will not exist when the window closes.

## What cannot be measured

Gizlet ships no analytics module, no provider script tag, and no client event calls, and Cloudflare Web Analytics does not support custom events (`privacy.md:7`, `privacy.md:13`). So none of the following is observable, and none may appear in a plan as a criterion:

- **Whether anyone finished anything.** Completion and error rates are explicitly not available (`privacy.md:13`). A Gizlet runs in the page and never navigates, so a finished job and an abandoned one are the same single pageview.
- **Downloads, copies, and clicks.** No event fires, so a download, a copy-to-clipboard, and a click on one row of a list are all invisible.
- **Anything carried in a query string.** Cloudflare Web Analytics does not log URL query strings (`privacy.md:9`).
- **Anything older than about 30 days.**

This is not an oversight to be fixed in passing. It is the same design decision that makes the privacy claim true: there is no code path that could put a file's contents, a filename, JSON contents, a generated password, a tool result, or an error message into analytics, because no such path exists at all (`privacy.md:9`).

## Two things that are uncountable by construction

- **Recipe-link shares.** Recipe settings travel in the URL fragment, and a fragment is never transmitted to a server. This is stronger than the query-string case: a query string is sent and merely not logged, while a fragment does not leave the browser. The privacy claim and the uncountability are the same property, so this is a correct trade rather than a gap.
- **Anything a visitor does with a downloaded file.** It left the browser as a file, not as a request.

## The only real instrument

**A GitHub issue filed through [the request form](request-form.md).** It opens a pre-filled issue in the visitor's own name — `getGizletRequestIssueUrl` builds the URL, and the browser does not send form values to Gizlet — so filing costs the visitor something public and non-zero.

That is what makes it worth more than any click count: a signal nobody spends anything to produce carries no information. It is also directly countable, without a dashboard, by reading the issue list.

Everything else that can be counted is a pageview.

## The rule for plans

Before a plan states a signal or a kill criterion, check it against the two lists above.

A criterion that needs a number this architecture cannot produce has two honest options, and only two:

1. **Restate it** in terms of pageviews, referrers, browser share, or filed issues.
2. **Change the data contract first**, in its own issue, with the privacy consequences argued in the open.

What is not an option is writing the criterion anyway and discovering at evaluation time that nothing was recorded. That has now happened three times.
