/** The bounded, descending qualities used when aiming for a file-size limit. */
export const imageTargetSizeQualities = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1] as const;

export interface ImageTargetSizeCandidate {
  readonly actualBytes: number;
  readonly quality: number;
}

/** A completed target-size search without the browser-owned Blob payload. */
export type ImageTargetSizeDecision =
  | { readonly kind: 'met'; readonly actualBytes: number; readonly quality: number }
  | { readonly kind: 'unmet'; readonly actualBytes: number; readonly quality: number };

/** Returns a visitor-facing validation message, or nothing for a usable byte target. */
export function validateImageTargetBytes(targetBytes: number): string | undefined {
  if (!Number.isFinite(targetBytes) || !Number.isSafeInteger(targetBytes) || targetBytes <= 0) {
    return 'Enter a whole number of bytes greater than zero.';
  }

  return undefined;
}

/**
 * Decides which completed encode to keep. Candidates must be ordered from the
 * highest tested quality to the lowest. A target-size search stops at the first
 * matching candidate, so it never claims to have found a global optimum.
 */
export function decideImageTargetSize(
  targetBytes: number,
  candidates: readonly ImageTargetSizeCandidate[],
): ImageTargetSizeDecision | undefined {
  const met = candidates.find((candidate) => candidate.actualBytes <= targetBytes);
  if (met) return { kind: 'met', ...met };

  const smallest = candidates.reduce<ImageTargetSizeCandidate | undefined>((best, candidate) => {
    if (!best || candidate.actualBytes < best.actualBytes) return candidate;
    return best;
  }, undefined);

  return smallest && { kind: 'unmet', ...smallest };
}
