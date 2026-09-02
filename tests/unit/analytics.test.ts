import { describe, expect, it, vi } from 'vitest';

import { analyticsEvents, getAnalyticsConfiguration } from '../../src/data/analytics';
import { trackToolEvent, type AnalyticsTracker } from '../../src/scripts/analytics';

describe('getAnalyticsConfiguration', () => {
  it('enables Plausible only for an explicitly configured production build', () => {
    expect(
      getAnalyticsConfiguration({
        isDevelopment: false,
        enabled: 'true',
        plausibleDomain: 'GIZLET.APP ',
      }),
    ).toEqual({ enabled: true, plausibleDomain: 'gizlet.app' });
  });

  it('always disables analytics in development and when configuration is incomplete', () => {
    expect(
      getAnalyticsConfiguration({ isDevelopment: true, enabled: 'true', plausibleDomain: 'gizlet.app' }),
    ).toEqual({ enabled: false, plausibleDomain: undefined });
    expect(
      getAnalyticsConfiguration({ isDevelopment: false, enabled: 'true', plausibleDomain: undefined }),
    ).toEqual({ enabled: false, plausibleDomain: undefined });
    expect(
      getAnalyticsConfiguration({ isDevelopment: false, enabled: 'false', plausibleDomain: 'gizlet.app' }),
    ).toEqual({ enabled: false, plausibleDomain: undefined });
  });
});

describe('trackToolEvent', () => {
  it('sends a custom event with only a static registry slug', () => {
    const tracker = vi.fn<AnalyticsTracker>();

    expect(trackToolEvent(analyticsEvents.toolActionCompleted, 'compress-image', tracker)).toBe(true);
    expect(tracker).toHaveBeenCalledWith(analyticsEvents.toolActionCompleted, {
      props: { tool: 'compress-image' },
    });
  });

  it('refuses unknown tool values and does nothing without an enabled tracker', () => {
    const tracker = vi.fn<AnalyticsTracker>();

    expect(trackToolEvent(analyticsEvents.toolError, 'private-file-name.png', tracker)).toBe(false);
    expect(trackToolEvent(analyticsEvents.toolError, 'compress-image', undefined)).toBe(false);
    expect(tracker).not.toHaveBeenCalled();
  });
});
