# Privacy, analytics, and advertising

Gizlet uses [Plausible Analytics](https://plausible.io/) for aggregate usage measurement when analytics is explicitly enabled for a production build. Plausible was selected because its standard tracker is lightweight, does not use cookies, and is designed for aggregate rather than user-level analytics.

## What Gizlet sends

When enabled, the Plausible tracker records page views and the following centrally-defined custom events:

| Event | When it is sent | Custom data sent by Gizlet |
| --- | --- | --- |
| `pageview` | A page loads | None |
| `tool_opened` | A typed-registry Gizlet page opens | The static Gizlet slug, such as `compress-image` |
| `tool_action_completed` | A Gizlet produces a result | The static Gizlet slug |
| `tool_error` | A Gizlet shows an error | The static Gizlet slug |

Gizlet does **not** send file contents, filenames, file sizes, dimensions, formats, JSON contents, generated passwords, result URLs, error messages, or any other entered/generated tool payload in analytics events. The event API only accepts a known registry slug, so arbitrary tool values cannot be sent through it.

Plausible receives the page URL, referrer, browser, operating system, device type, and country for aggregate reporting. Its standard tracker strips URL query parameters except marketing parameters (`ref`, `source`, and `utm_*`). Gizlet does not enable Plausible’s optional outbound-link, file-download, form-submission, custom-property, session-recording, or heatmap measurements.

For details of Plausible’s visitor-data handling, see its [data policy](https://plausible.io/data-policy) and [privacy policy](https://plausible.io/privacy).

## Configuration

Analytics is disabled by default and always disabled while Astro is running in development mode. To enable it for a production build, set both variables from [.env.example](../.env.example):

```sh
PUBLIC_ANALYTICS_ENABLED=true
PUBLIC_PLAUSIBLE_DOMAIN=gizlet.app
```

Add `gizlet.app` as a site in Plausible and configure custom-event goals with these exact names: `tool_opened`, `tool_action_completed`, and `tool_error`. The analytics script is omitted entirely when either variable is absent or invalid.

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
