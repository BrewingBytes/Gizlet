import {
  ArchiveReadError,
  deflatedMethod,
  getEntryBlocker,
  getExtractionName,
  getExtractionPaths,
  readEntryPayload,
  storedMethod,
  verifyEntry,
  type ArchiveEntry,
} from '../data/extract-archive';
import { createZipArchive, zipMimeType, type ZipEntry } from '../data/zip-archive';

/**
 * Taking files back out of an archive, in the browser.
 *
 * The container is read by `data/extract-archive`, which is pure and tested.
 * What is here is the one part of unpacking that needs a browser at all:
 * `DecompressionStream('deflate-raw')`, which is inflate, built in, and the
 * reason this Gizlet reads ZIP archives without a dependency to do it.
 *
 * Files come back one at a time and each is checked against the checksum the
 * archive recorded for it before it is handed over, so a damaged archive is
 * reported as damaged rather than turned into files that will not open.
 */

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Whether this browser can inflate, which is whether it can unpack at all. */
export function canInflate(): boolean {
  return typeof DecompressionStream === 'function';
}

/** What the page says on a browser with no decompressor. */
export function getNoInflateMessage(): string {
  return 'This browser has no decompressor built in, so a compressed archive cannot be unpacked here. A current Firefox, Chrome, Edge or Safari has one.';
}

export async function inflateBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (!canInflate()) throw new ArchiveReadError(getNoInflateMessage());

  const stream = new Blob([bytes.slice()])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** One entry, unpacked and checked, as the bytes it was before it was packed. */
export async function unpackEntry(archive: Uint8Array, entry: ArchiveEntry): Promise<Uint8Array> {
  const blocker = getEntryBlocker(entry);

  if (blocker) throw new ArchiveReadError(`${entry.path} cannot be unpacked here: ${blocker.toLowerCase()}.`);

  const payload = readEntryPayload(archive, entry);
  let data: Uint8Array;

  if (entry.method === storedMethod) {
    data = payload.slice();
  } else if (entry.method === deflatedMethod) {
    data = await inflateBytes(payload);
  } else {
    throw new ArchiveReadError(`${entry.path} uses a compression method a browser cannot read.`);
  }

  const damage = verifyEntry(entry, data);

  if (damage) throw new ArchiveReadError(damage);

  return data;
}

export interface ExtractionResult {
  readonly blob: Blob;
  readonly name: string;
  /** What the files come to unpacked, which is what the result panel reports. */
  readonly bytes: number;
}

export interface ExtractionOptions {
  readonly onFile?: (position: number, total: number) => void;
}

/**
 * The chosen files, as one download.
 *
 * A single file comes back as itself. Several come back as an archive, because
 * a browser download is one file and there is no way to hand over a folder —
 * and the archive is written by the same writer Create ZIP uses, so what comes
 * out of this Gizlet is a file the other one could have made.
 *
 * Sequential on purpose: each entry is held in memory while it inflates, and
 * unpacking four hundred at once is how a tab runs out of memory doing
 * something it could have done comfortably one after another.
 */
export async function extractEntries(
  archive: Uint8Array,
  archiveName: string,
  files: readonly ArchiveEntry[],
  indexes: readonly number[],
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const paths = getExtractionPaths(files, indexes);
  const name = getExtractionName(archiveName, paths);
  const entries: ZipEntry[] = [];
  let bytes = 0;

  for (const [position, index] of indexes.entries()) {
    const entry = files[index];

    if (!entry) continue;

    options.onFile?.(position + 1, indexes.length);
    await nextPaint();

    const data = await unpackEntry(archive, entry);

    bytes += data.length;

    if (indexes.length === 1) {
      return {
        blob: new Blob([data.slice()], { type: 'application/octet-stream' }),
        name,
        bytes,
      };
    }

    entries.push({ name: paths[position], data });
  }

  if (entries.length === 0) throw new ArchiveReadError('Nothing was ticked, so there is nothing to unpack.');

  return { blob: new Blob([createZipArchive(entries)], { type: zipMimeType }), name, bytes };
}
