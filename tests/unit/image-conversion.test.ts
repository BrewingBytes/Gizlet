import { describe, expect, test } from 'vitest';

import {
  getConversionOutputFilename,
  getSourceFormat,
  getSourceFormatLabel,
  losesTransparency,
} from '../../src/data/image-conversion';

describe('image conversion helpers', () => {
  test('detects practical input formats and labels them for the workspace', () => {
    expect(getSourceFormat({ name: 'holiday.JPG', type: '' })).toBe('image/jpeg');
    expect(getSourceFormat({ name: 'illustration.avif', type: 'image/avif' })).toBe('image/avif');
    expect(getSourceFormat({ name: 'notes.txt', type: 'text/plain' })).toBeUndefined();
    expect(getSourceFormatLabel('image/webp')).toBe('WebP');
  });

  test('uses selected format extensions and warns only when JPEG will flatten alpha', () => {
    expect(getConversionOutputFilename('summer.photo.png', 'image/jpeg')).toBe('summer.photo-converted.jpg');
    expect(getConversionOutputFilename('image', 'image/png')).toBe('image-converted.png');
    expect(getConversionOutputFilename('.webp', 'image/webp')).toBe('image-converted.webp');
    expect(losesTransparency(true, 'image/jpeg')).toBe(true);
    expect(losesTransparency(true, 'image/png')).toBe(false);
    expect(losesTransparency(false, 'image/jpeg')).toBe(false);
  });
});
