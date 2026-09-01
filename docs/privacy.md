# Privacy and analytics

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
PUBLIC_PLAUSIBLE_DOMAIN=gizlet.com
```

Add `gizlet.com` as a site in Plausible and configure custom-event goals with these exact names: `tool_opened`, `tool_action_completed`, and `tool_error`. The analytics script is omitted entirely when either variable is absent or invalid.
