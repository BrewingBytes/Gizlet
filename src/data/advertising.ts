import type { AdvertisementSlotVariant } from './advertisement-slots';

export const adSenseScriptBaseUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

export interface AdvertisementEnvironment {
  isDevelopment: boolean;
  enabled?: string;
  adSenseClient?: string;
  bannerSlot?: string;
  inlineSlot?: string;
  railSlot?: string;
}

export interface AdvertisementConfiguration {
  readonly enabled: boolean;
  readonly adSenseClient?: string;
  readonly slots: Readonly<Partial<Record<AdvertisementSlotVariant, string>>>;
}

const adSenseClientPattern = /^ca-pub-\d{16}$/;
const adSenseSlotPattern = /^\d+$/;

function normaliseAdSenseClient(value: string | undefined): string | undefined {
  const client = value?.trim();
  return client && adSenseClientPattern.test(client) ? client : undefined;
}

function normaliseAdSenseSlot(value: string | undefined): string | undefined {
  const slot = value?.trim();
  return slot && adSenseSlotPattern.test(slot) ? slot : undefined;
}

/**
 * Ads are opt-in for production only. A malformed or incomplete provider
 * configuration is treated exactly like ads being disabled.
 */
export function getAdvertisementConfiguration({
  isDevelopment,
  enabled,
  adSenseClient,
  bannerSlot,
  inlineSlot,
  railSlot,
}: AdvertisementEnvironment): AdvertisementConfiguration {
  const client = normaliseAdSenseClient(adSenseClient);
  const slots = {
    banner: normaliseAdSenseSlot(bannerSlot),
    inline: normaliseAdSenseSlot(inlineSlot),
    rail: normaliseAdSenseSlot(railSlot),
  } satisfies Record<AdvertisementSlotVariant, string | undefined>;
  const configuredSlots = Object.fromEntries(
    Object.entries(slots).filter(([, slot]) => slot !== undefined),
  ) as Partial<Record<AdvertisementSlotVariant, string>>;
  const isEnabled = !isDevelopment && enabled === 'true' && client !== undefined
    && Object.keys(configuredSlots).length > 0;

  return isEnabled
    ? { enabled: true, adSenseClient: client, slots: configuredSlots }
    : { enabled: false, slots: {} };
}
