import {
  decideImageTargetSize,
  imageTargetSizeQualities,
  validateImageTargetBytes,
} from '../data/image-target-size';
import type { ImageOutputFormat } from '../data/image-compression';
import { validateResizeDimensions, type ImageDimensions } from '../data/image-resize';
import { encodeBrowserImage } from './image-processing';

export type TargetImageEncoder = (quality: number) => Promise<Blob>;

export type ImageTargetSizeResult =
  | { readonly kind: 'met'; readonly blob: Blob; readonly actualBytes: number; readonly quality: number }
  | { readonly kind: 'unmet'; readonly blob: Blob; readonly actualBytes: number; readonly quality: number }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'encoding-failed'; readonly error: unknown };

export interface ImageTargetSizeOptions {
  readonly signal?: AbortSignal;
}

/**
 * Creates an encoder that always redraws from the original decoded pixels.
 * The target-size search never hands a lossy candidate back into this encoder.
 */
export function createBrowserTargetImageEncoder(
  image: CanvasImageSource,
  dimensions: ImageDimensions,
  format: Extract<ImageOutputFormat, 'image/jpeg' | 'image/webp'>,
): TargetImageEncoder {
  const dimensionsError = validateResizeDimensions(dimensions);
  if (dimensionsError) throw new RangeError(dimensionsError);

  if (format !== 'image/jpeg' && format !== 'image/webp') {
    throw new TypeError('Target-size compression supports JPEG and WebP output.');
  }

  return (quality) => encodeBrowserImage(image, dimensions, format, quality);
}

/**
 * Searches no more than ten descending quality candidates for an encoded Blob
 * at or below `targetBytes`. This is intentionally a bounded sample, not a
 * monotonic or globally optimal compression search.
 */
export async function encodeImageToTargetSize(
  targetBytes: number,
  encode: TargetImageEncoder,
  options: ImageTargetSizeOptions = {},
): Promise<ImageTargetSizeResult> {
  const validationError = validateImageTargetBytes(targetBytes);
  if (validationError) return { kind: 'encoding-failed', error: new RangeError(validationError) };

  const candidates: Array<{ readonly blob: Blob; readonly actualBytes: number; readonly quality: number }> = [];

  for (const quality of imageTargetSizeQualities) {
    if (options.signal?.aborted) return { kind: 'cancelled' };

    let blob: Blob;
    try {
      blob = await encode(quality);
    } catch (error) {
      return options.signal?.aborted ? { kind: 'cancelled' } : { kind: 'encoding-failed', error };
    }

    // A completed encode is still not publishable when cancellation won while
    // it was in flight.
    if (options.signal?.aborted) return { kind: 'cancelled' };

    const candidate = { blob, actualBytes: blob.size, quality };
    candidates.push(candidate);
    const decision = decideImageTargetSize(targetBytes, candidates);

    if (decision?.kind === 'met') {
      return { ...decision, blob };
    }
  }

  const decision = decideImageTargetSize(targetBytes, candidates);
  if (!decision || decision.kind !== 'unmet') {
    return { kind: 'encoding-failed', error: new Error('No image candidates were encoded.') };
  }

  const candidate = candidates.find(
    (item) => item.actualBytes === decision.actualBytes && item.quality === decision.quality,
  );

  if (!candidate) {
    return { kind: 'encoding-failed', error: new Error('The selected image candidate was unavailable.') };
  }

  return { ...decision, blob: candidate.blob };
}
