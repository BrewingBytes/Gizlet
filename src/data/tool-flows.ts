import type { ImageInputFormat, ImageOutputFormat } from './image-compression';
import { describePdfPageCount, maximumPdfPages } from './jpg-to-pdf';
import { describeMergeDocumentCount, maximumMergeDocuments } from './merge-pdf';
import { getAvailableTools, type AvailableToolSlug, type ToolRegistryEntry } from './tools';

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
  /**
   * A one-to-many step: it takes one payload apart, so everything after it runs
   * once per piece and the chain ends with a set rather than a file. Declared
   * rather than inferred from the payload kinds, for the same reason as its
   * opposite: a future Gizlet that reads a PDF and writes one image would
   * otherwise be mistaken for a splitting one.
   */
  readonly splitsInput?: boolean;
}

/** The payload an image flow starts from. Exported so no UI restates it. */
export const imageFlowInput = {
  kind: 'image-file',
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'],
} as const satisfies FlowPayloadContract;

/** The payload a PDF flow starts from. */
export const pdfFlowInput = { kind: 'pdf-file' } as const satisfies FlowPayloadContract;

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
  {
    toolSlug: 'merge-pdf',
    input: pdfPayload,
    output: pdfPayload,
    combinesInputs: true,
  },
  {
    toolSlug: 'pdf-to-jpg',
    input: pdfPayload,
    output: imageOutput,
    splitsInput: true,
  },
  {
    toolSlug: 'split-pdf',
    input: pdfPayload,
    output: pdfPayload,
    splitsInput: true,
  },
  {
    toolSlug: 'crop-image',
    input: imageFlowInput,
    output: imageOutput,
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
 * The payload kinds the flow builder can carry. This is a list of shapes rather
 * than of Gizlets: a new Gizlet joins a chain by declaring one of these kinds,
 * without being named here.
 *
 * Both the image and the PDF category draw from this one list, because the
 * lineages meet: an image chain can end in a document and a PDF chain can end
 * in images. What separates the categories is only where a chain may start.
 */
export const flowPayloadKinds = ['image-file', 'pdf-file'] as const;

export type FlowPayloadLineageKind = (typeof flowPayloadKinds)[number];

/** Everything the flow builder can put in a chain. */
export type ChainableFlowToolSlug = Extract<
  FlowDefinition,
  { readonly input: { readonly kind: FlowPayloadLineageKind } }
>['toolSlug'];

/** The chainable slugs, in registry order, derived rather than listed. */
function getChainableFlowToolSlugs(): readonly ChainableFlowToolSlug[] {
  return toolFlowRegistry
    .filter((tool): tool is Extract<FlowDefinition, { readonly input: { readonly kind: FlowPayloadLineageKind } }> =>
      flowPayloadKinds.includes(tool.input.kind as FlowPayloadLineageKind),
    )
    .map((tool) => tool.toolSlug);
}

/**
 * Chainable and published: what the builder may actually offer. A planned
 * Gizlet can declare its contract early without appearing in a flow.
 */
export type AvailableFlowToolSlug = ChainableFlowToolSlug & AvailableToolSlug;

export function getAvailableFlowToolSlugs(): readonly AvailableFlowToolSlug[] {
  const published = new Set<string>(getAvailableTools().map((tool) => tool.slug));

  return getChainableFlowToolSlugs().filter(
    (slug): slug is AvailableFlowToolSlug => published.has(slug),
  );
}

export function isAvailableFlowToolSlug(value: string): value is AvailableFlowToolSlug {
  return getAvailableFlowToolSlugs().includes(value as AvailableFlowToolSlug);
}

/**
 * A starting payload a visitor can choose between, with the copy the builder
 * needs to ask for it. The category decides only where a chain begins; every
 * hand-off after that is the payload-kind rule, as it was when images were the
 * only way in.
 */
export interface FlowCategory {
  readonly id: string;
  readonly label: string;
  readonly input: FlowPayloadContract;
  /** What the category can do, shown beside the chooser. */
  readonly summary: string;
  /** The starting-input heading, for one file and for several. */
  readonly sourceTitle: { readonly one: string; readonly many: string };
  /** What the file picker accepts, said in words and as an `accept` list. */
  readonly sourceDetails: string;
  readonly accept: string;
  /** The picker's button, for a chain that takes one file and for one that takes several. */
  readonly chooseLabel: { readonly one: string; readonly many: string };
  readonly addLabel: { readonly one: string; readonly many: string };
  /** The picker's accessible name, which never changes with the chain. */
  readonly chooseAriaLabel: string;
  /**
   * How many starting files a combining chain takes, and how to count them.
   *
   * The ceiling is the combining Gizlet's own, not a number invented here: an
   * image flow assembles pages and a PDF flow joins documents, and those are
   * different limits because they are different jobs.
   */
  readonly combiningLimit: number;
  readonly describeSourceCount: (count: number) => string;
}

/**
 * Every starting payload the builder knows, in the order it offers them.
 *
 * A category is a starting point rather than a group of Gizlets, so nothing
 * here lists which Gizlets belong to it: `getFlowCategoryStartSlugs` reads that
 * off the same contracts the graph uses.
 */
export const flowCategories = [
  {
    id: 'images',
    label: 'Images',
    input: imageFlowInput,
    summary: 'Image Gizlets pass a file to one another, and can end by making a PDF. A block is offered when it accepts what the block before it produces.',
    sourceTitle: { one: 'Your image', many: 'Your images' },
    sourceDetails: 'JPEG, PNG, WebP, AVIF, or BMP.',
    accept: 'image/jpeg,image/png,image/webp,image/avif,image/bmp,.jpg,.jpeg,.png,.webp,.avif,.bmp',
    chooseLabel: { one: 'Choose image', many: 'Choose images' },
    addLabel: { one: 'Choose another image', many: 'Add images' },
    chooseAriaLabel: 'Choose images for this flow',
    combiningLimit: maximumPdfPages,
    describeSourceCount: describePdfPageCount,
  },
  {
    id: 'pdf',
    label: 'PDF',
    input: pdfFlowInput,
    summary: 'PDF Gizlets pass a document to one another, and can end by making images. A block is offered when it accepts what the block before it produces.',
    sourceTitle: { one: 'Your PDF', many: 'Your PDFs' },
    sourceDetails: 'PDF.',
    accept: 'application/pdf,.pdf',
    chooseLabel: { one: 'Choose PDF', many: 'Choose PDFs' },
    addLabel: { one: 'Choose another PDF', many: 'Add PDFs' },
    chooseAriaLabel: 'Choose PDFs for this flow',
    combiningLimit: maximumMergeDocuments,
    describeSourceCount: describeMergeDocumentCount,
  },
] as const satisfies readonly FlowCategory[];

export type FlowCategoryId = (typeof flowCategories)[number]['id'];

/** The category a flow starts from when nothing has chosen one. */
export const defaultFlowCategoryId = 'images' satisfies FlowCategoryId;

export function isFlowCategoryId(value: string): value is FlowCategoryId {
  return flowCategories.some((category) => category.id === value);
}

export function getFlowCategory(id: FlowCategoryId): FlowCategory {
  const category = flowCategories.find((candidate) => candidate.id === id);
  if (!category) throw new Error(`Missing flow category: ${id}`);
  return category;
}

/** The published Gizlets that can begin a chain in this category. */
export function getFlowCategoryStartSlugs(
  id: FlowCategoryId,
): readonly AvailableFlowToolSlug[] {
  const available = new Set<string>(getAvailableFlowToolSlugs());

  return getFlowToolsForInput(getFlowCategory(id).input)
    .map((tool) => tool.toolSlug)
    .filter((slug): slug is AvailableFlowToolSlug => available.has(slug));
}

/**
 * The categories worth offering: one with nothing published to start it would
 * be a chooser that leads to an empty step list, which is worse than no chooser.
 */
export function getAvailableFlowCategories(): readonly FlowCategory[] {
  return flowCategories.filter(
    (category) => getFlowCategoryStartSlugs(category.id).length > 0,
  );
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

/**
 * The last step that changes how many payloads a chain carries.
 *
 * A combining step makes one payload out of many and a splitting step takes one
 * apart again, so neither the presence of a kind nor a count of them settles
 * what a chain holds — only the last of them does.
 */
function lastPayloadCountStep(
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  definitions: Definitions = toolFlowRegistry,
): ToolFlowDefinition | undefined {
  return [...toolSlugs]
    .reverse()
    .map((toolSlug) => getFlowTool(toolSlug, definitions))
    .find((tool) => tool.splitsInput === true || tool.combinesInputs === true);
}

/** Whether a chain ends with a set of files rather than with one. */
export function splitsFlowInput(
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  definitions: Definitions = toolFlowRegistry,
): boolean {
  return lastPayloadCountStep(toolSlugs, definitions)?.splitsInput === true;
}

/**
 * Whether a chain still carries several payloads.
 *
 * A flow starts with as many payloads as the visitor chose, and a combining
 * step makes a single one of them, so everything after a combining step has
 * exactly one payload however many the flow began with — until a splitting
 * step takes that one apart again, which is a rule rather than an exception.
 */
function carriesSeveralPayloads(
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  definitions: Definitions = toolFlowRegistry,
): boolean {
  const last = lastPayloadCountStep(toolSlugs, definitions);

  return last === undefined || last.splitsInput === true;
}

/** Validates an ordered pipeline against its initial payload and each hand-off. */
export function isValidFlowSequence(
  input: FlowPayloadContract,
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  definitions: Definitions = toolFlowRegistry,
): boolean {
  if (toolSlugs.length === 0) return true;
  if (getFlowTool(toolSlugs[0], definitions).input.kind !== input.kind) return false;

  return toolSlugs.every((toolSlug, index) => {
    if (index > 0 && !canFlowTo(toolSlugs[index - 1], toolSlug, definitions)) return false;

    // A combining step placed after another has nothing left to combine: the
    // payload reaching it is already the one file the earlier step made.
    return (
      getFlowTool(toolSlug, definitions).combinesInputs !== true ||
      carriesSeveralPayloads(toolSlugs.slice(0, index), definitions)
    );
  });
}

/**
 * Every Gizlet that may follow a chain: the ones that read what it produces,
 * minus any the chain itself rules out. An empty chain offers the Gizlets that
 * read the flow's starting payload.
 */
export function getNextFlowSteps(
  input: FlowPayloadContract,
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  definitions: Definitions = toolFlowRegistry,
): readonly ToolFlowDefinition[] {
  const last = toolSlugs.at(-1);
  const candidates = last
    ? getNextFlowTools(last, definitions)
    : getFlowToolsForInput(input, definitions);

  return candidates.filter((candidate) =>
    isValidFlowSequence(input, [...toolSlugs, candidate.toolSlug], definitions),
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
 * Guards against published Gizlets that forget to declare their executable
 * contract, while letting one that deliberately has none say so.
 *
 * The guard covers the available Gizlets, not the whole registry. A planned
 * Gizlet genuinely has no contract: it reads and writes nothing, because there
 * is no code to read or write anything, and inventing a payload kind for a
 * Gizlet that does not exist would put the compatibility graph ahead of the
 * implementation. The obligation lands the moment a Gizlet becomes available,
 * which is where `AGENTS.md` means it.
 */
export function hasCompleteFlowContracts(
  definitions: Definitions = toolFlowRegistry,
  flowless: readonly string[] = flowlessToolSlugs,
): boolean {
  return getAvailableTools().every(
    (tool) =>
      definitions.some((flowTool) => flowTool.toolSlug === tool.slug) ||
      flowless.includes(tool.slug),
  );
}

/**
 * The image-format control a chain needs, if it needs one at all.
 *
 * Three things have to agree — whether the control appears, what it is called,
 * and which formats it offers — and all three follow from what the chain ends
 * by producing. Deriving them separately is what let a chain ending in a set of
 * PDFs offer a "final output format" of WebP.
 */
export type FlowFormatControl =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'pages' | 'output';
      readonly label: string;
      readonly formats: readonly ImageOutputFormat[];
    };

/**
 * Formats that survive being put in a PDF.
 *
 * `getPdfEmbedStrategy` embeds JPEG and PNG byte for byte and re-encodes
 * everything else as JPEG, so offering WebP for a chain that ends in a document
 * would only buy a second lossy pass. The two here are the honest choice a page
 * image has: small and lossy, or large and lossless.
 */
export const pdfPageImageFormats = ['image/jpeg', 'image/png'] as const satisfies readonly ImageOutputFormat[];

/** Formats a chain can hand the visitor as its own result. */
export const flowOutputImageFormats = ['image/jpeg', 'image/png', 'image/webp'] as const satisfies readonly ImageOutputFormat[];

export function getFlowFormatControl(
  toolSlugs: readonly ToolRegistryEntry['slug'][],
  definitions: Definitions = toolFlowRegistry,
): FlowFormatControl {
  const last = toolSlugs.at(-1);

  // Nothing re-encodes an image, so there is no image format to choose. A
  // merge, or a split that only copies page trees, is such a chain.
  if (
    last === undefined ||
    !toolSlugs.some((toolSlug) => getFlowTool(toolSlug, definitions).output.kind === 'image-file')
  ) {
    return { kind: 'none' };
  }

  // What the chain ends by producing, rather than whether it combines or
  // splits: a split after a combine still hands the visitor documents.
  if (getFlowTool(last, definitions).output.kind === 'pdf-file') {
    return { kind: 'pages', label: 'Page image format', formats: pdfPageImageFormats };
  }

  return { kind: 'output', label: 'Final output format', formats: flowOutputImageFormats };
}

/**
 * The format a chain can actually honour, given the one already chosen.
 *
 * Adding a PDF block to a chain set to WebP must not leave a setting the chain
 * would quietly ignore, so the choice moves to the nearest format the control
 * offers rather than being left stale.
 */
export function getUsableFlowFormat(
  control: FlowFormatControl,
  selected: ImageOutputFormat,
): ImageOutputFormat | undefined {
  if (control.kind === 'none') return undefined;
  if (control.formats.includes(selected)) return selected;

  // WebP is the only format a PDF-terminated chain drops, and JPEG is what
  // pdf-lib would have re-encoded it to anyway.
  return control.formats[0];
}
