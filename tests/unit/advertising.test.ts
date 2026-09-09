import { describe, expect, it } from 'vitest';

import {
  adSensePublisherId,
  getAdsTxt,
  getAdvertisementConfiguration,
  getPageAdvertisementPolicy,
} from '../../src/data/advertising';

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

describe('getPageAdvertisementPolicy', () => {
  const configuration = getAdvertisementConfiguration(productionConfiguration);

  it('only permits the configured banner on the homepage', () => {
    expect(getPageAdvertisementPolicy({
      pathname: '/',
      configuration,
      requestedSlots: ['banner', 'inline'],
    })).toEqual({
      enabled: true,
      adSenseClient: 'ca-pub-1234567890123456',
      slots: { banner: '1234567890' },
    });
  });

  it('only permits configured requested placements on available Gizlet pages', () => {
    expect(getPageAdvertisementPolicy({
      pathname: '/tools/compress-image/',
      configuration,
      isAvailableTool: true,
      requestedSlots: ['inline', 'rail'],
    })).toEqual({
      enabled: true,
      adSenseClient: 'ca-pub-1234567890123456',
      slots: { inline: '2345678901', rail: '3456789012' },
    });
  });

  it('fails closed for excluded routes, planned Gizlets, and pages without applicable slots', () => {
    for (const pathname of [
      '/privacy/',
      '/terms/',
      '/about/',
      '/roadmap/',
      '/404.html',
      '/request-a-gizlet/',
    ]) {
      expect(getPageAdvertisementPolicy({
        pathname,
        configuration,
        requestedSlots: ['banner', 'inline', 'rail'],
      })).toEqual({ enabled: false, slots: {} });
    }

    expect(getPageAdvertisementPolicy({
      pathname: '/tools/remove-background/',
      configuration,
      requestedSlots: ['inline', 'rail'],
    })).toEqual({ enabled: false, slots: {} });
    expect(getPageAdvertisementPolicy({
      pathname: '/',
      configuration,
      requestedSlots: ['inline'],
    })).toEqual({ enabled: false, slots: {} });
  });
});

describe('getAdsTxt', () => {
  it('authorises the declared AdSense account to sell this inventory', () => {
    expect(getAdsTxt()).toBe(
      'google.com, pub-5739296020070844, DIRECT, f08c47fec0942fa0\n',
    );
  });

  it('uses the same publisher account as the site verification tag', () => {
    expect(getAdsTxt()).toContain(adSensePublisherId.replace(/^ca-/, ''));
  });
});
