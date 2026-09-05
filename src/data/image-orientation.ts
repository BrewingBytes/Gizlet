import type { ImageOutputFormat } from './image-compression';
import {
  maximumImageDimension,
  maximumImagePixels,
  type ImageDimensions,
} from './image-resize';

/**
 * How an image has been turned, as state rather than as a list of steps.
 *
 * Every button press folds into one of eight orientations — four quarter turns,
 * each either mirrored or not — so pressing rotate right four times returns the
 * picture to where it started instead of stacking four transforms, and the
 * export applies exactly one of them to the original pixels. A history of
 * operations would re-encode the image once per press and lose a little each
 * time; this cannot, because the source is only ever drawn once.
 */
export interface ImageOrientation {
  /** Clockwise, in degrees. Only quarter turns: free angles are a different job. */
  readonly rotation: 0 | 90 | 180 | 270;
  /** Mirrored left to right, in the source's own axes, before the rotation. */
  readonly flipHorizontal: boolean;
  /** Mirrored top to bottom, in the source's own axes, before the rotation. */
  readonly flipVertical: boolean;
}

export type RotationDegrees = ImageOrientation['rotation'];

export type RotationDirection = 'left' | 'right';

export type FlipAxis = 'horizontal' | 'vertical';

export const rotationDegrees = [0, 90, 180, 270] as const satisfies readonly RotationDegrees[];

/** The picture as it arrived. */
export const identityOrientation: ImageOrientation = {
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
};

const outputExtensions: Record<ImageOutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function normaliseRotation(degrees: number): RotationDegrees {
  return (((degrees % 360) + 360) % 360) as RotationDegrees;
}

export function isIdentityOrientation(orientation: ImageOrientation): boolean {
  return (
    orientation.rotation === 0 &&
    !orientation.flipHorizontal &&
    !orientation.flipVertical
  );
}

/** Whether the turn is a quarter one, which is what swaps the sides. */
export function isQuarterTurn(orientation: ImageOrientation): boolean {
  return orientation.rotation === 90 || orientation.rotation === 270;
}

/** Turns the picture a quarter of the way round, in the direction asked for. */
export function rotateOrientation(
  orientation: ImageOrientation,
  direction: RotationDirection,
): ImageOrientation {
  return {
    ...orientation,
    rotation: normaliseRotation(orientation.rotation + (direction === 'right' ? 90 : -90)),
  };
}

/**
 * Mirrors what the visitor is looking at, which is not always what the source
 * would be mirrored along.
 *
 * The state keeps its flips in the source's own axes and applies them before
 * the rotation, so a flip asked for on screen has to be moved to the other side
 * of that rotation. Reflecting a rotation turns it into its opposite — mirror a
 * picture turned a quarter right and the result is a picture turned a quarter
 * left and mirrored — which is the whole of the rule below, and the reason
 * pressing flip twice returns exactly where it started.
 */
export function flipOrientation(
  orientation: ImageOrientation,
  axis: FlipAxis,
): ImageOrientation {
  return {
    rotation: normaliseRotation(-orientation.rotation),
    flipHorizontal: axis === 'horizontal' ? !orientation.flipHorizontal : orientation.flipHorizontal,
    flipVertical: axis === 'vertical' ? !orientation.flipVertical : orientation.flipVertical,
  };
}

/** The size the picture comes out at: a quarter turn swaps the sides. */
export function getOrientedDimensions(
  source: ImageDimensions,
  orientation: ImageOrientation,
): ImageDimensions {
  return isQuarterTurn(orientation)
    ? { width: source.height, height: source.width }
    : { width: source.width, height: source.height };
}

/**
 * The numbers a canvas needs to draw the picture once, in this orientation.
 *
 * The transform is composed about the middle of the output, so the same three
 * values work for every one of the eight orientations and the component has no
 * arithmetic of its own to get wrong. The scale is applied inside the rotation,
 * which is what makes the flips mean the source's axes.
 */
export interface OrientationDrawing extends ImageDimensions {
  /** Where the middle of the output sits, which is where the turn happens. */
  readonly centerX: number;
  readonly centerY: number;
  readonly rotationRadians: number;
  readonly scaleX: 1 | -1;
  readonly scaleY: 1 | -1;
  /** Where the source is drawn from, once the middle is the origin. */
  readonly drawX: number;
  readonly drawY: number;
  readonly drawWidth: number;
  readonly drawHeight: number;
}

export function getOrientationDrawing(
  source: ImageDimensions,
  orientation: ImageOrientation,
): OrientationDrawing {
  const { width, height } = getOrientedDimensions(source, orientation);

  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    rotationRadians: (orientation.rotation * Math.PI) / 180,
    scaleX: orientation.flipHorizontal ? -1 : 1,
    scaleY: orientation.flipVertical ? -1 : 1,
    drawX: -source.width / 2,
    drawY: -source.height / 2,
    drawWidth: source.width,
    drawHeight: source.height,
  };
}

/**
 * The single transform a Flow block applies.
 *
 * A flow has nobody to press a button twice, so it names one turn rather than
 * carrying a state: these are the five a person actually asks for, and each is
 * the orientation the workspace reaches with one press.
 */
export const orientationPresets = {
  'rotate-right': {
    label: 'Rotate right 90°',
    orientation: { rotation: 90, flipHorizontal: false, flipVertical: false },
  },
  'rotate-left': {
    label: 'Rotate left 90°',
    orientation: { rotation: 270, flipHorizontal: false, flipVertical: false },
  },
  'upside-down': {
    label: 'Turn upside down',
    orientation: { rotation: 180, flipHorizontal: false, flipVertical: false },
  },
  'flip-horizontal': {
    label: 'Flip horizontally',
    orientation: { rotation: 0, flipHorizontal: true, flipVertical: false },
  },
  'flip-vertical': {
    label: 'Flip vertically',
    orientation: { rotation: 0, flipHorizontal: false, flipVertical: true },
  },
} as const satisfies Record<
  string,
  { readonly label: string; readonly orientation: ImageOrientation }
>;

export type OrientationPresetName = keyof typeof orientationPresets;

export const orientationPresetNames = Object.keys(
  orientationPresets,
) as readonly OrientationPresetName[];

export const defaultOrientationPreset = 'rotate-right' satisfies OrientationPresetName;

export function isOrientationPresetName(value: string): value is OrientationPresetName {
  return Object.hasOwn(orientationPresets, value);
}

export function getOrientationPreset(name: OrientationPresetName): ImageOrientation {
  return orientationPresets[name].orientation;
}

/** The preset control's options, so no markup retypes a label. */
export function getOrientationPresetOptions(): readonly {
  readonly value: OrientationPresetName;
  readonly label: string;
}[] {
  return orientationPresetNames.map((value) => ({
    value,
    label: orientationPresets[value].label,
  }));
}

/**
 * What has been done to the picture, in words.
 *
 * The rotation is named the way it was asked for rather than in degrees
 * clockwise, because a picture turned 270° clockwise is one a person turned
 * left, and that is what they pressed.
 */
export function describeOrientation(orientation: ImageOrientation): string {
  const parts: string[] = [];

  if (orientation.rotation === 90) parts.push('Rotated right 90°');
  if (orientation.rotation === 180) parts.push('Turned upside down');
  if (orientation.rotation === 270) parts.push('Rotated left 90°');
  if (orientation.flipHorizontal) parts.push(parts.length > 0 ? 'flipped horizontally' : 'Flipped horizontally');
  if (orientation.flipVertical) parts.push(parts.length > 0 ? 'flipped vertically' : 'Flipped vertically');

  return parts.length === 0 ? 'Unchanged' : parts.join(' · ');
}

/**
 * Why an image cannot be turned, if it cannot.
 *
 * A turn keeps every pixel it was given, so the only image this refuses is one
 * already past the ceilings every other image Gizlet keeps — which is the case
 * where a canvas hands back a blank picture rather than an error.
 */
export function validateOrientedImage(dimensions: ImageDimensions): string | undefined {
  if (dimensions.width < 1 || dimensions.height < 1) {
    return 'This image has no usable dimensions.';
  }

  if (dimensions.width > maximumImageDimension || dimensions.height > maximumImageDimension) {
    return `Each side has to be ${maximumImageDimension.toLocaleString()} pixels or less to turn.`;
  }

  if (dimensions.width * dimensions.height > maximumImagePixels) {
    return `An image has to be below ${maximumImagePixels.toLocaleString()} pixels to turn.`;
  }

  return undefined;
}

/**
 * Names the file for what was actually done to it.
 *
 * An orientation that changed nothing gets no suffix: the picture is the one
 * that arrived, and calling it rotated would be the file name claiming
 * something the pixels do not show.
 */
export function getOrientationOutputFilename(
  inputName: string,
  orientation: ImageOrientation,
  format: ImageOutputFormat,
): string {
  const basename = inputName.replace(/\.[^.]+$/, '') || 'image';
  const turned = orientation.rotation !== 0;
  const mirrored = orientation.flipHorizontal || orientation.flipVertical;
  const suffix = turned && mirrored ? '-rotated-flipped' : turned ? '-rotated' : mirrored ? '-flipped' : '';

  return `${basename}${suffix}.${outputExtensions[format]}`;
}
