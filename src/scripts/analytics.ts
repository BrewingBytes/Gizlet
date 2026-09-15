import { analyticsConfigParameters, getAnalyticsTagUrl } from '../data/analytics';
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
