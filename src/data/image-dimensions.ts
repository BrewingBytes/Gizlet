import { getFormatLabel, isImageOutputFormat, type ImageInputFormat } from './image-compression';
import type { ImageDimensions } from './image-resize';

/**
 * Reading a picture's shape back, and saying it the way a person would.
 *
 * Everything here is a formatting decision rather than a measurement: the
 * numbers come from the browser's own decode. What is worth testing is how they
 * are said — which is why an aspect ratio that reduces to nothing useful has a
 * rule of its own rather than being printed raw.
 */

/** The shape a picture is, in the word people use for it. */
export type ImageShape = 'landscape' | 'portrait' | 'square';

export const imageShapeLabels = {
  landscape: 'Landscape',
  portrait: 'Portrait',
  square: 'Square',
} as const satisfies Record<ImageShape, string>;

/**
 * The ratios worth recognising by name.
 *
 * A picture from a real camera is rarely an exact 16:9 — it is 4032 by 2268,
 * which reduces to 16:9, or 4000 by 2250, which does not reduce to anything a
 * person would recognise. Naming the near ones is the difference between a
 * useful answer and a long division.
 */
const namedRatios = [
  { label: '1:1', value: 1 },
  { label: '5:4', value: 5 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:10', value: 16 / 10 },
  { label: '16:9', value: 16 / 9 },
  { label: '2:1', value: 2 },
  { label: '21:9', value: 21 / 9 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:4', value: 3 / 4 },
  { label: '2:3', value: 2 / 3 },
  { label: '10:16', value: 10 / 16 },
  { label: '9:16', value: 9 / 16 },
] as const;

/** How close a ratio has to be to a named one to be called by its name. */
const namedRatioTolerance = 0.01;

/** The largest reduced side that still reads as a ratio rather than as noise. */
const readableRatioLimit = 50;

function greatestCommonDivisor(first: number, second: number): number {
  let left = Math.abs(Math.round(first));
  let right = Math.abs(Math.round(second));

  while (right > 0) {
    [left, right] = [right, left % right];
  }

  return left || 1;
}

export function isUsableImageDimensions(dimensions: ImageDimensions): boolean {
  return (
    Number.isFinite(dimensions.width) &&
    Number.isFinite(dimensions.height) &&
    dimensions.width >= 1 &&
    dimensions.height >= 1
  );
}

/** The sides divided by everything they have in common. */
export function reduceAspectRatio(dimensions: ImageDimensions): ImageDimensions {
  if (!isUsableImageDimensions(dimensions)) return { width: 0, height: 0 };

  const divisor = greatestCommonDivisor(dimensions.width, dimensions.height);

  return {
    width: Math.round(dimensions.width) / divisor,
    height: Math.round(dimensions.height) / divisor,
  };
}

/**
 * The aspect ratio, said the most useful way this particular picture allows.
 *
 * A ratio that reduces small is printed as it is. One that reduces to something
 * nobody recognises but sits within a percent of a common shape is named as
 * that shape, marked approximate. Anything else is a decimal, which is at least
 * true.
 */
export function describeAspectRatio(dimensions: ImageDimensions): string {
  if (!isUsableImageDimensions(dimensions)) return 'Unavailable';

  const reduced = reduceAspectRatio(dimensions);

  if (reduced.width <= readableRatioLimit && reduced.height <= readableRatioLimit) {
    return `${reduced.width}:${reduced.height}`;
  }

  const ratio = dimensions.width / dimensions.height;
  const named = namedRatios.find(
    (candidate) => Math.abs(candidate.value - ratio) / candidate.value <= namedRatioTolerance,
  );

  if (named) return `≈ ${named.label}`;

  return `${ratio.toFixed(2)}:1`;
}

/** How many pixels there are, in the unit a camera advertises. */
export function describeMegapixels(dimensions: ImageDimensions): string {
  if (!isUsableImageDimensions(dimensions)) return 'Unavailable';

  const megapixels = (dimensions.width * dimensions.height) / 1_000_000;

  if (megapixels < 0.1) return 'Under 0.1 MP';

  return `${megapixels < 10 ? megapixels.toFixed(1) : Math.round(megapixels)} MP`;
}

export function getImageShape(dimensions: ImageDimensions): ImageShape {
  if (dimensions.width === dimensions.height) return 'square';

  return dimensions.width > dimensions.height ? 'landscape' : 'portrait';
}

export function describeImageShape(dimensions: ImageDimensions): string {
  if (!isUsableImageDimensions(dimensions)) return 'Unavailable';

  return imageShapeLabels[getImageShape(dimensions)];
}

/** The dimensions themselves, which is the line most visitors came to copy. */
export function describeImageDimensions(dimensions: ImageDimensions): string {
  if (!isUsableImageDimensions(dimensions)) return 'Unavailable';

  return `${Math.round(dimensions.width)} × ${Math.round(dimensions.height)}`;
}

/** What the file is, named the way the format is written rather than typed. */
export function describeImageFormat(format: ImageInputFormat | undefined): string {
  if (!format) return 'Unrecognised';
  if (isImageOutputFormat(format)) return getFormatLabel(format);

  return format === 'image/avif' ? 'AVIF' : 'BMP';
}

/**
 * A fact about the picture, with the value a copy button would take.
 *
 * The `copyable` flag is what separates a number somebody wants in a form from
 * a description they are only reading: the width and the ratio are pasted into
 * things, the word "Landscape" is not.
 */
export interface ImageFact {
  readonly label: string;
  readonly value: string;
  readonly copyable: boolean;
}

export function getImageFacts(
  dimensions: ImageDimensions,
  details: { readonly format: ImageInputFormat | undefined; readonly size: string },
): readonly ImageFact[] {
  return [
    { label: 'Dimensions', value: describeImageDimensions(dimensions), copyable: true },
    { label: 'Aspect ratio', value: describeAspectRatio(dimensions), copyable: true },
    { label: 'Width', value: `${Math.round(dimensions.width)} px`, copyable: true },
    { label: 'Height', value: `${Math.round(dimensions.height)} px`, copyable: true },
    { label: 'Megapixels', value: describeMegapixels(dimensions), copyable: false },
    { label: 'Shape', value: describeImageShape(dimensions), copyable: false },
    { label: 'Format', value: describeImageFormat(details.format), copyable: false },
    { label: 'File size', value: details.size, copyable: false },
  ];
}
