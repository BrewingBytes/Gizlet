import type { ImageInputFormat, ImageOutputFormat } from './image-compression';
import { getAvailableTools, toolRegistry, type AvailableToolSlug, type ToolRegistryEntry } from './tools';

/** A data shape that can be passed from one Gizlet operation to another. */
export type FlowPayloadContract =
  | {
      readonly kind: 'image-file';
      readonly acceptedFormats: readonly ImageInputFormat[];
      readonly producedFormats?: readonly ImageOutputFormat[];
    }
  | { readonly kind: 'json-text' }
  | { readonly kind: 'json-ld-form' }
  | { readonly kind: 'pdf-file' };

export type FlowPayloadKind = FlowPayloadContract['kind'];

/**
 * This is an executable compatibility contract, deliberately independent from
 * the editorial related-Gizlet recommendations used on tool pages.
 *
 * Compatibility is not listed anywhere: a block may follow another when the
 * earlier one's `output.kind` is the later one's `input.kind`. Declare a Gizlet
 * that reads a PDF and it becomes available after Image to PDF; declare one that
 * turns a PDF back into images and the image Gizlets become available after
 * that, with no edit to the graph. A hand-written adjacency list would only
 * restate these kinds and could then disagree with them.
 */
export interface ToolFlowDefinition {
  readonly toolSlug: ToolRegistryEntry['slug'];
  readonly input: FlowPayloadContract;
  readonly output: FlowPayloadContract;
  /**
   * A many-to-one step: it makes a single payload out of everything handed to
   * it, so a chain containing one takes several starting payloads.
   */
  readonly combinesInputs?: boolean;
}

/** The payload an image flow starts from. Exported so no UI restates it. */
export const imageFlowInput = {
  kind: 'image-file',
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'],
} as const satisfies FlowPayloadContract;

const imageOutput = {
  kind: 'image-file',
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  producedFormats: ['image/jpeg', 'image/png', 'image/webp'],
} as const satisfies FlowPayloadContract;

const pdfPayload = { kind: 'pdf-file' } as const satisfies FlowPayloadContract;

const jsonText = { kind: 'json-text' } as const satisfies FlowPayloadContract;

const jsonLdForm = { kind: 'json-ld-form' } as const satisfies FlowPayloadContract;

/** Kept in tool-registry order, which is the order the step dropdown offers. */
export const toolFlowRegistry = [
  {
    toolSlug: 'compress-image',
    input: imageFlowInput,
    output: imageOutput,
  },
  {
    toolSlug: 'resize-image',
    input: imageFlowInput,
    output: imageOutput,
  },
  {
    toolSlug: 'convert-image',
    input: imageFlowInput,
    output: imageOutput,
  },
  {
    toolSlug: 'json-ld-generator',
    input: jsonLdForm,
    output: jsonText,
  },
  {
    toolSlug: 'json-formatter',
    input: jsonText,
    output: jsonText,
  },
  {
    toolSlug: 'jpg-to-pdf',
    input: imageFlowInput,
    output: pdfPayload,
    combinesInputs: true,
  },
] as const satisfies readonly ToolFlowDefinition[];

/**
 * Gizlets that deliberately have no flow contract, because they read and write
 * nothing another Gizlet can use.
 *
 * A Gizlet that only shows the visitor something is not a pipeline step: no
 * flow needs an Image Viewer block to see an image, and a result panel that
 * previews its own output leaves such a block with nothing to do. Saying so
 * here is the honest alternative to giving one a pass-through contract it does
 * not have, and it keeps `hasCompleteFlowContracts` a real guard against a
 * Gizlet that simply forgot to declare itself.
 */
export const flowlessToolSlugs = [
  'pdf-viewer',
] as const satisfies readonly ToolRegistryEntry['slug'][];

/** The registry's own entries, with their payload kinds preserved. */
export type FlowDefinition = (typeof toolFlowRegistry)[number];

/** Every slug that declares a flow contract. */
export type FlowToolSlug = FlowDefinition['toolSlug'];

/**
 * The payload kinds an image-started flow can carry. This is a list of shapes
 * rather than of Gizlets: a new Gizlet joins the image lineage by declaring one
 * of these kinds, without being named here.
 */
export const imageFlowPayloadKinds = ['image-file', 'pdf-file'] as const;

export type ImageFlowPayloadKind = (typeof imageFlowPayloadKinds)[number];

/** Everything the image flow builder can put in a chain. */
export type ImageFlowToolSlug = Extract<
  FlowDefinition,
  { readonly input: { readonly kind: ImageFlowPayloadKind } }
>['toolSlug'];

/** The chainable slugs, in registry order, derived rather than listed. */
function getImageFlowToolSlugs(): readonly ImageFlowToolSlug[] {
  return toolFlowRegistry
    .filter((tool): tool is Extract<FlowDefinition, { readonly input: { readonly kind: ImageFlowPayloadKind } }> =>
      imageFlowPayloadKinds.includes(tool.input.kind as ImageFlowPayloadKind),
    )
    .map((tool) => tool.toolSlug);
}

/**
 * Chainable and published: what the builder may actually offer. A planned
 * Gizlet can declare its contract early without appearing in a flow.
 */
export type AvailableImageFlowToolSlug = ImageFlowToolSlug & AvailableToolSlug;

export function getAvailableImageFlowToolSlugs(): readonly AvailableImageFlowToolSlug[] {
  const published = new Set<string>(getAvailableTools().map((tool) => tool.slug));

  return getImageFlowToolSlugs().filter(
    (slug): slug is AvailableImageFlowToolSlug => published.has(slug),
  );
}

export function isAvailableImageFlowToolSlug(
  value: string,
): value is AvailableImageFlowToolSlug {
  return getAvailableImageFlowToolSlugs().includes(value as AvailableImageFlowToolSlug);
}

type Definitions = readonly ToolFlowDefinition[];

export function getFlowTool(
  toolSlug: ToolRegistryEntry['slug'],
  definitions: Definitions = toolFlowRegistry,
): ToolFlowDefinition {
  const tool = definitions.find((candidate) => candidate.toolSlug === toolSlug);
  if (!tool) throw new Error(`Missing flow contract for Gizlet: ${toolSlug}`);
  return tool;
}

/** Every Gizlet that accepts this payload, in registry order. */
export function getFlowToolsForInput(
  input: FlowPayloadContract | FlowPayloadKind,
  definitions: Definitions = toolFlowRegistry,
): readonly ToolFlowDefinition[] {
  const kind = typeof input === 'string' ? input : input.kind;

  return definitions.filter((tool) => tool.input.kind === kind);
}

/**
 * Every Gizlet that can follow this one, derived from what it produces. An
 * empty result means nothing reads that payload yet, not that the payload was
 * declared a dead end.
 */
export function getNextFlowTools(
  toolSlug: ToolRegistryEntry['slug'],
  definitions: Definitions = toolFlowRegistry,
): readonly ToolFlowDefinition[] {
  return getFlowToolsForInput(getFlowTool(toolSlug, definitions).output, definitions);
}

export function canFlowTo(
  fromToolSlug: ToolRegistryEntry['slug'],
  toToolSlug: ToolRegistryEntry['slug'],
  definitions: Definitions = toolFlowRegistry,
): boolean {
  return (
    getFlowTool(fromToolSlug, definitions).output.kind ===
    getFlowTool(toToolSlug, definitions).input.kind
  );
}

/**
 * Whether a chain turns several starting payloads into one. The property is
 * declared on the step rather than inferred from its output kind, so a future
 * one-to-one PDF Gizlet is not mistaken for a combining one.
 */
export function combinesFlowInputs(
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  definitions: Definitions = toolFlowRegistry,
): boolean {
  return toolSlugs.some((toolSlug) => getFlowTool(toolSlug, definitions).combinesInputs === true);
}

/** Validates an ordered pipeline against its initial payload and each hand-off. */
export function isValidFlowSequence(
  input: FlowPayloadContract,
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  definitions: Definitions = toolFlowRegistry,
): boolean {
  if (toolSlugs.length === 0) return true;
  if (getFlowTool(toolSlugs[0], definitions).input.kind !== input.kind) return false;

  return toolSlugs.every(
    (toolSlug, index) => index === 0 || canFlowTo(toolSlugs[index - 1], toolSlug, definitions),
  );
}

/** Returns whether moving a block would leave every hand-off valid. */
export function canReorderFlowStep(
  input: FlowPayloadContract,
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  fromIndex: number,
  toIndex: number,
  definitions: Definitions = toolFlowRegistry,
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
  return isValidFlowSequence(input, reordered, definitions);
}

/**
 * Guards against catalog additions that forget to declare their executable
 * contract, while letting one that deliberately has none say so.
 */
export function hasCompleteFlowContracts(
  definitions: Definitions = toolFlowRegistry,
  flowless: readonly string[] = flowlessToolSlugs,
): boolean {
  return toolRegistry.every(
    (tool) =>
      definitions.some((flowTool) => flowTool.toolSlug === tool.slug) ||
      flowless.includes(tool.slug),
  );
}
