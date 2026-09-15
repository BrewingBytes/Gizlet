/**
 * Google Analytics 4 configuration.
 *
 * Measurement is opt-in for production only, and a malformed or incomplete
 * configuration is treated exactly like measurement being disabled — the rule
 * `advertising.ts` already applies to ad slots. Nothing loads by default.
 *
 * The consent banner is the only consumer today: it has nothing to ask about
 * until measurement is configured. The measurement ID is validated here so the
 * tag that will read it cannot be handed a value this module would reject.
 */

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
