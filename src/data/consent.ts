/**
 * Visitor consent for analytics measurement.
 *
 * Nothing here reads storage or touches the DOM: this module decides, and
 * `src/scripts/consent.ts` does the reading, writing, and rendering. A stored
 * value that is not exactly what this module wrote is discarded whole rather
 * than read in part — the rule `recipes.ts` already applies to a shared link —
 * so a truncated, corrupted, or hand-edited entry can only ever fail closed.
 */

export type ConsentDecision = 'granted' | 'denied';

/**
 * Bump when the choices offered change. A stored choice carrying any other
 * version is discarded, so the visitor is asked again rather than being held
 * to an answer they gave to a different question.
 */
export const consentVersion = 1;

export const consentStorageKey = 'gizlet-consent';

/** Dispatched on the document when a visitor answers, carrying the choice. */
export const consentChangeEventName = 'gizlet:consent';

export interface ConsentChoice {
  readonly version: number;
  readonly analytics: ConsentDecision;
  readonly decidedAt: string;
}

/** The Consent Mode v2 keys. Every one defaults to denied. */
export const consentSignalKeys = [
  'ad_storage',
  'ad_personalization',
  'ad_user_data',
  'analytics_storage',
] as const;

export type ConsentSignalKey = (typeof consentSignalKeys)[number];

export type ConsentSignals = Readonly<Record<ConsentSignalKey, ConsentDecision>>;

/**
 * What is signalled before a visitor has chosen, and what a refusal returns to.
 * This is also what a page sends when nothing is stored at all, so the
 * measured default is denial rather than the absence of a signal.
 */
export const deniedConsentSignals: ConsentSignals = {
  ad_storage: 'denied',
  ad_personalization: 'denied',
  ad_user_data: 'denied',
  analytics_storage: 'denied',
};

const consentChoiceKeys = ['version', 'analytics', 'decidedAt'] as const;

function isConsentDecision(value: unknown): value is ConsentDecision {
  return value === 'granted' || value === 'denied';
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

export function createConsentChoice(analytics: ConsentDecision, decidedAt: Date): ConsentChoice {
  return { version: consentVersion, analytics, decidedAt: decidedAt.toISOString() };
}

export function serialiseConsent(choice: ConsentChoice): string {
  return JSON.stringify(choice);
}

/**
 * Reads a stored choice, or returns undefined so the caller falls back to
 * denial. An unrecognised key rejects the whole record: a value this module
 * did not write is not a value it will act on.
 */
export function parseStoredConsent(value: string | null): ConsentChoice | undefined {
  if (value === null) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  const hasOnlyKnownKeys = Object.keys(record).every((key) =>
    (consentChoiceKeys as readonly string[]).includes(key),
  );

  if (!hasOnlyKnownKeys || Object.keys(record).length !== consentChoiceKeys.length) {
    return undefined;
  }

  if (record.version !== consentVersion) {
    return undefined;
  }

  if (!isConsentDecision(record.analytics) || !isTimestamp(record.decidedAt)) {
    return undefined;
  }

  return { version: consentVersion, analytics: record.analytics, decidedAt: record.decidedAt };
}

/**
 * The advertising keys stay denied whatever the visitor chose, because the
 * banner does not offer that choice and no advertisement is served. They are
 * signalled rather than omitted so enabling advertising later extends this
 * function instead of rebuilding the consent surface.
 */
export function getConsentSignals(choice: ConsentChoice | undefined): ConsentSignals {
  return choice?.analytics === 'granted'
    ? { ...deniedConsentSignals, analytics_storage: 'granted' }
    : deniedConsentSignals;
}

export function isAnalyticsGranted(choice: ConsentChoice | undefined): boolean {
  return choice?.analytics === 'granted';
}

/** The banner is asked for only when measurement is configured and unanswered. */
export function isConsentRequired(
  isAnalyticsConfigured: boolean,
  choice: ConsentChoice | undefined,
): boolean {
  return isAnalyticsConfigured && choice === undefined;
}
