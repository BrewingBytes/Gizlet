import {
  getAvailableTools,
  toolCategoryLabels,
  toolsIndexPath,
  type AvailableTool,
  type AvailableToolSlug,
} from './tools';

/**
 * Standalone pages for the registry's categories.
 *
 * A category earns a page only while it holds at least one available Gizlet,
 * and everything a page says about its Gizlets — which ones, their names,
 * their links, whether they run on the device — is read from the registry.
 * The editorial map below supplies only what the registry cannot: an
 * introduction and the questions that tell one Gizlet in the category from
 * another.
 */

/**
 * A category that holds at least one available Gizlet. It is derived from the
 * registry's literal types, so publishing the first Gizlet in a new category
 * is a type error here until that category has editorial copy, and a category
 * whose Gizlets are all planned cannot be given a page at all.
 */
export type ActiveToolCategory = AvailableTool['category'];

export const toolCategoryPagesPath = '/categories/';

export type ToolCategoryPagePath = `${typeof toolCategoryPagesPath}${ActiveToolCategory}/`;

/** One line of selection guidance: the job someone has, and the Gizlet for it. */
export interface ToolCategoryChoice {
  readonly need: string;
  readonly slug: AvailableToolSlug;
}

export interface ToolCategoryEditorial {
  /** The page's H1, and the first half of its document title. */
  readonly heading: string;
  /** The meta description. */
  readonly description: string;
  readonly introduction: readonly string[];
  /**
   * How to choose among the category's Gizlets. Every available Gizlet in the
   * category appears here at least once, and no other Gizlet does; a unit
   * test holds the two to each other.
   */
  readonly choices: readonly ToolCategoryChoice[];
}

/**
 * Editorial copy for each active category.
 *
 * Nothing here claims or denies that a Gizlet processes input on the device:
 * that sentence is derived from the registry by `getToolCategoryLocality`, so
 * it cannot drift from the implementation.
 */
export const toolCategoryEditorial = {
  images: {
    heading: 'Image tools',
    description:
      'Compress, resize, convert, crop, and tidy up images, and how to tell which Gizlet fits the job in front of you.',
    introduction: [
      'Most image jobs are one of three things: the file is too big, the picture is the wrong shape, or it is in the wrong format for where it is going. The Gizlets below each do one of those, plus two that read a picture without changing it.',
      'When a form or an upload has a limit, start from the limit. A file-size cap is a compression job; a pixel cap is a resize job; a list of accepted types is a conversion job.',
    ],
    choices: [
      { need: 'The file is too large to upload or send, or has to fit under a size in KB', slug: 'compress-image' },
      { need: 'The picture has to be a set width and height, or a percentage of its size', slug: 'resize-image' },
      { need: 'The site wants JPG, PNG, or WebP and the file is something else', slug: 'convert-image' },
      { need: 'Only part of the picture is wanted, or it needs a fixed aspect ratio', slug: 'crop-image' },
      { need: 'The photo is sideways, upside down, or mirrored', slug: 'rotate-flip-image' },
      { need: 'The picture has to sit on a set canvas size or background colour', slug: 'image-background' },
      { need: 'Several pictures should become one', slug: 'collage-maker' },
      { need: 'A photo may carry GPS coordinates or camera details you would rather not share', slug: 'remove-image-metadata' },
      { need: 'You only need to know its size, ratio, or format, without changing it', slug: 'image-dimensions' },
      { need: 'You need the exact colour of one pixel as HEX, RGB, or HSL', slug: 'image-color-picker' },
      { need: 'A website needs its favicon and app icons', slug: 'favicon-generator' },
    ],
  },
  pdf: {
    heading: 'PDF tools',
    description:
      'Read, merge, split, rearrange, stamp, number, and sign PDFs, with a guide to which Gizlet does which.',
    introduction: [
      'PDF jobs split along one line: whether you are changing which pages are in the document, or changing what is drawn on them. Merging, splitting and organising move whole pages around; watermarks, page numbers and signatures draw onto pages that stay where they are.',
      'Two more cross over to images, one in each direction. The viewer only reads, and the metadata cleaner shows what a document says about itself before it clears anything.',
    ],
    choices: [
      { need: 'You only want to read it', slug: 'pdf-viewer' },
      { need: 'Several PDFs should be one document', slug: 'merge-pdf' },
      { need: 'One PDF should become several, by page range or page by page', slug: 'split-pdf' },
      { need: 'Pages are in the wrong order, turned the wrong way, or should not be there', slug: 'organize-pdf' },
      { need: 'Every page, or some of them, needs a text or picture stamp', slug: 'watermark-pdf' },
      { need: 'The document arrived without page numbers', slug: 'pdf-page-numbers' },
      { need: 'A drawn, typed, or pictured signature has to go on a page', slug: 'sign-pdf' },
      { need: 'The file may name its author or the software that made it', slug: 'clean-pdf-metadata' },
      { need: 'Photos or scans should become a PDF', slug: 'jpg-to-pdf' },
      { need: 'Pages should become images to post or paste somewhere', slug: 'pdf-to-jpg' },
    ],
  },
  seo: {
    heading: 'SEO tools',
    description:
      'Write JSON-LD structured data for a page from a form, and what that markup can and cannot do for a search listing.',
    introduction: [
      'There is one Gizlet here so far. It writes the Schema.org markup a page carries to describe what it is: a product, an organisation, a local business, an article, an event, or the breadcrumb trail that leads to it.',
      'Valid markup tells a search engine what the page holds. It does not promise a rich result or a better position, and the generator keeps those two questions apart: Schema.org errors are listed separately from Google search recommendations.',
    ],
    choices: [
      { need: 'A page needs JSON-LD for a product, organisation, local business, article, event, or breadcrumb trail', slug: 'json-ld-generator' },
    ],
  },
  developer: {
    heading: 'Developer tools',
    description:
      'Format JSON, convert CSV, decode JWTs and Base64, hash files, read timestamps, and make UUIDs, sorted by the job each one does.',
    introduction: [
      'These are for the text that passes between systems: payloads, tokens, encoded strings, exports, identifiers. Most of them read something you pasted and tell you what it is; a few turn it into something else.',
      'If what you have is unreadable and you are not sure what it is, the shape usually says. Three dot-separated chunks is a JWT, a string of letters ending in = is likely Base64, %20 and friends are percent-encoding, and a ten or thirteen digit number is probably a timestamp.',
    ],
    choices: [
      { need: 'JSON is on one line or will not parse, and you need to see why', slug: 'json-formatter' },
      { need: 'Records have to move between JSON and CSV', slug: 'json-csv-converter' },
      { need: 'A CSV export should be read as a table, or its quoting tidied', slug: 'csv-viewer' },
      { need: 'A token from an Authorization header needs reading', slug: 'jwt-decoder' },
      { need: 'Text or a small file has to go into Base64, or come back out of it', slug: 'base64-encode-decode' },
      { need: 'A string has to be safe inside a URL, or a URL is full of % escapes', slug: 'url-encode-decode' },
      { need: 'A Unix timestamp has to become a date, or a date a timestamp', slug: 'timestamp-converter' },
      { need: 'You need fresh identifiers, or want to know what a UUID contains', slug: 'uuid-generator' },
      { need: 'A download has a published checksum to compare against', slug: 'file-hash-generator' },
    ],
  },
  archive: {
    heading: 'Archive tools',
    description:
      'Bundle files into a ZIP, or look inside one and take out only what you need.',
    introduction: [
      'Two Gizlets, one for each direction. One packs files into a standard ZIP; the other opens a ZIP and shows its contents as a tree before anything is unpacked.',
    ],
    choices: [
      { need: 'Several files, or a folder, should travel as one', slug: 'create-zip' },
      { need: 'You received a ZIP and want some or all of what is inside', slug: 'extract-archive' },
    ],
  },
} as const satisfies Record<ActiveToolCategory, ToolCategoryEditorial>;

export interface ToolCategoryGuidance {
  readonly need: string;
  readonly tool: AvailableTool;
}

export interface ToolCategoryPage {
  readonly category: ActiveToolCategory;
  readonly label: string;
  readonly path: ToolCategoryPagePath;
  /** The category's group on the Gizlet index, which keeps its jump anchor. */
  readonly indexAnchorPath: `${typeof toolsIndexPath}#${ActiveToolCategory}`;
  readonly title: string;
  readonly heading: string;
  readonly description: string;
  readonly introduction: readonly string[];
  readonly guidance: readonly ToolCategoryGuidance[];
  /** The category's available Gizlets, in registry order. */
  readonly tools: readonly AvailableTool[];
  readonly locality: string;
  /** Whether every Gizlet in the category processes its input on the device. */
  readonly isEntirelyLocal: boolean;
}

/** The standalone page of a category that holds at least one available Gizlet. */
export function getToolCategoryPagePath(category: ActiveToolCategory): ToolCategoryPagePath {
  return `${toolCategoryPagesPath}${category}/`;
}

/**
 * The sentence a category page prints about where its Gizlets do their work.
 * It is counted from the registry, so a category is only described as running
 * entirely on the device while every Gizlet in it does.
 */
export function getToolCategoryLocality(tools: readonly AvailableTool[]): string {
  const local = tools.filter((tool) => tool.processesLocally).length;
  const noun = tools.length === 1 ? 'Gizlet' : 'Gizlets';

  if (local === tools.length) {
    return tools.length === 1
      ? 'This Gizlet works in your browser: what you give it stays on this device.'
      : `All ${tools.length} ${noun} here work in your browser: what you give them stays on this device.`;
  }

  return `${local} of these ${tools.length} ${noun} work in your browser. Each one's page says where its input goes.`;
}

/**
 * Every category that holds an available Gizlet, in the order the registry
 * first lists one, with the page each gets. A category whose Gizlets are all
 * planned is absent, so it has no route, no sitemap entry, and no link.
 */
export function getToolCategoryPages(): readonly ToolCategoryPage[] {
  const tools = getAvailableTools();
  const categories = [...new Set(tools.map((tool) => tool.category))];

  return categories.map((category) => {
    const editorial: ToolCategoryEditorial = toolCategoryEditorial[category];
    const categoryTools = tools.filter((tool) => tool.category === category);

    return {
      category,
      label: toolCategoryLabels[category],
      path: getToolCategoryPagePath(category),
      indexAnchorPath: `${toolsIndexPath}#${category}`,
      title: `${editorial.heading} | Gizlet`,
      heading: editorial.heading,
      description: editorial.description,
      introduction: editorial.introduction,
      guidance: editorial.choices.map((choice) => {
        const tool = categoryTools.find((candidate) => candidate.slug === choice.slug);

        if (!tool) {
          throw new Error(`The ${category} guidance names ${choice.slug}, which is not an available ${category} Gizlet.`);
        }

        return { need: choice.need, tool };
      }),
      tools: categoryTools,
      locality: getToolCategoryLocality(categoryTools),
      isEntirelyLocal: categoryTools.every((tool) => tool.processesLocally),
    };
  });
}

/** The page for a category, when it has one. */
export function getToolCategoryPage(category: string): ToolCategoryPage | undefined {
  return getToolCategoryPages().find((page) => page.category === category);
}
