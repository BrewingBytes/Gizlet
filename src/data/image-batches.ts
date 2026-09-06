import { formatFileSize, isSupportedImageFile } from './image-compression';
import { maximumImagePixels } from './image-resize';
import { zipExtension } from './zip-archive';

/**
 * Running one settings panel over several pictures at once.
 *
 * The image Gizlets and the image Flows were built one file at a time, which is
 * the wrong shape for the job people actually arrive with: a folder of photos
 * that all need the same thing done to them. This module is the part of that
 * which is arithmetic and wording — how many files are allowed, how much work
 * they add up to, what happens when one of them is broken, and what the result
 * panel says — so all of it can be tested without a browser and so every
 * workspace and the flow builder answer the same way.
 *
 * The rule that matters most here is that a batch is a set of independent jobs.
 * One unreadable file is one failed row, not a failed run: the pictures that
 * worked are still finished, still downloadable, and the one that did not says
 * why. A batch that threw away twenty good results because the twenty-first
 * file was a renamed text document would be worse than no batch at all.
 */

/**
 * The most files one batch takes.
 *
 * It is a guard rather than a taste: every picture is decoded and re-encoded in
 * this tab, and a hundred large photographs is a tab that stops responding
 * rather than a batch that finishes. Twenty-five is comfortably more than a
 * phone camera roll's worth of one afternoon and comfortably less than that.
 */
export const maximumBatchImages = 25;

/**
 * The pixels a whole batch may add up to.
 *
 * Each picture is already held to `maximumImagePixels` on its own. A batch is
 * held to a multiple of that rather than to the sum of the limits, because the
 * work is sequential — one canvas at a time — and the browser's ceiling is on
 * what is alive at once, not on what passes through.
 */
export const maximumBatchPixels = maximumImagePixels * 8;

export function describeBatchCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'image' : 'images'}`;
}

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

export interface BatchDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Whether this set of files can be taken on, given what is already chosen.
 *
 * The count is checked against the total rather than against the addition, so
 * dropping five files onto twenty-three says the same thing as choosing
 * twenty-eight at once.
 */
export function validateBatchSelection(
  files: readonly FileDetails[],
  alreadyChosen = 0,
): string | undefined {
  if (files.length === 0) return 'Choose at least one image.';

  const unsupported = files.find((file) => !isSupportedImageFile(file));

  if (unsupported) {
    return `${unsupported.name} is not a JPEG, PNG, WebP, AVIF, or BMP image.`;
  }

  const total = alreadyChosen + files.length;

  if (total > maximumBatchImages) {
    return `This Gizlet works on up to ${describeBatchCount(maximumBatchImages)} at a time, and that would be ${describeBatchCount(total)}.`;
  }

  return undefined;
}

/** Whether the batch, as a whole, is more work than one tab should take on. */
export function validateBatchPixels(images: readonly BatchDimensions[]): string | undefined {
  const pixels = images.reduce((total, image) => total + image.width * image.height, 0);

  if (pixels > maximumBatchPixels) {
    return `These images come to ${pixels.toLocaleString()} pixels together, and this Gizlet works through up to ${maximumBatchPixels.toLocaleString()} in one batch. Take some out and run them separately.`;
  }

  return undefined;
}

/** One file's outcome. A batch is a list of these and nothing else. */
export type BatchOutcome<T> =
  | { readonly status: 'done'; readonly name: string; readonly output: T }
  | { readonly status: 'failed'; readonly name: string; readonly reason: string };

export function getBatchSuccesses<T>(outcomes: readonly BatchOutcome<T>[]): readonly T[] {
  return outcomes.flatMap((outcome) => (outcome.status === 'done' ? [outcome.output] : []));
}

export function getBatchFailures<T>(
  outcomes: readonly BatchOutcome<T>[],
): readonly { readonly name: string; readonly reason: string }[] {
  return outcomes.flatMap((outcome) =>
    outcome.status === 'failed' ? [{ name: outcome.name, reason: outcome.reason }] : [],
  );
}

/** Whether a batch produced anything at all, which is what the panel turns on. */
export function hasBatchOutput<T>(outcomes: readonly BatchOutcome<T>[]): boolean {
  return outcomes.some((outcome) => outcome.status === 'done');
}

/**
 * What the result panel says happened.
 *
 * A batch where everything worked does not mention failure, and a batch where
 * something failed says so in the same breath as the successes rather than in a
 * separate alarm somewhere else on the page.
 */
export function summariseBatch<T>(outcomes: readonly BatchOutcome<T>[], totalBytes = 0): string {
  const done = outcomes.filter((outcome) => outcome.status === 'done').length;
  const failed = outcomes.length - done;
  const size = totalBytes > 0 ? ` · ${formatFileSize(totalBytes)}` : '';

  if (done === 0) return `None of these ${describeBatchCount(outcomes.length)} could be processed.`;
  if (failed === 0) return `${describeBatchCount(done)}${size}`;

  return `${describeBatchCount(done)} of ${outcomes.length}${size} · ${failed} could not be processed`;
}

/** The jobs a batch archive can come out of, which is what names the file. */
export const batchArchiveLabels = ['compressed', 'resized', 'converted', 'flow'] as const;

export type BatchArchiveLabel = (typeof batchArchiveLabels)[number];

/**
 * The archive's own name.
 *
 * It is named for the job rather than for the first file in it: a batch has no
 * one source to be named after, and `photo-1-and-11-more.zip` is a filename
 * nobody wants in their downloads folder.
 */
export function getBatchArchiveName(label: BatchArchiveLabel): string {
  return `${label === 'flow' ? 'flow' : label}-images.${zipExtension}`;
}

/**
 * Keeps the entry names inside an archive apart.
 *
 * Two pictures from two folders can arrive with the same name, and a ZIP with
 * the same entry twice is one a reader will silently overwrite half of. The
 * number goes before the extension so the names still sort the way the batch
 * ran.
 */
export function getUniqueBatchNames(names: readonly string[]): readonly string[] {
  const used = new Map<string, number>();

  return names.map((name) => {
    const seen = used.get(name) ?? 0;

    used.set(name, seen + 1);

    if (seen === 0) return name;

    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : '';

    return `${base}-${seen + 1}${extension}`;
  });
}

/** The line one row of the result list shows. */
export function describeBatchItem(name: string, detail: string): string {
  return `${name} · ${detail}`;
}
