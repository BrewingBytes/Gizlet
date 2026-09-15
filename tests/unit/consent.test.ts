import { describe, expect, it } from 'vitest';

import {
  consentStorageKey,
  consentVersion,
  createConsentChoice,
  deniedConsentSignals,
  getConsentSignals,
  isAnalyticsGranted,
  isConsentRequired,
  parseStoredConsent,
  serialiseConsent,
  type ConsentChoice,
} from '../../src/data/consent';

const decidedAt = new Date('2026-09-15T10:00:00.000Z');
const granted: ConsentChoice = createConsentChoice('granted', decidedAt);
const denied: ConsentChoice = createConsentChoice('denied', decidedAt);

describe('createConsentChoice', () => {
  it('stamps the current version and an ISO timestamp', () => {
    expect(granted).toEqual({
      version: consentVersion,
      analytics: 'granted',
      decidedAt: '2026-09-15T10:00:00.000Z',
    });
  });
});

describe('parseStoredConsent', () => {
  it('reads back exactly what it wrote', () => {
    expect(parseStoredConsent(serialiseConsent(granted))).toEqual(granted);
    expect(parseStoredConsent(serialiseConsent(denied))).toEqual(denied);
  });

  it('falls back to undefined rather than reading part of a record', () => {
    expect(parseStoredConsent(null)).toBeUndefined();
    expect(parseStoredConsent('')).toBeUndefined();
    expect(parseStoredConsent('not json')).toBeUndefined();
    expect(parseStoredConsent('null')).toBeUndefined();
    expect(parseStoredConsent('"granted"')).toBeUndefined();
    expect(parseStoredConsent('[]')).toBeUndefined();
    expect(parseStoredConsent(JSON.stringify([granted]))).toBeUndefined();
  });

  it('rejects a record carrying a key it did not write', () => {
    // An unrecognised key means something else wrote this; none of it is trusted.
    expect(parseStoredConsent(JSON.stringify({ ...granted, advertising: 'granted' }))).toBeUndefined();
  });

  it('rejects a record missing a key', () => {
    expect(parseStoredConsent(JSON.stringify({ version: consentVersion, analytics: 'granted' }))).toBeUndefined();
    expect(parseStoredConsent(JSON.stringify({ analytics: 'granted', decidedAt: decidedAt.toISOString() }))).toBeUndefined();
  });

  it('rejects a choice made against a different set of questions', () => {
    expect(parseStoredConsent(JSON.stringify({ ...granted, version: consentVersion + 1 }))).toBeUndefined();
    expect(parseStoredConsent(JSON.stringify({ ...granted, version: String(consentVersion) }))).toBeUndefined();
  });

  it('rejects a decision that is not one of the two answers', () => {
    expect(parseStoredConsent(JSON.stringify({ ...granted, analytics: 'yes' }))).toBeUndefined();
    expect(parseStoredConsent(JSON.stringify({ ...granted, analytics: true }))).toBeUndefined();
    expect(parseStoredConsent(JSON.stringify({ ...granted, analytics: null }))).toBeUndefined();
  });

  it('rejects a timestamp that is not a readable date', () => {
    expect(parseStoredConsent(JSON.stringify({ ...granted, decidedAt: '' }))).toBeUndefined();
    expect(parseStoredConsent(JSON.stringify({ ...granted, decidedAt: 'whenever' }))).toBeUndefined();
    expect(parseStoredConsent(JSON.stringify({ ...granted, decidedAt: decidedAt.getTime() }))).toBeUndefined();
  });
});

describe('getConsentSignals', () => {
  it('denies everything until a visitor grants analytics', () => {
    expect(getConsentSignals(undefined)).toEqual(deniedConsentSignals);
    expect(getConsentSignals(denied)).toEqual(deniedConsentSignals);
  });

  it('grants analytics storage alone, never an advertising key', () => {
    expect(getConsentSignals(granted)).toEqual({
      ad_storage: 'denied',
      ad_personalization: 'denied',
      ad_user_data: 'denied',
      analytics_storage: 'granted',
    });
  });

  it('signals every Consent Mode key rather than omitting the denied ones', () => {
    expect(Object.keys(getConsentSignals(granted)).sort()).toEqual([
      'ad_personalization',
      'ad_storage',
      'ad_user_data',
      'analytics_storage',
    ]);
  });
});

describe('isAnalyticsGranted', () => {
  it('treats an absent choice as a refusal', () => {
    expect(isAnalyticsGranted(undefined)).toBe(false);
    expect(isAnalyticsGranted(denied)).toBe(false);
    expect(isAnalyticsGranted(granted)).toBe(true);
  });
});

describe('isConsentRequired', () => {
  it('asks only when measurement is configured and unanswered', () => {
    expect(isConsentRequired(true, undefined)).toBe(true);
    expect(isConsentRequired(true, granted)).toBe(false);
    expect(isConsentRequired(true, denied)).toBe(false);
  });

  it('never asks when there is nothing configured to consent to', () => {
    expect(isConsentRequired(false, undefined)).toBe(false);
    expect(isConsentRequired(false, granted)).toBe(false);
  });
});

describe('consentStorageKey', () => {
  it('is namespaced to Gizlet so it cannot collide with the theme entry', () => {
    expect(consentStorageKey).toBe('gizlet-consent');
  });
});
