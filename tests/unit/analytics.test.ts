import { describe, expect, it } from 'vitest';

import { getAnalyticsConfiguration } from '../../src/data/analytics';

const measurementId = 'G-ABC1234567';

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
