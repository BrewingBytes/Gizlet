/**
 * Google Analytics 4 configuration.
 *
 * Measurement is opt-in for production only, and a malformed or incomplete
 * configuration is treated exactly like measurement being disabled — the rule
 * `advertising.ts` already applies to ad slots. Nothing loads by default.
 *
 * The measurement ID is validated here so the tag that reads it cannot be
 * handed a value this module would reject.
 */

import { isAnalyticsGranted, type ConsentChoice } from './consent';

export interface AnalyticsEnvironment {
  isDevelopment: boolean;
  enabled?: string;
  measurementId?: string;
}

export interface AnalyticsConfiguration {
  readonly enabled: boolean;
  readonly measurementId?: string;
}

const measurementIdPattern = /^G-[A-Z0-9]{4,}$/;

function normaliseMeasurementId(value: string | undefined): string | undefined {
  const measurementId = value?.trim();
  return measurementId && measurementIdPattern.test(measurementId) ? measurementId : undefined;
}

export function getAnalyticsConfiguration({
  isDevelopment,
  enabled,
  measurementId,
}: AnalyticsEnvironment): AnalyticsConfiguration {
  const id = normaliseMeasurementId(measurementId);
  const isEnabled = !isDevelopment && enabled === 'true' && id !== undefined;

  return isEnabled ? { enabled: true, measurementId: id } : { enabled: false };
}

export const analyticsTagBaseUrl = 'https://www.googletagmanager.com/gtag/js';

export function getAnalyticsTagUrl(measurementId: string): string {
  return `${analyticsTagBaseUrl}?id=${encodeURIComponent(measurementId)}`;
}

/**
 * Google Analytics is configured without its advertising features. Gizlet
 * serves no personalised advertising from this data, and the Consent Mode
 * advertising keys are denied whatever the visitor chose, so asking for the
 * signals as well would collect something nothing is allowed to use.
 */
export const analyticsConfigParameters = {
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;

/**
 * Basic Consent Mode: the tag is not requested at all until the visitor grants
 * analytics.
 *
 * Advanced Consent Mode would load it anyway and send cookieless pings on a
 * refusal, which would make a refusing visitor countable. `analytics-contract.md`
 * says a refusing visitor is not counted at all, so the request itself waits
 * rather than the cookie alone.
 */
export function shouldLoadAnalytics(
  configuration: AnalyticsConfiguration,
  choice: ConsentChoice | undefined,
): boolean {
  return configuration.enabled && isAnalyticsGranted(choice);
}
