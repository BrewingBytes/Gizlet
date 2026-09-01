import type { ImageOutputFormat } from './image-compression';

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export const maximumImageDimension = 16_384;
export const maximumImagePixels = 40_000_000;
export const largeImagePixels = 16_000_000;

const outputExtensions: Record<ImageOutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function roundedDimension(value: number): number {
  return Math.max(1, Math.round(value));
}

export function dimensionsFromWidth(source: ImageDimensions, width: number): ImageDimensions {
  return {
    width: roundedDimension(width),
    height: roundedDimension((width * source.height) / source.width),
  };
}

export function dimensionsFromHeight(source: ImageDimensions, height: number): ImageDimensions {
  return {
    width: roundedDimension((height * source.width) / source.height),
    height: roundedDimension(height),
  };
}

export function dimensionsFromPercentage(source: ImageDimensions, percentage: number): ImageDimensions {
  return {
    width: roundedDimension((source.width * percentage) / 100),
    height: roundedDimension((source.height * percentage) / 100),
  };
}

export function validateResizeDimensions(dimensions: ImageDimensions): string | undefined {
  const { width, height } = dimensions;

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return 'Enter whole-number dimensions greater than zero.';
  }

  if (width > maximumImageDimension || height > maximumImageDimension) {
    return `Keep each side at ${maximumImageDimension.toLocaleString()} pixels or less.`;
  }

  if (width * height > maximumImagePixels) {
    return `Keep the result below ${maximumImagePixels.toLocaleString()} pixels.`;
  }

  return undefined;
}

export function isLargeImage(dimensions: ImageDimensions): boolean {
  return dimensions.width * dimensions.height >= largeImagePixels;
}

export function getResizeOutputFilename(inputName: string, format: ImageOutputFormat): string {
  const basename = inputName.replace(/\.[^.]+$/, '') || 'image';

  return `${basename}-resized.${outputExtensions[format]}`;
}
