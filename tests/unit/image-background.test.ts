import { describe, expect, it } from 'vitest';

import {
  backgroundAnchorNames,
  backgroundAnchors,
  backgroundCanvasPresetNames,
  backgroundFitNames,
  backgroundFits,
  defaultBackgroundAnchor,
  defaultBackgroundColour,
  defaultBackgroundFit,
  describeBackgroundPlan,
  getBackgroundAnchorOptions,
  getBackgroundCanvasPreset,
  getBackgroundCanvasPresetOptions,
  getBackgroundFitOptions,
  getBackgroundOutputFilename,
  getEffectiveBackground,
  getMatchingCanvasPreset,
  getTransparencyNote,
  isBackgroundAnchor,
  isBackgroundColour,
  isBackgroundCanvasPreset,
  isBackgroundFit,
  planImageBackground,
  showsBackground,
  transparentBackground,
  validateBackgroundCanvas,
  type BackgroundOptions,
} from '../../src/data/image-background';
import { maximumImageDimension, maximumImagePixels } from '../../src/data/image-resize';

const landscape = { width: 400, height: 200 };
const square = { width: 1000, height: 1000 };

const options = (overrides: Partial<BackgroundOptions> = {}): BackgroundOptions => ({
  canvas: square,
  fit: defaultBackgroundFit,
  anchor: defaultBackgroundAnchor,
  offsetX: 0,
  offsetY: 0,
  ...overrides,
});

describe('the choices on offer', () => {
  it('resolves every fit, anchor and canvas preset it names', () => {
    for (const name of backgroundFitNames) {
      expect(isBackgroundFit(name), name).toBe(true);
      expect(backgroundFits[name].description.length, name).toBeGreaterThan(0);
    }

    for (const name of backgroundAnchorNames) {
      expect(isBackgroundAnchor(name), name).toBe(true);
    }

    for (const name of backgroundCanvasPresetNames) {
      expect(isBackgroundCanvasPreset(name), name).toBe(true);
    }

    expect(isBackgroundFit('stretch')).toBe(false);
    expect(isBackgroundAnchor('middle')).toBe(false);
    expect(isBackgroundCanvasPreset('a4')).toBe(false);
  });

  it('hands each control its labels rather than letting markup retype them', () => {
    expect(getBackgroundFitOptions().map((option) => option.value)).toEqual([...backgroundFitNames]);
    expect(getBackgroundAnchorOptions()[0].label).toBe(
      backgroundAnchors[backgroundAnchorNames[0]].label,
    );
    expect(getBackgroundCanvasPresetOptions()).toHaveLength(backgroundCanvasPresetNames.length);
  });

  it('takes a colour a canvas will accept, or no colour at all', () => {
    expect(isBackgroundColour(defaultBackgroundColour)).toBe(true);
    expect(isBackgroundColour('#0F172A')).toBe(true);
    expect(isBackgroundColour(transparentBackground)).toBe(true);
    expect(isBackgroundColour('white')).toBe(false);
    expect(isBackgroundColour('#fff')).toBe(false);
  });

  it('reads a canvas size back as the preset it answers to', () => {
    expect(getBackgroundCanvasPreset('source', landscape, square)).toEqual(landscape);
    expect(getBackgroundCanvasPreset('square', landscape, square)).toEqual({
      width: 1080,
      height: 1080,
    });
    // Custom means whatever is in the fields, so choosing it changes nothing.
    expect(getBackgroundCanvasPreset('custom', landscape, square)).toEqual(square);

    expect(getMatchingCanvasPreset(landscape, landscape)).toBe('source');
    expect(getMatchingCanvasPreset({ width: 1200, height: 630 }, landscape)).toBe('social');
    expect(getMatchingCanvasPreset({ width: 640, height: 480 }, landscape)).toBe('custom');
  });
});

describe('planImageBackground', () => {
  it('fits the whole picture inside the canvas and centres it', () => {
    const plan = planImageBackground(landscape, options());

    // 400x200 into 1000x1000 scales by 2.5 and leaves bands above and below.
    expect(plan).toEqual({ canvas: square, x: 0, y: 250, width: 1000, height: 500 });
    expect(showsBackground(plan)).toBe(true);
  });

  it('fills the canvas and lets the overflow fall outside it', () => {
    const plan = planImageBackground(landscape, options({ fit: 'cover' }));

    // The short side decides: 200 to 1000 is five times, so the width overruns.
    expect(plan).toEqual({ canvas: square, x: -500, y: 0, width: 2000, height: 1000 });
    expect(showsBackground(plan)).toBe(false);
  });

  it('leaves every pixel alone at its original size', () => {
    const plan = planImageBackground(landscape, options({ fit: 'original' }));

    expect(plan).toEqual({ canvas: square, x: 300, y: 400, width: 400, height: 200 });
  });

  it('holds the picture against the anchor asked for', () => {
    const at = (anchor: BackgroundOptions['anchor']) =>
      planImageBackground(landscape, options({ fit: 'original', anchor }));

    expect(at('top-left')).toMatchObject({ x: 0, y: 0 });
    expect(at('top-right')).toMatchObject({ x: 600, y: 0 });
    expect(at('bottom-left')).toMatchObject({ x: 0, y: 800 });
    expect(at('bottom-right')).toMatchObject({ x: 600, y: 800 });
    expect(at('top')).toMatchObject({ x: 300, y: 0 });
    expect(at('left')).toMatchObject({ x: 0, y: 400 });
  });

  it('nudges from wherever the anchor put it', () => {
    const plan = planImageBackground(
      landscape,
      options({ fit: 'original', anchor: 'top-left', offsetX: 40, offsetY: -10 }),
    );

    expect(plan).toMatchObject({ x: 40, y: -10 });
  });

  it('rounds the canvas to whole pixels and never plans an empty one', () => {
    const plan = planImageBackground(landscape, options({ canvas: { width: 99.6, height: 0 } }));

    expect(plan.canvas).toEqual({ width: 100, height: 1 });
  });

  it('draws nothing for an image with no usable dimensions', () => {
    const plan = planImageBackground({ width: 0, height: 0 }, options());

    expect(plan).toMatchObject({ width: 0, height: 0 });
    expect(plan.canvas).toEqual(square);
  });

  it('keeps a picture that already fills the canvas exactly', () => {
    const plan = planImageBackground(square, options());

    expect(plan).toEqual({ canvas: square, x: 0, y: 0, width: 1000, height: 1000 });
    expect(showsBackground(plan)).toBe(false);
  });
});

describe('transparency, and the format that cannot hold it', () => {
  it('keeps a transparent background where the format allows one', () => {
    expect(getEffectiveBackground(transparentBackground, 'image/png')).toBe(transparentBackground);
    expect(getEffectiveBackground(transparentBackground, 'image/webp')).toBe(transparentBackground);
    expect(getTransparencyNote(transparentBackground, 'image/png')).toBeUndefined();
  });

  it('paints it white for JPEG, and says so', () => {
    // A canvas flattens to black rather than to anything anyone wanted, so the
    // colour is chosen here rather than left to the encoder.
    expect(getEffectiveBackground(transparentBackground, 'image/jpeg')).toBe(defaultBackgroundColour);
    expect(getTransparencyNote(transparentBackground, 'image/jpeg')).toMatch(/JPEG cannot hold/);
  });

  it('leaves a chosen colour alone in every format', () => {
    for (const format of ['image/jpeg', 'image/png', 'image/webp'] as const) {
      expect(getEffectiveBackground('#0f172a', format), format).toBe('#0f172a');
      expect(getTransparencyNote('#0f172a', format), format).toBeUndefined();
    }
  });
});

describe('validateBackgroundCanvas', () => {
  it('accepts an ordinary canvas', () => {
    expect(validateBackgroundCanvas(square)).toBeUndefined();
    expect(validateBackgroundCanvas({ width: 1, height: 1 })).toBeUndefined();
  });

  it('asks for whole dimensions greater than zero', () => {
    expect(validateBackgroundCanvas({ width: 0, height: 100 })).toMatch(/greater than zero/);
    expect(validateBackgroundCanvas({ width: 100.5, height: 100 })).toMatch(/whole canvas/);
    expect(validateBackgroundCanvas({ width: Number.NaN, height: 100 })).toMatch(/whole canvas/);
  });

  it('keeps the pixel limits every image Gizlet keeps', () => {
    expect(
      validateBackgroundCanvas({ width: maximumImageDimension + 1, height: 10 }),
    ).toMatch(new RegExp(maximumImageDimension.toLocaleString()));
    expect(
      validateBackgroundCanvas({ width: maximumImageDimension, height: maximumImageDimension }),
    ).toMatch(new RegExp(maximumImagePixels.toLocaleString()));
  });
});

describe('what a plan is called', () => {
  it('says the canvas and the size the picture is drawn at', () => {
    expect(describeBackgroundPlan(planImageBackground(landscape, options()))).toBe(
      '1000 × 1000 px canvas · image at 1000 × 500 px',
    );
  });

  it('names the file for what it is, in the chosen format', () => {
    expect(getBackgroundOutputFilename('logo.png', 'image/png')).toBe('logo-background.png');
    expect(getBackgroundOutputFilename('a.b.webp', 'image/jpeg')).toBe('a.b-background.jpg');
    expect(getBackgroundOutputFilename('', 'image/webp')).toBe('image-background.webp');
  });
});
