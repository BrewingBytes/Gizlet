import { describe, expect, test } from 'vitest';

import {
  canFlowTo,
  canReorderFlowStep,
  getFlowTool,
  getFlowToolsForInput,
  getNextFlowTools,
  hasCompleteFlowContracts,
  isValidFlowSequence,
} from '../../src/data/tool-flows';

describe('Gizlet flow registry', () => {
  test('declares a contract for every catalogued Gizlet', () => {
    expect(hasCompleteFlowContracts()).toBe(true);
  });

  test('keeps the image flow executable through explicit relationships', () => {
    expect(getFlowToolsForInput({
      kind: 'image-file',
      acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'],
    }).map((tool) => tool.toolSlug)).toEqual(expect.arrayContaining([
      'convert-image',
      'resize-image',
      'compress-image',
    ]));
    expect(getNextFlowTools('convert-image').map((tool) => tool.toolSlug)).toEqual([
      'convert-image',
      'resize-image',
      'compress-image',
      'jpg-to-pdf',
    ]);
    expect(canFlowTo('convert-image', 'resize-image')).toBe(true);
    expect(canFlowTo('convert-image', 'json-formatter')).toBe(false);
  });

  test('puts every image Gizlet upstream of the PDF Gizlet', () => {
    expect(getFlowToolsForInput({
      kind: 'image-file',
      acceptedFormats: ['image/jpeg'],
    }).map((tool) => tool.toolSlug)).toContain('jpg-to-pdf');

    for (const toolSlug of ['compress-image', 'resize-image', 'convert-image'] as const) {
      expect(canFlowTo(toolSlug, 'jpg-to-pdf'), toolSlug).toBe(true);
    }
  });

  test('treats a PDF as a terminal payload no Gizlet reads back in', () => {
    expect(getFlowTool('jpg-to-pdf').output).toEqual({ kind: 'pdf-file' });
    expect(getFlowToolsForInput({ kind: 'pdf-file' })).toEqual([]);
    expect(getNextFlowTools('jpg-to-pdf')).toEqual([]);
    expect(canFlowTo('jpg-to-pdf', 'compress-image')).toBe(false);
  });

  test('represents text payloads without image-specific fields', () => {
    expect(getFlowTool('json-ld-generator').output).toEqual({ kind: 'json-text' });
    expect(getFlowToolsForInput({ kind: 'json-text' }).map((tool) => tool.toolSlug)).toEqual([
      'json-formatter',
    ]);
    expect(canFlowTo('json-ld-generator', 'json-formatter')).toBe(true);
  });

  test('validates and reorders pipeline configuration deterministically', () => {
    const imageInput = {
      kind: 'image-file' as const,
      acceptedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'] as const,
    };
    const imageSequence = ['convert-image', 'resize-image', 'compress-image'] as const;

    expect(isValidFlowSequence(imageInput, imageSequence)).toBe(true);
    expect(isValidFlowSequence(imageInput, [...imageSequence, 'jpg-to-pdf'])).toBe(true);
    expect(isValidFlowSequence(imageInput, ['jpg-to-pdf', 'compress-image'])).toBe(false);
    expect(isValidFlowSequence(imageInput, ['convert-image', 'json-formatter'])).toBe(false);
    expect(canReorderFlowStep(imageInput, imageSequence, 2, 0)).toBe(true);
    expect(canReorderFlowStep(imageInput, imageSequence, 3, 0)).toBe(false);
  });
});
