import { createZipArchive, zipMimeType, type ZipEntry } from '../data/zip-archive';

/**
 * Building an archive in the browser: reading each file, compressing it if this
 * browser has a compressor, and assembling the result.
 *
 * The container is written by `data/zip-archive`, which is pure and tested.
 * What is here is the part that needs a browser — reading a `File`, running
 * `CompressionStream`, and yielding to the paint between files so a long job
 * does not freeze the tab it is running in.
 *
 * `CompressionStream('deflate-raw')` is the browser's own deflate, so this adds
 * no dependency to compress with. A browser without it stores the files
 * instead, which is a larger archive rather than a broken one — and every ZIP
 * reader in the world opens both.
 */

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Whether this browser can deflate, which decides how large the archive is. */
export function canDeflate(): boolean {
  return typeof CompressionStream === 'function';
}

/**
 * The deflated form of some bytes, or nothing.
 *
 * Nothing is a perfectly good answer: the entry is then stored, which is what
 * every archive this site wrote before this Gizlet existed.
 */
export async function deflateBytes(bytes: Uint8Array): Promise<Uint8Array | undefined> {
  if (!canDeflate()) return undefined;

  try {
    const stream = new Blob([bytes.slice()]).stream().pipeThrough(new CompressionStream('deflate-raw'));

    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return undefined;
  }
}

export interface ZipInput {
  /** The path the entry is written under, already normalised and unique. */
  readonly path: string;
  readonly file: File;
}

export interface ZipBuildOptions {
  readonly onFile?: (position: number, total: number) => void;
}

/**
 * Reads every file and writes them as one archive.
 *
 * Sequential on purpose: each file is held in memory as it is read and again as
 * it is compressed, and doing five hundred at once is how a tab runs out of
 * memory doing something it could have done comfortably one after another.
 */
export async function buildZipArchive(
  inputs: readonly ZipInput[],
  options: ZipBuildOptions = {},
): Promise<Blob> {
  const entries: ZipEntry[] = [];

  for (const [index, input] of inputs.entries()) {
    options.onFile?.(index + 1, inputs.length);
    await nextPaint();

    const data = new Uint8Array(await input.file.arrayBuffer());

    entries.push({ name: input.path, data, deflated: await deflateBytes(data) });
  }

  return new Blob([createZipArchive(entries)], { type: zipMimeType });
}
