import type { ImageInputFormat, ImageOutputFormat } from './image-compression';
import { toolRegistry, type ToolRegistryEntry } from './tools';

/** A data shape that can be passed from one Gizlet operation to another. */
export type FlowPayloadContract =
  | {
      readonly kind: 'image-file';
      readonly acceptedFormats: readonly ImageInputFormat[];
      readonly producedFormats?: readonly ImageOutputFormat[];
    }
  | { readonly kind: 'json-text' }
  | { readonly kind: 'json-ld-form' };

/**
 * This is an executable compatibility contract, deliberately independent from
 * the editorial related-Gizlet recommendations used on tool pages.
 */
export interface ToolFlowDefinition {
  readonly toolSlug: ToolRegistryEntry['slug'];
  readonly input: FlowPayloadContract;
  readonly output: FlowPayloadContract;
  readonly nextToolSlugs: readonly ToolRegistryEntry['slug'][];
}

const imageInput: FlowPayloadContract = {
  kind: 'image-file',
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'],
};

const imageOutput: FlowPayloadContract = {
  kind: 'image-file',
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  producedFormats: ['image/jpeg', 'image/png', 'image/webp'],
};

export const toolFlowRegistry = [
  {
    toolSlug: 'compress-image',
    input: imageInput,
    output: imageOutput,
    nextToolSlugs: ['convert-image', 'resize-image', 'compress-image'],
  },
  {
    toolSlug: 'resize-image',
    input: imageInput,
    output: imageOutput,
    nextToolSlugs: ['convert-image', 'resize-image', 'compress-image'],
  },
  {
    toolSlug: 'convert-image',
    input: imageInput,
    output: imageOutput,
    nextToolSlugs: ['convert-image', 'resize-image', 'compress-image'],
  },
  {
    toolSlug: 'json-ld-generator',
    input: { kind: 'json-ld-form' },
    output: { kind: 'json-text' },
    nextToolSlugs: ['json-formatter'],
  },
  {
    toolSlug: 'json-formatter',
    input: { kind: 'json-text' },
    output: { kind: 'json-text' },
    nextToolSlugs: ['json-formatter'],
  },
] as const satisfies readonly ToolFlowDefinition[];

export function getFlowTool(toolSlug: ToolRegistryEntry['slug']): ToolFlowDefinition {
  const tool = toolFlowRegistry.find((candidate) => candidate.toolSlug === toolSlug);
  if (!tool) throw new Error(`Missing flow contract for Gizlet: ${toolSlug}`);
  return tool;
}

export function getFlowToolsForInput(input: FlowPayloadContract): readonly ToolFlowDefinition[] {
  return toolFlowRegistry.filter((tool) => tool.input.kind === input.kind);
}

export function getNextFlowTools(toolSlug: ToolRegistryEntry['slug']): readonly ToolFlowDefinition[] {
  return getFlowTool(toolSlug).nextToolSlugs.map(getFlowTool);
}

export function canFlowTo(fromToolSlug: ToolRegistryEntry['slug'], toToolSlug: ToolRegistryEntry['slug']): boolean {
  return getFlowTool(fromToolSlug).nextToolSlugs.includes(toToolSlug);
}

/** Validates an ordered pipeline against its initial payload and each hand-off. */
export function isValidFlowSequence(
  input: FlowPayloadContract,
  toolSlugs: readonly ToolRegistryEntry['slug'][],
): boolean {
  if (toolSlugs.length === 0) return true;
  if (getFlowTool(toolSlugs[0]).input.kind !== input.kind) return false;

  return toolSlugs.every((toolSlug, index) => index === 0 || canFlowTo(toolSlugs[index - 1], toolSlug));
}

/** Returns whether moving a block would leave every hand-off valid. */
export function canReorderFlowStep(
  input: FlowPayloadContract,
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  fromIndex: number,
  toIndex: number,
): boolean {
  if (
    fromIndex < 0 || fromIndex >= toolSlugs.length ||
    toIndex < 0 || toIndex >= toolSlugs.length
  ) {
    return false;
  }

  const reordered = [...toolSlugs];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return isValidFlowSequence(input, reordered);
}

/** Guards against catalog additions that forget to declare their executable contract. */
export function hasCompleteFlowContracts(): boolean {
  return toolRegistry.every((tool) => toolFlowRegistry.some((flowTool) => flowTool.toolSlug === tool.slug));
}
