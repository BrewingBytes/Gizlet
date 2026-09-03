import { type ImageOutputFormat } from './image-compression';
import { validateResizeDimensions } from './image-resize';
import { getFlowTool, isValidFlowSequence } from './tool-flows';
import { getAvailableTools, type RegisteredTool } from './tools';

/**
 * A Gizlet Flow encoded as a shareable link.
 *
 * Settings travel in the URL fragment and never in the query string. A query
 * string is transmitted to the server on every request and merely not logged;
 * a fragment is never sent at all. Nothing here can carry file content, a
 * filename, or a URL, because only setting-shaped keys exist — the privacy
 * contract is the shape of this module rather than a promise about it.
 */

/** Slugs a recipe may name: published Gizlets that run in the image flow. */
export type RecipeToolSlug = Extract<
  RegisteredTool,
  { readonly category: 'images'; readonly launchStatus: 'available' }
>['slug'];

export interface RecipeStep {
  readonly toolSlug: RecipeToolSlug;
  readonly width?: number;
  readonly height?: number;
  readonly quality?: number;
}

export interface Recipe {
  readonly steps: readonly RecipeStep[];
  /** The flow's single final output format, which the builder applies to every step. */
  readonly outputFormat?: ImageOutputFormat;
}

/** A leading version token. An unrecognised version means the whole fragment is ignored. */
export const recipeVersion = 'v1';
/** Caps, so a crafted link cannot become an absurd chain. */
export const maximumRecipeLength = 512;
export const maximumRecipeSteps = 8;
/** Matches the quality range the flow builder offers. */
export const minimumRecipeQuality = 40;
export const maximumRecipeQuality = 100;

/** Short, delimiter-free names for the three output formats the flow can produce. */
const recipeFormatNames = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const satisfies Record<string, ImageOutputFormat>;

type RecipeFormatName = keyof typeof recipeFormatNames;

const recipeStepKeys = {
  'resize-image': ['w', 'h'],
  'compress-image': ['q'],
  'convert-image': [],
} as const satisfies Record<RecipeToolSlug, readonly string[]>;

function isRecipeToolSlug(value: string): value is RecipeToolSlug {
  return getAvailableTools().some((tool) => tool.category === 'images' && tool.slug === value);
}

function isRecipeFormatName(value: string): value is RecipeFormatName {
  return Object.hasOwn(recipeFormatNames, value);
}

/** Whole numbers only. A sign, a decimal point, or padding is a malformed value. */
function parseWholeNumber(value: string): number | undefined {
  return /^\d{1,7}$/.test(value) ? Number(value) : undefined;
}

function parseStepSettings(
  toolSlug: RecipeToolSlug,
  settings: string,
): Record<string, number> | undefined {
  if (settings === '') return {};

  const allowedKeys: readonly string[] = recipeStepKeys[toolSlug];
  const parsed: Record<string, number> = {};

  for (const pair of settings.split(',')) {
    const separatorIndex = pair.indexOf('=');

    if (separatorIndex === -1) return undefined;

    const key = pair.slice(0, separatorIndex);
    const rawValue = pair.slice(separatorIndex + 1);

    if (!allowedKeys.includes(key) || Object.hasOwn(parsed, key)) return undefined;
    if (rawValue.includes('=')) return undefined;

    const value = parseWholeNumber(rawValue);

    if (value === undefined) return undefined;

    parsed[key] = value;
  }

  return parsed;
}

function buildStep(toolSlug: RecipeToolSlug, settings: Record<string, number>): RecipeStep | undefined {
  if (toolSlug === 'resize-image') {
    const hasWidth = Object.hasOwn(settings, 'w');
    const hasHeight = Object.hasOwn(settings, 'h');

    // Half a resize is a partly applied recipe, which is worse than none.
    if (hasWidth !== hasHeight) return undefined;
    if (!hasWidth) return { toolSlug };

    const dimensions = { width: settings.w, height: settings.h };

    if (validateResizeDimensions(dimensions)) return undefined;

    return { toolSlug, width: dimensions.width, height: dimensions.height };
  }

  if (toolSlug === 'compress-image') {
    if (!Object.hasOwn(settings, 'q')) return { toolSlug };
    if (settings.q < minimumRecipeQuality || settings.q > maximumRecipeQuality) return undefined;

    return { toolSlug, quality: settings.q };
  }

  return { toolSlug };
}

/**
 * Reads a recipe from a URL fragment.
 *
 * An invalid recipe is rejected whole and never partly applied: a visitor
 * cannot see which settings survived, so a half-applied chain is worse than
 * none. Returns undefined for anything that does not parse and validate.
 */
export function decodeRecipe(fragment: string): Recipe | undefined {
  const encoded = fragment.startsWith('#') ? fragment.slice(1) : fragment;

  if (!encoded || encoded.length > maximumRecipeLength) return undefined;

  const segments = encoded.split(';');

  if (segments[0] !== `r=${recipeVersion}`) return undefined;

  let index = 1;
  let outputFormat: ImageOutputFormat | undefined;
  const formatSegment = segments[index];

  if (formatSegment?.startsWith('f=')) {
    const name = formatSegment.slice(2);

    if (!isRecipeFormatName(name)) return undefined;

    outputFormat = recipeFormatNames[name];
    index += 1;
  }

  const stepSegments = segments.slice(index);

  if (stepSegments.length === 0 || stepSegments.length > maximumRecipeSteps) return undefined;

  const steps: RecipeStep[] = [];

  for (const segment of stepSegments) {
    const separatorIndex = segment.indexOf(':');
    const toolSlug = separatorIndex === -1 ? segment : segment.slice(0, separatorIndex);
    const settings = separatorIndex === -1 ? '' : segment.slice(separatorIndex + 1);

    if (settings.includes(':') || !isRecipeToolSlug(toolSlug)) return undefined;

    const parsedSettings = parseStepSettings(toolSlug, settings);

    if (!parsedSettings) return undefined;

    const step = buildStep(toolSlug, parsedSettings);

    if (!step) return undefined;

    steps.push(step);
  }

  return isValidFlowChain(steps.map((step) => step.toolSlug)) ? { steps, outputFormat } : undefined;
}

/**
 * Checks a chain against the executable compatibility graph, so the recipe
 * format and the composition thesis validate against the same data.
 */
function isValidFlowChain(toolSlugs: readonly RecipeToolSlug[]): boolean {
  const input = getFlowTool(toolSlugs[0]).input;

  return input.kind === 'image-file' && isValidFlowSequence(input, toolSlugs);
}

/**
 * Writes a recipe as a URL fragment, including the leading `#`.
 *
 * Returns undefined rather than an unreadable link when the flow cannot be
 * expressed — a chain longer than the cap, or one the graph rejects.
 */
export function encodeRecipe(recipe: Recipe): string | undefined {
  if (recipe.steps.length === 0 || recipe.steps.length > maximumRecipeSteps) return undefined;
  if (!isValidFlowChain(recipe.steps.map((step) => step.toolSlug))) return undefined;

  const segments = [`r=${recipeVersion}`];

  if (recipe.outputFormat) {
    const name = (Object.keys(recipeFormatNames) as RecipeFormatName[]).find(
      (candidate) => recipeFormatNames[candidate] === recipe.outputFormat,
    );

    if (!name) return undefined;

    segments.push(`f=${name}`);
  }

  for (const step of recipe.steps) {
    const settings: string[] = [];

    if (step.toolSlug === 'resize-image' && step.width !== undefined && step.height !== undefined) {
      if (validateResizeDimensions({ width: step.width, height: step.height })) return undefined;

      settings.push(`w=${step.width}`, `h=${step.height}`);
    }

    if (step.toolSlug === 'compress-image' && step.quality !== undefined) {
      if (step.quality < minimumRecipeQuality || step.quality > maximumRecipeQuality) return undefined;
      if (!Number.isInteger(step.quality)) return undefined;

      settings.push(`q=${step.quality}`);
    }

    segments.push(settings.length === 0 ? step.toolSlug : `${step.toolSlug}:${settings.join(',')}`);
  }

  const encoded = `#${segments.join(';')}`;

  return encoded.length - 1 > maximumRecipeLength ? undefined : encoded;
}
