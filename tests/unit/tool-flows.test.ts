import { describe, expect, test } from 'vitest';

import {
  canFlowTo,
  canReorderFlowStep,
  combinesFlowInputs,
  flowlessToolSlugs,
  getFlowTool,
  getFlowToolsForInput,
  getNextFlowTools,
  hasCompleteFlowContracts,
  isValidFlowSequence,
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

  test('ends the image flow at the PDF, because no Gizlet reads one yet', () => {
    expect(getFlowTool('jpg-to-pdf').output).toEqual({ kind: 'pdf-file' });
    // Empty because nothing consumes a PDF, not because the payload was
    // declared a dead end: the injected contracts below prove the difference.
    expect(getFlowToolsForInput('pdf-file')).toEqual([]);
    expect(getNextFlowTools('jpg-to-pdf')).toEqual([]);
    // A PDF still cannot go back to an image Gizlet: nothing converts one yet.
    expect(canFlowTo('jpg-to-pdf', 'compress-image')).toBe(false);
  });

  test('knows which chains turn several starting payloads into one', () => {
    expect(combinesFlowInputs([])).toBe(false);
    expect(combinesFlowInputs(['resize-image', 'compress-image'])).toBe(false);
    expect(combinesFlowInputs(['resize-image', 'jpg-to-pdf'])).toBe(true);
    expect(combinesFlowInputs(['jpg-to-pdf'])).toBe(true);
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
  const pdfToJpg: ToolFlowDefinition = {
    toolSlug: 'pdf-to-jpg',
    input: { kind: 'pdf-file' },
    output: {
      kind: 'image-file',
      acceptedFormats: ['image/jpeg', 'image/png'],
      producedFormats: ['image/jpeg', 'image/png'],
    },
  };
  const compressPdf: ToolFlowDefinition = {
    toolSlug: 'compress-pdf',
    input: { kind: 'pdf-file' },
    output: { kind: 'pdf-file' },
  };
  const definitions: readonly ToolFlowDefinition[] = [...toolFlowRegistry, pdfToJpg, compressPdf];

  test('offers a further PDF Gizlet after Image to PDF as soon as one declares itself', () => {
    expect(getNextFlowTools('jpg-to-pdf', definitions).map((tool) => tool.toolSlug)).toEqual([
      'pdf-to-jpg',
      'compress-pdf',
    ]);
    expect(canFlowTo('jpg-to-pdf', 'pdf-to-jpg', definitions)).toBe(true);
    expect(canFlowTo('jpg-to-pdf', 'compress-pdf', definitions)).toBe(true);
  });

  test('offers the image Gizlets again after a Gizlet that turns a PDF into images', () => {
    expect(getNextFlowTools('pdf-to-jpg', definitions).map((tool) => tool.toolSlug)).toEqual([
      'compress-image',
      'resize-image',
      'convert-image',
      'jpg-to-pdf',
    ]);
    expect(getNextFlowTools('compress-pdf', definitions).map((tool) => tool.toolSlug)).toEqual([
      'pdf-to-jpg',
      'compress-pdf',
    ]);
    expect(canFlowTo('pdf-to-jpg', 'resize-image', definitions)).toBe(true);
  });

  test('validates a whole image → PDF → image chain without a special case', () => {
    expect(
      isValidFlowSequence(
        imageInput,
        ['resize-image', 'jpg-to-pdf', 'pdf-to-jpg', 'compress-image'],
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
  });
});
