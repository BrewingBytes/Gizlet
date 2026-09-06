import { crc32, zipExtension } from './zip-archive';
import { getUniqueZipPaths, normaliseZipPath } from './create-zip';

/**
 * Looking inside an archive somebody has on their device, and taking things
 * back out of it.
 *
 * This is the reading half of the pair whose writing half is `create-zip`, and
 * it deliberately shares that half's machinery rather than growing a second ZIP
 * stack beside it: the same CRC, the same path normalisation, the same
 * uniqueness rule, and the same container writer for handing several files back
 * as one download.
 *
 * Everything here is a pure function over bytes and strings, which is the point
 * — an archive is a file format with a great many ways to be wrong, and the
 * parts that decide what a byte means are the parts that have to be tested
 * rather than clicked at. What needs a browser is only the decompressor, and
 * that lives in `scripts/archive-reading`.
 *
 * A word about what is not here. RAR is not read: its decompression cannot be
 * written by hand at a sensible size, so it needs a decoder this project has
 * not adopted, and a Gizlet that quietly failed on one would be worse than a
 * Gizlet that says plainly it cannot. A RAR is recognised and named, and that
 * is the whole of what happens to it.
 */

/** The formats this Gizlet can recognise, whether or not it can read them. */
export const archiveFormats = ['zip', 'rar', 'seven-zip', 'gzip', 'unknown'] as const;

export type ArchiveFormat = (typeof archiveFormats)[number];

/** The only one that is actually read. */
export const readableArchiveFormats = ['zip'] as const satisfies readonly ArchiveFormat[];

const signatures: readonly { readonly format: ArchiveFormat; readonly bytes: readonly number[] }[] = [
  // Every ZIP begins with a local header, an empty one with its end record, and
  // a spanned one with a marker. All three say the same thing about the file.
  { format: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { format: 'zip', bytes: [0x50, 0x4b, 0x05, 0x06] },
  { format: 'zip', bytes: [0x50, 0x4b, 0x07, 0x08] },
  { format: 'rar', bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  { format: 'seven-zip', bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { format: 'gzip', bytes: [0x1f, 0x8b] },
];

/**
 * What a file actually is, read from its first bytes rather than its name.
 *
 * An extension is a claim and the signature is the file, which matters here
 * more than usual: a `.zip` that is really a RAR is common enough that treating
 * the name as the truth would fail on exactly the file the visitor came with.
 */
export function detectArchiveFormat(bytes: Uint8Array): ArchiveFormat {
  for (const signature of signatures) {
    if (signature.bytes.every((byte, index) => bytes[index] === byte)) return signature.format;
  }

  return 'unknown';
}

/** How the page names a format it has recognised. */
export function describeArchiveFormat(format: ArchiveFormat): string {
  if (format === 'zip') return 'ZIP';
  if (format === 'rar') return 'RAR';
  if (format === 'seven-zip') return '7-Zip';
  if (format === 'gzip') return 'gzip';

  return 'an unrecognised format';
}

/**
 * Why a recognised archive is not being read, or nothing when it will be.
 *
 * Each of these says what the file is and what to do about it, because "could
 * not open" tells somebody holding a RAR nothing they did not already know.
 */
export function getArchiveFormatMessage(format: ArchiveFormat): string | undefined {
  if (format === 'zip') return undefined;

  if (format === 'rar') {
    return 'That is a RAR. This Gizlet reads ZIP archives only for now — RAR needs a decoder that is not part of this site yet. Unpacking it with the tool that made it and zipping the result is the way through today.';
  }

  if (format === 'seven-zip') {
    return 'That is a 7z archive, and this Gizlet reads ZIP archives only. 7-Zip itself opens it, and it can save the contents as a ZIP.';
  }

  if (format === 'gzip') {
    return 'That is a gzip file, which holds one compressed stream rather than an archive of files — often a .tar inside. This Gizlet reads ZIP archives.';
  }

  return 'That file does not begin like an archive. This Gizlet reads ZIP archives; check that the file downloaded completely and is the one you meant.';
}

/**
 * How large an archive this reads.
 *
 * The file is held in memory to be read, and so is whatever comes out of it, so
 * the limit is about a tab rather than about the format.
 */
export const maximumArchiveBytes = 512 * 1024 * 1024;

/** How many entries one archive may list before this stops looking. */
export const maximumArchiveEntries = 5_000;

/** How much may come out of one archive in total, unpacked. */
export const maximumExtractedBytes = 512 * 1024 * 1024;

/**
 * How much larger than itself a single entry may claim to unpack.
 *
 * A file that swears it is forty megabytes compressed into four kilobytes is
 * either a very dull file or a decompression bomb, and this Gizlet has no way
 * to tell which before unpacking it. Refusing at a ratio no honest file reaches
 * is the cheap half of not being the thing that fills somebody's memory.
 */
export const maximumEntryRatio = 1_000;

/** Under this size, a small file compressing extremely well is just a small file. */
const ratioFloor = 64 * 1024;

export function validateArchiveFile(file: { readonly size: number }): string | undefined {
  if (file.size === 0) return 'That file is empty, so there is nothing in it to look at.';

  if (file.size > maximumArchiveBytes) {
    return 'That archive is larger than this Gizlet opens in one tab. An archive tool on your device will handle it.';
  }

  return undefined;
}

const localHeaderSignature = 0x04034b50;
const centralHeaderSignature = 0x02014b50;
const endOfDirectorySignature = 0x06054b50;
const zip64EndOfDirectorySignature = 0x06064b50;
const zip64LocatorSignature = 0x07064b50;

const centralHeaderSize = 46;
const localHeaderSize = 30;
const endOfDirectorySize = 22;
const zip64LocatorSize = 20;

/** The methods that can be unpacked here: stored as it is, or deflated. */
export const storedMethod = 0;
export const deflatedMethod = 8;

/** Bit 0 of the flags: the entry is encrypted, whichever scheme did it. */
const encryptedFlag = 0x0001;

/** Bit 11: the name is UTF-8 rather than the format's legacy code page. */
const utf8NameFlag = 0x0800;

/** The marker a 32-bit field carries when its real value is in the ZIP64 extra. */
const zip64Marker = 0xffff_ffff;

export interface ArchiveEntry {
  /** The path as the archive stores it, shown when it differs from the safe one. */
  readonly storedPath: string;
  /** The path it is written under: normalised, relative, and free of `..`. */
  readonly path: string;
  /** Whether the stored path had to be changed to stay inside the folder. */
  readonly renamed: boolean;
  readonly isDirectory: boolean;
  readonly method: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly crc: number;
  readonly encrypted: boolean;
  /** Where the entry's own header sits, which is where its bytes are found. */
  readonly headerOffset: number;
}

/** An archive that cannot be read says why, in a sentence meant for a person. */
export class ArchiveReadError extends Error {}

function readName(bytes: Uint8Array, flags: number): string {
  if ((flags & utf8NameFlag) !== 0) return new TextDecoder().decode(bytes);

  // Without the flag the name is in the format's legacy code page. Most modern
  // writers set UTF-8 anyway and never say so, so UTF-8 is tried first and the
  // legacy reading is the fallback rather than the other way round.
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      return new TextDecoder().decode(bytes);
    }
  }
}

/**
 * Whether a stored path is one that would unpack somewhere nobody asked for.
 *
 * This is the oldest bug in archives: an entry called `../../.bashrc` unpacked
 * by something that trusted it. Nothing here writes to a file system, so it
 * cannot happen — but the path is still corrected, and the list still says so,
 * because a visitor holding an archive with such an entry in it has been told
 * something worth knowing about that archive.
 */
export function isUnsafeArchivePath(storedPath: string): boolean {
  const path = storedPath.replace(/\\/g, '/');

  return (
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path) ||
    path.split('/').some((segment) => segment === '..')
  );
}

function toEntryPath(storedPath: string): { readonly path: string; readonly renamed: boolean } {
  const path = normaliseZipPath(storedPath);

  return { path, renamed: path !== storedPath };
}

/**
 * The ZIP64 extra field, which holds the real numbers when the 32-bit ones
 * cannot. The fields appear in a fixed order and only when the value they
 * replace is the all-ones marker, so they are read in that order.
 */
function readZip64Extra(
  extra: Uint8Array,
  needs: { readonly size: boolean; readonly compressed: boolean; readonly offset: boolean },
): { size?: number; compressed?: number; offset?: number } {
  const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  let position = 0;

  while (position + 4 <= extra.length) {
    const id = view.getUint16(position, true);
    const length = view.getUint16(position + 2, true);
    let field = position + 4;

    if (field + length > extra.length) break;

    if (id === 0x0001) {
      const result: { size?: number; compressed?: number; offset?: number } = {};
      const take = () => {
        if (field + 8 > position + 4 + length) return undefined;

        const value = view.getBigUint64(field, true);

        field += 8;

        if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new ArchiveReadError('That archive holds a file too large to open in a browser tab.');
        }

        return Number(value);
      };

      if (needs.size) result.size = take();
      if (needs.compressed) result.compressed = take();
      if (needs.offset) result.offset = take();

      return result;
    }

    position = field + length;
  }

  return {};
}

interface DirectoryLocation {
  readonly offset: number;
  readonly count: number;
}

function findDirectory(bytes: Uint8Array, view: DataView): DirectoryLocation {
  // The end record sits at the very end unless the archive carries a comment,
  // whose length the format caps at 65,535, so this is the whole search space.
  const earliest = Math.max(0, bytes.length - endOfDirectorySize - 0xffff);
  let end = -1;

  for (let position = bytes.length - endOfDirectorySize; position >= earliest; position -= 1) {
    if (view.getUint32(position, true) === endOfDirectorySignature) {
      end = position;
      break;
    }
  }

  if (end === -1) {
    throw new ArchiveReadError(
      'That file does not end like a ZIP archive. It may have downloaded incompletely, or be part of a set split across several files.',
    );
  }

  const count = view.getUint16(end + 10, true);
  const offset = view.getUint32(end + 16, true);

  if (count !== 0xffff && offset !== zip64Marker) return { offset, count };

  // Either number being all ones means the real one is in the ZIP64 records,
  // which sit immediately before the end record, found through their locator.
  const locator = end - zip64LocatorSize;

  if (locator < 0 || view.getUint32(locator, true) !== zip64LocatorSignature) {
    throw new ArchiveReadError('That archive says it is in ZIP64 form but does not carry the records for it.');
  }

  const zip64Offset = view.getBigUint64(locator + 8, true);

  if (zip64Offset > BigInt(bytes.length - 56)) {
    throw new ArchiveReadError('That archive points past its own end. It is damaged or incomplete.');
  }

  const record = Number(zip64Offset);

  if (view.getUint32(record, true) !== zip64EndOfDirectorySignature) {
    throw new ArchiveReadError('That archive says it is in ZIP64 form but does not carry the records for it.');
  }

  const zip64Count = view.getBigUint64(record + 32, true);
  const directoryOffset = view.getBigUint64(record + 48, true);

  if (zip64Count > BigInt(maximumArchiveEntries) || directoryOffset > BigInt(bytes.length)) {
    throw new ArchiveReadError(
      `That archive lists more than the ${maximumArchiveEntries.toLocaleString()} files this Gizlet opens at once.`,
    );
  }

  return { offset: Number(directoryOffset), count: Number(zip64Count) };
}

/**
 * Every entry an archive lists.
 *
 * The list comes from the central directory rather than by walking the entries
 * from the front, because the directory is the archive's own index: it is what
 * every other reader uses, and an archive with something odd appended to it
 * still opens.
 */
export function readArchiveEntries(bytes: Uint8Array): readonly ArchiveEntry[] {
  if (bytes.length < endOfDirectorySize) {
    throw new ArchiveReadError('That file is too small to be a ZIP archive.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { offset, count } = findDirectory(bytes, view);

  if (count > maximumArchiveEntries) {
    throw new ArchiveReadError(
      `That archive lists ${count.toLocaleString()} files, and this Gizlet opens up to ${maximumArchiveEntries.toLocaleString()} at once.`,
    );
  }

  const entries: ArchiveEntry[] = [];
  let position = offset;

  for (let index = 0; index < count; index += 1) {
    if (position + centralHeaderSize > bytes.length) {
      throw new ArchiveReadError('That archive ends in the middle of its own index. It is damaged or incomplete.');
    }

    if (view.getUint32(position, true) !== centralHeaderSignature) {
      throw new ArchiveReadError('That archive’s index does not read as one. It is damaged, or it is not a ZIP.');
    }

    const flags = view.getUint16(position + 8, true);
    const method = view.getUint16(position + 10, true);
    const crc = view.getUint32(position + 16, true);
    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);
    const nameStart = position + centralHeaderSize;
    const extraStart = nameStart + nameLength;
    const next = extraStart + extraLength + commentLength;

    if (next > bytes.length) {
      throw new ArchiveReadError('That archive ends in the middle of its own index. It is damaged or incomplete.');
    }

    let compressedSize = view.getUint32(position + 20, true);
    let size = view.getUint32(position + 24, true);
    let headerOffset = view.getUint32(position + 42, true);
    const needs = {
      size: size === zip64Marker,
      compressed: compressedSize === zip64Marker,
      offset: headerOffset === zip64Marker,
    };

    if (needs.size || needs.compressed || needs.offset) {
      const zip64 = readZip64Extra(bytes.subarray(extraStart, extraStart + extraLength), needs);

      size = zip64.size ?? size;
      compressedSize = zip64.compressed ?? compressedSize;
      headerOffset = zip64.offset ?? headerOffset;
    }

    const storedPath = readName(bytes.subarray(nameStart, extraStart), flags);
    const isDirectory = storedPath.endsWith('/') || storedPath.endsWith('\\');
    const { path, renamed } = toEntryPath(storedPath);

    entries.push({
      storedPath,
      path,
      renamed: renamed && !isDirectory,
      isDirectory,
      method,
      compressedSize,
      size,
      crc,
      encrypted: (flags & encryptedFlag) !== 0,
      headerOffset,
    });

    position = next;
  }

  return entries;
}

/**
 * The files in an archive, which is what the page lists.
 *
 * A directory entry is a name with no bytes behind it. The tree already shows
 * folders, drawn from the paths, so a row for one would be a second way of
 * saying the same thing — and an archive from a Windows tool often has none of
 * them anyway, which is why folders cannot come from these entries.
 */
export function getArchiveFiles(entries: readonly ArchiveEntry[]): readonly ArchiveEntry[] {
  return entries.filter((entry) => !entry.isDirectory && entry.path !== 'file');
}

/**
 * Why an entry cannot be unpacked, or nothing when it can.
 *
 * The method numbers are the format's own: bzip2, LZMA, zstd and the rest are
 * legal ZIP and no browser has a decompressor for any of them.
 */
export function getEntryBlocker(entry: ArchiveEntry): string | undefined {
  if (entry.encrypted) return 'Encrypted';

  if (entry.method !== storedMethod && entry.method !== deflatedMethod) {
    return `Compressed with method ${entry.method}`;
  }

  if (entry.size > maximumExtractedBytes) return 'Too large to unpack here';

  if (
    entry.compressedSize > 0 &&
    entry.size > ratioFloor &&
    entry.size / entry.compressedSize > maximumEntryRatio
  ) {
    return 'Refused: unpacks to an implausible size';
  }

  return undefined;
}

/** Whether anything in the archive can be taken out of it at all. */
export function hasExtractableEntry(entries: readonly ArchiveEntry[]): boolean {
  return getArchiveFiles(entries).some((entry) => getEntryBlocker(entry) === undefined);
}

/** What the page says about an archive it has opened but cannot take anything from. */
export function getArchiveBlockedMessage(entries: readonly ArchiveEntry[]): string | undefined {
  const files = getArchiveFiles(entries);

  if (files.length === 0) return 'That archive lists no files. It holds only folders, or it is empty.';
  if (hasExtractableEntry(entries)) return undefined;

  if (files.every((entry) => entry.encrypted)) {
    return 'Every file in that archive is encrypted. This Gizlet does not ask for passwords and does not try to get around them, so there is nothing it can take out.';
  }

  return 'Nothing in that archive is in a form a browser can unpack. Its files use a compression method no browser has a decompressor for.';
}

export interface ArchiveTreeNode {
  readonly kind: 'folder' | 'file';
  /** The last segment, which is what the row reads as. */
  readonly name: string;
  /** The whole path, which is what a folder's tick acts on. */
  readonly path: string;
  readonly depth: number;
  /** Which entry a file row is, as an index into the files it was built from. */
  readonly fileIndex?: number;
  /** How many files sit under a folder, at any depth. */
  readonly fileCount: number;
  /** What those files come to unpacked. */
  readonly size: number;
}

/**
 * The archive as a tree, flattened into rows a list can draw.
 *
 * Folders come from the paths rather than from the archive's folder entries,
 * so an archive written without them still shows its shape. Rows are ordered
 * the way a file manager orders them — folders first, then files, each
 * alphabetically — because that is the order the visitor is expecting to read.
 */
export function buildArchiveTree(files: readonly ArchiveEntry[]): readonly ArchiveTreeNode[] {
  interface Folder {
    readonly folders: Map<string, Folder>;
    readonly files: { readonly name: string; readonly index: number; readonly size: number }[];
  }

  const makeFolder = (): Folder => ({ folders: new Map(), files: [] });
  const root = makeFolder();

  files.forEach((entry, index) => {
    const segments = entry.path.split('/');
    const name = segments.pop() ?? entry.path;
    let folder = root;

    for (const segment of segments) {
      let next = folder.folders.get(segment);

      if (!next) {
        next = makeFolder();
        folder.folders.set(segment, next);
      }

      folder = next;
    }

    folder.files.push({ name, index, size: entry.size });
  });

  const compare = (left: string, right: string) => left.localeCompare(right, 'en');
  const nodes: ArchiveTreeNode[] = [];

  const walk = (folder: Folder, prefix: string, depth: number): { count: number; size: number } => {
    let count = 0;
    let size = 0;

    for (const name of [...folder.folders.keys()].sort(compare)) {
      const path = prefix === '' ? name : `${prefix}/${name}`;
      const placeholder = nodes.length;

      nodes.push({ kind: 'folder', name, path, depth, fileCount: 0, size: 0 });

      const totals = walk(folder.folders.get(name) as Folder, path, depth + 1);

      nodes[placeholder] = { ...nodes[placeholder], fileCount: totals.count, size: totals.size };
      count += totals.count;
      size += totals.size;
    }

    for (const file of [...folder.files].sort((left, right) => compare(left.name, right.name))) {
      nodes.push({
        kind: 'file',
        name: file.name,
        path: prefix === '' ? file.name : `${prefix}/${file.name}`,
        depth,
        fileIndex: file.index,
        fileCount: 1,
        size: file.size,
      });
      count += 1;
      size += file.size;
    }

    return { count, size };
  };

  walk(root, '', 0);

  return nodes;
}

/** Which files sit under a folder row, which is what ticking one means. */
export function getFileIndexesUnder(
  nodes: readonly ArchiveTreeNode[],
  folderPath: string,
): readonly number[] {
  const prefix = `${folderPath}/`;

  return nodes
    .filter((node) => node.kind === 'file' && node.path.startsWith(prefix))
    .map((node) => node.fileIndex as number);
}

/**
 * Whether a folder's tick is on, off, or somewhere between.
 *
 * A folder holding a file that cannot be unpacked can never be fully ticked, so
 * the third state is not a nicety: it is the honest answer for most folders in
 * an archive that has anything odd in it.
 */
export function getFolderSelectionState(
  indexes: readonly number[],
  selected: ReadonlySet<number>,
): 'none' | 'some' | 'all' {
  const ticked = indexes.filter((index) => selected.has(index)).length;

  if (ticked === 0) return 'none';

  return ticked === indexes.length ? 'all' : 'some';
}

/**
 * What the bar above the list says about what is ticked.
 *
 * It sits beside the description of the archive itself, so it says what that
 * one does not: everything ticked is a phrase rather than the same two numbers
 * a second time, and a partial selection is stated against the whole.
 */
export function describeArchiveSelection(
  files: readonly ArchiveEntry[],
  selected: ReadonlySet<number>,
  formatSize: (bytes: number) => string,
): string {
  if (selected.size === 0) return 'nothing ticked yet';
  if (selected.size === files.length) return 'everything ticked';

  const bytes = [...selected].reduce((total, index) => total + (files[index]?.size ?? 0), 0);

  return `${selected.size.toLocaleString()} of ${files.length.toLocaleString()} ticked · ${formatSize(bytes)}`;
}

/** What the page says about the archive itself, once it has been read. */
export function describeArchive(
  files: readonly ArchiveEntry[],
  formatSize: (bytes: number) => string,
): string {
  const bytes = files.reduce((total, entry) => total + entry.size, 0);
  // Every folder the tree draws, which means the ancestors too: a folder that
  // holds only other folders is a row on the page and has to be counted as one.
  const folders = new Set(
    files.flatMap((entry) => {
      const segments = entry.path.split('/').slice(0, -1);

      return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
    }),
  );
  const count = `${files.length.toLocaleString()} ${files.length === 1 ? 'file' : 'files'}`;
  const parts = [count, `${formatSize(bytes)} unpacked`];

  if (folders.size > 0) {
    parts.push(`${folders.size.toLocaleString()} ${folders.size === 1 ? 'folder' : 'folders'}`);
  }

  return parts.join(' · ');
}

/** What a row says about an entry beside its name. */
export function describeEntry(entry: ArchiveEntry, formatSize: (bytes: number) => string): string {
  const blocker = getEntryBlocker(entry);

  if (blocker) return blocker;

  const method = entry.method === storedMethod ? 'stored' : 'deflated';

  return `${formatSize(entry.size)} · ${method}`;
}

/**
 * The paths the chosen files are handed back under.
 *
 * Two entries really can normalise to the same path — an archive holding both
 * `a/b.txt` and `a\b.txt`, or one written with a `..` in it — and a download
 * holding one name twice loses a file. They are numbered instead, by the same
 * rule Create ZIP uses, so the two Gizlets disagree about nothing.
 */
export function getExtractionPaths(
  files: readonly ArchiveEntry[],
  indexes: readonly number[],
): readonly string[] {
  return getUniqueZipPaths(indexes.map((index) => files[index]?.path ?? 'file'));
}

/** Whether the chosen files come back as themselves or as one archive. */
export function isSingleFileExtraction(indexes: readonly number[]): boolean {
  return indexes.length === 1;
}

/**
 * What the download is called.
 *
 * One file comes back as itself, under its own name, because that is what was
 * asked for. Several come back as an archive, since a browser cannot be handed
 * a folder — and it is named after the archive they came out of, so it is
 * obvious which one it belongs to without overwriting it.
 */
export function getExtractionName(archiveName: string, paths: readonly string[]): string {
  if (paths.length === 1) {
    const [path] = paths;

    return path.slice(path.lastIndexOf('/') + 1) || 'file';
  }

  const dot = archiveName.lastIndexOf('.');
  const base = normaliseZipPath(dot > 0 ? archiveName.slice(0, dot) : archiveName);
  // A leading dot goes: an archive called `.zip` is a dotfile whose whole name
  // is its extension, and `.zip-extracted.zip` is a download nobody can see.
  const name = base.slice(base.lastIndexOf('/') + 1).replace(/^\.+/, '') || 'archive';

  return `${name}-extracted.${zipExtension}`;
}

/** The bytes of one entry, still compressed, taken out of the whole archive. */
export function readEntryPayload(bytes: Uint8Array, entry: ArchiveEntry): Uint8Array {
  const start = entry.headerOffset;

  if (start + localHeaderSize > bytes.length) {
    throw new ArchiveReadError(`${entry.path} is not where the archive says it is. The file is damaged.`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (view.getUint32(start, true) !== localHeaderSignature) {
    throw new ArchiveReadError(`${entry.path} is not where the archive says it is. The file is damaged.`);
  }

  // The local header repeats the name and may carry a different extra field
  // from the one in the index, so both lengths are read here rather than reused.
  const nameLength = view.getUint16(start + 26, true);
  const extraLength = view.getUint16(start + 28, true);
  const payload = start + localHeaderSize + nameLength + extraLength;
  const end = payload + entry.compressedSize;

  if (end > bytes.length) {
    throw new ArchiveReadError(`${entry.path} runs past the end of the archive. The file is incomplete.`);
  }

  return bytes.subarray(payload, end);
}

/**
 * Checks unpacked bytes against what the archive said they would be.
 *
 * The CRC is the archive's own claim about the file, so an entry that comes out
 * differently is a corrupt archive rather than a corrupt reader, and saying so
 * is more use than handing over a file that will not open.
 */
export function verifyEntry(entry: ArchiveEntry, data: Uint8Array): string | undefined {
  if (data.length !== entry.size) {
    return `${entry.path} unpacked to a different size than the archive says it should. The archive is damaged.`;
  }

  if (crc32(data) !== entry.crc) {
    return `${entry.path} did not survive the trip: its checksum does not match what the archive recorded. The archive is damaged.`;
  }

  return undefined;
}

/** The progress line, for an archive with enough in it to need one. */
export function describeExtractionProgress(position: number, total: number): string {
  return `Unpacking file ${position.toLocaleString()} of ${total.toLocaleString()} locally…`;
}

/** Where the progress line starts being worth showing. */
export const largeExtractionFiles = 20;

export function getArchiveReadErrorMessage(): string {
  return 'That archive could not be read on this device. Nothing was sent anywhere, and the file is untouched.';
}

export function getExtractionErrorMessage(): string {
  return 'Those files could not be unpacked on this device. Nothing was sent anywhere, and the archive is untouched.';
}
