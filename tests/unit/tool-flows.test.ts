import { describe, expect, test } from 'vitest';

import {
  canFlowTo,
  canReorderFlowStep,
  combinesFlowInputs,
  defaultFlowCategoryId,
  flowlessToolSlugs,
  getAvailableFlowCategories,
  getFlowCategory,
  getFlowCategoryStartSlugs,
  getFlowCombiningLimit,
  getFlowFormatControl,
  getFlowTool,
  getFlowToolsForInput,
  getNextFlowSteps,
  getNextFlowTools,
  getUsableFlowFormat,
  hasCompleteFlowContracts,
  isFlowCategoryId,
  isValidFlowSequence,
  splitsFlowInput,
  toolFlowRegistry,
  type FlowCategoryId,
  type FlowPayloadContract,
  type ToolFlowDefinition,
} from '../../src/data/tool-flows';
import {
  describeCollageImageCount,
  maximumCollageImages,
} from '../../src/data/image-collage';
import { getPlannedTools, toolRegistry } from '../../src/data/tools';

const imageInput: FlowPayloadContract = {
  kind: 'image-file',
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'],
};

describe('Gizlet flow registry', () => {
  test('declares a contract for every available Gizlet, or says it has none', () => {
    expect(hasCompleteFlowContracts()).toBe(true);
  });

  test('leaves a planned Gizlet out of the obligation entirely', () => {
    // A planned Gizlet reads and writes nothing, because there is no code to
    // read or write anything. Inventing a payload kind for it would put the
    // compatibility graph ahead of the implementation; the obligation lands
    // when the Gizlet becomes available.
    const contracted = new Set<string>(toolFlowRegistry.map((tool) => tool.toolSlug));

    for (const tool of getPlannedTools()) {
      expect(contracted, tool.slug).not.toContain(tool.slug);
      expect(flowlessToolSlugs as readonly string[], tool.slug).not.toContain(tool.slug);
    }

    expect(hasCompleteFlowContracts()).toBe(true);
  });

  test('catches a Gizlet that forgot its contract rather than declared none', () => {
    const forgetful = toolFlowRegistry.filter((tool) => tool.toolSlug !== 'compress-image');

    expect(hasCompleteFlowContracts(forgetful)).toBe(false);
    // The exemption has to be declared to count: without the list, the Gizlet
    // that deliberately has no contract is indistinguishable from that.
    expect(hasCompleteFlowContracts(toolFlowRegistry, [])).toBe(false);
  });

  test('keeps a Gizlet that declares no contract out of the graph entirely', () => {
    const contracted: readonly string[] = toolFlowRegistry.map((tool) => tool.toolSlug);

    for (const toolSlug of flowlessToolSlugs) {
      expect(contracted, toolSlug).not.toContain(toolSlug);
      expect(() => getFlowTool(toolSlug)).toThrow(/Missing flow contract/);
    }
  });

  test('stays in tool-registry order, which is the order the step dropdown offers', () => {
    const registryOrder: readonly string[] = toolRegistry.map((tool) => tool.slug);
    const flowOrder: readonly string[] = toolFlowRegistry.map((tool) => tool.toolSlug);

    expect(flowOrder).toEqual(registryOrder.filter((slug) => flowOrder.includes(slug)));
  });

  test('keeps the image flow executable, in registry order', () => {
    expect(getFlowToolsForInput(imageInput).map((tool) => tool.toolSlug)).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
      'crop-image',
      'collage-maker',
      'rotate-flip-image',
      'remove-image-metadata',
    ]);
    expect(getNextFlowTools('convert-image').map((tool) => tool.toolSlug)).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
      'crop-image',
      'collage-maker',
      'rotate-flip-image',
      'remove-image-metadata',
    ]);
    expect(canFlowTo('convert-image', 'resize-image')).toBe(true);
    expect(canFlowTo('convert-image', 'json-formatter')).toBe(false);
  });

  test('represents text payloads without image-specific fields', () => {
    expect(getFlowTool('json-ld-generator').output).toEqual({ kind: 'json-text' });
    expect(getFlowToolsForInput('json-text').map((tool) => tool.toolSlug)).toEqual([
      'json-formatter',
    ]);
    expect(canFlowTo('json-ld-generator', 'json-formatter')).toBe(true);
  });

  test('puts every image Gizlet upstream of the PDF Gizlet', () => {
    for (const toolSlug of ['compress-image', 'resize-image', 'convert-image', 'crop-image', 'collage-maker', 'rotate-flip-image', 'remove-image-metadata'] as const) {
      expect(canFlowTo(toolSlug, 'jpg-to-pdf'), toolSlug).toBe(true);
    }
  });

  test('hands the PDF on to every Gizlet that reads one', () => {
    expect(getFlowTool('jpg-to-pdf').output).toEqual({ kind: 'pdf-file' });
    expect(getFlowToolsForInput('pdf-file').map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
      'split-pdf',
    ]);
    expect(getNextFlowTools('jpg-to-pdf').map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
      'split-pdf',
    ]);
    expect(canFlowTo('jpg-to-pdf', 'merge-pdf')).toBe(true);
    expect(canFlowTo('jpg-to-pdf', 'split-pdf')).toBe(true);
    // Splitting keeps the payload a PDF, so the PDF Gizlets follow it too.
    expect(getNextFlowTools('split-pdf').map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
      'split-pdf',
    ]);
    // A PDF reaches an image Gizlet only through the one that converts it.
    expect(canFlowTo('jpg-to-pdf', 'compress-image')).toBe(false);
    expect(canFlowTo('pdf-to-jpg', 'compress-image')).toBe(true);
  });

  test('closes the loop: an image can become a PDF and come back as images', () => {
    expect(getNextFlowTools('pdf-to-jpg').map((tool) => tool.toolSlug)).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
      'crop-image',
      'collage-maker',
      'rotate-flip-image',
      'remove-image-metadata',
    ]);
    expect(
      isValidFlowSequence(imageInput, ['resize-image', 'jpg-to-pdf', 'pdf-to-jpg', 'compress-image']),
    ).toBe(true);
  });

  test('knows which chains end with a set of files rather than one', () => {
    expect(splitsFlowInput([])).toBe(false);
    expect(splitsFlowInput(['resize-image', 'compress-image'])).toBe(false);
    expect(splitsFlowInput(['jpg-to-pdf'])).toBe(false);
    expect(splitsFlowInput(['jpg-to-pdf', 'pdf-to-jpg'])).toBe(true);
    // Splitting keeps the payload kind, so its set is read from the property
    // rather than guessed from the hand-off.
    expect(splitsFlowInput(['jpg-to-pdf', 'split-pdf'])).toBe(true);
    expect(splitsFlowInput(['jpg-to-pdf', 'split-pdf', 'pdf-to-jpg'])).toBe(true);
    expect(splitsFlowInput(['jpg-to-pdf', 'pdf-to-jpg', 'compress-image'])).toBe(true);
    // The last step of either kind decides, so combining after splitting is one
    // file again rather than a set.
    expect(splitsFlowInput(['jpg-to-pdf', 'pdf-to-jpg', 'jpg-to-pdf'])).toBe(false);
  });

  test('knows which chains turn several starting payloads into one', () => {
    expect(combinesFlowInputs([])).toBe(false);
    expect(combinesFlowInputs(['resize-image', 'compress-image'])).toBe(false);
    expect(combinesFlowInputs(['resize-image', 'jpg-to-pdf'])).toBe(true);
    expect(combinesFlowInputs(['jpg-to-pdf'])).toBe(true);
  });

  /**
   * Merge PDF reads a PDF, so the payload kinds line up after Image to PDF —
   * but the payload reaching it there is the single document that step just
   * made, and there is nothing to join a lone document to.
   */
  test('will not put a combining step where its payload is already one file', () => {
    expect(getFlowTool('merge-pdf').combinesInputs).toBe(true);
    expect(canFlowTo('jpg-to-pdf', 'merge-pdf')).toBe(true);
    expect(isValidFlowSequence(imageInput, ['jpg-to-pdf', 'merge-pdf'])).toBe(false);
    // So it is never offered as the step after one, whichever way the chain
    // arrived there — while the Gizlet that takes that document apart is,
    // because a lone document is exactly what it wants.
    expect(getNextFlowSteps(imageInput, ['jpg-to-pdf']).map((tool) => tool.toolSlug)).toEqual([
      'pdf-to-jpg',
      'split-pdf',
    ]);
    expect(
      getNextFlowSteps(imageInput, ['resize-image', 'jpg-to-pdf']).map((tool) => tool.toolSlug),
    ).toEqual(['pdf-to-jpg', 'split-pdf']);
  });

  /**
   * What the rule refuses is a merge with nothing to merge, not the Gizlet. A
   * flow that starts from several PDFs is exactly what its contract is for.
   */
  test('keeps a combining step valid where the payload really is several', () => {
    const pdfInput: FlowPayloadContract = { kind: 'pdf-file' };

    expect(isValidFlowSequence(pdfInput, ['merge-pdf'])).toBe(true);
    expect(getNextFlowSteps(pdfInput, []).map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
      'split-pdf',
    ]);
    expect(isValidFlowSequence(pdfInput, ['merge-pdf', 'merge-pdf'])).toBe(false);
    expect(getNextFlowSteps(pdfInput, ['merge-pdf']).map((tool) => tool.toolSlug)).toEqual([
      'pdf-to-jpg',
      'split-pdf',
    ]);
    // Splitting a merged document leaves several again, so a second merge has
    // something to join once more.
    expect(isValidFlowSequence(pdfInput, ['merge-pdf', 'split-pdf', 'merge-pdf'])).toBe(true);
  });

  test('offers the steps that read the starting payload to an empty chain', () => {
    expect(getNextFlowSteps(imageInput, []).map((tool) => tool.toolSlug)).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
      'crop-image',
      'collage-maker',
      'rotate-flip-image',
      'remove-image-metadata',
    ]);
    expect(getNextFlowSteps(imageInput, ['convert-image']).map((tool) => tool.toolSlug)).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
      'crop-image',
      'collage-maker',
      'rotate-flip-image',
      'remove-image-metadata',
    ]);
  });

  test('validates and reorders pipeline configuration deterministically', () => {
    const imageSequence = ['convert-image', 'resize-image', 'compress-image'] as const;

    expect(isValidFlowSequence(imageInput, imageSequence)).toBe(true);
    expect(isValidFlowSequence(imageInput, [...imageSequence, 'jpg-to-pdf'])).toBe(true);
    expect(isValidFlowSequence(imageInput, ['jpg-to-pdf', 'compress-image'])).toBe(false);
    expect(isValidFlowSequence(imageInput, ['convert-image', 'json-formatter'])).toBe(false);
    expect(canReorderFlowStep(imageInput, imageSequence, 2, 0)).toBe(true);
    expect(canReorderFlowStep(imageInput, imageSequence, 3, 0)).toBe(false);
  });

  test('will not let a combining step be reordered ahead of the steps that feed it', () => {
    const chain = ['resize-image', 'jpg-to-pdf'] as const;

    expect(canReorderFlowStep(imageInput, chain, 1, 0)).toBe(false);
    expect(canReorderFlowStep(imageInput, chain, 0, 1)).toBe(false);
  });
});

/**
 * The compatibility rule is that payload kinds line up, so it has to hold for
 * contracts the live registry does not contain yet. These run the same
 * functions over injected definitions: declaring a Gizlet that reads a PDF has
 * to make it available after Image to PDF, and one that turns a PDF back into an
 * image has to make the image Gizlets available after itself — with no change
 * to the graph code and no adjacency list to edit.
 */
describe('the compatibility rule, against contracts that do not exist yet', () => {
  const compressPdf: ToolFlowDefinition = {
    toolSlug: 'compress-pdf',
    input: { kind: 'pdf-file' },
    output: { kind: 'pdf-file' },
  };
  const definitions: readonly ToolFlowDefinition[] = [...toolFlowRegistry, compressPdf];

  test('offers a further PDF Gizlet after Image to PDF as soon as one declares itself', () => {
    expect(getNextFlowTools('jpg-to-pdf', definitions).map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
      'split-pdf',
      'compress-pdf',
    ]);
    expect(canFlowTo('jpg-to-pdf', 'compress-pdf', definitions)).toBe(true);
  });

  test('offers the same PDF Gizlets after one that hands a PDF on', () => {
    expect(getNextFlowTools('compress-pdf', definitions).map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
      'split-pdf',
      'compress-pdf',
    ]);
    expect(canFlowTo('compress-pdf', 'pdf-to-jpg', definitions)).toBe(true);
  });

  test('reads a splitting step that keeps its payload kind', () => {
    expect(splitsFlowInput(['jpg-to-pdf', 'split-pdf'], definitions)).toBe(true);
    expect(splitsFlowInput(['jpg-to-pdf', 'split-pdf', 'jpg-to-pdf'], definitions)).toBe(false);
    expect(splitsFlowInput(['jpg-to-pdf', 'compress-pdf'], definitions)).toBe(false);
  });

  test('validates a whole image → PDF → image chain without a special case', () => {
    expect(
      isValidFlowSequence(
        imageInput,
        ['resize-image', 'jpg-to-pdf', 'compress-pdf', 'pdf-to-jpg', 'compress-image'],
        definitions,
      ),
    ).toBe(true);
    expect(
      isValidFlowSequence(imageInput, ['resize-image', 'pdf-to-jpg'], definitions),
    ).toBe(false);
  });

  test('still refuses a hand-off the payload kinds do not permit', () => {
    expect(canFlowTo('pdf-to-jpg', 'compress-pdf', definitions)).toBe(false);
    expect(canFlowTo('compress-image', 'compress-pdf', definitions)).toBe(false);
  });

  test('treats a one-to-one PDF Gizlet as one-to-one, rather than guessing from its payload', () => {
    expect(combinesFlowInputs(['jpg-to-pdf', 'compress-pdf'], definitions)).toBe(true);
    expect(combinesFlowInputs(['pdf-to-jpg', 'compress-image'], definitions)).toBe(false);
    expect(splitsFlowInput(['jpg-to-pdf', 'compress-pdf'], definitions)).toBe(false);
  });
});

describe('how many payloads a chain takes', () => {
  test('uses the category’s ceiling while nothing in the chain names its own', () => {
    const images = getFlowCategory('images');

    expect(getFlowCombiningLimit(images, []).limit).toBe(images.combiningLimit);
    expect(getFlowCombiningLimit(images, ['jpg-to-pdf']).limit).toBe(images.combiningLimit);
    expect(getFlowCombiningLimit(getFlowCategory('pdf'), ['merge-pdf']).limit).toBe(
      getFlowCategory('pdf').combiningLimit,
    );
  });

  test('lets a combining Gizlet with a different job name its own', () => {
    // Assembling pages and arranging a collage are different jobs, so the
    // ceiling belongs to the step rather than to the category holding both.
    const { limit, describeCount } = getFlowCombiningLimit(getFlowCategory('images'), [
      'collage-maker',
      'rotate-flip-image',
      'remove-image-metadata',
    ]);

    expect(limit).toBe(maximumCollageImages);
    expect(limit).not.toBe(getFlowCategory('images').combiningLimit);
    expect(describeCount(limit)).toBe(describeCollageImageCount(limit));
  });

  test('asks only the combining step, of which a valid chain has at most one', () => {
    expect(getFlowCombiningLimit(getFlowCategory('images'), ['collage-maker', 'compress-image']).limit).toBe(
      maximumCollageImages,
    );
    expect(isValidFlowSequence(getFlowCategory('images').input, ['collage-maker', 'jpg-to-pdf'])).toBe(
      false,
    );
  });
});

describe('flow categories', () => {
  test('offers a category only while a published Gizlet can start it', () => {
    const offered = getAvailableFlowCategories().map((category) => category.id as FlowCategoryId);

    expect(offered).toEqual(['images', 'pdf']);

    for (const id of offered) {
      expect(getFlowCategoryStartSlugs(id).length).toBeGreaterThan(0);
    }
  });

  test('derives the starting Gizlets from the contracts rather than a list', () => {
    // Every Gizlet whose input is the category's payload, and no other.
    expect(getFlowCategoryStartSlugs('images')).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
      'crop-image',
      'collage-maker',
      'rotate-flip-image',
      'remove-image-metadata',
    ]);
    expect(getFlowCategoryStartSlugs('pdf')).toEqual(['merge-pdf', 'pdf-to-jpg', 'split-pdf']);
  });

  test('gives the PDF category the starting payload the PDF Gizlets declare', () => {
    const { input } = getFlowCategory('pdf');

    expect(input.kind).toBe('pdf-file');

    for (const slug of getFlowCategoryStartSlugs('pdf')) {
      expect(isValidFlowSequence(input, [slug])).toBe(true);
    }
  });

  /**
   * A merge was reachable in the contracts and unreachable in the product: this
   * is the chain 0.4.0's changelog described and no visitor could build.
   */
  test('lets a PDF flow merge documents and then take them apart again', () => {
    const { input } = getFlowCategory('pdf');

    expect(isValidFlowSequence(input, ['merge-pdf'])).toBe(true);
    expect(isValidFlowSequence(input, ['merge-pdf', 'split-pdf'])).toBe(true);
    expect(isValidFlowSequence(input, ['merge-pdf', 'pdf-to-jpg', 'jpg-to-pdf'])).toBe(true);
    // Two combining steps in a row still have nothing to join the second time.
    expect(isValidFlowSequence(input, ['merge-pdf', 'merge-pdf'])).toBe(false);
  });

  test('keeps the categories apart: neither starting payload feeds the other`s Gizlets', () => {
    expect(isValidFlowSequence(getFlowCategory('pdf').input, ['compress-image'])).toBe(false);
    expect(isValidFlowSequence(getFlowCategory('images').input, ['split-pdf'])).toBe(false);
  });

  test('recognises only the ids it offers', () => {
    expect(isFlowCategoryId('images')).toBe(true);
    expect(isFlowCategoryId('pdf')).toBe(true);
    expect(isFlowCategoryId('pdfs')).toBe(false);
    expect(isFlowCategoryId('')).toBe(false);
    expect(() => getFlowCategory('json' as never)).toThrow();
  });

  test('starts from images when nothing has chosen, which is what every old link meant', () => {
    expect(defaultFlowCategoryId).toBe('images');
    expect(isFlowCategoryId(defaultFlowCategoryId)).toBe(true);
  });
});

describe('the image format a chain can honour', () => {
  test('offers nothing when no step re-encodes an image', () => {
    expect(getFlowFormatControl([]).kind).toBe('none');
    expect(getFlowFormatControl(['jpg-to-pdf']).kind).toBe('none');
    expect(getFlowFormatControl(['merge-pdf']).kind).toBe('none');
    expect(getFlowFormatControl(['split-pdf']).kind).toBe('none');
    expect(getFlowFormatControl(['merge-pdf', 'split-pdf']).kind).toBe('none');
  });

  test('names the output format when the chain ends in images', () => {
    for (const chain of [
      ['compress-image'],
      ['resize-image', 'convert-image'],
      ['pdf-to-jpg'],
      ['jpg-to-pdf', 'pdf-to-jpg'],
      ['compress-image', 'jpg-to-pdf', 'split-pdf', 'pdf-to-jpg'],
    ] as const) {
      const control = getFlowFormatControl(chain);

      expect(control).toMatchObject({
        kind: 'output',
        label: 'Final output format',
        formats: ['image/jpeg', 'image/png', 'image/webp'],
      });
    }
  });

  /**
   * The defect this replaces: a chain ending in a set of PDFs offered a "final
   * output format" of WebP, naming the format of a file it never produced.
   */
  test('names the page format, and drops WebP, whenever the chain ends in a PDF', () => {
    for (const chain of [
      ['compress-image', 'jpg-to-pdf'],
      ['convert-image', 'jpg-to-pdf', 'split-pdf'],
      ['resize-image', 'jpg-to-pdf', 'split-pdf', 'merge-pdf'],
      ['jpg-to-pdf', 'pdf-to-jpg', 'jpg-to-pdf'],
      ['split-pdf', 'pdf-to-jpg', 'jpg-to-pdf'],
    ] as const) {
      const control = getFlowFormatControl(chain);

      expect(control).toMatchObject({ kind: 'pages', label: 'Page image format' });
      expect(control.kind === 'pages' && control.formats).toEqual(['image/jpeg', 'image/png']);
    }
  });

  test('agrees with itself over every chain the graph allows from either category', () => {
    const chains: string[][] = [];

    for (const category of getAvailableFlowCategories()) {
      const walk = (chain: string[]) => {
        if (chain.length > 0) chains.push([...chain]);
        if (chain.length >= 4) return;

        for (const { toolSlug } of toolFlowRegistry) {
          const next = [...chain, toolSlug];
          if (isValidFlowSequence(category.input, next)) walk(next);
        }
      };

      walk([]);
    }

    expect(chains.length).toBeGreaterThan(200);

    for (const chain of chains) {
      const control = getFlowFormatControl(chain);
      const endsInPdf = getFlowTool(chain[chain.length - 1]).output.kind === 'pdf-file';

      if (control.kind === 'none') continue;

      // The label and the formats both follow from what the chain produces, so
      // neither can describe a file the other does not.
      expect(control.kind).toBe(endsInPdf ? 'pages' : 'output');
      expect(control.formats.includes('image/webp')).toBe(!endsInPdf);
    }
  });

  test('moves a format the chain cannot honour rather than leaving it stale', () => {
    const pages = getFlowFormatControl(['compress-image', 'jpg-to-pdf']);
    const output = getFlowFormatControl(['compress-image']);

    expect(getUsableFlowFormat(pages, 'image/webp')).toBe('image/jpeg');
    expect(getUsableFlowFormat(pages, 'image/png')).toBe('image/png');
    expect(getUsableFlowFormat(output, 'image/webp')).toBe('image/webp');
    expect(getUsableFlowFormat({ kind: 'none' }, 'image/webp')).toBeUndefined();
  });
});
