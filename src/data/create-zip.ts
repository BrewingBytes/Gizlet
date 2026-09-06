import { maximumZipBytes, maximumZipEntries, zipExtension } from './zip-archive';

/**
 * Turning a pile of files on somebody's device into one archive.
 *
 * The interesting part of this Gizlet is not the ZIP format — that is already
 * written, and Split PDF and PDF to Image have been using it for months. It is
 * what happens to the *names*: a browser hands over whatever the file system
 * had, a visitor may choose a whole folder, two folders may hold a file of the
 * same name, and a path with a `..` in it is a path that unpacks somewhere
 * nobody asked for.
 *
 * So every path is normalised and made unique here, in one place, as a pure
 * function over strings. Nothing about it needs a browser and all of it needs
 * to be right, which is the same argument the rest of `src/data` makes.
 */

/**
 * How many files one archive takes here.
 *
 * The format's own ceiling is 65,535 entries and this is far below it: the
 * limit that binds is a tab that has to hold every file in memory to write the
 * archive, not the container.
 */
export const maximumZipFiles = 500;

/**
 * How much those files may come to.
 *
 * The archive is assembled in memory before it is handed over, so this is a
 * limit on what one tab can be asked to hold at once rather than on what the
 * format can address.
 */
export const maximumZipInputBytes = 512 * 1024 * 1024;

/** Where the progress line starts being worth showing. */
export const largeZipJobFiles = 20;

export interface ZipCandidate {
  /** The path as the browser reported it, folders and all. */
  readonly path: string;
  readonly size: number;
}

/**
 * The path an entry is written under.
 *
 * Backslashes become slashes, because a path from a Windows file system is
 * still a path; a drive letter and a leading slash go, because an archive holds
 * relative paths; `.` and `..` segments go, because an entry that unpacks
 * outside the folder it was unpacked into is the oldest bug in archives; and
 * the characters a ZIP reader cannot be trusted with are replaced rather than
 * dropped, so two files never quietly become one name.
 */
export function normaliseZipPath(path: string): string {
  const segments = path
    .replace(/\\/g, '/')
    .replace(/^[A-Za-z]:/, '')
    .split('/')
    .map((segment) => segment.replace(/[\u0000-\u001f\u007f]/g, '_').trim())
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');

  return segments.join('/') || 'file';
}

/** The name a path ends in, which is what a list shows. */
export function getZipEntryName(path: string): string {
  const normalised = normaliseZipPath(path);

  return normalised.slice(normalised.lastIndexOf('/') + 1);
}

/** The folder a path sits in, or nothing when it sits at the top. */
export function getZipEntryFolder(path: string): string | undefined {
  const normalised = normaliseZipPath(path);
  const separator = normalised.lastIndexOf('/');

  return separator === -1 ? undefined : normalised.slice(0, separator);
}

/**
 * Every path, normalised and made unique, in the order it was given.
 *
 * Two files really can arrive as the same path — two folders holding a
 * `notes.txt`, the same file chosen twice — and a ZIP with one name twice is an
 * archive that silently loses a file when it is unpacked. The number goes
 * before the extension, so the names still sort the way the list reads.
 */
export function getUniqueZipPaths(paths: readonly string[]): readonly string[] {
  const used = new Map<string, number>();

  return paths.map((path) => {
    const normalised = normaliseZipPath(path);
    const seen = used.get(normalised) ?? 0;

    used.set(normalised, seen + 1);

    if (seen === 0) return normalised;

    const separator = normalised.lastIndexOf('/');
    const folder = separator === -1 ? '' : `${normalised.slice(0, separator)}/`;
    const name = normalised.slice(separator + 1);
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : '';

    return `${folder}${base}-${seen + 1}${extension}`;
  });
}

/** Moves an entry, which is how a visitor decides what an archive reads like. */
export function moveZipEntry<T>(
  entries: readonly T[],
  fromIndex: number,
  toIndex: number,
): readonly T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= entries.length ||
    toIndex >= entries.length
  ) {
    return entries;
  }

  const moved = [...entries];
  const [entry] = moved.splice(fromIndex, 1);

  moved.splice(toIndex, 0, entry);

  return moved;
}

export function validateZipSelection(candidates: readonly ZipCandidate[]): string | undefined {
  if (candidates.length === 0) return 'Choose the files you want in the archive.';

  if (candidates.length > maximumZipFiles) {
    return `One archive holds up to ${maximumZipFiles.toLocaleString()} files here, and that would be ${candidates.length.toLocaleString()}.`;
  }

  if (candidates.length > maximumZipEntries) {
    return `The ZIP format holds up to ${maximumZipEntries.toLocaleString()} files.`;
  }

  const total = candidates.reduce((bytes, candidate) => bytes + candidate.size, 0);

  if (total > maximumZipInputBytes) {
    return 'These files come to more than this Gizlet builds in one archive. Take some out and make a second one.';
  }

  if (total > maximumZipBytes) {
    return 'These files are too large for one ZIP. Make more than one archive.';
  }

  return undefined;
}

export function describeZipFileCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'file' : 'files'}`;
}

/** What the picker says it is holding, before anything is written. */
export function describeZipSelection(
  candidates: readonly ZipCandidate[],
  formatSize: (bytes: number) => string,
): string {
  if (candidates.length === 0) return 'Nothing chosen yet.';

  const total = candidates.reduce((bytes, candidate) => bytes + candidate.size, 0);
  const folders = new Set(
    candidates
      .map((candidate) => getZipEntryFolder(candidate.path))
      .filter((folder): folder is string => folder !== undefined),
  );
  const parts = [describeZipFileCount(candidates.length), formatSize(total)];

  if (folders.size > 0) {
    parts.push(`${folders.size.toLocaleString()} ${folders.size === 1 ? 'folder' : 'folders'} kept`);
  }

  return parts.join(' · ');
}

/** What the result panel says, which is about the archive rather than the files. */
export function describeZipResult(
  fileCount: number,
  inputBytes: number,
  archiveBytes: number,
  formatSize: (bytes: number) => string,
): string {
  const saved = inputBytes > 0 ? Math.round(((inputBytes - archiveBytes) / inputBytes) * 100) : 0;
  const change =
    saved > 0
      ? `${saved}% smaller than the files`
      : 'about the size of the files, which are already compressed';

  return `${describeZipFileCount(fileCount)} · ${formatSize(archiveBytes)} · ${change}`;
}

/** The progress line, for a job long enough to need one. */
export function describeZipProgress(position: number, total: number): string {
  return `Packing file ${position.toLocaleString()} of ${total.toLocaleString()} locally…`;
}

/**
 * The archive's own name.
 *
 * A folder gives it one; a pile of loose files does not, and naming it after
 * whichever file happened to be first is a guess dressed as a fact.
 */
export function getZipArchiveName(candidates: readonly ZipCandidate[]): string {
  const [first] = candidates;
  const folder = first ? getZipEntryFolder(first.path) : undefined;
  const root = folder?.split('/')[0];
  const shared =
    root !== undefined &&
    candidates.every((candidate) => getZipEntryFolder(candidate.path)?.split('/')[0] === root);

  return `${shared && root ? root : 'files'}.${zipExtension}`;
}

export function getZipWriteErrorMessage(): string {
  return 'The archive could not be built on this device. Nothing was changed, and your files are untouched.';
}
