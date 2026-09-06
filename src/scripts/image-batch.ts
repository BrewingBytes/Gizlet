import { getUniqueBatchNames, validateBatchPixels, type BatchOutcome } from '../data/image-batches';
import { createZipArchive, zipMimeType } from '../data/zip-archive';
import { loadBrowserImage } from './image-processing';

/**
 * Running a batch in the browser: reading the pictures, working through them,
 * and packing what came out.
 *
 * The decisions — how many, how big, what the panel says — are all in
 * `data/image-batches`. What is here is the part that needs a browser: decoding
 * a file, yielding to the paint between pictures so a long batch does not
 * freeze the tab, and turning the finished files into one archive.
 *
 * Every workspace that takes several images uses this rather than writing the
 * loop again, which is what keeps one bad file behaving the same way in all of
 * them.
 */

export interface BatchSource {
  readonly file: File;
  readonly image: HTMLImageElement;
  readonly width: number;
  readonly height: number;
  /** For the thumbnail beside the row. Revoked by `releaseBatch`. */
  readonly previewUrl: string;
}

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/**
 * Decodes the chosen files.
 *
 * A file the browser will not decode is a failed row rather than a thrown
 * batch: the visitor is told which one, and the rest are read.
 */
export interface BatchFailure {
  readonly name: string;
  readonly reason: string;
}

export async function readBatchSources(
  files: readonly File[],
  onProgress?: (position: number, total: number) => void,
): Promise<{ readonly sources: readonly BatchSource[]; readonly failures: readonly BatchFailure[] }> {
  const sources: BatchSource[] = [];
  const failures: BatchFailure[] = [];

  for (const [index, file] of files.entries()) {
    onProgress?.(index + 1, files.length);
    await nextPaint();

    try {
      const image = await loadBrowserImage(file);

      if (!image.naturalWidth || !image.naturalHeight) throw new Error('no usable dimensions');

      sources.push({
        file,
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        previewUrl: URL.createObjectURL(file),
      });
    } catch {
      failures.push({ name: file.name, reason: 'This image could not be read.' });
    }
  }

  return { sources, failures };
}

export function releaseBatch(sources: readonly BatchSource[]): void {
  for (const source of sources) URL.revokeObjectURL(source.previewUrl);
}

/** The pixel guard, applied to what was actually decoded. */
export function checkBatchSize(sources: readonly BatchSource[]): string | undefined {
  return validateBatchPixels(sources);
}

/**
 * Works through the batch, one picture at a time.
 *
 * Sequential on purpose: each picture is a canvas the size of the picture, and
 * doing twenty at once is how a tab runs out of memory doing something it could
 * have done comfortably one after another.
 */
export async function runImageBatch<T>(
  sources: readonly BatchSource[],
  run: (source: BatchSource) => Promise<T>,
  onProgress?: (position: number, total: number) => void,
): Promise<readonly BatchOutcome<T>[]> {
  const outcomes: BatchOutcome<T>[] = [];

  for (const [index, source] of sources.entries()) {
    onProgress?.(index + 1, sources.length);
    await nextPaint();

    try {
      outcomes.push({ status: 'done', name: source.file.name, output: await run(source) });
    } catch (caughtError) {
      outcomes.push({
        status: 'failed',
        name: source.file.name,
        reason: caughtError instanceof Error ? caughtError.message : 'This image could not be processed.',
      });
    }
  }

  return outcomes;
}

/** The finished files as one archive, written from the same bytes the rows link to. */
export async function packImageArchive(files: readonly File[]): Promise<Blob> {
  const names = getUniqueBatchNames(files.map((file) => file.name));
  const entries = await Promise.all(
    files.map(async (file, index) => ({
      name: names[index],
      data: new Uint8Array(await file.arrayBuffer()),
    })),
  );

  return new Blob([createZipArchive(entries)], { type: zipMimeType });
}
