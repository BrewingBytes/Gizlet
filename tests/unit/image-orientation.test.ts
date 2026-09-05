import { describe, expect, it } from 'vitest';

import {
  defaultOrientationPreset,
  describeOrientation,
  flipOrientation,
  getOrientationDrawing,
  getOrientationOutputFilename,
  getOrientationPreset,
  getOrientationPresetOptions,
  getOrientedDimensions,
  identityOrientation,
  isIdentityOrientation,
  isOrientationPresetName,
  isQuarterTurn,
  orientationPresetNames,
  orientationPresets,
  rotateOrientation,
  rotationDegrees,
  validateOrientedImage,
  type FlipAxis,
  type ImageOrientation,
  type RotationDirection,
} from '../../src/data/image-orientation';
import { maximumImageDimension, maximumImagePixels } from '../../src/data/image-resize';

const landscape = { width: 40, height: 20 };

/** The orientation a sequence of button presses leaves behind. */
function press(...actions: readonly (RotationDirection | FlipAxis)[]): ImageOrientation {
  return actions.reduce<ImageOrientation>(
    (orientation, action) =>
      action === 'left' || action === 'right'
        ? rotateOrientation(orientation, action)
        : flipOrientation(orientation, action),
    identityOrientation,
  );
}

/**
 * Where a corner of the source lands, given the drawing the state produces.
 *
 * The maths is the transform a canvas would apply — flip, then rotate, then
 * move to the middle of the output — so a test can check the picture ends up
 * where a person expects rather than only that the state changed.
 */
function corner(
  source: { readonly width: number; readonly height: number },
  orientation: ImageOrientation,
  point: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  const drawing = getOrientationDrawing(source, orientation);
  const flipped = {
    x: (point.x - source.width / 2) * drawing.scaleX,
    y: (point.y - source.height / 2) * drawing.scaleY,
  };
  const cos = Math.round(Math.cos(drawing.rotationRadians));
  const sin = Math.round(Math.sin(drawing.rotationRadians));

  return {
    x: Math.round(flipped.x * cos - flipped.y * sin + drawing.centerX),
    y: Math.round(flipped.x * sin + flipped.y * cos + drawing.centerY),
  };
}

describe('turning a picture', () => {
  it('starts unchanged', () => {
    expect(isIdentityOrientation(identityOrientation)).toBe(true);
    expect(describeOrientation(identityOrientation)).toBe('Unchanged');
    expect(isQuarterTurn(identityOrientation)).toBe(false);
  });

  it('rotates in quarter turns, in the direction asked for', () => {
    expect(press('right').rotation).toBe(90);
    expect(press('right', 'right').rotation).toBe(180);
    expect(press('right', 'right', 'right').rotation).toBe(270);
    expect(press('left').rotation).toBe(270);
    expect(press('left', 'left').rotation).toBe(180);
    expect(rotationDegrees).toContain(press('left').rotation);
  });

  it('folds four turns back to where it started, rather than stacking them', () => {
    expect(press('right', 'right', 'right', 'right')).toEqual(identityOrientation);
    expect(press('left', 'left', 'left', 'left')).toEqual(identityOrientation);
    expect(press('right', 'left')).toEqual(identityOrientation);
  });

  it('folds a flip pressed twice back to where it started', () => {
    expect(press('horizontal', 'horizontal')).toEqual(identityOrientation);
    expect(press('vertical', 'vertical')).toEqual(identityOrientation);
  });

  it('is one of eight orientations, whatever the visitor presses', () => {
    const seen = new Set<string>();
    const actions = ['left', 'right', 'horizontal', 'vertical'] as const;

    for (const a of actions) {
      for (const b of actions) {
        for (const c of actions) {
          seen.add(JSON.stringify(press(a, b, c)));
        }
      }
    }

    expect(seen.size).toBeLessThanOrEqual(8);
  });

  it('mirrors what the visitor is looking at, not what the source would mirror along', () => {
    // Turned a quarter right and then mirrored on screen is the same picture as
    // one turned a quarter left and mirrored, which is the rule that keeps a
    // flip pressed twice from drifting.
    expect(press('right', 'horizontal')).toEqual({
      rotation: 270,
      flipHorizontal: true,
      flipVertical: false,
    });
    expect(press('right', 'horizontal', 'horizontal')).toEqual({
      rotation: 90,
      flipHorizontal: false,
      flipVertical: false,
    });
  });

  it('puts the top-left corner where a person watching would expect', () => {
    const topLeft = { x: 0, y: 0 };

    // A quarter turn right sends the top-left corner to the top-right.
    expect(corner(landscape, press('right'), topLeft)).toEqual({ x: 20, y: 0 });
    expect(corner(landscape, press('left'), topLeft)).toEqual({ x: 0, y: 40 });
    expect(corner(landscape, press('right', 'right'), topLeft)).toEqual({ x: 40, y: 20 });
    expect(corner(landscape, press('horizontal'), topLeft)).toEqual({ x: 40, y: 0 });
    expect(corner(landscape, press('vertical'), topLeft)).toEqual({ x: 0, y: 20 });
    // And a flip after a turn moves it on screen, which is what was pressed.
    expect(corner(landscape, press('right', 'horizontal'), topLeft)).toEqual({ x: 0, y: 0 });
  });
});

describe('getOrientedDimensions', () => {
  it('swaps the sides on a quarter turn and only then', () => {
    expect(getOrientedDimensions(landscape, press('right'))).toEqual({ width: 20, height: 40 });
    expect(getOrientedDimensions(landscape, press('left'))).toEqual({ width: 20, height: 40 });
    expect(getOrientedDimensions(landscape, press('right', 'right'))).toEqual(landscape);
    expect(getOrientedDimensions(landscape, identityOrientation)).toEqual(landscape);
  });

  it('leaves the sides alone for a flip, which moves pixels rather than shape', () => {
    expect(getOrientedDimensions(landscape, press('horizontal'))).toEqual(landscape);
    expect(getOrientedDimensions(landscape, press('vertical'))).toEqual(landscape);
    expect(getOrientedDimensions(landscape, press('right', 'horizontal'))).toEqual({
      width: 20,
      height: 40,
    });
  });
});

describe('getOrientationDrawing', () => {
  it('describes one transform about the middle of the output', () => {
    expect(getOrientationDrawing(landscape, press('right'))).toEqual({
      width: 20,
      height: 40,
      centerX: 10,
      centerY: 20,
      rotationRadians: Math.PI / 2,
      scaleX: 1,
      scaleY: 1,
      drawX: -20,
      drawY: -10,
      drawWidth: 40,
      drawHeight: 20,
    });
  });

  it('turns each flip into the scale that belongs to the source’s own axes', () => {
    expect(getOrientationDrawing(landscape, press('horizontal')).scaleX).toBe(-1);
    expect(getOrientationDrawing(landscape, press('horizontal')).scaleY).toBe(1);
    expect(getOrientationDrawing(landscape, press('vertical')).scaleY).toBe(-1);
    expect(getOrientationDrawing(landscape, identityOrientation).rotationRadians).toBe(0);
  });
});

describe('the turns a Flow can name', () => {
  it('offers one press each, and resolves every one of them', () => {
    for (const name of orientationPresetNames) {
      expect(isOrientationPresetName(name), name).toBe(true);
      expect(orientationPresets[name].label.length, name).toBeGreaterThan(0);
      expect(isIdentityOrientation(getOrientationPreset(name)), name).toBe(false);
    }

    expect(isOrientationPresetName('rotate-sideways')).toBe(false);
    expect(getOrientationPreset(defaultOrientationPreset)).toEqual(press('right'));
    expect(getOrientationPreset('rotate-left')).toEqual(press('left'));
    expect(getOrientationPreset('upside-down')).toEqual(press('right', 'right'));
    expect(getOrientationPreset('flip-horizontal')).toEqual(press('horizontal'));
    expect(getOrientationPreset('flip-vertical')).toEqual(press('vertical'));
  });

  it('hands a control its labels rather than letting markup retype them', () => {
    expect(getOrientationPresetOptions().map((option) => option.value)).toEqual([
      ...orientationPresetNames,
    ]);
    expect(getOrientationPresetOptions()[0].label).toBe(
      orientationPresets[orientationPresetNames[0]].label,
    );
  });
});

describe('describeOrientation', () => {
  it('names the turn the way it was asked for, not in degrees clockwise', () => {
    expect(describeOrientation(press('right'))).toBe('Rotated right 90°');
    expect(describeOrientation(press('left'))).toBe('Rotated left 90°');
    expect(describeOrientation(press('right', 'right'))).toBe('Turned upside down');
    expect(describeOrientation(press('horizontal'))).toBe('Flipped horizontally');
    expect(describeOrientation(press('vertical'))).toBe('Flipped vertically');
    expect(describeOrientation({ rotation: 90, flipHorizontal: true, flipVertical: false })).toBe(
      'Rotated right 90° · flipped horizontally',
    );
  });
});

describe('validateOrientedImage', () => {
  it('accepts an ordinary image', () => {
    expect(validateOrientedImage(landscape)).toBeUndefined();
    expect(validateOrientedImage({ width: 1, height: 1 })).toBeUndefined();
  });

  it('refuses an image already past the limits every image Gizlet keeps', () => {
    expect(validateOrientedImage({ width: 0, height: 10 })).toMatch(/no usable dimensions/);
    expect(
      validateOrientedImage({ width: maximumImageDimension + 1, height: 10 }),
    ).toMatch(new RegExp(maximumImageDimension.toLocaleString()));
    expect(
      validateOrientedImage({ width: maximumImageDimension, height: maximumImageDimension }),
    ).toMatch(new RegExp(maximumImagePixels.toLocaleString()));
  });
});

describe('getOrientationOutputFilename', () => {
  it('names the file for what was actually done to it', () => {
    expect(getOrientationOutputFilename('holiday.jpg', press('right'), 'image/webp')).toBe(
      'holiday-rotated.webp',
    );
    expect(getOrientationOutputFilename('holiday.jpg', press('horizontal'), 'image/jpeg')).toBe(
      'holiday-flipped.jpg',
    );
    expect(
      getOrientationOutputFilename('a.b.png', press('right', 'vertical'), 'image/png'),
    ).toBe('a.b-rotated-flipped.png');
  });

  it('claims nothing for a picture that was not turned', () => {
    // Only the container changed, so the name says only that.
    expect(getOrientationOutputFilename('holiday.jpg', identityOrientation, 'image/png')).toBe(
      'holiday.png',
    );
    expect(getOrientationOutputFilename('', identityOrientation, 'image/webp')).toBe('image.webp');
  });
});
