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

/**
 * What "KB" and "MB" mean in this one control.
 *
 * Everywhere else Gizlet reports a size in binary units, because that is what a
 * file manager shows. A target is a different kind of number: it comes from an
 * upload form that said "under 500 KB", and a form that says that means 500,000
 * bytes. Aiming at 512,000 to satisfy a rule written as 500,000 would hand back
 * a file the visitor came here to avoid, so this control is decimal, and the
 * copy beside it says so rather than leaving it to be discovered.
 */
export const targetSizeBytesPerKilobyte = 1_000;
export const targetSizeBytesPerMegabyte = 1_000_000;

/** Which of the two ways to ask for a smaller file is in use. */
export const imageTargetSizeModes = ['quality', 'target'] as const;

export type ImageTargetSizeMode = (typeof imageTargetSizeModes)[number];

export interface ImageTargetSizePreset {
  readonly label: string;
  readonly bytes: number;
}

/**
 * The limits worth one click.
 *
 * They are the numbers upload forms actually print, rather than a tidy series:
 * a form asking for under 300 KB is rare, and one asking for under 500 KB or
 * under 1 MB is not. Anything else is the custom field.
 */
export const imageTargetSizePresets: readonly ImageTargetSizePreset[] = [
  { label: '100 KB', bytes: 100 * targetSizeBytesPerKilobyte },
  { label: '200 KB', bytes: 200 * targetSizeBytesPerKilobyte },
  { label: '500 KB', bytes: 500 * targetSizeBytesPerKilobyte },
  { label: '1 MB', bytes: targetSizeBytesPerMegabyte },
];

/**
 * The largest custom limit the field takes.
 *
 * A target above this is not a target: the picture is already under it, and the
 * search returns its first candidate every time. It is a guard against a typo
 * that adds three zeroes, not a claim about what the browser can encode.
 */
export const maximumImageTargetKilobytes = 100_000;

export type ImageTargetKilobytes =
  | { readonly kind: 'bytes'; readonly bytes: number }
  | { readonly kind: 'invalid'; readonly message: string };

/**
 * Reads the custom field, which is whole kilobytes and nothing else.
 *
 * Half a kilobyte is a precision this control does not have — the search tests
 * ten qualities and takes what the encoder gives — so a fractional entry is
 * refused rather than quietly rounded into a limit the visitor did not ask for.
 */
export function parseImageTargetKilobytes(value: string): ImageTargetKilobytes {
  const trimmed = value.trim();

  if (trimmed === '') return { kind: 'invalid', message: 'Enter a size in KB.' };

  const kilobytes = Number(trimmed);

  if (!Number.isInteger(kilobytes) || kilobytes <= 0) {
    return { kind: 'invalid', message: 'Enter a whole number of KB greater than zero.' };
  }

  if (kilobytes > maximumImageTargetKilobytes) {
    return {
      kind: 'invalid',
      message: `Enter ${maximumImageTargetKilobytes.toLocaleString()} KB or less.`,
    };
  }

  return { kind: 'bytes', bytes: kilobytes * targetSizeBytesPerKilobyte };
}

/** A limit as this control writes it, in the decimal units it is measured in. */
export function formatTargetSize(bytes: number): string {
  if (bytes >= targetSizeBytesPerMegabyte && bytes % targetSizeBytesPerMegabyte === 0) {
    return `${bytes / targetSizeBytesPerMegabyte} MB`;
  }

  if (bytes >= targetSizeBytesPerKilobyte && bytes % targetSizeBytesPerKilobyte === 0) {
    return `${(bytes / targetSizeBytesPerKilobyte).toLocaleString()} KB`;
  }

  return `${bytes.toLocaleString()} bytes`;
}

/**
 * What the result actually weighs.
 *
 * The exact count rather than a rounded one: the visitor is about to hand this
 * file to something that will measure it, and "98.4 KB" is not a number that
 * can be checked against a limit.
 */
export function formatExactBytes(bytes: number): string {
  return `${bytes.toLocaleString()} ${bytes === 1 ? 'byte' : 'bytes'}`;
}

/** One finished target search, as the result panel or a batch row says it. */
export function describeImageTargetResult(
  kind: ImageTargetSizeDecision['kind'],
  actualBytes: number,
  targetBytes: number,
): string {
  const limit = formatTargetSize(targetBytes);

  return kind === 'met'
    ? `${formatExactBytes(actualBytes)} · within the ${limit} limit`
    : `${formatExactBytes(actualBytes)} · over the ${limit} limit`;
}

/** The heading above a single finished target search. */
export function getImageTargetTitle(kind: ImageTargetSizeDecision['kind']): string {
  return kind === 'met' ? 'Your image is under the limit.' : 'This is as small as it went.';
}

/**
 * How a batch did against its limit.
 *
 * The target is applied to each picture on its own, so this counts rather than
 * averages: a batch is a set of independent answers, and the one file that
 * would not come down is the one the visitor needs to find.
 */
export function summariseImageTargetBatch(
  kinds: readonly ImageTargetSizeDecision['kind'][],
  targetBytes: number,
): string {
  const limit = formatTargetSize(targetBytes);
  const met = kinds.filter((kind) => kind === 'met').length;

  if (met === 0) return `No image came in under ${limit}.`;
  if (met === kinds.length) return `Every image came in under ${limit}.`;

  return `${met} of ${kinds.length} images came in under ${limit}.`;
}

/**
 * Whether a target can be aimed at in this format at all.
 *
 * PNG is lossless, so there is no quality to spend and nothing for the search
 * to vary. Aiming at a size in PNG would mean changing the format or the
 * dimensions behind the visitor's back, and this Gizlet does neither.
 */
export function supportsImageTargetSize(
  format: string,
): format is 'image/jpeg' | 'image/webp' {
  return format === 'image/jpeg' || format === 'image/webp';
}

/** Why the target control is not offered for PNG. */
export const imageTargetSizePngExplanation =
  'PNG stores every pixel exactly, so there is no quality to trade away and no size to aim at. Choose JPEG or WebP to set a target, or use Resize Image to take pixels out instead.';

/** What is left to try when the limit could not be met. */
export const imageTargetSizeUnmetAdvice =
  'The lowest quality this Gizlet tries still leaves the file over the limit. Fewer pixels is the thing left: a smaller picture compresses further, and the format and dimensions are not changed here without you asking.';
