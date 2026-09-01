import { analyticsEvents, type AnalyticsCustomEventName } from '../data/analytics';
import { toolRegistry } from '../data/tools';

export interface AnalyticsTracker {
  (eventName: AnalyticsCustomEventName, options: { props: { tool: string } }): void;
}

declare global {
  interface Window {
    plausible?: AnalyticsTracker;
  }
}

const knownToolSlugs: ReadonlySet<string> = new Set(toolRegistry.map((tool) => tool.slug));

function getTracker(): AnalyticsTracker | undefined {
  return typeof window === 'undefined' ? undefined : window.plausible;
}

/**
 * Sends only a centrally-defined event and a static registry slug. Tool
 * contents, filenames, generated values, and error messages cannot enter the
 * analytics payload through this API.
 */
export function trackToolEvent(
  eventName: AnalyticsCustomEventName,
  toolSlug: string,
  tracker: AnalyticsTracker | undefined = getTracker(),
): boolean {
  if (!tracker || !knownToolSlugs.has(toolSlug)) {
    return false;
  }

  tracker(eventName, { props: { tool: toolSlug } });
  return true;
}

/** Tracks an open only for pages rendered from the typed Gizlet registry. */
export function initialiseAnalytics() {
  const toolSlug = document.querySelector<HTMLElement>('[data-analytics-tool]')?.dataset.analyticsTool;

  if (toolSlug) {
    trackToolEvent(analyticsEvents.toolOpened, toolSlug);
  }
}
