import { describe, expect, test } from 'vitest';

import { getBackgroundOutputFilename, planImageBackground } from '../../src/data/image-background';
import { getOutputFilename, type ImageOutputFormat } from '../../src/data/image-compression';
import { getConversionOutputFilename } from '../../src/data/image-conversion';
import { getCenteredCrop, getCropAspectRatio, getCropOutputFilename } from '../../src/data/image-crop';
import { getCleanedImageFilename } from '../../src/data/image-metadata';
import {
  getOrientationOutputFilename,
  getOrientationPreset,
  getOrientedDimensions,
} from '../../src/data/image-orientation';
import { getResizeOutputFilename } from '../../src/data/image-resize';
import { toolRegistry } from '../../src/data/tools';
import {
  runFlowImageStep,
  type FlowImageAdapters,
  type FlowImageStep,
  type FlowPayload,
} from '../../src/scripts/flow-image-runner';

const sourceName = 'holiday.png';
const format: ImageOutputFormat = 'image/jpeg';

/** Adapters that record what the runner asked for instead of drawing anything. */
const createAdapters = (width = 400, height = 200) => {
  const calls: { readonly name: string; readonly args: readonly unknown[] }[] = [];
  const decoded = { naturalWidth: width, naturalHeight: height } as unknown as HTMLImageElement;
  const cropped = { kind: 'cropped' } as unknown as CanvasImageSource;
  const oriented = { kind: 'oriented' } as unknown as CanvasImageSource;
  const background = { kind: 'background' } as unknown as CanvasImageSource;
  const adapters: FlowImageAdapters = {
    load: async (...args) => {
      calls.push({ name: 'load', args });
      return decoded;
    },
    encode: async (...args) => {
      calls.push({ name: 'encode', args });
      return new Blob([new Uint8Array(3)], { type: args[2] });
    },
    crop: (...args) => {
      calls.push({ name: 'crop', args });
      return cropped;
    },
    orient: (...args) => {
      calls.push({ name: 'orient', args });
      return oriented;
    },
    drawBackground: (...args) => {
      calls.push({ name: 'drawBackground', args });
      return background;
    },
  };

  return { adapters, calls, decoded, cropped, oriented, background };
};

const payload = (): FlowPayload => ({
  file: new File([new Uint8Array(1)], sourceName, { type: 'image/png' }),
  width: 400,
  height: 200,
});

const run = (step: FlowImageStep, adapters: FlowImageAdapters, outputFormat: ImageOutputFormat = format) =>
  runFlowImageStep(step, payload(), outputFormat, adapters);

describe('runFlowImageStep', () => {
  test('re-encodes the decoded picture at its own size for format-only steps', async () => {
    const cases = [
      ['convert-image', getConversionOutputFilename(sourceName, format)],
      ['remove-image-metadata', getCleanedImageFilename(sourceName, format)],
    ] as const;

    for (const [toolSlug, filename] of cases) {
      const { adapters, calls, decoded } = createAdapters();
      const output = await run({ toolSlug }, adapters);

      expect(calls.map((call) => call.name)).toEqual(['load', 'encode']);
      expect(calls[1].args).toEqual([decoded, { width: 400, height: 200 }, format, undefined]);
      expect(output).toMatchObject({ width: 400, height: 200 });
      expect(output.file.name).toBe(filename);
      expect(output.file.type).toBe(format);
    }
  });

  test('passes the compression quality as a fraction, defaulting to 80%', async () => {
    const chosen = createAdapters();
    const output = await run({ toolSlug: 'compress-image', quality: 55 }, chosen.adapters);
    expect(chosen.calls[1].args[3]).toBe(0.55);
    expect(output.file.name).toBe(getOutputFilename(sourceName, format));

    const unset = createAdapters();
    await run({ toolSlug: 'compress-image' }, unset.adapters);
    expect(unset.calls[1].args[3]).toBe(0.8);
  });

  test('resizes to rounded dimensions and refuses unusable ones before encoding', async () => {
    const { adapters, calls, decoded } = createAdapters();
    const output = await run({ toolSlug: 'resize-image', width: 120.4, height: 59.6 }, adapters);

    expect(calls[1].args).toEqual([decoded, { width: 120, height: 60 }, format, undefined]);
    expect(output).toMatchObject({ width: 120, height: 60 });
    expect(output.file.name).toBe(getResizeOutputFilename(sourceName, format));

    const refused = createAdapters();
    await expect(run({ toolSlug: 'resize-image', width: 0, height: 10 }, refused.adapters)).rejects.toThrow(/^Resize Image: /);
    expect(refused.calls.map((call) => call.name)).toEqual(['load']);
  });

  test('crops the largest centred rectangle of the chosen ratio, square by default', async () => {
    const { adapters, calls, decoded, cropped } = createAdapters();
    const output = await run({ toolSlug: 'crop-image' }, adapters);
    const rectangle = getCenteredCrop({ width: 400, height: 200 }, getCropAspectRatio('1:1'));

    expect(calls.map((call) => call.name)).toEqual(['load', 'crop', 'encode']);
    expect(calls[1].args).toEqual([decoded, rectangle]);
    expect(calls[2].args).toEqual([cropped, { width: rectangle.width, height: rectangle.height }, format, undefined]);
    expect(output).toMatchObject({ width: rectangle.width, height: rectangle.height });
    expect(output.file.name).toBe(getCropOutputFilename(sourceName, format));
  });

  test('turns the picture and hands on its swapped sides, a right turn by default', async () => {
    const { adapters, calls, decoded, oriented } = createAdapters();
    const output = await run({ toolSlug: 'rotate-flip-image' }, adapters);
    const turned = getOrientationPreset('rotate-right');
    const dimensions = getOrientedDimensions({ width: 400, height: 200 }, turned);

    expect(dimensions).toEqual({ width: 200, height: 400 });
    expect(calls.map((call) => call.name)).toEqual(['load', 'orient', 'encode']);
    expect(calls[1].args).toEqual([decoded, { width: 400, height: 200 }, turned]);
    expect(calls[2].args).toEqual([oriented, dimensions, format]);
    expect(output).toMatchObject(dimensions);
    expect(output.file.name).toBe(getOrientationOutputFilename(sourceName, turned, format));
  });

  test('places the picture on a white canvas of the chosen size', async () => {
    const { adapters, calls, decoded, background } = createAdapters();
    const output = await run({ toolSlug: 'image-background', canvasWidth: 1080, canvasHeight: 1080 }, adapters);
    const plan = planImageBackground({ width: 400, height: 200 }, {
      canvas: { width: 1080, height: 1080 },
      fit: 'contain',
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
    });

    expect(calls.map((call) => call.name)).toEqual(['load', 'drawBackground', 'encode']);
    expect(calls[1].args).toEqual([decoded, plan, '#ffffff']);
    expect(calls[2].args).toEqual([background, { width: 1080, height: 1080 }, format]);
    expect(output).toMatchObject({ width: 1080, height: 1080 });
    expect(output.file.name).toBe(getBackgroundOutputFilename(sourceName, format));
  });

  test('names the Gizlet in a refused background canvas', async () => {
    const { adapters, calls } = createAdapters();
    const backgroundName = toolRegistry.find((tool) => tool.slug === 'image-background')?.name;

    expect(backgroundName).toBeDefined();
    await expect(run({ toolSlug: 'image-background', canvasWidth: 0, canvasHeight: 0 }, adapters)).rejects.toThrow(`${backgroundName}: `);
    expect(calls.map((call) => call.name)).toEqual(['load']);
  });

  test('refuses a picture with no dimensions before any step runs', async () => {
    const { adapters, calls } = createAdapters(0, 0);

    await expect(run({ toolSlug: 'convert-image' }, adapters)).rejects.toThrow('This image has no usable dimensions.');
    expect(calls.map((call) => call.name)).toEqual(['load']);
  });

  test('encodes in the output format it is given', async () => {
    const { adapters, calls } = createAdapters();
    const output = await run({ toolSlug: 'convert-image' }, adapters, 'image/webp');

    expect(calls[1].args[2]).toBe('image/webp');
    expect(output.file.type).toBe('image/webp');
    expect(output.file.name).toBe(getConversionOutputFilename(sourceName, 'image/webp'));
  });
});
