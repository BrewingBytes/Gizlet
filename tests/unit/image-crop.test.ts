import { describe, expect, it } from 'vitest';

import {
  applyCropAspectRatio,
  clampCropToImage,
  cropAspectRatioNames,
  cropAspectRatios,
  defaultCropAspectRatio,
  defaultFlowCropAspectRatio,
  describeCropCoverage,
  describeCropRectangle,
  flowCropAspectRatioNames,
  getCenteredCrop,
  getCropAspectRatio,
  getCropAspectRatioOptions,
  getCropFromPoints,
  getCropOutputFilename,
  isCropAspectRatioName,
  isFlowCropAspectRatioName,
  moveCropRectangle,
  resizeCropRectangle,
  validateCropRectangle,
} from '../../src/data/image-crop';
import { maximumImageDimension, maximumImagePixels } from '../../src/data/image-resize';

const landscape = { width: 1000, height: 500 };
const square = { width: 400, height: 400 };

describe('the ratios on offer', () => {
  it('names every ratio it can resolve, and free crop resolves to none', () => {
    for (const name of cropAspectRatioNames) {
      expect(isCropAspectRatioName(name), name).toBe(true);
    }

    expect(getCropAspectRatio('free')).toBeUndefined();
    expect(getCropAspectRatio('1:1')).toBe(1);
    expect(getCropAspectRatio('16:9')).toBeCloseTo(16 / 9);
    expect(isCropAspectRatioName('21:9')).toBe(false);
    expect(defaultCropAspectRatio).toBe('free');
  });

  it('offers a Flow every shape except the one that is not a shape', () => {
    expect(flowCropAspectRatioNames).not.toContain('free');
    expect(flowCropAspectRatioNames).toEqual(
      cropAspectRatioNames.filter((name) => name !== 'free'),
    );
    expect(isFlowCropAspectRatioName('free')).toBe(false);
    expect(isFlowCropAspectRatioName(defaultFlowCropAspectRatio)).toBe(true);
  });

  it('hands a control its labels rather than letting markup retype them', () => {
    expect(getCropAspectRatioOptions()).toHaveLength(cropAspectRatioNames.length);
    expect(getCropAspectRatioOptions(flowCropAspectRatioNames)[0]).toEqual({
      value: '1:1',
      label: cropAspectRatios['1:1'].label,
    });
  });
});

describe('getCenteredCrop', () => {
  it('keeps the whole image when no shape is asked for', () => {
    expect(getCenteredCrop(landscape)).toEqual({ x: 0, y: 0, ...landscape });
  });

  it('takes the largest rectangle of a shape, centred', () => {
    expect(getCenteredCrop(landscape, 1)).toEqual({ x: 250, y: 0, width: 500, height: 500 });
    expect(getCenteredCrop(landscape, 16 / 9)).toEqual({ x: 56, y: 0, width: 889, height: 500 });
    expect(getCenteredCrop(square, 9 / 16)).toEqual({ x: 88, y: 0, width: 225, height: 400 });
  });

  it('never leaves the image, whatever the shape', () => {
    for (const name of flowCropAspectRatioNames) {
      const crop = getCenteredCrop(landscape, getCropAspectRatio(name));

      expect(validateCropRectangle(crop, landscape), name).toBeUndefined();
    }
  });

  it('ignores a ratio that is not a positive number', () => {
    expect(getCenteredCrop(square, 0)).toEqual({ x: 0, y: 0, ...square });
    expect(getCenteredCrop(square, Number.NaN)).toEqual({ x: 0, y: 0, ...square });
    expect(getCenteredCrop(square, -2)).toEqual({ x: 0, y: 0, ...square });
  });

  it('keeps a pixel of a one-pixel image', () => {
    expect(getCenteredCrop({ width: 1, height: 1 }, 16 / 9)).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });
});

describe('clampCropToImage', () => {
  it('rounds to whole pixels', () => {
    expect(clampCropToImage({ x: 10.4, y: 10.6, width: 100.5, height: 20.4 }, landscape)).toEqual({
      x: 10,
      y: 11,
      width: 101,
      height: 20,
    });
  });

  it('moves a selection that has left the image back inside it', () => {
    expect(clampCropToImage({ x: -50, y: -50, width: 100, height: 100 }, landscape)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(clampCropToImage({ x: 990, y: 480, width: 100, height: 100 }, landscape)).toEqual({
      x: 900,
      y: 400,
      width: 100,
      height: 100,
    });
  });

  it('shrinks a selection larger than the image rather than moving it', () => {
    expect(clampCropToImage({ x: -10, y: -10, width: 5000, height: 5000 }, landscape)).toEqual({
      x: 0,
      y: 0,
      ...landscape,
    });
  });

  it('never returns an empty selection', () => {
    expect(clampCropToImage({ x: 10, y: 10, width: 0, height: -4 }, landscape)).toEqual({
      x: 10,
      y: 10,
      width: 1,
      height: 1,
    });
  });
});

describe('applyCropAspectRatio', () => {
  it('re-shapes around the selection’s own centre', () => {
    const shaped = applyCropAspectRatio({ x: 100, y: 100, width: 200, height: 100 }, landscape, 1);

    expect(shaped).toEqual({ x: 100, y: 50, width: 200, height: 200 });
  });

  it('lets the height lead when following the width would leave the image', () => {
    const shaped = applyCropAspectRatio({ x: 0, y: 0, width: 900, height: 400 }, landscape, 1);

    expect(shaped).toEqual({ x: 200, y: 0, width: 500, height: 500 });
    expect(validateCropRectangle(shaped, landscape)).toBeUndefined();
  });

  it('only clamps when there is no shape to apply', () => {
    expect(applyCropAspectRatio({ x: -5, y: 0, width: 200, height: 100 }, landscape)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
  });
});

describe('moving and resizing with a keyboard', () => {
  it('moves by whole pixels and stops at the edge', () => {
    expect(moveCropRectangle({ x: 10, y: 10, width: 100, height: 100 }, landscape, 10, -10)).toEqual({
      x: 20,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(moveCropRectangle({ x: 890, y: 0, width: 100, height: 100 }, landscape, 100, 0)).toEqual({
      x: 900,
      y: 0,
      width: 100,
      height: 100,
    });
  });

  it('resizes from the bottom-right, so the corner the visitor set stays put', () => {
    expect(
      resizeCropRectangle({ x: 100, y: 100, width: 100, height: 100 }, landscape, 50, 20),
    ).toEqual({ x: 100, y: 100, width: 150, height: 120 });
  });

  it('lets the locked shape decide the other side', () => {
    expect(
      resizeCropRectangle({ x: 0, y: 0, width: 100, height: 100 }, landscape, 100, 0, 1 / 1),
    ).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expect(
      resizeCropRectangle({ x: 0, y: 0, width: 100, height: 100 }, landscape, 60, 0, 16 / 9),
    ).toEqual({ x: 0, y: 0, width: 160, height: 90 });
  });

  it('cannot be shrunk out of existence', () => {
    expect(
      resizeCropRectangle({ x: 0, y: 0, width: 4, height: 4 }, landscape, -100, -100),
    ).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe('getCropFromPoints', () => {
  it('draws from the anchor towards the pointer', () => {
    expect(getCropFromPoints({ x: 100, y: 100 }, { x: 300, y: 200 }, landscape)).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
  });

  it('flips rather than producing a negative side when the drag crosses the anchor', () => {
    expect(getCropFromPoints({ x: 300, y: 200 }, { x: 100, y: 100 }, landscape)).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
  });

  it('follows the side the hand moved furthest along when a shape is locked', () => {
    // A wide drag leads with its width; a tall one leads with its height.
    expect(getCropFromPoints({ x: 0, y: 0 }, { x: 400, y: 100 }, landscape, 1)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 400,
    });
    expect(getCropFromPoints({ x: 0, y: 0 }, { x: 100, y: 400 }, landscape, 1)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 400,
    });
  });

  it('keeps a drag that ran off the picture inside it', () => {
    const crop = getCropFromPoints({ x: 900, y: 400 }, { x: 4000, y: 4000 }, landscape);

    expect(crop).toEqual({ x: 900, y: 400, width: 100, height: 100 });
    expect(validateCropRectangle(crop, landscape)).toBeUndefined();
  });
});

describe('validateCropRectangle', () => {
  it('accepts a whole-number selection inside the image', () => {
    expect(validateCropRectangle({ x: 0, y: 0, width: 1, height: 1 }, landscape)).toBeUndefined();
    expect(
      validateCropRectangle({ x: 0, y: 0, ...landscape }, landscape),
    ).toBeUndefined();
  });

  it('refuses fractions, because a pixel is not divisible', () => {
    expect(validateCropRectangle({ x: 0.5, y: 0, width: 10, height: 10 }, landscape)).toMatch(
      /whole-number/,
    );
    expect(validateCropRectangle({ x: 0, y: 0, width: Number.NaN, height: 10 }, landscape)).toMatch(
      /whole-number/,
    );
  });

  it('refuses a selection with no area', () => {
    expect(validateCropRectangle({ x: 10, y: 10, width: 0, height: 10 }, landscape)).toMatch(
      /at least one pixel/,
    );
    expect(validateCropRectangle({ x: 10, y: 10, width: 10, height: -5 }, landscape)).toMatch(
      /at least one pixel/,
    );
  });

  it('refuses a selection that is not on the image', () => {
    expect(validateCropRectangle({ x: -1, y: 0, width: 10, height: 10 }, landscape)).toMatch(
      /inside the image/,
    );
    expect(validateCropRectangle({ x: 995, y: 0, width: 10, height: 10 }, landscape)).toMatch(
      /inside the image/,
    );
    expect(validateCropRectangle({ x: 0, y: 495, width: 10, height: 10 }, landscape)).toMatch(
      /inside the image/,
    );
  });

  it('keeps the pixel limits every image Gizlet keeps', () => {
    const huge = { width: maximumImageDimension + 10, height: maximumImageDimension + 10 };

    expect(
      validateCropRectangle({ x: 0, y: 0, width: huge.width, height: 10 }, huge),
    ).toMatch(/pixels or less/);
    expect(
      validateCropRectangle(
        { x: 0, y: 0, width: maximumImageDimension, height: maximumImageDimension },
        huge,
      ),
    ).toMatch(new RegExp(maximumImagePixels.toLocaleString()));
  });
});

describe('what a selection is called', () => {
  it('says the size and where it was taken from', () => {
    expect(describeCropRectangle({ x: 10, y: 20, width: 300, height: 200 })).toBe(
      '300 × 200 px from 10, 20',
    );
  });

  it('says how much of the picture survives', () => {
    expect(describeCropCoverage({ x: 0, y: 0, width: 500, height: 500 }, landscape)).toBe(
      '50% of the image',
    );
    expect(describeCropCoverage({ x: 0, y: 0, ...landscape }, landscape)).toBe('100% of the image');
    // Rounding a tiny crop to 0% would read as nothing at all, which it is not.
    expect(describeCropCoverage({ x: 0, y: 0, width: 1, height: 1 }, landscape)).toBe(
      'under 1% of the image',
    );
    expect(describeCropCoverage({ x: 0, y: 0, width: 1, height: 1 }, { width: 0, height: 0 })).toBe(
      'Coverage unavailable',
    );
  });
});

describe('getCropOutputFilename', () => {
  it('names the file for what happened to it, in the chosen format', () => {
    expect(getCropOutputFilename('holiday.jpg', 'image/webp')).toBe('holiday-cropped.webp');
    expect(getCropOutputFilename('a.b.png', 'image/jpeg')).toBe('a.b-cropped.jpg');
    expect(getCropOutputFilename('', 'image/png')).toBe('image-cropped.png');
  });
});
