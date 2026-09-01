import { describe, expect, test } from 'vitest';

import {
  dimensionsFromHeight,
  dimensionsFromPercentage,
  dimensionsFromWidth,
  getResizeOutputFilename,
  isLargeImage,
  validateResizeDimensions,
} from '../../src/data/image-resize';

describe('image resize helpers', () => {
  test('keeps the source aspect ratio when a width or height changes', () => {
    const source = { width: 1200, height: 800 };

    expect(dimensionsFromWidth(source, 600)).toEqual({ width: 600, height: 400 });
    expect(dimensionsFromHeight(source, 200)).toEqual({ width: 300, height: 200 });
  });

  test('calculates percentage dimensions and keeps at least one pixel', () => {
    expect(dimensionsFromPercentage({ width: 1200, height: 800 }, 25)).toEqual({ width: 300, height: 200 });
    expect(dimensionsFromPercentage({ width: 1, height: 1 }, 1)).toEqual({ width: 1, height: 1 });
  });

  test('blocks invalid or impractical output dimensions with clear feedback', () => {
    expect(validateResizeDimensions({ width: 0, height: 200 })).toBe('Enter whole-number dimensions greater than zero.');
    expect(validateResizeDimensions({ width: 16_385, height: 200 })).toContain('16,384');
    expect(validateResizeDimensions({ width: 10_000, height: 10_000 })).toContain('40,000,000');
    expect(validateResizeDimensions({ width: 1200, height: 800 })).toBeUndefined();
  });

  test('identifies large images before processing and names downloads accurately', () => {
    expect(isLargeImage({ width: 4000, height: 4000 })).toBe(true);
    expect(isLargeImage({ width: 1200, height: 800 })).toBe(false);
    expect(getResizeOutputFilename('summer.photo.png', 'image/webp')).toBe('summer.photo-resized.webp');
  });
});
