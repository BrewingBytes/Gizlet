# Privacy, analytics, and advertising

Gizlet measures from two sources, and they are not interchangeable. [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) measures aggregate traffic and page performance for every visitor. [Google Analytics 4](#google-analytics-4) measures a closed set of events, and only for a visitor who has allowed it.

Cloudflare Web Analytics was selected because it is free at any traffic level, needs no script or configuration in this repository, and is designed for aggregate rather than user-level reporting: Cloudflare states that it "does not use any client-side state, such as cookies or localStorage, to collect usage metrics" and does not fingerprint individuals.

## What Gizlet sends

**To Cloudflare, nothing.** Gizlet ships no Cloudflare analytics module and no beacon tag. Cloudflare injects its beacon at the edge for the proxied `gizlet.app` zone, so the only data it collects is what that beacon reports for a page load: the page path, referrer, browser, operating system, device type, country, and page-performance timings. Cloudflare Web Analytics does not log URL query strings, so a value that reached a URL is not collected there either.

**To Google Analytics, a closed list and nothing else** — and only once a visitor has allowed analytics. The list is defined in `src/data/analytics-events.ts`:

| Event | Values it carries |
| --- | --- |
| `tool_opened` | The Gizlet's identifier |
| `tool_completed` | The Gizlet's identifier |
| `tool_error` | The Gizlet's identifier, and a category: `unsupported-input`, `input-too-large`, `processing-failed`, or `feature-unavailable` |
| `tool_download` | The Gizlet's identifier, and a kind: `image`, `pdf`, `archive`, `text`, or `data` |
| `flow_step` | Two Gizlet identifiers and a step number |

Every value is a fixed name from one of those lists, a bounded whole number, or the identifier of a Gizlet that exists. **No parameter accepts free text.** A file's contents, its name, size, dimensions or format, JSON contents, a generated password, a tool result, or an error message has no field it could be sent in — an error reports its category, never what it said. An event carrying anything unrecognised is discarded whole rather than sent in part, and a value read from a visitor's file cannot become one of these names.

The request form accepts one value through a URL **query parameter**: a row in the not-built block on `/tools/` links to `/request-a-gizlet/` with a `gizlet` parameter naming a planned Gizlet's slug. That value never leaves the visitor's browser. The page is prerendered, so the parameter is read by browser-side code rather than sent anywhere to be resolved, and Cloudflare Web Analytics does not log URL query strings, so it is not collected either. It is also resolved against the tool registry and discarded if it names nothing, so the only thing it can prefill is a Gizlet Gizlet already lists. See [request-form.md](request-form.md).

A Gizlet Flow can be shared as a recipe link, and those settings travel in the URL **fragment** rather than the query string. A fragment is never transmitted to a server at all, which is a stronger guarantee than a query string that is sent and merely not logged. A recipe carries whitelisted setting keys only — step order, pixel dimensions, a quality number, and an output format — and there is no key that could carry file content, a filename, or a URL. The whitelist is enforced in `src/data/recipes.ts`, and an unrecognised key makes the whole link unreadable rather than partly applied. One consequence, recorded rather than discovered later: because the fragment never reaches a server, recipe-link shares cannot be counted at all. See [signals.md](signals.md).

Cloudflare's proxy adds more to a page load than the analytics beacon. The browser also fetches Cloudflare's bot-detection script from `/cdn-cgi/challenge-platform/` and posts its result, next to the `/cdn-cgi/rum` request that carries the Web Analytics measurement. These are zone-level Cloudflare features rather than Gizlet code, and they do not respond to tool activity: loading a 325 KB image into a Gizlet and compressing it leaves their payloads the same size as a page load with no file at all. No Gizlet input reaches them.

Cloudflare Web Analytics does not support custom events, so nothing above reaches it. Per-Gizlet usage is visible there because every Gizlet is its own route, such as `/tools/compress-image/`; completion and error rates are not. Cloudflare retention is limited to roughly 30 days.

For Cloudflare's handling of this data, see its [privacy policy](https://www.cloudflare.com/privacypolicy/) and the [Web Analytics documentation](https://developers.cloudflare.com/web-analytics/).

For what these limits mean when planning — which signals a Gizlet feature may rely on, and which it may not — see [signals.md](signals.md).

## Google Analytics 4

Google Analytics is **off unless a production build turns it on**, is never enabled in development, and treats a malformed measurement ID exactly like being disabled. A default build contains no Google tag, no measurement identifier, and no consent banner.

When it is configured, nothing is requested from Google until the visitor allows analytics. This is Google's *basic* consent mode rather than its advanced mode: a refusing visitor produces **no request at all**, not a cookieless one. Consent Mode defaults are declared in the document head before any tag can load, denying `ad_storage`, `ad_personalization`, `ad_user_data`, and `analytics_storage`. Granting analytics grants `analytics_storage` alone; the three advertising keys stay denied whatever the visitor chose.

Google Analytics advertising features are turned off in the tag configuration — `allow_google_signals` and `allow_ad_personalization_signals` are both `false` — so the data is not used to build advertising audiences.

Google Analytics uses cookies. That is the whole reason the consent banner exists, and it is the one place Gizlet's measurement is not cookieless.

### What this costs, recorded rather than glossed

Two consequences follow, and neither should be argued away later:

- **A refusing visitor is not counted at all**, and is unlikely to be a random sample. Google Analytics totals are therefore not a measure of Gizlet's traffic; Cloudflare's are.
- The privacy claim changed shape when this shipped. It used to hold because no mechanism existed. It now holds because a mechanism exists and is constrained by a whitelist and its tests. See [analytics-contract.md](analytics-contract.md), which records that trade and the decisions behind it.

## Analytics consent

A visitor who has not answered is treated exactly as one who refused. The banner asks once, stores the answer in the browser under `gizlet-consent`, and does not ask again unless the choices themselves change. A stored answer that Gizlet did not write — an unrecognised key, a missing key, an unreadable timestamp, or a choice recorded against a different set of questions — is discarded whole, and the visitor is asked again rather than held to it.

The answer is stored in the visitor's own browser and is never sent anywhere. Clearing site data for gizlet.app clears it, and the banner asks again.

## Configuration

Google Analytics is configured by two build-time public variables, absent by default:

```sh
PUBLIC_ANALYTICS_ENABLED=false
PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

Both must be set for measurement to exist at all, and they must be set as **build** variables in Cloudflare Workers Builds rather than as the Worker's runtime variables: the values are inlined into the static output at build time, so a runtime variable would be read by nothing. See [releasing.md](releasing.md).

Cloudflare Web Analytics needs nothing in the repository, and no `PUBLIC_*` variable gates it. It is enabled per zone in the Cloudflare dashboard:

1. Open the Cloudflare dashboard for the `gizlet.app` zone and go to **Analytics & Logs → Web Analytics**.
2. Keep the automatic setup for the proxied zone so Cloudflare injects `beacon.min.js` itself. Enabling the beacon manually would put a site token in this repository, which is why the automatic path is used.
3. Read the same dashboard section for reporting. Maintainers need Cloudflare access to the zone to see it; there is no public dashboard and no separate analytics account.

Automatic injection requires that responses stay rewritable at the edge. A response served with `Cache-Control: no-transform` is not modified, so the beacon would not be added and measurement would silently stop. Gizlet's pages are served without `no-transform`.

To confirm a deployment is measured, check that the beacon reaches the built page. The `Accept` header is required: Cloudflare only injects the beacon into responses it treats as an HTML navigation, so a request sending the `curl` default of `Accept: */*` gets an uninjected page and reports `0` even when measurement is working.

```sh
curl -s -H 'Accept: text/html' https://gizlet.app | grep -c 'static.cloudflareinsights.com/beacon.min.js'
```

The authoritative check is the Web Analytics dashboard itself: if it reports page views for gizlet.app, the site is measured regardless of what any single request returns.

The injected tag is absent from `pnpm run build` output and from a local preview, because it is added by Cloudflare in front of the deployed site rather than by the build.

## Advertising

Gizlet's first advertising provider is [Google AdSense](https://adsense.google.com/). Its responsive display units can serve the banner, inline, and desktop-rail placements already defined by the reusable `AdvertisementSlot` component. The integration emits no provider script, ad tags, or reserved ad space by default, in development, whenever its configuration is invalid, or on a page without an eligible configured placement. Individual placements also remain absent until their own ad-unit ID is configured and the page is eligible to display it.

The Gizlet integration sends AdSense only its public publisher ID and the public ID of the requested ad unit. It never places file contents, filenames, JSON, generated passwords, tool results, error messages, or other Gizlet payloads into ad tags. As with any third-party advertising service, enabling it allows the provider to process the page request and information necessary to serve and measure advertising; the production privacy and cookie notice must accurately describe that processing and the providers selected in AdSense.

### Consent management

For EEA, UK, and Swiss visitors, Gizlet uses the Google-certified CMP configured in AdSense Privacy & messaging. The selected message must offer accept, refuse, and manage-options choices before ads that require consent are served. It must explain the applicable advertising purposes, providers, and any cookie or local-storage use. The published privacy page describes the boundary: Gizlet tool inputs and outputs are never included in advertising or consent payloads.

Configuring or publishing a consent message in AdSense does not enable advertisements in the site. Ads remain disabled until the production environment sets `PUBLIC_ADS_ENABLED=true` and provides valid ad-unit IDs.

### Production enablement checklist

Do not set `PUBLIC_ADS_ENABLED=true` until all of the following are complete:

1. The Gizlet site is approved in the AdSense publisher account and responsive ad units have been created for the desired placements.
2. A legally reviewed privacy and cookie notice is published, including the advertising provider, relevant data uses, and a way for visitors to revisit their choices where required.
3. A Google-certified, IAB TCF-compatible consent management platform is configured for EEA, UK, and Swiss traffic before ads are served. Gizlet uses Google’s Privacy & messaging CMP with accept, refuse, and manage-options choices; any future alternative must remain on Google’s certified list and support the current TCF version.
4. The consent flow, configured ad-technology providers, and non-personalized/declined-consent behavior are reviewed in AdSense and tested in a production-like environment.
5. The site is checked at desktop and mobile sizes to confirm ads remain clearly labeled and separated from each Gizlet's input, primary action, and download controls.

Google requires a certified CMP integrated with the IAB Transparency and Consent Framework when AdSense ads are served to users in the EEA, UK, or Switzerland. See Google's [publisher consent requirements](https://support.google.com/adsense/answer/13554116) and [European regulations message guidance](https://support.google.com/adsense/answer/10961068) before enabling ads. This is an implementation checklist, not legal advice.

### Configuration

All values are build-time public configuration and are intentionally absent by default:

```sh
PUBLIC_ADS_ENABLED=false
PUBLIC_ADSENSE_CLIENT=ca-pub-1234567890123456
PUBLIC_ADSENSE_BANNER_SLOT=1234567890
PUBLIC_ADSENSE_INLINE_SLOT=2345678901
PUBLIC_ADSENSE_RAIL_SLOT=3456789012
```

Set `PUBLIC_ADS_ENABLED=true` only for a production build after completing the checklist. `PUBLIC_ADSENSE_CLIENT` must be an AdSense `ca-pub-…` identifier, and a placement only appears when its matching numeric slot ID is supplied. The same switch can keep ads disabled globally for development and future Gizlet Pro sessions.
