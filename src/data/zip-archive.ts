/**
 * A ZIP archive, written by hand, so a Gizlet that makes a set of files can
 * hand the visitor one download instead of a row of links.
 *
 * The entries are stored rather than deflated. Everything a Gizlet puts in an
 * archive today is a JPEG, a PNG, or a WebP — already compressed — so deflate
 * would spend time to save nothing, and storing means the format needs no
 * compressor: a local header, the bytes, a central directory, and an end
 * record. That is small enough to keep here, dependency-free and testable,
 * rather than adding a library for it.
 *
 * Every entry carries the same fixed timestamp instead of the clock. An
 * archive built twice from the same files is then byte for byte the same, and
 * the file the visitor downloads says nothing about when or where it was made.
 */

export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

export const zipMimeType = 'application/zip';

/** The extension the archive is downloaded under. */
export const zipExtension = 'zip';

/**
 * 1 January 1980, the earliest moment a ZIP timestamp can express, in the
 * packed DOS form the format stores: no clock reading reaches the file.
 */
const dosTime = 0;
const dosDate = 0x0021;

/** Stored, not deflated. */
const storedMethod = 0;

/** PKZIP 2.0, which is what a stored entry needs. */
const zipVersion = 20;

/** Bit 11: the file name is UTF-8 rather than the format's legacy code page. */
const utf8NameFlag = 0x0800;

const localHeaderSignature = 0x04034b50;
const centralHeaderSignature = 0x02014b50;
const endOfDirectorySignature = 0x06054b50;

const localHeaderSize = 30;
const centralHeaderSize = 46;
const endOfDirectorySize = 22;

/**
 * The ceilings the classic format itself imposes. Passing either needs ZIP64,
 * which is a different container; a Gizlet says so rather than writing an
 * archive no tool can open.
 */
export const maximumZipEntries = 65_535;
export const maximumZipBytes = 0xffff_ffff;

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      // The reversed CRC-32 polynomial, which is the one ZIP uses.
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

/** The CRC-32 of some bytes, which every ZIP entry carries twice. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

interface PreparedEntry {
  readonly name: Uint8Array;
  readonly data: Uint8Array;
  readonly crc: number;
  readonly offset: number;
}

function prepare(entries: readonly ZipEntry[]): readonly PreparedEntry[] {
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  const prepared: PreparedEntry[] = [];
  let offset = 0;

  for (const entry of entries) {
    if (seen.has(entry.name)) {
      throw new Error(`An archive cannot hold two files called ${entry.name}.`);
    }

    seen.add(entry.name);
    const name = encoder.encode(entry.name);

    prepared.push({ name, data: entry.data, crc: crc32(entry.data), offset });
    offset += localHeaderSize + name.length + entry.data.length;
  }

  return prepared;
}

/**
 * Writes the entries as one archive.
 *
 * Names are taken as given: a Gizlet composes them from its own output, so
 * there is no path to sanitise and no directory to create.
 */
export function createZipArchive(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  if (entries.length > maximumZipEntries) {
    throw new Error(`One archive holds up to ${maximumZipEntries.toLocaleString()} files.`);
  }

  const prepared = prepare(entries);
  const directoryOffset = prepared.reduce(
    (total, entry) => total + localHeaderSize + entry.name.length + entry.data.length,
    0,
  );
  const directorySize = prepared.reduce(
    (total, entry) => total + centralHeaderSize + entry.name.length,
    0,
  );
  const totalSize = directoryOffset + directorySize + endOfDirectorySize;

  if (totalSize > maximumZipBytes) {
    throw new Error('These files are too large to put in one archive. Download them separately.');
  }

  const archive = new Uint8Array(totalSize);
  const view = new DataView(archive.buffer);
  let position = 0;

  for (const entry of prepared) {
    view.setUint32(position, localHeaderSignature, true);
    view.setUint16(position + 4, zipVersion, true);
    view.setUint16(position + 6, utf8NameFlag, true);
    view.setUint16(position + 8, storedMethod, true);
    view.setUint16(position + 10, dosTime, true);
    view.setUint16(position + 12, dosDate, true);
    view.setUint32(position + 14, entry.crc, true);
    // Stored, so the compressed and uncompressed sizes are the same number.
    view.setUint32(position + 18, entry.data.length, true);
    view.setUint32(position + 22, entry.data.length, true);
    view.setUint16(position + 26, entry.name.length, true);
    view.setUint16(position + 28, 0, true);
    position += localHeaderSize;

    archive.set(entry.name, position);
    position += entry.name.length;
    archive.set(entry.data, position);
    position += entry.data.length;
  }

  for (const entry of prepared) {
    view.setUint32(position, centralHeaderSignature, true);
    view.setUint16(position + 4, zipVersion, true);
    view.setUint16(position + 6, zipVersion, true);
    view.setUint16(position + 8, utf8NameFlag, true);
    view.setUint16(position + 10, storedMethod, true);
    view.setUint16(position + 12, dosTime, true);
    view.setUint16(position + 14, dosDate, true);
    view.setUint32(position + 16, entry.crc, true);
    view.setUint32(position + 20, entry.data.length, true);
    view.setUint32(position + 24, entry.data.length, true);
    view.setUint16(position + 28, entry.name.length, true);
    view.setUint16(position + 30, 0, true);
    view.setUint16(position + 32, 0, true);
    view.setUint16(position + 34, 0, true);
    view.setUint16(position + 36, 0, true);
    view.setUint32(position + 38, 0, true);
    view.setUint32(position + 42, entry.offset, true);
    position += centralHeaderSize;

    archive.set(entry.name, position);
    position += entry.name.length;
  }

  view.setUint32(position, endOfDirectorySignature, true);
  view.setUint16(position + 4, 0, true);
  view.setUint16(position + 6, 0, true);
  view.setUint16(position + 8, prepared.length, true);
  view.setUint16(position + 10, prepared.length, true);
  view.setUint32(position + 12, directorySize, true);
  view.setUint32(position + 16, directoryOffset, true);
  view.setUint16(position + 20, 0, true);

  return archive;
}
