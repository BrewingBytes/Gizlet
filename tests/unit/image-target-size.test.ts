import { describe, expect, test } from 'vitest';

import {
  decideImageTargetSize,
  describeImageTargetResult,
  formatExactBytes,
  formatTargetSize,
  getImageTargetTitle,
  imageTargetSizeModes,
  imageTargetSizePresets,
  imageTargetSizeQualities,
  maximumImageTargetKilobytes,
  parseImageTargetKilobytes,
  summariseImageTargetBatch,
  supportsImageTargetSize,
  targetSizeBytesPerKilobyte,
  targetSizeBytesPerMegabyte,
  validateImageTargetBytes,
} from '../../src/data/image-target-size';
import {
  createBrowserTargetImageEncoder,
  encodeImageToTargetSize,
} from '../../src/scripts/image-target-size';

const encoded = (bytes: number) => new Blob([new Uint8Array(bytes)]);

describe('image target-size decisions', () => {
  test('uses exactly ten descending quality samples from 1.0 through 0.1', () => {
    expect(imageTargetSizeQualities).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]);
  });

  test('accepts only finite, positive safe-integer byte targets', () => {
    expect(validateImageTargetBytes(1)).toBeUndefined();
    expect(validateImageTargetBytes(0)).toBeDefined();
    expect(validateImageTargetBytes(-1)).toBeDefined();
    expect(validateImageTargetBytes(1.5)).toBeDefined();
    expect(validateImageTargetBytes(Number.POSITIVE_INFINITY)).toBeDefined();
    expect(validateImageTargetBytes(Number.MAX_SAFE_INTEGER + 1)).toBeDefined();
  });

  test('keeps the highest tested candidate at the exact target boundary', () => {
    expect(
      decideImageTargetSize(100, [
        { quality: 1, actualBytes: 100 },
        { quality: 0.9, actualBytes: 90 },
      ]),
    ).toEqual({ kind: 'met', quality: 1, actualBytes: 100 });
  });

  test('retains the smallest tested candidate when the target is impossible', () => {
    expect(
      decideImageTargetSize(10, [
        { quality: 1, actualBytes: 30 },
        { quality: 0.9, actualBytes: 21 },
        { quality: 0.8, actualBytes: 22 },
      ]),
    ).toEqual({ kind: 'unmet', quality: 0.9, actualBytes: 21 });
  });
});

describe('encodeImageToTargetSize', () => {
  test('stops after an already-small first candidate', async () => {
    let attempts = 0;
    const encode = async (quality: number) => encoded(quality === 1 ? 80 : 1);

    const result = await encodeImageToTargetSize(80, async (quality) => {
      attempts += 1;
      return encode(quality);
    });

    expect(result).toMatchObject({
      kind: 'met',
      actualBytes: 80,
      quality: 1,
    });
    expect(attempts).toBe(1);
  });

  test('does not assume encoder sizes are monotonic', async () => {
    const sizes = [160, 110, 140, 100];
    let attempts = 0;
    const result = await encodeImageToTargetSize(100, async () => encoded(sizes[attempts++]!));

    expect(result).toMatchObject({ kind: 'met', actualBytes: 100, quality: 0.7 });
    expect(attempts).toBe(4);
  });

  test('returns the smallest candidate after all ten failed encodes', async () => {
    const blobs = [200, 190, 185, 180, 175, 170, 165, 149, 155, 150].map(encoded);
    let attempts = 0;
    const result = await encodeImageToTargetSize(100, async () => blobs[attempts++]!);

    expect(result).toMatchObject({ kind: 'unmet', actualBytes: 149, quality: 0.3 });
    expect(result.kind === 'unmet' && result.blob).toBe(blobs[7]);
    expect(attempts).toBe(10);
  });

  test('does not call an encoder for an invalid target or a pre-aborted signal', async () => {
    let attempts = 0;
    const encode = async () => {
      attempts += 1;
      return encoded(1);
    };

    await expect(encodeImageToTargetSize(0, encode)).resolves.toMatchObject({
      kind: 'encoding-failed',
    });
    const controller = new AbortController();
    controller.abort();
    await expect(encodeImageToTargetSize(10, encode, { signal: controller.signal })).resolves.toEqual({
      kind: 'cancelled',
    });
    expect(attempts).toBe(0);
  });

  test('returns an encoding failure without attempting a later quality', async () => {
    let attempts = 0;
    const result = await encodeImageToTargetSize(100, async () => {
      attempts += 1;
      throw new Error('browser encoder failed');
    });

    expect(result).toMatchObject({ kind: 'encoding-failed', error: expect.any(Error) });
    expect(attempts).toBe(1);
  });

  test('does not publish a candidate when cancelled during an encode', async () => {
    const controller = new AbortController();
    const result = await encodeImageToTargetSize(
      100,
      async () => {
        controller.abort();
        return encoded(50);
      },
      { signal: controller.signal },
    );

    expect(result).toEqual({ kind: 'cancelled' });
  });

  test('gives cancellation precedence when an in-flight encoder rejects', async () => {
    const controller = new AbortController();
    const result = await encodeImageToTargetSize(
      100,
      async () => {
        controller.abort();
        throw new Error('aborted too late');
      },
      { signal: controller.signal },
    );

    expect(result).toEqual({ kind: 'cancelled' });
  });
});

describe('createBrowserTargetImageEncoder', () => {
  test('rejects unsafe dimensions and formats before drawing pixels', () => {
    expect(() =>
      createBrowserTargetImageEncoder({} as CanvasImageSource, { width: 0, height: 100 }, 'image/jpeg'),
    ).toThrow(RangeError);
    expect(() =>
      createBrowserTargetImageEncoder(
        {} as CanvasImageSource,
        { width: 100, height: 100 },
        'image/png' as never,
      ),
    ).toThrow('JPEG and WebP');
  });
});

describe('the target-size control', () => {
  test('measures KB and MB in decimal, the way an upload form writes them', () => {
    expect(targetSizeBytesPerKilobyte).toBe(1_000);
    expect(targetSizeBytesPerMegabyte).toBe(1_000_000);
    expect(imageTargetSizePresets.map((preset) => preset.bytes)).toEqual([
      100_000, 200_000, 500_000, 1_000_000,
    ]);
    expect(imageTargetSizePresets.map((preset) => preset.label)).toEqual([
      '100 KB',
      '200 KB',
      '500 KB',
      '1 MB',
    ]);
  });

  test('offers quality and target, with quality first because it is the default', () => {
    expect(imageTargetSizeModes).toEqual(['quality', 'target']);
  });

  test('writes every preset back in the units it was set in', () => {
    for (const preset of imageTargetSizePresets) {
      expect(formatTargetSize(preset.bytes)).toBe(preset.label);
    }

    expect(formatTargetSize(250 * targetSizeBytesPerKilobyte)).toBe('250 KB');
    expect(formatTargetSize(1_500 * targetSizeBytesPerKilobyte)).toBe('1,500 KB');
    expect(formatTargetSize(2 * targetSizeBytesPerMegabyte)).toBe('2 MB');
    expect(formatTargetSize(940)).toBe('940 bytes');
  });

  test('takes whole kilobytes and refuses everything else', () => {
    expect(parseImageTargetKilobytes('250')).toEqual({ kind: 'bytes', bytes: 250_000 });
    expect(parseImageTargetKilobytes('  40  ')).toEqual({ kind: 'bytes', bytes: 40_000 });
    expect(parseImageTargetKilobytes(String(maximumImageTargetKilobytes))).toEqual({
      kind: 'bytes',
      bytes: maximumImageTargetKilobytes * targetSizeBytesPerKilobyte,
    });

    for (const refused of ['', '   ', '0', '-5', '12.5', 'large', 'NaN', 'Infinity']) {
      expect(parseImageTargetKilobytes(refused).kind, refused).toBe('invalid');
    }

    expect(parseImageTargetKilobytes(String(maximumImageTargetKilobytes + 1)).kind).toBe('invalid');
  });

  test('never produces a byte target the engine would then reject', () => {
    for (const entry of ['1', '250', String(maximumImageTargetKilobytes)]) {
      const parsed = parseImageTargetKilobytes(entry);

      expect(parsed.kind).toBe('bytes');
      expect(parsed.kind === 'bytes' && validateImageTargetBytes(parsed.bytes)).toBeUndefined();
    }
  });

  test('reports the exact bytes beside the limit, met or not', () => {
    expect(formatExactBytes(1)).toBe('1 byte');
    expect(formatExactBytes(98_412)).toBe('98,412 bytes');
    expect(describeImageTargetResult('met', 98_412, 100_000)).toBe(
      '98,412 bytes · within the 100 KB limit',
    );
    expect(describeImageTargetResult('unmet', 142_908, 100_000)).toBe(
      '142,908 bytes · over the 100 KB limit',
    );
  });

  test('says which of the two happened in the heading as well as the detail', () => {
    expect(getImageTargetTitle('met')).not.toBe(getImageTargetTitle('unmet'));
    expect(getImageTargetTitle('unmet')).toMatch(/small/i);
  });

  test('counts a batch against its limit rather than averaging it', () => {
    expect(summariseImageTargetBatch(['met', 'met'], 100_000)).toBe(
      'Every image came in under 100 KB.',
    );
    expect(summariseImageTargetBatch(['unmet', 'unmet'], 100_000)).toBe(
      'No image came in under 100 KB.',
    );
    expect(summariseImageTargetBatch(['met', 'unmet', 'met'], 1_000_000)).toBe(
      '2 of 3 images came in under 1 MB.',
    );
    // Every row failed to encode, so there is nothing that came in under it.
    expect(summariseImageTargetBatch([], 200_000)).toBe('No image came in under 200 KB.');
  });

  test('offers a target only for the formats that have a quality to spend', () => {
    expect(supportsImageTargetSize('image/jpeg')).toBe(true);
    expect(supportsImageTargetSize('image/webp')).toBe(true);
    expect(supportsImageTargetSize('image/png')).toBe(false);
    expect(supportsImageTargetSize('image/avif')).toBe(false);
  });
});
