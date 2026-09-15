import { describe, expect, it } from 'vitest';

import {
  analyticsConfigParameters,
  getAnalyticsConfiguration,
  getAnalyticsTagUrl,
  shouldLoadAnalytics,
} from '../../src/data/analytics';
import { createConsentChoice } from '../../src/data/consent';

const measurementId = 'G-ABC1234567';
const decidedAt = new Date('2026-09-15T10:00:00.000Z');

describe('getAnalyticsConfiguration', () => {
  it('enables measurement for a complete production configuration', () => {
    expect(
      getAnalyticsConfiguration({ isDevelopment: false, enabled: 'true', measurementId }),
    ).toEqual({ enabled: true, measurementId });
  });

  it('stays disabled in development however it is configured', () => {
    expect(
      getAnalyticsConfiguration({ isDevelopment: true, enabled: 'true', measurementId }),
    ).toEqual({ enabled: false });
  });

  it('treats an unset or non-affirmative switch as disabled', () => {
    expect(getAnalyticsConfiguration({ isDevelopment: false, measurementId })).toEqual({
      enabled: false,
    });
    expect(
      getAnalyticsConfiguration({ isDevelopment: false, enabled: 'false', measurementId }),
    ).toEqual({ enabled: false });
    expect(
      getAnalyticsConfiguration({ isDevelopment: false, enabled: 'TRUE', measurementId }),
    ).toEqual({ enabled: false });
  });

  it('treats a malformed measurement ID exactly like being disabled', () => {
    for (const value of ['', '   ', 'UA-12345-6', 'G-', 'G-abc1234567', 'ABC1234567', 'G ABC1234']) {
      expect(
        getAnalyticsConfiguration({ isDevelopment: false, enabled: 'true', measurementId: value }),
      ).toEqual({ enabled: false });
    }
  });

  it('accepts a measurement ID padded with whitespace', () => {
    expect(
      getAnalyticsConfiguration({
        isDevelopment: false,
        enabled: 'true',
        measurementId: `  ${measurementId}  `,
      }),
    ).toEqual({ enabled: true, measurementId });
  });

  it('never returns a measurement ID while disabled', () => {
    expect(
      getAnalyticsConfiguration({ isDevelopment: false, enabled: 'false', measurementId }),
    ).not.toHaveProperty('measurementId');
  });
});

describe('getAnalyticsTagUrl', () => {
  it('points at the Google tag for the measurement ID', () => {
    expect(getAnalyticsTagUrl(measurementId)).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
    );
  });

  it('encodes the identifier rather than interpolating it raw', () => {
    expect(getAnalyticsTagUrl('G-A&B')).toBe('https://www.googletagmanager.com/gtag/js?id=G-A%26B');
  });
});

describe('shouldLoadAnalytics', () => {
  const enabled = getAnalyticsConfiguration({ isDevelopment: false, enabled: 'true', measurementId });
  const disabled = getAnalyticsConfiguration({ isDevelopment: false, enabled: 'false', measurementId });

  it('requests the tag only once a visitor has granted analytics', () => {
    expect(shouldLoadAnalytics(enabled, createConsentChoice('granted', decidedAt))).toBe(true);
  });

  it('never requests the tag for a refusal or an unanswered visitor', () => {
    // Basic Consent Mode: a refusing visitor is not counted at all, so no
    // request is made rather than a cookieless one.
    expect(shouldLoadAnalytics(enabled, createConsentChoice('denied', decidedAt))).toBe(false);
    expect(shouldLoadAnalytics(enabled, undefined)).toBe(false);
  });

  it('never requests the tag when measurement is not configured, whatever was granted', () => {
    expect(shouldLoadAnalytics(disabled, createConsentChoice('granted', decidedAt))).toBe(false);
  });
});

describe('analyticsConfigParameters', () => {
  it('turns off the advertising features Gizlet is not allowed to use', () => {
    expect(analyticsConfigParameters).toEqual({
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  });
});
