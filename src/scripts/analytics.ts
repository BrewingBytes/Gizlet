import { analyticsConfigParameters, getAnalyticsTagUrl } from '../data/analytics';
import { buildAnalyticsEvent } from '../data/analytics-events';
import {
  consentChangeEventName,
  consentStorageKey,
  isAnalyticsGranted,
  parseStoredConsent,
  type ConsentChoice,
} from '../data/consent';

/** The measurement ID is absent unless the build configured it, which is the off switch. */
const measurementIdAttribute = 'gaMeasurementId';

let isTagRequested = false;

/**
 * The first request to Google happens here and nowhere earlier. Until a visitor
 * grants analytics, no `googletagmanager.com` request is made at all.
 */
function requestTag(measurementId: string): void {
  if (isTagRequested) {
    return;
  }

  isTagRequested = true;

  const tag = document.createElement('script');

  tag.async = true;
  tag.src = getAnalyticsTagUrl(measurementId);
  document.head.append(tag);

  window.gtag?.('js', new Date());
  window.gtag?.('config', measurementId, analyticsConfigParameters);
}

function readStoredChoice(): ConsentChoice | undefined {
  try {
    return parseStoredConsent(window.localStorage.getItem(consentStorageKey));
  } catch {
    return undefined;
  }
}

export function initialiseAnalytics(): void {
  const measurementId = document.body.dataset[measurementIdAttribute];

  if (!measurementId) {
    return;
  }

  if (isAnalyticsGranted(readStoredChoice())) {
    requestTag(measurementId);
  }

  // A visitor answering now is the other way in; a refusal never reaches here.
  document.addEventListener(consentChangeEventName, (event) => {
    const choice = (event as CustomEvent<ConsentChoice>).detail;

    if (isAnalyticsGranted(choice)) {
      requestTag(measurementId);
    }
  });
}

/**
 * Reports one whitelisted event, or nothing.
 *
 * Consent is re-read here rather than trusted from module state, so a call from
 * any bundle on the page is checked against the visitor's actual answer. An
 * event the whitelist rejects is dropped whole and silently: a mistake at a call
 * site costs a measurement, never a disclosure.
 */
export function sendAnalyticsEvent(
  name: string,
  parameters: Readonly<Record<string, unknown>>,
): void {
  if (!isAnalyticsGranted(readStoredChoice())) {
    return;
  }

  const event = buildAnalyticsEvent(name, parameters);

  if (!event) {
    return;
  }

  window.gtag?.('event', event.name, event.parameters);
}
