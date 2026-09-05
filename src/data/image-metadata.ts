import type { ImageOutputFormat } from './image-compression';

/**
 * Reading what a picture says about the person who took it.
 *
 * This is a parser rather than a library call, and deliberately: the job is to
 * show a visitor the fields their file is carrying, and a dependency that reads
 * EXIF would be tens of kilobytes shipped to every visitor to read a few dozen
 * bytes. It is also the part of this Gizlet that has to be trustworthy, and a
 * pure function over a byte array is the part that can be tested exhaustively
 * without a browser.
 *
 * It reads the containers the three supported formats actually use — EXIF in
 * JPEG and WebP and PNG, XMP where it is announced, PNG's text chunks — and
 * names the fields that say something about a person. Everything else it finds
 * is counted rather than named, so the summary never implies the file carries
 * less than it does.
 */

/** What a field is about, which is what decides how alarming it is. */
export type MetadataGroup = 'location' | 'camera' | 'time' | 'authorship' | 'other';

export const metadataGroupLabels = {
  location: 'Where it was taken',
  camera: 'What took it',
  time: 'When it was taken',
  authorship: 'Who it belongs to',
  other: 'Everything else',
} as const satisfies Record<MetadataGroup, string>;

export const metadataGroupOrder = [
  'location',
  'time',
  'camera',
  'authorship',
  'other',
] as const satisfies readonly MetadataGroup[];

export interface MetadataField {
  readonly label: string;
  readonly value: string;
  readonly group: MetadataGroup;
}

export interface ImageMetadata {
  /** The fields this reader can name, in a stable order. */
  readonly fields: readonly MetadataField[];
  /**
   * Entries found and not named. They are still removed; counting them is what
   * keeps the summary from implying the file carries only what is listed.
   */
  readonly unnamedCount: number;
  /** The containers the metadata was found in, for the line that says so. */
  readonly containers: readonly string[];
}

export const emptyImageMetadata: ImageMetadata = {
  fields: [],
  unnamedCount: 0,
  containers: [],
};

const outputExtensions: Record<ImageOutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** The EXIF tags worth naming, with what to call them and what they are about. */
const exifTags: Record<number, { readonly label: string; readonly group: MetadataGroup }> = {
  0x010f: { label: 'Camera make', group: 'camera' },
  0x0110: { label: 'Camera model', group: 'camera' },
  0x0112: { label: 'Orientation', group: 'other' },
  0x0131: { label: 'Software', group: 'camera' },
  0x0132: { label: 'File changed', group: 'time' },
  0x013b: { label: 'Artist', group: 'authorship' },
  0x8298: { label: 'Copyright', group: 'authorship' },
  0x829a: { label: 'Exposure time', group: 'camera' },
  0x829d: { label: 'Aperture', group: 'camera' },
  0x8827: { label: 'ISO', group: 'camera' },
  0x9003: { label: 'Taken', group: 'time' },
  0x9004: { label: 'Digitised', group: 'time' },
  0x920a: { label: 'Focal length', group: 'camera' },
  0xa002: { label: 'Recorded width', group: 'other' },
  0xa003: { label: 'Recorded height', group: 'other' },
  0xa434: { label: 'Lens', group: 'camera' },
  0xa430: { label: 'Camera owner', group: 'authorship' },
  0xa431: { label: 'Camera serial number', group: 'camera' },
};

const gpsTags: Record<number, { readonly label: string; readonly group: MetadataGroup }> = {
  0x0006: { label: 'Altitude', group: 'location' },
  0x0012: { label: 'Map datum', group: 'location' },
  0x001d: { label: 'Date', group: 'location' },
};

/** Tags read to build a coordinate rather than shown one by one. */
const gpsCoordinateTags = new Set([0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0007]);

/** The pointers to the other directories, which are structure rather than data. */
const exifPointerTags = new Set([0x8769, 0x8825, 0xa005]);

/**
 * The directories walked as part of the main run. GPS is deliberately absent:
 * it is read once, on its own, because a coordinate is three tags and a
 * reference letter rather than four fields anybody wants listed.
 */
const walkedPointerTags = new Set([0x8769, 0xa005]);

type TiffValue = string | number | readonly number[];

interface TiffEntry {
  readonly tag: number;
  readonly value: TiffValue;
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  let value = '';

  for (let index = 0; index < length; index += 1) {
    const code = bytes[start + index];

    if (code === undefined || code === 0) break;
    value += String.fromCharCode(code);
  }

  return value.trim();
}

const typeSizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/**
 * One TIFF directory, which is what EXIF is made of wherever it is embedded.
 *
 * A malformed offset is treated as the end of the data rather than as an error:
 * this reads files that arrived from anywhere, and a picture with a damaged
 * directory should still show whatever the rest of it says.
 */
function readTiffDirectory(
  view: DataView,
  bytes: Uint8Array,
  tiffStart: number,
  directoryOffset: number,
  little: boolean,
): readonly TiffEntry[] {
  const start = tiffStart + directoryOffset;

  if (start + 2 > bytes.length) return [];

  const count = view.getUint16(start, little);
  const entries: TiffEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    const entry = start + 2 + index * 12;

    if (entry + 12 > bytes.length) break;

    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const length = view.getUint32(entry + 4, little);
    const size = typeSizes[type];

    if (!size) continue;

    const total = size * length;
    const valueStart = total <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, little);

    if (valueStart < 0 || valueStart + total > bytes.length) continue;

    if (type === 2) {
      entries.push({ tag, value: readAscii(bytes, valueStart, length) });
      continue;
    }

    const numbers: number[] = [];

    for (let item = 0; item < length && item < 16; item += 1) {
      const at = valueStart + item * size;

      if (type === 1 || type === 7) numbers.push(bytes[at]);
      if (type === 3) numbers.push(view.getUint16(at, little));
      if (type === 4) numbers.push(view.getUint32(at, little));
      if (type === 9) numbers.push(view.getInt32(at, little));
      if (type === 5 || type === 10) {
        const numerator = type === 5 ? view.getUint32(at, little) : view.getInt32(at, little);
        const denominator = type === 5 ? view.getUint32(at + 4, little) : view.getInt32(at + 4, little);

        numbers.push(denominator === 0 ? 0 : numerator / denominator);
      }
    }

    entries.push({ tag, value: numbers.length === 1 ? numbers[0] : numbers });
  }

  return entries;
}

function formatValue(value: TiffValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(Math.round(value * 1000) / 1000);

  return value.map((item) => Math.round(item * 1000) / 1000).join(', ');
}

/** Degrees, minutes and seconds as one number, which is how a map reads it. */
function toDecimalDegrees(value: TiffValue, reference: TiffValue | undefined): number | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;

  const [degrees, minutes, seconds] = value as readonly number[];
  const decimal = degrees + minutes / 60 + seconds / 3600;

  if (!Number.isFinite(decimal)) return undefined;

  const negative = typeof reference === 'string' && /^[sw]/i.test(reference);

  return negative ? -decimal : decimal;
}

/** The one field this Gizlet exists for, written the way a map link would take it. */
function readCoordinates(entries: readonly TiffEntry[]): MetadataField | undefined {
  const byTag = new Map(entries.map((entry) => [entry.tag, entry.value]));
  const latitude = toDecimalDegrees(byTag.get(0x0002) ?? [], byTag.get(0x0001));
  const longitude = toDecimalDegrees(byTag.get(0x0004) ?? [], byTag.get(0x0003));

  if (latitude === undefined || longitude === undefined) return undefined;

  return {
    label: 'Coordinates',
    value: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    group: 'location',
  };
}

interface Collected {
  readonly fields: MetadataField[];
  unnamed: number;
}

function collectExif(view: DataView, bytes: Uint8Array, tiffStart: number, collected: Collected): void {
  if (tiffStart + 8 > bytes.length) return;

  const order = view.getUint16(tiffStart, false);

  if (order !== 0x4949 && order !== 0x4d4d) return;

  const little = order === 0x4949;

  if (view.getUint16(tiffStart + 2, little) !== 42) return;

  const directories = [readTiffDirectory(view, bytes, tiffStart, view.getUint32(tiffStart + 4, little), little)];
  const first = directories[0];

  for (const entry of first) {
    if (walkedPointerTags.has(entry.tag) && typeof entry.value === 'number') {
      directories.push(readTiffDirectory(view, bytes, tiffStart, entry.value, little));
    }
  }

  // The GPS directory is read as a whole, because a coordinate is three tags and
  // a reference letter rather than a field anybody wants listed four times.
  const gpsPointer = first.find((entry) => entry.tag === 0x8825);
  const gps =
    gpsPointer && typeof gpsPointer.value === 'number'
      ? readTiffDirectory(view, bytes, tiffStart, gpsPointer.value, little)
      : [];
  const coordinates = readCoordinates(gps);

  if (coordinates) collected.fields.push(coordinates);

  for (const entry of gps) {
    if (gpsCoordinateTags.has(entry.tag)) {
      // Counted only when it did not become the coordinate above.
      if (!coordinates) collected.unnamed += 1;
      continue;
    }

    const known = gpsTags[entry.tag];
    const value = formatValue(entry.value);

    if (known && value !== '') {
      collected.fields.push({ label: known.label, value, group: known.group });
    } else {
      collected.unnamed += 1;
    }
  }

  for (const directory of directories) {
    for (const entry of directory) {
      if (exifPointerTags.has(entry.tag)) continue;

      const known = exifTags[entry.tag];
      const value = formatValue(entry.value);

      if (known && value !== '') {
        collected.fields.push({ label: known.label, value, group: known.group });
      } else {
        collected.unnamed += 1;
      }
    }
  }
}

function startsWith(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }

  return true;
}

function readJpeg(view: DataView, bytes: Uint8Array, collected: Collected): string[] {
  const containers: string[] = [];
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1];

    // The image data starts here, and nothing after it is metadata.
    if (marker === 0xda || marker === 0xd9) break;

    const length = view.getUint16(offset + 2, false);
    const data = offset + 4;

    if (length < 2 || data + length - 2 > bytes.length) break;

    if (marker === 0xe1 && startsWith(bytes, data, 'Exif\0\0')) {
      containers.push('EXIF');
      collectExif(view, bytes, data + 6, collected);
    }

    if (marker === 0xe1 && startsWith(bytes, data, 'http://ns.adobe.com/xap/1.0/')) {
      containers.push('XMP');
      collected.unnamed += 1;
    }

    if (marker === 0xed) {
      containers.push('Photoshop data');
      collected.unnamed += 1;
    }

    if (marker === 0xfe) {
      const comment = readAscii(bytes, data, length - 2);

      containers.push('Comment');

      if (comment !== '') {
        collected.fields.push({ label: 'Comment', value: comment, group: 'other' });
      } else {
        collected.unnamed += 1;
      }
    }

    offset = data + length - 2;
  }

  return containers;
}

function readPng(view: DataView, bytes: Uint8Array, collected: Collected): string[] {
  const containers: string[] = [];
  let offset = 8;

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = readAscii(bytes, offset + 4, 4);
    const data = offset + 8;

    if (data + length > bytes.length) break;
    if (type === 'IEND') break;

    if (type === 'eXIf') {
      containers.push('EXIF');
      collectExif(view, bytes, data, collected);
    }

    if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
      const keyword = readAscii(bytes, data, Math.min(length, 79));

      if (!containers.includes('PNG text')) containers.push('PNG text');

      if (type === 'tEXt') {
        const text = readAscii(bytes, data + keyword.length + 1, length - keyword.length - 1);

        collected.fields.push({ label: keyword || 'Text', value: text, group: 'other' });
      } else {
        // Compressed and structured text are announced rather than decoded: the
        // point is that they exist and are about to go.
        collected.fields.push({ label: keyword || 'Text', value: 'Text block', group: 'other' });
      }
    }

    if (type === 'tIME') {
      containers.push('PNG time');
      collected.fields.push({ label: 'File changed', value: 'Recorded in the file', group: 'time' });
    }

    offset = data + length + 4;
  }

  return containers;
}

function readWebp(view: DataView, bytes: Uint8Array, collected: Collected): string[] {
  const containers: string[] = [];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const type = readAscii(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const data = offset + 8;

    if (data + length > bytes.length) break;

    if (type === 'EXIF') {
      containers.push('EXIF');
      collectExif(view, bytes, data, collected);
    }

    if (type === 'XMP') {
      containers.push('XMP');
      collected.unnamed += 1;
    }

    // Chunks are padded to an even length, which is not part of the size.
    offset = data + length + (length % 2);
  }

  return containers;
}

/**
 * Everything a file says about itself, as far as this reader understands it.
 *
 * An unreadable or unsupported file reports nothing rather than throwing: the
 * honest answer to "what is in this file" for a format nobody here can parse is
 * that this Gizlet found nothing, and the page says exactly that.
 */
export function readImageMetadata(source: ArrayBuffer | Uint8Array): ImageMetadata {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);

  if (bytes.length < 12) return emptyImageMetadata;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const collected: Collected = { fields: [], unnamed: 0 };
  let containers: readonly string[] = [];

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    containers = readJpeg(view, bytes, collected);
  } else if (startsWith(bytes, 1, 'PNG')) {
    containers = readPng(view, bytes, collected);
  } else if (startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP')) {
    containers = readWebp(view, bytes, collected);
  }

  return {
    fields: collected.fields,
    unnamedCount: collected.unnamed,
    containers: [...new Set(containers)],
  };
}

/** Whether the file carries anything at all worth removing. */
export function hasRemovableMetadata(metadata: ImageMetadata): boolean {
  return metadata.fields.length > 0 || metadata.unnamedCount > 0;
}

/** Whether the file says where it was taken, which is the field that matters most. */
export function hasLocationMetadata(metadata: ImageMetadata): boolean {
  return metadata.fields.some((field) => field.group === 'location');
}

/** The fields of one group, in the order they were found. */
export function getMetadataGroup(
  metadata: ImageMetadata,
  group: MetadataGroup,
): readonly MetadataField[] {
  return metadata.fields.filter((field) => field.group === group);
}

/** The groups that actually have something in them, in a fixed order. */
export function getPopulatedMetadataGroups(
  metadata: ImageMetadata,
): readonly { readonly group: MetadataGroup; readonly label: string; readonly fields: readonly MetadataField[] }[] {
  return metadataGroupOrder
    .map((group) => ({
      group,
      label: metadataGroupLabels[group],
      fields: getMetadataGroup(metadata, group),
    }))
    .filter((entry) => entry.fields.length > 0);
}

/** What the file is carrying, in one line. */
export function describeMetadata(metadata: ImageMetadata): string {
  if (!hasRemovableMetadata(metadata)) return 'No metadata this Gizlet can read.';

  const named = metadata.fields.length;
  const parts = [
    named === 1 ? '1 field' : `${named} fields`,
    ...(metadata.unnamedCount > 0
      ? [`${metadata.unnamedCount} more this page does not name`]
      : []),
    ...(metadata.containers.length > 0 ? [metadata.containers.join(', ')] : []),
  ];

  return parts.join(' · ');
}

export function getCleanedImageFilename(inputName: string, format: ImageOutputFormat): string {
  const basename = inputName.replace(/\.[^.]+$/, '') || 'image';

  return `${basename}-clean.${outputExtensions[format]}`;
}
