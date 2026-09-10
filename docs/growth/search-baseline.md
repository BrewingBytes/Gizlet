# Search performance baseline

Status: ready-to-fill baseline; Search Console account data was not supplied.

This document separates account observations from interpretation and experiments. It is not a measured baseline yet: every Search Console value below is `Unknown`, and no query is inferred from registry keywords or page copy.

## Measurement window

Use the Search results Performance report with search type **Web**.

- Baseline: **2026-08-13 through 2026-09-09**, the 28 calendar days before this document's 2026-09-10 preparation date.
- Comparison: **2026-07-16 through 2026-08-12**, the immediately preceding, equivalent 28-day window.
- Search Console labels daily Performance data in Pacific Time. Confirm that 2026-09-09 is shown as complete, not preliminary, before exporting. If the report's last complete date is earlier, move both windows back by the same number of days and record the actual dates here.

Google says that the newest Performance data can be preliminary and can change, and that the report normally presents complete days. The report can also omit anonymized queries and retain only its most important table rows, so query rows need not sum to the chart total. These limitations apply to every table below.

## Definitions and method

Use Google's [Search results Performance report definitions](https://support.google.com/webmasters/answer/7576553?hl=en) consistently:

- **Clicks** count clicks from Google Search results to Gizlet.
- **Impressions** count appearances in Search results according to Google's result-type rules.
- **CTR** is clicks divided by impressions.
- **Average position** is the average position of the topmost Gizlet result for the relevant row, not a fixed rank from a manual search.

These are Google Search visibility and traffic metrics. They do not measure a Gizlet action, successful tool completion, download, copy, or error. Gizlet's separate Cloudflare Web Analytics contract measures aggregate page loads and retains roughly 30 days; it has no custom completion events and no query-string reporting. Search Console performance history is a different data source: its Performance report offers a **Last 16 months** window, and Google recommends exporting data separately to extend that history. Do not apply Cloudflare's roughly 30-day limit to Search Console, or claim that Search Console data exists before the property began collecting it. See Google's [traffic-drop analysis guidance](https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops#analyze-the-drop-pattern) for the 16-month report window.

To populate this baseline:

1. In Search Console, select the `gizlet.app` property and open **Performance → Search results**.
2. Set search type to **Web**, enable clicks, impressions, average CTR, and average position, and compare the two custom windows above.
3. Record the property-level totals below. Export the **Queries** and **Pages** tables for both windows, preserving the export files outside this repository if they contain account data.
4. Build query/page pairs by selecting a query and opening the Pages dimension, or by filtering each relevant page and exporting its Queries table. Do not combine property-aggregated chart values with page-aggregated table values: Google [counts those aggregations differently](https://support.google.com/webmasters/answer/17011364?hl=en).
5. Sort candidate pairs by impressions, then retain the highest-impression rows the export actually provides. Record omitted/anonymized-query and row-limit caveats with the result.

Search Console assigns most performance data to Google's selected canonical. See Google's [dimensions and data-grouping guidance](https://support.google.com/webmasters/answer/17011259?hl=en) when reconciling exported page URLs.

## Observed Search Console data

### Property and sitemap

| Observation | Baseline window | Comparison window | Evidence / checked at |
| --- | --- | --- | --- |
| Property verified and accessible | Unknown | Not applicable | No account access supplied |
| Total clicks | Unknown | Unknown | Performance export required |
| Total impressions | Unknown | Unknown | Performance export required |
| Average CTR | Unknown | Unknown | Performance export required |
| Average position | Unknown | Unknown | Performance export required |
| Submitted sitemap URL | Unknown | Not applicable | Sitemap report access required |
| Sitemap submission status and last read | Unknown | Not applicable | Sitemap report access required |
| Discovered pages / indexing state | Unknown | Not applicable | Sitemap and Page indexing reports required |

Do not turn a live `sitemap.xml` response or repository sitemap entry into a claim that Google has received, read, or indexed it. Those claims require the Search Console Sitemap or Page indexing reports.

### Top query/page pairs

No Performance export was supplied, so there are no observed top queries or query/page pairs to report.

| Rank | Query | Page (Google-attributed canonical) | Impressions | Clicks | CTR | Average position | Comparison impressions | Comparison clicks | Comparison CTR | Comparison position | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| — | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Awaiting export |

When filling this table, copy query text exactly from Search Console. Do not replace missing or anonymized rows with registry keywords, search-volume estimates, rank scraping, or manual searches.

### Required URL inspections

The source observations below were read from the repository at the baseline preparation commit. `src/data/metadata.ts` normalizes each non-root pathname to a trailing slash, resolves it against `https://gizlet.app`, and emits that URL as `rel="canonical"`; tool titles default to `<tool name> | Gizlet`. These are source intentions only. The URL Inspection fields remain unknown until checked in the Search Console property.

| Route | Source-intended canonical | Source title | URL Inspection coverage / indexing | User-declared canonical | Google-selected canonical | Match? | Inspected at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | `https://gizlet.app/` | `Gizlet \| Useful internet things, without the nonsense.` | Unknown | Unknown | Unknown | Unknown | Not inspected; no account access |
| `/tools/compress-image/` | `https://gizlet.app/tools/compress-image/` | `Compress Image \| Gizlet` | Unknown | Unknown | Unknown | Unknown | Not inspected; no account access |
| `/tools/merge-pdf/` | `https://gizlet.app/tools/merge-pdf/` | `Merge PDF \| Gizlet` | Unknown | Unknown | Unknown | Unknown | Not inspected; no account access |
| `/tools/jpg-to-pdf/` | `https://gizlet.app/tools/jpg-to-pdf/` | `Image to PDF \| Gizlet` | Unknown | Unknown | Unknown | Unknown | Not inspected; no account access |
| `/tools/json-formatter/` | `https://gizlet.app/tools/json-formatter/` | `JSON Formatter \| Gizlet` | Unknown | Unknown | Unknown | Unknown | Not inspected; no account access |

For each route, inspect the exact source-intended URL and record indexed/not indexed, last crawl if shown, the user-declared canonical, and the Google-selected canonical. Google notes that URL Inspection describes its indexed version and that its selected canonical can differ from the declared one; see the [URL Inspection documentation](https://support.google.com/webmasters/answer/9012289?hl=en). A `Match?` value is valid only after both canonical fields are observed.

## Interpretations

None yet. Account metrics, query/page pairs, sitemap status, and URL Inspection results are all unavailable. Source titles and canonicals establish what Gizlet asks crawlers to use, but they do not establish indexing, ranking, demand, a query mismatch, or an opportunity.

Once observations exist, write interpretations here and cite the exact table rows that support each one. Consider impressions and clicks alongside CTR and position; do not read average position as a stable rank. Search results vary by time, place, device, and search history, and query rows can be withheld for privacy.

Movement between the two windows is correlation, not proof that a page edit caused it. Seasonality, result-layout changes, indexing changes, competitors, device/country mix, and Google data anomalies are possible contributors. Record known launches or incidents beside the comparison.

## Proposed experiments

**Selected experiments: 0.** An experiment requires an observed, meaningful query/page mismatch in the exported data. With no export, selecting a page or proposing replacement title/content would invent evidence.

At most three candidates may be promoted into the slots below after review. A candidate should name the exact observed query/page rows, explain the mismatch between search intent and the existing page, change one coherent title/content hypothesis, and preserve an honest description of the tool.

| Slot | Status | Page | Supporting observed query/page rows | Before text | Proposed text | Rationale | Review date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Pending evidence | — | — | — | — | — | — |
| 2 | Pending evidence | — | — | — | — | — | — |
| 3 | Pending evidence | — | — | — | — | — | — |

For a selected experiment, capture a fresh 28-complete-day pre-change window and choose a review date only when an equivalent 28-complete-day post-change window can exist. Compare like-for-like Web search windows. Record intervening releases and external changes; do not attribute all movement to the edit. This document proposes experiments only—it does not authorize metadata changes, production enablement, or campaign activity.

## Evidence record

| Item | Value |
| --- | --- |
| Prepared | 2026-09-10 |
| Repository baseline | `48d956b` (`origin/main`) |
| Search Console account/export access | Not supplied |
| URL Inspection access | Not supplied |
| Sitemap report access | Not supplied |
| Official metric source | [Performance report overview](https://support.google.com/webmasters/answer/7576553?hl=en) |
| Official data caveats | [Performance report data](https://support.google.com/webmasters/answer/17011364?hl=en), [Search Console data timing](https://support.google.com/webmasters/answer/96568?hl=en) |
| Canonical inspection source | [URL Inspection tool](https://support.google.com/webmasters/answer/9012289?hl=en) |
