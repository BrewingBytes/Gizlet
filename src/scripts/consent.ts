import {
  consentStorageKey,
  createConsentChoice,
  getConsentSignals,
  parseStoredConsent,
  serialiseConsent,
  type ConsentChoice,
  type ConsentDecision,
} from '../data/consent';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readStoredConsent(): ConsentChoice | undefined {
  try {
    return parseStoredConsent(window.localStorage.getItem(consentStorageKey));
  } catch {
    // Denial is the fallback, so an unreadable store asks again rather than assuming.
    return undefined;
  }
}

function storeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(consentStorageKey, serialiseConsent(choice));
  } catch {
    // The choice still applies to this page; it is only the memory of it that is lost.
  }
}

/**
 * The defaults are declared inline in the document head so they are in place
 * before any tag loads. This only ever narrows or widens them afterwards.
 */
function applyConsent(choice: ConsentChoice | undefined): void {
  window.gtag?.('consent', 'update', getConsentSignals(choice));
}

export function initialiseConsentBanner(): void {
  const banner = document.querySelector<HTMLElement>('[data-consent-banner]');

  if (!banner) {
    return;
  }

  const stored = readStoredConsent();

  if (stored) {
    applyConsent(stored);
    return;
  }

  const decide = (analytics: ConsentDecision): void => {
    const choice = createConsentChoice(analytics, new Date());

    storeConsent(choice);
    applyConsent(choice);
    banner.hidden = true;
    // The dismissed button was holding focus, so hand it somewhere real.
    document.querySelector<HTMLElement>('#main-content')?.focus();
  };

  banner.querySelectorAll<HTMLButtonElement>('[data-consent-choice]').forEach((button) => {
    const analytics = button.dataset.consentChoice;

    if (analytics === 'granted' || analytics === 'denied') {
      button.addEventListener('click', () => decide(analytics));
    }
  });

  banner.hidden = false;
}
