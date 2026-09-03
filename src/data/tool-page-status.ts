import type { ToolRegistryEntry, ToolSlug } from './tools';

export interface ToolProcessingStatus {
  readonly description: string;
  readonly isLocal: boolean;
  readonly label: 'Local processing' | 'Processing details';
}

/**
 * Creates truthful processing copy for a tool page.
 *
 * A caller may tailor the explanatory sentence, but whether the page claims
 * local processing always comes from the canonical tool registry.
 */
export function getToolProcessingStatus(
  tool: ToolRegistryEntry,
  description?: string,
): ToolProcessingStatus | undefined {
  if (tool.processesLocally) {
    return {
      label: 'Local processing',
      description: description ?? 'Your file stays on this device.',
      isLocal: true,
    };
  }

  if (description) {
    return {
      label: 'Processing details',
      description,
      isLocal: false,
    };
  }

  return undefined;
}

/**
 * Per-Gizlet processing sentences, for the Gizlets whose input is not a file
 * and would be described inaccurately by the default wording.
 */
const toolProcessingDescriptions: Partial<Record<ToolSlug, string>> = {
  'json-formatter': 'Your JSON stays on this device.',
};

/** The tailored processing sentence for a Gizlet, where it has one. */
export function getToolProcessingDescription(slug: ToolSlug): string | undefined {
  return toolProcessingDescriptions[slug];
}
