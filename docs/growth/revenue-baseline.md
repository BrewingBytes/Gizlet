# Revenue and acquisition baseline

This is the reproducible 28-day review sheet for deciding whether Gizlet has enough evidence for a small paid-acquisition pilot. It is not approval to enable ads or spend money, and it is not a financial forecast.

## Reporting identity

| Field | Value |
| --- | --- |
| Review prepared | 2026-09-10 |
| Review timezone | Europe/Bucharest |
| Inclusive review interval | 2026-08-13 00:00:00–2026-09-09 23:59:59 Europe/Bucharest |
| Calendar days | 28 |
| AdSense reporting currency | unknown — copy from the account export |
| AdSense account timezone | unknown — copy from the account settings or export |
| Cloudflare reporting timezone | unknown — copy from the dashboard or export |
| Cost and sponsor ledger currency | unknown — record it; convert only with a documented rate and date |
| Evidence available | Repository documentation only; no AdSense, Cloudflare, hosting, sponsor, or campaign account exports were supplied |

The interval contains 28 complete local calendar days: `2026-09-09 − 2026-08-13 + 1 day = 28 days`. Export each source for its exact equivalent interval and record that source's timezone. If boundaries cannot be aligned, keep figures separate and mark comparisons `unknown`; do not silently combine partial days or currencies.

## Evidence to attach

- AdSense report for the interval: estimated earnings, page views, page RPM, ad requests, matched requests, impressions, report currency, and account timezone.
- Cloudflare Web Analytics export or dated dashboard capture for the interval: page views and dashboard timezone.
- Hosting invoices or ledger entries accrued to the interval, including currency and the allocation method for a different billing period.
- Campaign invoice/export: spend and attributable visits, if available, with the visit definition, attribution method, and attribution window.
- Sponsor ledger or invoices: gross direct sponsor revenue, refunds, payment-processing/platform fees, currency, and recognition dates.

Keep approved exports outside this repository if they contain account or commercial details. Record an evidence reference here, not credentials or visitor-level data.

## Actual 28-day report

`unknown` means evidence was not supplied or cannot be aligned. It never means zero.

| Category | Metric | Actual | Currency/unit | Evidence | Exact source interval and timezone | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Advertising | AdSense estimated earnings (gross ad revenue) | unknown | unknown currency | Not supplied | unknown | Estimated account earnings, not cash received |
| Advertising | AdSense page views | unknown | page views | Not supplied | unknown | Provider count used for page RPM |
| Advertising | AdSense page RPM | unknown | unknown currency / 1,000 AdSense page views | Not supplied | unknown | Verify with the formula below |
| Unit delivery | Ad requests | unknown | requests | Not supplied | unknown | A request for an ad; not a page view or impression |
| Unit delivery | Matched requests | unknown | matched requests | Not supplied | unknown | Keep separate from requests and impressions |
| Unit delivery | Ad impressions | unknown | impressions | Not supplied | unknown | Keep separate from page views; a page can contain multiple units |
| Traffic | Cloudflare page views | unknown | page views | Not supplied | unknown | Aggregate route loads, not completed tool actions or AdSense page views |
| Sponsorship | Gross direct sponsor revenue | unknown | unknown currency | Not supplied | unknown | Record zero only when a complete ledger proves none |
| Deductions | Sponsor refunds | unknown | unknown currency | Not supplied | unknown | Enter as a positive deduction |
| Deductions | Sponsor payment/platform fees | unknown | unknown currency | Not supplied | unknown | Enter as a positive deduction |
| Operating cost | Hosting cost allocated to interval | unknown | unknown currency | Not supplied | unknown | State the allocation method |
| Acquisition | Campaign spend | unknown | unknown currency | Not supplied | unknown | Spend is a cost, not a visit count |
| Acquisition | Acquired visits attributable to campaign | unknown | visits | Not supplied | unknown | Record visit definition and attribution window |
| Acquisition | Attributable ad revenue | unknown | unknown currency | Not supplied | unknown | Only revenue supportably assigned to those visits |

Do not reconcile AdSense page views to Cloudflare page views by assuming they describe the same event. An ad request, matched request, filled/rendered impression, and page view are also different units. Differences are diagnostic observations, not values to substitute for one another.

## Reproducible actuals formulas

Use unrounded source values, then display money to the currency's normal precision. Every operand must cover the aligned interval and currency.

```text
verified page RPM
  = AdSense estimated earnings / AdSense page views × 1,000

net sponsor revenue
  = gross direct sponsor revenue − sponsor refunds − sponsor payment/platform fees

net revenue before acquisition
  = AdSense estimated earnings + net sponsor revenue − hosting cost

net result after acquisition
  = net revenue before acquisition − campaign spend

ad-supported break-even acquisition cost per acquired visit
  = attributable ad revenue / acquired visits
```

Division by zero or any `unknown` input produces `unknown`, not zero or infinity. Break-even acquisition cost is valid only when attributable ad revenue and acquired visits use the same campaign cohort and attribution window. It is not page RPM, cost per click, or return on ad spend.

| Calculated result | Actual | Reason while unknown |
| --- | --- | --- |
| Verified page RPM | unknown | AdSense earnings and page views not supplied |
| Net sponsor revenue | unknown | Sponsor ledger, refunds, and fees not supplied |
| Net revenue before acquisition | unknown | Revenue and hosting inputs not supplied |
| Net result after acquisition | unknown | Revenue, hosting, and campaign inputs not supplied |
| Ad-supported break-even acquisition cost per acquired visit | unknown | Attributable ad revenue and acquired visits not supplied |

## Scenario-only sensitivity table

This table is deliberately unfilled. Edit every bracketed assumption from an approved source or documented hypothesis. These are scenarios, never actual traffic, RPM, conversion, earnings, or an ROI claim.

| Editable assumption | Low | Base | High | Unit/source rationale |
| --- | --- | --- | --- | --- |
| Assumed monetized page views from the acquired-visit cohort | `[unknown]` | `[unknown]` | `[unknown]` | AdSense page views assumed to be generated by the same acquired visits; state the rationale |
| Assumed page RPM | `[unknown]` | `[unknown]` | `[unknown]` | reporting currency / 1,000 monetized page views; state the source |
| Assumed acquired visits | `[unknown]` | `[unknown]` | `[unknown]` | visits; state campaign and attribution definition |
| Assumed pilot spend | `[unknown]` | `[unknown]` | `[unknown]` | same reporting currency |

For each column:

```text
scenario ad revenue
  = assumed page RPM × assumed monetized page views from the acquired-visit cohort / 1,000

scenario revenue per assumed acquired visit
  = scenario ad revenue / assumed acquired visits

scenario ad-only result after acquisition
  = scenario ad revenue − assumed pilot spend
```

When campaign attribution is absent, `assumed page RPM × assumed monetized page views from the acquired-visit cohort / 1,000` is permitted only as an ad-revenue scenario. The scenario numerator and acquired-visit denominator must describe the same hypothetical cohort; never mix whole-site page views with campaign visits. Do not relabel the result attributable revenue or use it to claim ROI. No conversion-rate assumption is needed or implied.

## Readiness observations

Operational readiness is separate from earnings. A ready configuration does not prove revenue, and revenue does not prove compliant configuration.

| Observation | Status | Required evidence before a paid pilot |
| --- | --- | --- |
| AdSense account/site approval | unknown | Dated AdSense Sites capture showing approval/ready status |
| Ad-unit delivery | unknown | Production-like desktop and mobile checks plus a report separating requests, matched requests, and impressions |
| `ads.txt` authorization | unknown | Root-domain HTTP response and dated AdSense Sites status showing the publisher ID is authorized |
| Consent configuration | unknown | Dated review of the published notice, Google-certified CMP, accept/refuse/manage-options flow, provider choices, and declined-consent behavior for EEA, UK, and Swiss traffic |
| Production ad enablement | unknown | Owner-approved record after every item in the [production enablement checklist](../privacy.md#production-enablement-checklist) passes |
| Campaign attribution | unknown | Documented visit definition, attribution method/window, and reproducible campaign-to-revenue link |

Google states that a site must be approved before showing AdSense ads and defines page RPM as estimated earnings divided by page views, multiplied by 1,000. Google also treats `ads.txt` authorization as a separate site status. See [Connect your site to AdSense](https://support.google.com/adsense/answer/7584263), [Revenue per thousand impressions](https://support.google.com/adsense/answer/190515), and the [ads.txt guide](https://support.google.com/adsense/answer/12171612). Gizlet's consent and enablement requirements remain those in [privacy.md](../privacy.md#advertising).

## 28-day review decision

**Decision on 2026-09-10: defer a paid pilot pending evidence and an explicit owner decision; no ROI claim can be made.** No approved account exports were available, so there is no measured revenue, traffic, delivery, cost, spend, or attribution baseline. `unknown` values are not evidence of zero activity.

A later 28-day review may permit an owner-approved, capped paid pilot only when all of this evidence exists:

1. A complete, aligned 28-day set of AdSense, Cloudflare, hosting, sponsor, and campaign records with currency, timezone, and exact intervals.
2. Separate confirmation of AdSense site approval, ad-unit delivery, `ads.txt` authorization, and the consent/privacy checklist above.
3. An explicit owner decision setting the pilot budget, stop rule, scope, and authority to spend; this ticket grants none of them.

Even then, a pilot is an experiment, not proof of positive ROI. An ROI or ad-supported acquisition claim remains blocked until measured acquired visits and attributable ad revenue exist for the same campaign cohort and attribution window, with campaign spend, refunds/fees, and applicable hosting cost included. Without attribution, low/base/high RPM scenarios may inform a budget ceiling but cannot establish return on spend.
