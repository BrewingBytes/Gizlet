import type { ImageOutputFormat } from './image-compression';
import {
  maximumImageDimension,
  maximumImagePixels,
  type ImageDimensions,
} from './image-resize';

/**
 * The rectangle a crop keeps, in the source image's own pixels.
 *
 * Everything here works in image pixels rather than in screen ones. A crop is
 * drawn at whatever size the preview happens to be, and a rectangle that only
 * made sense at that size would produce a different picture on a phone than on
 * a desktop; the component converts pointer positions once and asks these
 * functions the same questions whatever the preview measures.
 */
export interface CropRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The corner a resize is dragging, and so the corner that stays put. */
export type CropHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** The smallest crop worth making. Below this there is nothing left to see. */
export const minimumCropSize = 1;

const outputExtensions: Record<ImageOutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * The ratios the Gizlet offers, `undefined` meaning the visitor's own.
 *
 * They are the ones a crop is actually asked for: a square avatar, the two
 * classic photographic ratios, a widescreen frame, and each of those standing
 * up for a phone. Anything else is what free crop is for.
 */
export const cropAspectRatios = {
  free: { label: 'Free', ratio: undefined },
  '1:1': { label: 'Square 1:1', ratio: 1 },
  '4:3': { label: 'Landscape 4:3', ratio: 4 / 3 },
  '3:2': { label: 'Landscape 3:2', ratio: 3 / 2 },
  '16:9': { label: 'Widescreen 16:9', ratio: 16 / 9 },
  '3:4': { label: 'Portrait 3:4', ratio: 3 / 4 },
  '2:3': { label: 'Portrait 2:3', ratio: 2 / 3 },
  '9:16': { label: 'Tall 9:16', ratio: 9 / 16 },
} as const satisfies Record<string, { readonly label: string; readonly ratio: number | undefined }>;

export type CropAspectRatioName = keyof typeof cropAspectRatios;

export const cropAspectRatioNames = Object.keys(cropAspectRatios) as readonly CropAspectRatioName[];

/** The ratio a workspace starts on: the visitor's own, until they ask for one. */
export const defaultCropAspectRatio = 'free' satisfies CropAspectRatioName;

/**
 * The ratios a Flow may name.
 *
 * A flow has nobody to draw a rectangle, so it takes the largest centred one of
 * a chosen shape. Free crop is not a shape, so it is not offered there: a step
 * that cropped to the whole image would be a block that does nothing.
 */
export type FlowCropAspectRatioName = Exclude<CropAspectRatioName, 'free'>;

export const flowCropAspectRatioNames = cropAspectRatioNames.filter(
  (name): name is FlowCropAspectRatioName => name !== 'free',
);

export const defaultFlowCropAspectRatio = '1:1' satisfies FlowCropAspectRatioName;

export function isCropAspectRatioName(value: string): value is CropAspectRatioName {
  return Object.hasOwn(cropAspectRatios, value);
}

export function isFlowCropAspectRatioName(value: string): value is FlowCropAspectRatioName {
  return (flowCropAspectRatioNames as readonly string[]).includes(value);
}

/** The numeric ratio a name stands for, or `undefined` for free crop. */
export function getCropAspectRatio(name: CropAspectRatioName): number | undefined {
  return cropAspectRatios[name].ratio;
}

/** The ratio control's options, so no markup retypes a label. */
export function getCropAspectRatioOptions(
  names: readonly CropAspectRatioName[] = cropAspectRatioNames,
): readonly { readonly value: CropAspectRatioName; readonly label: string }[] {
  return names.map((value) => ({ value, label: cropAspectRatios[value].label }));
}

function round(value: number): number {
  return Math.round(value);
}

/** Whether a number can be a pixel count at all. */
function isUsableNumber(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * The largest rectangle of a given shape, centred on the image.
 *
 * It is both the selection a workspace opens on and the crop a Flow applies,
 * which is deliberate: the block in a chain does what the visitor would have
 * got by choosing the ratio and touching nothing else.
 */
export function getCenteredCrop(image: ImageDimensions, ratio?: number): CropRectangle {
  if (ratio === undefined || !isUsableNumber(ratio) || ratio <= 0) {
    return { x: 0, y: 0, width: image.width, height: image.height };
  }

  const fitsWidth = image.width / image.height > ratio;
  const width = fitsWidth ? image.height * ratio : image.width;
  const height = fitsWidth ? image.height : image.width / ratio;
  const bounded = {
    width: Math.max(minimumCropSize, Math.min(image.width, round(width))),
    height: Math.max(minimumCropSize, Math.min(image.height, round(height))),
  };

  return {
    x: round((image.width - bounded.width) / 2),
    y: round((image.height - bounded.height) / 2),
    ...bounded,
  };
}

/**
 * Rounds a rectangle to whole pixels and pushes it back inside the image.
 *
 * A pointer produces fractional coordinates and can leave the picture entirely,
 * so this is the last thing every gesture goes through. It moves a rectangle
 * that is still small enough to fit, and shrinks one that is not: a selection
 * wider than the image becomes the image.
 */
export function clampCropToImage(rectangle: CropRectangle, image: ImageDimensions): CropRectangle {
  const width = Math.max(minimumCropSize, Math.min(round(rectangle.width), image.width));
  const height = Math.max(minimumCropSize, Math.min(round(rectangle.height), image.height));

  return {
    x: Math.max(0, Math.min(round(rectangle.x), image.width - width)),
    y: Math.max(0, Math.min(round(rectangle.y), image.height - height)),
    width,
    height,
  };
}

/**
 * Re-shapes a selection to a ratio without moving its centre.
 *
 * The height follows the width, because that is the side a visitor is usually
 * holding when the shape changes; if the result would leave the image, the
 * width follows the height instead, and only then does the rectangle move.
 */
export function applyCropAspectRatio(
  rectangle: CropRectangle,
  image: ImageDimensions,
  ratio?: number,
): CropRectangle {
  if (ratio === undefined || !isUsableNumber(ratio) || ratio <= 0) {
    return clampCropToImage(rectangle, image);
  }

  const centerX = rectangle.x + rectangle.width / 2;
  const centerY = rectangle.y + rectangle.height / 2;
  let width = rectangle.width;
  let height = width / ratio;

  if (height > image.height) {
    height = image.height;
    width = height * ratio;
  }

  if (width > image.width) {
    width = image.width;
    height = width / ratio;
  }

  return clampCropToImage(
    { x: centerX - width / 2, y: centerY - height / 2, width, height },
    image,
  );
}

/** Moves a selection by whole pixels, keeping it inside the image. */
export function moveCropRectangle(
  rectangle: CropRectangle,
  image: ImageDimensions,
  deltaX: number,
  deltaY: number,
): CropRectangle {
  return clampCropToImage(
    { ...rectangle, x: rectangle.x + deltaX, y: rectangle.y + deltaY },
    image,
  );
}

/**
 * Grows or shrinks a selection from its bottom-right corner, which is the
 * corner a keyboard has: arrow keys move the crop and shifted arrow keys size
 * it, so the top-left stays where the visitor put it.
 */
export function resizeCropRectangle(
  rectangle: CropRectangle,
  image: ImageDimensions,
  deltaWidth: number,
  deltaHeight: number,
  ratio?: number,
): CropRectangle {
  const width = rectangle.width + deltaWidth;
  const height =
    ratio === undefined || !isUsableNumber(ratio) || ratio <= 0
      ? rectangle.height + deltaHeight
      : width / ratio;

  return clampCropToImage({ ...rectangle, width, height }, image);
}

/**
 * The rectangle a drag between two points describes.
 *
 * The anchor is the corner the gesture started from and does not move, so a
 * drag that crosses it flips the rectangle rather than producing a negative
 * width. With a ratio, the pointer decides the longer side and the shape
 * decides the other one.
 */
export function getCropFromPoints(
  anchor: { readonly x: number; readonly y: number },
  pointer: { readonly x: number; readonly y: number },
  image: ImageDimensions,
  ratio?: number,
): CropRectangle {
  // The pointer is kept on the picture before anything is measured from it, so
  // a drag that ran off the edge stops there rather than being shrunk to fit
  // afterwards and taking the anchored corner with it.
  const held = {
    x: Math.max(0, Math.min(pointer.x, image.width)),
    y: Math.max(0, Math.min(pointer.y, image.height)),
  };
  const width = Math.abs(held.x - anchor.x);
  const height = Math.abs(held.y - anchor.y);
  const towardsLeft = held.x < anchor.x;
  const towardsTop = held.y < anchor.y;

  if (ratio === undefined || !isUsableNumber(ratio) || ratio <= 0) {
    return clampCropToImage(
      {
        x: towardsLeft ? anchor.x - width : anchor.x,
        y: towardsTop ? anchor.y - height : anchor.y,
        width,
        height,
      },
      image,
    );
  }

  // The side the pointer moved furthest along leads, so a shaped drag follows
  // the hand rather than snapping to whichever side the code asked first.
  const leadsWithWidth = width / ratio >= height;
  const shaped = {
    width: leadsWithWidth ? width : height * ratio,
    height: leadsWithWidth ? width / ratio : height,
  };

  return clampCropToImage(
    {
      x: towardsLeft ? anchor.x - shaped.width : anchor.x,
      y: towardsTop ? anchor.y - shaped.height : anchor.y,
      ...shaped,
    },
    image,
  );
}

/**
 * Why a selection cannot be cropped, if it cannot.
 *
 * The pixel ceilings are the ones every image Gizlet already keeps. A crop is
 * never larger than what it came from, so they only bite on an image that was
 * already past them, which is exactly the case worth refusing before a canvas
 * silently hands back a blank picture.
 */
export function validateCropRectangle(
  rectangle: CropRectangle,
  image: ImageDimensions,
): string | undefined {
  const values = [rectangle.x, rectangle.y, rectangle.width, rectangle.height];

  if (!values.every((value) => Number.isInteger(value))) {
    return 'Enter whole-number values for the selection.';
  }

  if (rectangle.width < minimumCropSize || rectangle.height < minimumCropSize) {
    return 'Select an area at least one pixel wide and one pixel tall.';
  }

  if (
    rectangle.x < 0 ||
    rectangle.y < 0 ||
    rectangle.x + rectangle.width > image.width ||
    rectangle.y + rectangle.height > image.height
  ) {
    return 'Keep the selection inside the image.';
  }

  if (rectangle.width > maximumImageDimension || rectangle.height > maximumImageDimension) {
    return `Keep each side at ${maximumImageDimension.toLocaleString()} pixels or less.`;
  }

  if (rectangle.width * rectangle.height > maximumImagePixels) {
    return `Keep the result below ${maximumImagePixels.toLocaleString()} pixels.`;
  }

  return undefined;
}

/** The selection said in the units the visitor is working in. */
export function describeCropRectangle(rectangle: CropRectangle): string {
  return `${rectangle.width} × ${rectangle.height} px from ${rectangle.x}, ${rectangle.y}`;
}

/** How much of the picture a crop keeps, for the line beside the selection. */
export function describeCropCoverage(
  rectangle: CropRectangle,
  image: ImageDimensions,
): string {
  const total = image.width * image.height;

  if (total <= 0) return 'Coverage unavailable';

  const share = ((rectangle.width * rectangle.height) / total) * 100;

  // A one-pixel crop of a photograph is not 0% of it, and rounding says so;
  // the honest reading of a share too small to write is that it is small.
  return share < 1 ? 'under 1% of the image' : `${Math.round(share)}% of the image`;
}

export function getCropOutputFilename(inputName: string, format: ImageOutputFormat): string {
  const basename = inputName.replace(/\.[^.]+$/, '') || 'image';

  return `${basename}-cropped.${outputExtensions[format]}`;
}
