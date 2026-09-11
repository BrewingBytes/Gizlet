import { getFormatLabel, type ImageOutputFormat } from './image-compression';
import { pdfMetadataScopeNotice } from './pdf-metadata';
import { encodeRecipe, type Recipe, type RecipeStep } from './recipes';
import {
  combinesFlowInputs,
  flowPayloadKinds,
  getFlowCategory,
  getFlowFormatControl,
  getFlowOutputKind,
  splitsFlowInput,
  type FlowCategoryId,
  type FlowPayloadLineageKind,
} from './tool-flows';
import { toolRegistry, type ToolRegistryEntry } from './tools';

/**
 * Three flows worth opening the page for, written as recipes rather than as
 * prose about them.
 *
 * A card links to `/flows/` carrying the fragment the Copy recipe link button
 * writes, so a starter recipe is exactly a shared flow that this site happens
 * to have shared. There is no second grammar here and no parser: every chain
 * below goes out through `encodeRecipe`, which refuses anything the
 * compatibility graph refuses, so a card cannot advertise a flow the builder
 * would not open.
 *
 * What a link carries is settings. It carries no file and starts nothing: the
 * builder applies the chain and then waits for the visitor to choose something
 * local, which is the state the page is in after the same blocks are added by
 * hand.
 */

/**
 * What a chain takes and hands back, in the words a card uses.
 *
 * `droppedFileLabels` says 'an image' because it finishes a sentence about a
 * file somebody dropped. A card needs both numbers instead, and the plural of a
 * payload kind is not a fact the registry holds. Declared against the payload
 * kinds, so a new one cannot arrive without a name here.
 */
const payloadNouns = {
  'image-file': { one: 'image', many: 'images' },
  'pdf-file': { one: 'PDF', many: 'PDFs' },
  'csv-file': { one: 'CSV', many: 'CSVs' },
  'json-text': { one: 'JSON file', many: 'JSON files' },
} as const satisfies Record<
  FlowPayloadLineageKind,
  { readonly one: string; readonly many: string }
>;

/**
 * One block of a starter recipe, and what it does with the settings it carries.
 *
 * The step and the sentence about it are one entry rather than two lists, so a
 * recipe cannot end up describing a block it no longer has.
 */
interface StarterRecipeStep {
  readonly step: RecipeStep;
  /** What this block does to what reaches it, with these settings applied. */
  readonly effect: string;
}

interface StarterRecipeDefinition {
  readonly id: string;
  readonly title: string;
  /** Who the flow is for, in one sentence. */
  readonly summary: string;
  readonly category: FlowCategoryId;
  readonly outputFormat?: ImageOutputFormat;
  readonly steps: readonly StarterRecipeStep[];
  /**
   * What a link cannot say, where this recipe wanted to say it.
   *
   * A recipe carries whole numbers and names from closed lists, and a setting
   * outside that is not a setting a link can name. Where one was wanted, the
   * card says so rather than quietly shipping a different flow.
   */
  readonly substitution?: string;
  /** An accurate limit, where the chain could be read as promising more. */
  readonly limit?: string;
}

/**
 * The starting dimensions of a web page's image, and the shape that makes them
 * mean the same thing for every photograph.
 *
 * 1600 is the width a full-bleed image is asked for at; 900 is what 16:9 makes
 * of it. Written as one pair rather than two numbers so the crop and the resize
 * cannot drift apart.
 */
const heroImageWidth = 1600;
const heroImageHeight = 900;

const starterRecipeDefinitions: readonly StarterRecipeDefinition[] = [
  {
    id: 'web-ready-image',
    title: 'Make a photograph web-ready',
    summary:
      'A picture straight off a camera is several times the size a page needs and in a format that costs a visitor to download. This gives you one that is neither.',
    category: 'images',
    outputFormat: 'image/webp',
    steps: [
      {
        step: { toolSlug: 'crop-image', ratio: '16:9' },
        effect:
          'Takes the largest 16:9 rectangle from the middle of the picture, so the step after it has nothing to stretch.',
      },
      {
        step: { toolSlug: 'resize-image', width: heroImageWidth, height: heroImageHeight },
        effect: `Draws that rectangle again at exactly ${heroImageWidth} × ${heroImageHeight} pixels.`,
      },
    ],
    substitution:
      'Fitting the longest side to 1600 is not something a link can say: a flow’s resize block takes an exact width and a height, and there is no longest-side mode for one to name. The centred 16:9 crop is what makes one exact pair the right instruction for a picture of any shape.',
  },
  {
    id: 'photos-to-document',
    title: 'Bind photographs into one document',
    summary:
      'Photographs of pages, receipts or a whiteboard, turned into a single document you can send to somebody who wants a document.',
    category: 'images',
    outputFormat: 'image/jpeg',
    steps: [
      {
        step: { toolSlug: 'compress-image', quality: 80 },
        effect:
          'Re-encodes each photograph at 80% quality, which is where a camera-sized picture stops being camera-sized.',
      },
      {
        step: { toolSlug: 'jpg-to-pdf', pageSize: 'a4', orientation: 'portrait' },
        effect: 'Puts each photograph on its own A4 portrait page, in the order you chose them.',
      },
    ],
    substitution:
      'The longest side is missing here for the same reason, and resizing is left out rather than guessed at: one exact pair would stretch every photograph that is a different shape, and cropping to a shape cuts the corner off a photographed page. The quality setting carries the size instead.',
  },
  {
    id: 'combine-documents',
    title: 'Join documents and clear their fields',
    summary:
      'Several PDFs joined into one, with the title, author and software names the joined file would otherwise have inherited cleared out of it.',
    category: 'pdf',
    steps: [
      {
        step: { toolSlug: 'merge-pdf' },
        effect: 'Joins the documents into one, in the order you chose them.',
      },
      {
        step: { toolSlug: 'clean-pdf-metadata' },
        effect:
          'Clears the finished document’s own fields: its title, author, subject, keywords, and the software names it was written and produced by.',
      },
    ],
    limit: `Clearing those fields is not redaction. ${pdfMetadataScopeNotice}`,
  },
];

/** One block of a card: the Gizlet's registry name, and what it does here. */
export interface StarterRecipeCardStep {
  readonly toolSlug: RecipeStep['toolSlug'];
  readonly name: string;
  readonly effect: string;
}

export interface StarterRecipeCard {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  /** The starting payload, said in words: 'One image', 'Several PDFs'. */
  readonly input: string;
  /** What the flow leaves the visitor with, said the same way. */
  readonly output: string;
  readonly steps: readonly StarterRecipeCardStep[];
  /**
   * The image format the chain is set to, named as the builder's own control
   * names it — 'Final output format' for a flow that hands back an image, and
   * 'Page image format' for one that ends in a document. Absent when the chain
   * re-encodes no image and the control would not be shown either.
   */
  readonly format?: { readonly label: string; readonly value: string };
  readonly substitution?: string;
  readonly limit?: string;
  /** The recipe link: `/flows/` and the fragment the builder reads. */
  readonly href: string;
}

const flowsPath = '/flows/';

function getToolBySlug(slug: RecipeStep['toolSlug']): ToolRegistryEntry {
  const tool = toolRegistry.find((candidate) => candidate.slug === slug);

  if (!tool) throw new Error(`Missing registry entry for a starter recipe step: ${slug}`);

  return tool;
}

/**
 * A payload kind with a noun, which every kind a chain can carry has.
 *
 * The form filled in by a Gizlet rather than read out of a file is the one kind
 * with no noun here, and no chain ends on it — but the graph's type says it
 * could, so this says plainly what happens if one ever does.
 */
function getPayloadNouns(kind: string): (typeof payloadNouns)[FlowPayloadLineageKind] {
  if (!(flowPayloadKinds as readonly string[]).includes(kind)) {
    throw new Error(`A starter recipe carries a payload with no name: ${kind}`);
  }

  return payloadNouns[kind as FlowPayloadLineageKind];
}

function describePayload(kind: string, several: boolean, format?: ImageOutputFormat): string {
  const nouns = getPayloadNouns(kind);
  const named = format && kind === 'image-file' ? `${getFormatLabel(format)} ` : '';

  return several ? `Several ${named}${nouns.many}` : `One ${named}${nouns.one}`;
}

/**
 * The cards, built from the definitions above and from the same graph the
 * builder validates against.
 *
 * A recipe that cannot be encoded throws rather than being dropped: a starter
 * recipe silently missing from the page is a worse failure than a build that
 * stops, because nobody would notice the first one.
 */
export function getStarterRecipes(): readonly StarterRecipeCard[] {
  return starterRecipeDefinitions.map((definition) => {
    const toolSlugs = definition.steps.map((entry) => entry.step.toolSlug);
    const recipe: Recipe = {
      category: definition.category,
      outputFormat: definition.outputFormat,
      steps: definition.steps.map((entry) => entry.step),
    };
    const fragment = encodeRecipe(recipe);

    if (!fragment) throw new Error(`Starter recipe cannot be shared as a link: ${definition.id}`);

    const input = getFlowCategory(definition.category).input;
    const outputKind = getFlowOutputKind(input, toolSlugs);

    if (!outputKind) throw new Error(`Starter recipe has no valid chain: ${definition.id}`);

    const control = getFlowFormatControl(toolSlugs);

    return {
      id: definition.id,
      title: definition.title,
      summary: definition.summary,
      input: describePayload(input.kind, combinesFlowInputs(toolSlugs)),
      output: describePayload(outputKind, splitsFlowInput(toolSlugs), definition.outputFormat),
      steps: definition.steps.map((entry) => ({
        toolSlug: entry.step.toolSlug,
        name: getToolBySlug(entry.step.toolSlug).name,
        effect: entry.effect,
      })),
      format:
        control.kind === 'none' || !definition.outputFormat
          ? undefined
          : { label: control.label, value: getFormatLabel(definition.outputFormat) },
      substitution: definition.substitution,
      limit: definition.limit,
      href: `${flowsPath}${fragment}`,
    };
  });
}
