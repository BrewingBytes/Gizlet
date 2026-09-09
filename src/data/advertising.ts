import type { AdvertisementSlotVariant } from './advertisement-slots';

export const adSenseScriptBaseUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

/**
 * The AdSense account that owns gizlet.app. It is a public identifier, and it is
 * declared here once so the site-verification tag and /ads.txt cannot disagree.
 */
export const adSensePublisherId = 'ca-pub-5739296020070844';

/** Google's fixed certification-authority ID for ads.txt entries. */
const googleCertificationAuthorityId = 'f08c47fec0942fa0';

/**
 * Authorises Gizlet's own AdSense account to sell this site's inventory.
 * AdSense reports the file as missing until it is served from the site root,
 * and it is required regardless of whether ads are currently enabled.
 */
export function getAdsTxt(): string {
  return `google.com, ${adSensePublisherId.replace(/^ca-/, '')}, DIRECT, ${googleCertificationAuthorityId}\n`;
}

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

/**
 * Advertising can be configured for the site without being appropriate for a
 * particular page. This policy is the only place that turns configured slots
 * into page-level delivery eligibility.
 */
export interface PageAdvertisementPolicy extends AdvertisementConfiguration {}

export interface PageAdvertisementPolicyRequest {
  readonly pathname: string;
  readonly configuration: AdvertisementConfiguration;
  readonly requestedSlots: readonly AdvertisementSlotVariant[];
  readonly isAvailableTool?: boolean;
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

/**
 * Returns the configured slots a page may actually deliver. Every route is
 * denied by default: the home page may use its banner, and an available Gizlet
 * page may use its inline and rail placements. Legal, roadmap, request, 404,
 * and planned-tool pages therefore cannot load the provider merely because
 * site-wide advertising is configured.
 */
export function getPageAdvertisementPolicy({
  pathname,
  configuration,
  requestedSlots,
  isAvailableTool = false,
}: PageAdvertisementPolicyRequest): PageAdvertisementPolicy {
  const permittedSlots = pathname === '/'
    ? new Set<AdvertisementSlotVariant>(['banner'])
    : isAvailableTool && pathname.startsWith('/tools/')
      ? new Set<AdvertisementSlotVariant>(['inline', 'rail'])
      : new Set<AdvertisementSlotVariant>();
  const slots = Object.fromEntries(
    requestedSlots
      .filter((variant) => permittedSlots.has(variant))
      .map((variant) => [variant, configuration.slots[variant]])
      .filter(([, slot]) => slot !== undefined),
  ) as Partial<Record<AdvertisementSlotVariant, string>>;
  const enabled = configuration.enabled
    && configuration.adSenseClient !== undefined
    && Object.keys(slots).length > 0;

  return enabled
    ? { enabled: true, adSenseClient: configuration.adSenseClient, slots }
    : { enabled: false, slots: {} };
}
