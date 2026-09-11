import { describe, expect, test } from 'vitest';

import {
  decideImageTargetSize,
  imageTargetSizeQualities,
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
