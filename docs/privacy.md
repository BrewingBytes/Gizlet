# Privacy, analytics, and advertising

Gizlet uses [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) for aggregate traffic and page-performance measurement. It was selected because it is free at any traffic level, needs no script or configuration in this repository, and is designed for aggregate rather than user-level reporting: Cloudflare states that it "does not use any client-side state, such as cookies or localStorage, to collect usage metrics" and does not fingerprint individuals.

## What Gizlet sends

Nothing. Gizlet ships no analytics module, no provider script tag, and no client event calls. Cloudflare injects its beacon at the edge for the proxied `gizlet.app` zone, so the only analytics data collected is what that beacon reports for a page load: the page path, referrer, browser, operating system, device type, country, and page-performance timings.

Because Gizlet defines no events, there is no code path that could put a file's contents, filename, size, dimensions, or format, JSON contents, a generated password, a tool result, or an error message into analytics. Cloudflare Web Analytics also does not log URL query strings, so a value that reached a URL could not be collected either.

Cloudflare's proxy adds more to a page load than the analytics beacon. The browser also fetches Cloudflare's bot-detection script from `/cdn-cgi/challenge-platform/` and posts its result, next to the `/cdn-cgi/rum` request that carries the Web Analytics measurement. These are zone-level Cloudflare features rather than Gizlet code, and they do not respond to tool activity: loading a 325 KB image into a Gizlet and compressing it leaves their payloads the same size as a page load with no file at all. No Gizlet input reaches them.

Cloudflare Web Analytics does not currently support custom events, so the previous `tool_opened`, `tool_action_completed`, and `tool_error` events are gone. Per-Gizlet usage is still visible because every Gizlet is its own route, such as `/tools/compress-image/`; completion and error rates are not. Retention is limited to roughly 30 days.

For Cloudflare's handling of this data, see its [privacy policy](https://www.cloudflare.com/privacypolicy/) and the [Web Analytics documentation](https://developers.cloudflare.com/web-analytics/).

For what these limits mean when planning — which signals a Gizlet feature may rely on, and which it may not — see [signals.md](signals.md).

## Configuration

There is nothing to configure in the repository, and no `PUBLIC_*` variable gates analytics. Cloudflare Web Analytics is enabled per zone in the Cloudflare dashboard:

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

Gizlet's first advertising provider is [Google AdSense](https://adsense.google.com/). Its responsive display units can serve the banner, inline, and desktop-rail placements already defined by the reusable `AdvertisementSlot` component. The integration emits no provider script, ad tags, or reserved ad space by default, in development, or whenever its configuration is invalid. Individual placements also remain absent until their own ad-unit ID is configured.

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
