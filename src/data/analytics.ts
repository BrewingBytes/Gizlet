/**
 * Event names shared by the layout and browser-side Gizlet modules.
 *
 * `pageview` is emitted automatically by Plausible. Custom events only ever
 * carry the static Gizlet slug defined in the registry.
 */
export const analyticsEvents = {
  pageView: 'pageview',
  toolOpened: 'tool_opened',
  toolActionCompleted: 'tool_action_completed',
  toolError: 'tool_error',
} as const;

export type AnalyticsCustomEventName =
  | typeof analyticsEvents.toolOpened
  | typeof analyticsEvents.toolActionCompleted
  | typeof analyticsEvents.toolError;

export const plausibleScriptUrl = 'https://plausible.io/js/script.js';

export interface AnalyticsEnvironment {
  readonly isDevelopment: boolean;
  readonly enabled: string | undefined;
  readonly plausibleDomain: string | undefined;
}

export interface AnalyticsConfiguration {
  readonly enabled: boolean;
  readonly plausibleDomain: string | undefined;
}

const plausibleDomainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Analytics is opt-in for production and permanently disabled during local
 * development, even when a local environment file happens to enable it.
 */
export function getAnalyticsConfiguration({
  isDevelopment,
  enabled,
  plausibleDomain,
}: AnalyticsEnvironment): AnalyticsConfiguration {
  const domain = plausibleDomain?.trim().toLowerCase();
  const isConfigured = !isDevelopment && enabled === 'true' && Boolean(domain && plausibleDomainPattern.test(domain));

  return {
    enabled: isConfigured,
    plausibleDomain: isConfigured ? domain : undefined,
  };
}
