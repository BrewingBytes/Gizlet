import { describe, expect, test } from 'vitest';

import {
  canFlowTo,
  canReorderFlowStep,
  combinesFlowInputs,
  flowlessToolSlugs,
  getFlowTool,
  getFlowToolsForInput,
  getNextFlowSteps,
  getNextFlowTools,
  hasCompleteFlowContracts,
  isValidFlowSequence,
  splitsFlowInput,
  toolFlowRegistry,
  type FlowPayloadContract,
  type ToolFlowDefinition,
} from '../../src/data/tool-flows';
import { toolRegistry } from '../../src/data/tools';

const imageInput: FlowPayloadContract = {
  kind: 'image-file',
  acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'],
};

describe('Gizlet flow registry', () => {
  test('declares a contract for every catalogued Gizlet, or says it has none', () => {
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
    ]);
    expect(getNextFlowTools('convert-image').map((tool) => tool.toolSlug)).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
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
    for (const toolSlug of ['compress-image', 'resize-image', 'convert-image'] as const) {
      expect(canFlowTo(toolSlug, 'jpg-to-pdf'), toolSlug).toBe(true);
    }
  });

  test('hands the PDF on to both Gizlets that read one', () => {
    expect(getFlowTool('jpg-to-pdf').output).toEqual({ kind: 'pdf-file' });
    expect(getFlowToolsForInput('pdf-file').map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
    ]);
    expect(getNextFlowTools('jpg-to-pdf').map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
    ]);
    expect(canFlowTo('jpg-to-pdf', 'merge-pdf')).toBe(true);
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
    ]);
    expect(
      getNextFlowSteps(imageInput, ['resize-image', 'jpg-to-pdf']).map((tool) => tool.toolSlug),
    ).toEqual(['pdf-to-jpg']);
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
    ]);
    expect(isValidFlowSequence(pdfInput, ['merge-pdf', 'merge-pdf'])).toBe(false);
    expect(getNextFlowSteps(pdfInput, ['merge-pdf']).map((tool) => tool.toolSlug)).toEqual([
      'pdf-to-jpg',
    ]);
  });

  test('offers the steps that read the starting payload to an empty chain', () => {
    expect(getNextFlowSteps(imageInput, []).map((tool) => tool.toolSlug)).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
    ]);
    expect(getNextFlowSteps(imageInput, ['convert-image']).map((tool) => tool.toolSlug)).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
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
  const splitPdf: ToolFlowDefinition = {
    toolSlug: 'split-pdf',
    input: { kind: 'pdf-file' },
    output: { kind: 'pdf-file' },
    splitsInput: true,
  };
  const definitions: readonly ToolFlowDefinition[] = [...toolFlowRegistry, compressPdf, splitPdf];

  test('offers a further PDF Gizlet after Image to PDF as soon as one declares itself', () => {
    expect(getNextFlowTools('jpg-to-pdf', definitions).map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
      'compress-pdf',
      'split-pdf',
    ]);
    expect(canFlowTo('jpg-to-pdf', 'compress-pdf', definitions)).toBe(true);
  });

  test('offers the same PDF Gizlets after one that hands a PDF on', () => {
    expect(getNextFlowTools('compress-pdf', definitions).map((tool) => tool.toolSlug)).toEqual([
      'merge-pdf',
      'pdf-to-jpg',
      'compress-pdf',
      'split-pdf',
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
