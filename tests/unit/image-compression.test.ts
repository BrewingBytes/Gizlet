import { describe, expect, test } from 'vitest';

import {
  formatFileSize,
  formatSizeChange,
  getFormatLabel,
  getInputImageFormat,
  getOutputFilename,
  getPreferredOutputFormat,
  isImageOutputFormat,
  isSupportedImageFile,
} from '../../src/data/image-compression';

describe('image compression helpers', () => {
  test('recognises supported image MIME types and filename extensions', () => {
    expect(isSupportedImageFile({ name: 'photo.jpeg', type: 'image/jpeg' })).toBe(true);
    expect(isSupportedImageFile({ name: 'photo.webp', type: '' })).toBe(true);
    expect(isSupportedImageFile({ name: 'photo.avif', type: 'image/avif' })).toBe(true);
    expect(isSupportedImageFile({ name: 'photo.bmp', type: '' })).toBe(true);
    expect(isSupportedImageFile({ name: 'document.pdf', type: 'application/pdf' })).toBe(false);
  });

  test('uses the input image format as the default output format', () => {
    expect(getInputImageFormat({ name: 'photo.jpg', type: 'image/jpeg' })).toBe('image/jpeg');
    expect(getInputImageFormat({ name: 'photo.png', type: '' })).toBe('image/png');
    expect(getInputImageFormat({ name: 'photo.webp', type: 'application/octet-stream' })).toBe(
      'image/webp',
    );
    expect(getInputImageFormat({ name: 'photo.avif', type: 'image/avif' })).toBe('image/avif');
    expect(getInputImageFormat({ name: 'photo.bmp', type: '' })).toBe('image/bmp');
    expect(getInputImageFormat({ name: 'notes.txt', type: 'text/plain' })).toBeUndefined();
  });

  test('preserves supported output types and suggests WebP for AVIF and BMP inputs', () => {
    expect(getPreferredOutputFormat('image/jpeg')).toBe('image/jpeg');
    expect(getPreferredOutputFormat('image/avif')).toBe('image/webp');
    expect(getPreferredOutputFormat('image/bmp')).toBe('image/webp');
    expect(getPreferredOutputFormat(undefined)).toBe('image/webp');
  });

  test('creates download names for every supported output format', () => {
    expect(getOutputFilename('summer.photo.png', 'image/jpeg')).toBe('summer.photo-compressed.jpg');
    expect(getOutputFilename('image', 'image/png')).toBe('image-compressed.png');
    expect(getOutputFilename('.png', 'image/webp')).toBe('image-compressed.webp');
    expect(getFormatLabel('image/webp')).toBe('WebP');
  });

  test('formats file sizes and makes size changes truthful', () => {
    expect(formatFileSize(700)).toBe('700 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(formatSizeChange(1000, 180)).toBe('82% smaller');
    expect(formatSizeChange(1000, 1100)).toBe('10% larger');
    expect(formatSizeChange(0, 0)).toBe('Size comparison unavailable');
  });

  test('narrows browser output formats', () => {
    expect(isImageOutputFormat('image/png')).toBe(true);
    expect(isImageOutputFormat('image/avif')).toBe(false);
  });
});
