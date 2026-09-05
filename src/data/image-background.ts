import type { ImageOutputFormat } from './image-compression';
import {
  maximumImageDimension,
  maximumImagePixels,
  type ImageDimensions,
} from './image-resize';

/**
 * Where a picture sits on a canvas, and how big it is drawn.
 *
 * The whole Gizlet is this one calculation: a canvas size, a rule for scaling
 * the picture into it, and a corner or edge to hold it against. Keeping it here
 * is what lets the preview and the exported file be the same drawing rather
 * than two arrangements that agree until one of them is edited.
 */

/** How the picture is scaled into the canvas. */
export const backgroundFits = {
  contain: {
    label: 'Fit inside',
    description: 'The whole picture, scaled until it fits, with background around it.',
  },
  cover: {
    label: 'Fill the canvas',
    description: 'The canvas filled edge to edge, with whatever overflows trimmed off.',
  },
  original: {
    label: 'Original size',
    description: 'Every pixel at the size it already is, whether that fits or not.',
  },
} as const satisfies Record<string, { readonly label: string; readonly description: string }>;

export type BackgroundFit = keyof typeof backgroundFits;

export const backgroundFitNames = Object.keys(backgroundFits) as readonly BackgroundFit[];

export const defaultBackgroundFit = 'contain' satisfies BackgroundFit;

/** Where the picture is held. Nine positions, named as a person points at them. */
export const backgroundAnchors = {
  'top-left': { label: 'Top left', horizontal: 'start', vertical: 'start' },
  top: { label: 'Top', horizontal: 'center', vertical: 'start' },
  'top-right': { label: 'Top right', horizontal: 'end', vertical: 'start' },
  left: { label: 'Left', horizontal: 'start', vertical: 'center' },
  center: { label: 'Middle', horizontal: 'center', vertical: 'center' },
  right: { label: 'Right', horizontal: 'end', vertical: 'center' },
  'bottom-left': { label: 'Bottom left', horizontal: 'start', vertical: 'end' },
  bottom: { label: 'Bottom', horizontal: 'center', vertical: 'end' },
  'bottom-right': { label: 'Bottom right', horizontal: 'end', vertical: 'end' },
} as const satisfies Record<
  string,
  {
    readonly label: string;
    readonly horizontal: 'start' | 'center' | 'end';
    readonly vertical: 'start' | 'center' | 'end';
  }
>;

export type BackgroundAnchor = keyof typeof backgroundAnchors;

export const backgroundAnchorNames = Object.keys(backgroundAnchors) as readonly BackgroundAnchor[];

export const defaultBackgroundAnchor = 'center' satisfies BackgroundAnchor;

/**
 * Canvas sizes worth having a button for.
 *
 * These are the shapes the job actually asks for — a square listing photograph,
 * a link preview, a phone-shaped story — plus the picture's own size, which is
 * what someone wants when all they need is a background behind a transparent
 * PNG.
 */
export const backgroundCanvasPresets = {
  source: { label: 'Same as the image', dimensions: undefined },
  square: { label: 'Square · 1080 × 1080', dimensions: { width: 1080, height: 1080 } },
  social: { label: 'Link preview · 1200 × 630', dimensions: { width: 1200, height: 630 } },
  story: { label: 'Story · 1080 × 1920', dimensions: { width: 1080, height: 1920 } },
  custom: { label: 'Custom', dimensions: undefined },
} as const satisfies Record<
  string,
  { readonly label: string; readonly dimensions: ImageDimensions | undefined }
>;

export type BackgroundCanvasPreset = keyof typeof backgroundCanvasPresets;

export const backgroundCanvasPresetNames = Object.keys(
  backgroundCanvasPresets,
) as readonly BackgroundCanvasPreset[];

export const defaultBackgroundCanvasPreset = 'source' satisfies BackgroundCanvasPreset;

/** The colour a canvas starts as, and the word that means no colour at all. */
export const defaultBackgroundColour = '#ffffff';
export const transparentBackground = 'transparent';

export interface BackgroundOptions {
  readonly canvas: ImageDimensions;
  readonly fit: BackgroundFit;
  readonly anchor: BackgroundAnchor;
  /** Nudges from the anchored position, in canvas pixels. */
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Where the picture is drawn, in the canvas's own pixels. */
export interface BackgroundPlan {
  readonly canvas: ImageDimensions;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function isBackgroundFit(value: string): value is BackgroundFit {
  return Object.hasOwn(backgroundFits, value);
}

export function isBackgroundAnchor(value: string): value is BackgroundAnchor {
  return Object.hasOwn(backgroundAnchors, value);
}

export function isBackgroundCanvasPreset(value: string): value is BackgroundCanvasPreset {
  return Object.hasOwn(backgroundCanvasPresets, value);
}

/** A colour a canvas will accept, or the absence of one. */
export function isBackgroundColour(value: string): boolean {
  return value === transparentBackground || /^#[0-9a-f]{6}$/i.test(value);
}

export function getBackgroundFitOptions(): readonly {
  readonly value: BackgroundFit;
  readonly label: string;
}[] {
  return backgroundFitNames.map((value) => ({ value, label: backgroundFits[value].label }));
}

export function getBackgroundAnchorOptions(): readonly {
  readonly value: BackgroundAnchor;
  readonly label: string;
}[] {
  return backgroundAnchorNames.map((value) => ({ value, label: backgroundAnchors[value].label }));
}

export function getBackgroundCanvasPresetOptions(): readonly {
  readonly value: BackgroundCanvasPreset;
  readonly label: string;
}[] {
  return backgroundCanvasPresetNames.map((value) => ({
    value,
    label: backgroundCanvasPresets[value].label,
  }));
}

/** The canvas a preset names, which for two of them is whatever is on screen. */
export function getBackgroundCanvasPreset(
  preset: BackgroundCanvasPreset,
  source: ImageDimensions,
  current: ImageDimensions,
): ImageDimensions {
  if (preset === 'source') return { width: source.width, height: source.height };

  return backgroundCanvasPresets[preset].dimensions ?? current;
}

/** The preset a canvas size answers to, so the control cannot contradict the fields. */
export function getMatchingCanvasPreset(
  canvas: ImageDimensions,
  source: ImageDimensions,
): BackgroundCanvasPreset {
  if (canvas.width === source.width && canvas.height === source.height) return 'source';

  const named = backgroundCanvasPresetNames.find((name) => {
    const dimensions = backgroundCanvasPresets[name].dimensions;

    return dimensions?.width === canvas.width && dimensions?.height === canvas.height;
  });

  return named ?? 'custom';
}

function anchoredStart(
  available: number,
  drawn: number,
  placement: 'start' | 'center' | 'end',
): number {
  if (placement === 'start') return 0;
  if (placement === 'end') return available - drawn;

  return (available - drawn) / 2;
}

/**
 * Where the picture goes, given a canvas and a rule for filling it.
 *
 * `contain` scales the picture until the whole of it fits, `cover` until none of
 * the canvas is left showing and the overflow is trimmed, and `original` leaves
 * every pixel the size it already is — which is the one that can be larger than
 * the canvas, deliberately: someone putting a border around a picture wants the
 * picture untouched.
 */
export function planImageBackground(
  source: ImageDimensions,
  options: BackgroundOptions,
): BackgroundPlan {
  const canvas = {
    width: Math.max(1, Math.round(options.canvas.width)),
    height: Math.max(1, Math.round(options.canvas.height)),
  };

  if (source.width <= 0 || source.height <= 0) {
    return { canvas, x: 0, y: 0, width: 0, height: 0 };
  }

  const scale =
    options.fit === 'original'
      ? 1
      : options.fit === 'cover'
        ? Math.max(canvas.width / source.width, canvas.height / source.height)
        : Math.min(canvas.width / source.width, canvas.height / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const anchor = backgroundAnchors[options.anchor];

  return {
    canvas,
    x: Math.round(anchoredStart(canvas.width, width, anchor.horizontal) + options.offsetX),
    y: Math.round(anchoredStart(canvas.height, height, anchor.vertical) + options.offsetY),
    width,
    height,
  };
}

/**
 * The colour the canvas is actually painted.
 *
 * JPEG has no transparency, so a transparent background there is not a choice
 * the file can keep: it would be flattened, and a canvas flattens to black
 * rather than to anything anyone wanted. Saying which colour is used instead is
 * the honest half of allowing the combination at all.
 */
export function getEffectiveBackground(background: string, format: ImageOutputFormat): string {
  if (background !== transparentBackground) return background;

  return format === 'image/jpeg' ? defaultBackgroundColour : transparentBackground;
}

/** The warning a transparent background earns in a format that has none. */
export function getTransparencyNote(
  background: string,
  format: ImageOutputFormat,
): string | undefined {
  if (background !== transparentBackground || format !== 'image/jpeg') return undefined;

  return 'JPEG cannot hold transparency, so the background is saved white. Choose PNG or WebP to keep it clear.';
}

/**
 * Why a canvas cannot be drawn, if it cannot.
 *
 * The limits are the ones every image Gizlet keeps, and here they are about the
 * canvas rather than the picture: the canvas is what gets allocated, so a
 * visitor asking for one larger than the device can hold has to be told before
 * a blank file is handed back.
 */
export function validateBackgroundCanvas(canvas: ImageDimensions): string | undefined {
  const { width, height } = canvas;

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return 'Enter whole canvas dimensions greater than zero.';
  }

  if (width > maximumImageDimension || height > maximumImageDimension) {
    return `Keep each side of the canvas at ${maximumImageDimension.toLocaleString()} pixels or less.`;
  }

  if (width * height > maximumImagePixels) {
    return `Keep the canvas below ${maximumImagePixels.toLocaleString()} pixels.`;
  }

  return undefined;
}

/** Whether any of the canvas is left showing, which is what a background is for. */
export function showsBackground(plan: BackgroundPlan): boolean {
  return (
    plan.x > 0 ||
    plan.y > 0 ||
    plan.x + plan.width < plan.canvas.width ||
    plan.y + plan.height < plan.canvas.height
  );
}

/** The plan said in numbers, for the line beside the preview. */
export function describeBackgroundPlan(plan: BackgroundPlan): string {
  return `${plan.canvas.width} × ${plan.canvas.height} px canvas · image at ${plan.width} × ${plan.height} px`;
}

const outputExtensions: Record<ImageOutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function getBackgroundOutputFilename(inputName: string, format: ImageOutputFormat): string {
  const basename = inputName.replace(/\.[^.]+$/, '') || 'image';

  return `${basename}-background.${outputExtensions[format]}`;
}
