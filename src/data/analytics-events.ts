import { maximumRecipeSteps } from './recipes';
import { getAvailableTools } from './tools';

/**
 * The closed set of events Gizlet may report, and the closed set of values each
 * one may carry.
 *
 * Every value is an enum member, a bounded whole number, or a slug that resolves
 * in the tool registry. There is no parameter that accepts free text, so a
 * filename, a file size, a MIME type read from a visitor's file, clipboard
 * contents, a generated password, a tool result, or an error message has no
 * shape it could be sent in. The privacy contract is the shape of this module
 * rather than a promise about how it is called — the rule `recipes.ts` applies
 * to a shared link, applied to measurement.
 *
 * An unrecognised event, an unrecognised key, a missing key, or a value that
 * does not validate drops the whole event. Nothing is ever sent in part.
 */

export const analyticsOutputFormats = ['image', 'pdf', 'archive', 'text', 'data'] as const;

export type AnalyticsOutputFormat = (typeof analyticsOutputFormats)[number];

/**
 * Coarse on purpose. A category says what went wrong well enough to act on
 * without carrying anything about the file or the message that reported it.
 */
export const analyticsErrorCategories = [
  'unsupported-input',
  'input-too-large',
  'processing-failed',
  'feature-unavailable',
] as const;

export type AnalyticsErrorCategory = (typeof analyticsErrorCategories)[number];

export type AnalyticsParameterValue = string | number;

type ParameterValidator = (value: unknown) => boolean;

let availableToolSlugs: ReadonlySet<string> | undefined;

function isAvailableToolSlug(value: unknown): boolean {
  availableToolSlugs ??= new Set(getAvailableTools().map((tool) => tool.slug));

  return typeof value === 'string' && availableToolSlugs.has(value);
}

function isMemberOf(values: readonly string[]): ParameterValidator {
  return (value) => typeof value === 'string' && values.includes(value);
}

function isStepIndex(value: unknown): boolean {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value < maximumRecipeSteps;
}

const analyticsEventSpecifications = {
  /**
   * Redundant with the automatic page view, because every Gizlet is its own
   * route. Specified by the data contract and kept for that reason; prefer the
   * page view when answering a usage question.
   */
  tool_opened: { tool_slug: isAvailableToolSlug },
  tool_completed: { tool_slug: isAvailableToolSlug },
  tool_error: {
    tool_slug: isAvailableToolSlug,
    error_category: isMemberOf(analyticsErrorCategories),
  },
  tool_download: {
    tool_slug: isAvailableToolSlug,
    output_format: isMemberOf(analyticsOutputFormats),
  },
  flow_step: {
    from_slug: isAvailableToolSlug,
    to_slug: isAvailableToolSlug,
    step_index: isStepIndex,
  },
} as const satisfies Record<string, Record<string, ParameterValidator>>;

export type AnalyticsEventName = keyof typeof analyticsEventSpecifications;

export const analyticsEventNames = Object.keys(
  analyticsEventSpecifications,
) as readonly AnalyticsEventName[];

export interface AnalyticsEvent {
  readonly name: AnalyticsEventName;
  readonly parameters: Readonly<Record<string, AnalyticsParameterValue>>;
}

function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return Object.hasOwn(analyticsEventSpecifications, value);
}

/**
 * Returns the event to send, or undefined when any part of it fails. A caller
 * cannot send something this function did not build, so a mistake at a call
 * site loses a measurement rather than leaking a value.
 */
export function buildAnalyticsEvent(
  name: string,
  parameters: Readonly<Record<string, unknown>>,
): AnalyticsEvent | undefined {
  if (!isAnalyticsEventName(name)) {
    return undefined;
  }

  const specification: Record<string, ParameterValidator> = analyticsEventSpecifications[name];
  const expectedKeys = Object.keys(specification);
  const suppliedKeys = Object.keys(parameters);

  if (suppliedKeys.length !== expectedKeys.length) {
    return undefined;
  }

  const accepted: Record<string, AnalyticsParameterValue> = {};

  for (const key of expectedKeys) {
    if (!Object.hasOwn(parameters, key)) {
      return undefined;
    }

    const value = parameters[key];

    if (!specification[key]!(value)) {
      return undefined;
    }

    accepted[key] = value as AnalyticsParameterValue;
  }

  return { name, parameters: accepted };
}
