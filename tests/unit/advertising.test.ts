import { describe, expect, it } from 'vitest';

import { getAdvertisementConfiguration } from '../../src/data/advertising';

const productionConfiguration = {
  isDevelopment: false,
  enabled: 'true',
  adSenseClient: 'ca-pub-1234567890123456',
  bannerSlot: '1234567890',
  inlineSlot: '2345678901',
  railSlot: '3456789012',
};

describe('getAdvertisementConfiguration', () => {
  it('enables only valid, explicitly configured AdSense placements in production', () => {
    expect(getAdvertisementConfiguration(productionConfiguration)).toEqual({
      enabled: true,
      adSenseClient: 'ca-pub-1234567890123456',
      slots: {
        banner: '1234567890',
        inline: '2345678901',
        rail: '3456789012',
      },
    });
  });

  it('allows a production rollout to configure only the placements it has created', () => {
    expect(
      getAdvertisementConfiguration({
        ...productionConfiguration,
        bannerSlot: undefined,
        railSlot: undefined,
      }),
    ).toEqual({
      enabled: true,
      adSenseClient: 'ca-pub-1234567890123456',
      slots: { inline: '2345678901' },
    });
  });

  it('disables ads in development, when switched off, and when credentials are invalid', () => {
    expect(
      getAdvertisementConfiguration({ ...productionConfiguration, isDevelopment: true }),
    ).toEqual({ enabled: false, slots: {} });
    expect(
      getAdvertisementConfiguration({ ...productionConfiguration, enabled: 'false' }),
    ).toEqual({ enabled: false, slots: {} });
    expect(
      getAdvertisementConfiguration({ ...productionConfiguration, adSenseClient: 'not-a-client' }),
    ).toEqual({ enabled: false, slots: {} });
    expect(
      getAdvertisementConfiguration({
        ...productionConfiguration,
        inlineSlot: 'not-a-slot',
        bannerSlot: undefined,
        railSlot: undefined,
      }),
    ).toEqual({ enabled: false, slots: {} });
  });
});
