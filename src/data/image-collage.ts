import type { ImageOutputFormat } from './image-compression';
import {
  maximumImageDimension,
  maximumImagePixels,
  type ImageDimensions,
} from './image-resize';

/**
 * The arithmetic behind a collage: where each picture goes, and how big the
 * finished one is.
 *
 * Nothing here draws anything. A plan is a list of rectangles in the output's
 * own pixels, and the component hands them to a canvas one at a time, which is
 * what lets the layouts be unit-tested without a browser and lets the workspace
 * and a Flow lay a collage out identically.
 */

/** One image on its way into a collage. Only its shape matters to the plan. */
export type CollageItem = ImageDimensions;

/** Where one image is drawn in the finished collage. */
export interface CollageCell {
  /** The item this cell holds, by its position in the list handed in. */
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CollagePlan extends ImageDimensions {
  readonly cells: readonly CollageCell[];
}

/**
 * The arrangements on offer.
 *
 * Four, because they answer four different questions: put them in a block, in
 * a strip across, in a strip down, or one of them first and the rest beside it.
 * Anything past that is a design application rather than a Gizlet.
 */
export const collageLayouts = {
  grid: {
    label: 'Grid',
    description: 'As square a block as the number of images allows.',
  },
  row: { label: 'Single row', description: 'Side by side, left to right.' },
  column: { label: 'Single column', description: 'Stacked, top to bottom.' },
  feature: {
    label: 'Feature',
    description: 'The first image large, the rest stacked beside it.',
  },
} as const satisfies Record<string, { readonly label: string; readonly description: string }>;

export type CollageLayoutName = keyof typeof collageLayouts;

export const collageLayoutNames = Object.keys(collageLayouts) as readonly CollageLayoutName[];

export const defaultCollageLayout = 'grid' satisfies CollageLayoutName;

/**
 * How many pictures one collage takes.
 *
 * The ceiling is about the result rather than about the device: past a dozen,
 * every cell in a shareable image is a thumbnail, and a collage of thumbnails
 * is a contact sheet, which is a different job.
 */
export const maximumCollageImages = 12;
export const minimumCollageImages = 1;

/** The gap between cells and around the edge, in output pixels. */
export const defaultCollageSpacing = 16;
export const maximumCollageSpacing = 200;

/** How wide the finished collage is, before the layout works out its height. */
export const defaultCollageWidth = 1600;
export const minimumCollageWidth = 64;

/** The colour the gaps are painted, which is what a spacing of zero hides. */
export const defaultCollageBackground = '#ffffff';

const outputExtensions: Record<ImageOutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface CollageOptions {
  readonly layout: CollageLayoutName;
  readonly spacing: number;
  readonly width: number;
}

export function isCollageLayoutName(value: string): value is CollageLayoutName {
  return Object.hasOwn(collageLayouts, value);
}

/** The layout control's options, so no markup retypes a label. */
export function getCollageLayoutOptions(): readonly {
  readonly value: CollageLayoutName;
  readonly label: string;
}[] {
  return collageLayoutNames.map((value) => ({ value, label: collageLayouts[value].label }));
}

/** A colour a canvas will accept, rather than whatever arrived in the field. */
export function isCollageBackground(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** How many images a collage is holding, said in words. */
export function describeCollageImageCount(count: number): string {
  return count === 1 ? '1 image' : `${count} images`;
}

/**
 * The columns a grid uses.
 *
 * The square root rounded up, so four images make a 2×2 and five make a 3×2
 * with a gap rather than a 5×1 strip. A row and a column are the two layouts
 * that deliberately ignore it.
 */
export function getCollageColumns(count: number, layout: CollageLayoutName): number {
  if (count < 1) return 0;
  if (layout === 'row') return count;
  if (layout === 'column') return 1;

  return Math.ceil(Math.sqrt(count));
}

function roundedSize(value: number): number {
  return Math.max(1, Math.round(value));
}

/**
 * The shape a cell takes when nothing else decides it: the average of what was
 * handed in.
 *
 * A grid of cells all shaped like the pictures going into them is the layout
 * that crops least, and averaging is what keeps one panorama among portraits
 * from setting the shape for every cell.
 */
function getAverageAspectRatio(items: readonly CollageItem[]): number {
  const usable = items.filter((item) => item.width > 0 && item.height > 0);

  if (usable.length === 0) return 1;

  return usable.reduce((total, item) => total + item.width / item.height, 0) / usable.length;
}

/**
 * The collage a set of pictures and a few settings make.
 *
 * Cells are laid out in the order the items arrive, which is the order the
 * visitor put them in; nothing here re-orders anything, so moving a picture up
 * the list is the only thing that moves it in the result.
 */
export function planCollage(
  items: readonly CollageItem[],
  options: CollageOptions,
): CollagePlan {
  const spacing = Math.max(0, Math.round(options.spacing));
  const width = Math.max(minimumCollageWidth, Math.round(options.width));

  if (items.length === 0) {
    return { width, height: Math.max(1, spacing * 2), cells: [] };
  }

  const aspect = getAverageAspectRatio(items);

  if (options.layout === 'feature' && items.length > 1) {
    // The first picture takes two thirds of the width and sets the height; the
    // rest share the remaining column, which is what makes it a feature rather
    // than a wider cell in a grid.
    const featureWidth = roundedSize((width - spacing * 3) * (2 / 3));
    const sideWidth = Math.max(1, width - spacing * 3 - featureWidth);
    const featureAspect = items[0].height > 0 ? items[0].width / items[0].height : aspect;
    const featureHeight = roundedSize(featureWidth / featureAspect);
    const sideCount = items.length - 1;
    const sideHeight = roundedSize((featureHeight - spacing * (sideCount - 1)) / sideCount);
    const cells: CollageCell[] = [
      { index: 0, x: spacing, y: spacing, width: featureWidth, height: featureHeight },
    ];

    for (let index = 1; index <= sideCount; index += 1) {
      cells.push({
        index,
        x: spacing * 2 + featureWidth,
        y: spacing + (index - 1) * (sideHeight + spacing),
        width: sideWidth,
        height: sideHeight,
      });
    }

    return {
      width,
      // The stacked column is rounded cell by cell, so the collage is as tall
      // as what is actually in it rather than as tall as the feature was meant
      // to be.
      height: Math.max(
        featureHeight,
        sideCount * sideHeight + spacing * (sideCount - 1),
      ) + spacing * 2,
      cells,
    };
  }

  const columns = getCollageColumns(items.length, options.layout);
  const rows = Math.ceil(items.length / columns);
  const cellWidth = roundedSize((width - spacing * (columns + 1)) / columns);
  const cellHeight = roundedSize(cellWidth / aspect);
  const cells = items.map((_item, index) => ({
    index,
    x: spacing + (index % columns) * (cellWidth + spacing),
    y: spacing + Math.floor(index / columns) * (cellHeight + spacing),
    width: cellWidth,
    height: cellHeight,
  }));

  return {
    width,
    height: rows * cellHeight + spacing * (rows + 1),
    cells,
  };
}

/**
 * Why a collage cannot be made, if it cannot.
 *
 * The pixel ceilings are checked against the whole composition rather than
 * against each picture going into it: twelve images that are each comfortably
 * within the limits still add up, and the canvas that fails is the combined
 * one, so that is the number worth refusing before a blank picture is handed
 * back.
 */
export function validateCollage(items: readonly CollageItem[], plan: CollagePlan): string | undefined {
  if (items.length < minimumCollageImages) {
    return 'Choose at least one image.';
  }

  if (items.length > maximumCollageImages) {
    return `Use up to ${describeCollageImageCount(maximumCollageImages)} in one collage.`;
  }

  if (plan.width < 1 || plan.height < 1) {
    return 'These settings leave nothing to draw.';
  }

  if (plan.width > maximumImageDimension || plan.height > maximumImageDimension) {
    return `Keep each side of the collage at ${maximumImageDimension.toLocaleString()} pixels or less.`;
  }

  if (plan.width * plan.height > maximumImagePixels) {
    return `Keep the whole collage below ${maximumImagePixels.toLocaleString()} pixels.`;
  }

  return undefined;
}

/** Why a chosen width cannot be used, if it cannot. Checked as it is typed. */
export function validateCollageWidth(width: number): string | undefined {
  if (!Number.isInteger(width) || width < minimumCollageWidth) {
    return `Enter a whole width of at least ${minimumCollageWidth} pixels.`;
  }

  if (width > maximumImageDimension) {
    return `Keep the width at ${maximumImageDimension.toLocaleString()} pixels or less.`;
  }

  return undefined;
}

/** Why a chosen gap cannot be used, if it cannot. */
export function validateCollageSpacing(spacing: number): string | undefined {
  if (!Number.isInteger(spacing) || spacing < 0) {
    return 'Enter a whole gap of zero pixels or more.';
  }

  if (spacing > maximumCollageSpacing) {
    return `Keep the gap at ${maximumCollageSpacing} pixels or less.`;
  }

  return undefined;
}

/**
 * The part of a picture a cell shows.
 *
 * Cells are filled rather than fitted: a picture is scaled until it covers its
 * cell and the overflow is trimmed evenly from both sides. Fitting instead
 * would leave every cell with two bars of background, which is the look of a
 * collage that has gone wrong.
 */
export function getCollageSourceRectangle(
  item: CollageItem,
  cell: ImageDimensions,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  if (item.width <= 0 || item.height <= 0 || cell.width <= 0 || cell.height <= 0) {
    return { x: 0, y: 0, width: Math.max(1, item.width), height: Math.max(1, item.height) };
  }

  const cellAspect = cell.width / cell.height;
  const itemAspect = item.width / item.height;
  const width = itemAspect > cellAspect ? item.height * cellAspect : item.width;
  const height = itemAspect > cellAspect ? item.height : item.width / cellAspect;

  return {
    x: (item.width - width) / 2,
    y: (item.height - height) / 2,
    width,
    height,
  };
}

/** The collage said in numbers, for the line beside the preview. */
export function describeCollage(plan: CollagePlan, layout: CollageLayoutName): string {
  return `${plan.width} × ${plan.height} px · ${collageLayouts[layout].label.toLowerCase()}`;
}

export function getCollageOutputFilename(inputName: string, format: ImageOutputFormat): string {
  const basename = inputName.replace(/\.[^.]+$/, '') || 'images';

  return `${basename}-collage.${outputExtensions[format]}`;
}
