import { describe, expect, it } from 'vitest';

import {
  describeMetadata,
  emptyImageMetadata,
  getCleanedImageFilename,
  getMetadataGroup,
  getPopulatedMetadataGroups,
  hasLocationMetadata,
  hasRemovableMetadata,
  metadataGroupLabels,
  metadataGroupOrder,
  readImageMetadata,
} from '../../src/data/image-metadata';

/**
 * A TIFF block, built the way a camera writes one.
 *
 * The files here are assembled rather than committed as fixtures: a reader of
 * this test can see exactly which bytes produce which field, which is the whole
 * argument for parsing EXIF by hand instead of trusting a library to.
 */
interface TiffEntryInput {
  readonly tag: number;
  readonly type: number;
  readonly values: readonly number[] | string;
}

function buildTiff(
  directories: {
    readonly main: readonly TiffEntryInput[];
    readonly exif?: readonly TiffEntryInput[];
    readonly gps?: readonly TiffEntryInput[];
  },
): Uint8Array {
  const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const overflow: number[] = [];
  const header = [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08];

  const entryCount = (entries: readonly TiffEntryInput[]) => 2 + entries.length * 12 + 4;
  const mainSize = entryCount([
    ...directories.main,
    ...(directories.exif ? [{ tag: 0, type: 4, values: [0] }] : []),
    ...(directories.gps ? [{ tag: 0, type: 4, values: [0] }] : []),
  ]);
  const exifOffset = 8 + mainSize;
  const gpsOffset = exifOffset + (directories.exif ? entryCount(directories.exif) : 0);
  const overflowStart = gpsOffset + (directories.gps ? entryCount(directories.gps) : 0);

  function encodeEntries(entries: readonly TiffEntryInput[]): number[] {
    const bytes: number[] = [(entries.length >> 8) & 0xff, entries.length & 0xff];

    for (const entry of entries) {
      const count = typeof entry.values === 'string' ? entry.values.length + 1 : entry.values.length;
      const payload: number[] = [];

      if (typeof entry.values === 'string') {
        for (const character of entry.values) payload.push(character.charCodeAt(0));
        payload.push(0);
      } else {
        for (const value of entry.values) {
          if (entry.type === 3) payload.push((value >> 8) & 0xff, value & 0xff);
          if (entry.type === 4) payload.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
          if (entry.type === 5) {
            // Written as a fraction over 1000, which is how a camera stores one.
            const numerator = Math.round(value * 1000);
            payload.push(
              (numerator >>> 24) & 0xff, (numerator >>> 16) & 0xff, (numerator >>> 8) & 0xff, numerator & 0xff,
              0, 0, 0x03, 0xe8,
            );
          }
        }
      }

      const total = sizes[entry.type] * count;

      bytes.push((entry.tag >> 8) & 0xff, entry.tag & 0xff, (entry.type >> 8) & 0xff, entry.type & 0xff);
      bytes.push((count >>> 24) & 0xff, (count >>> 16) & 0xff, (count >>> 8) & 0xff, count & 0xff);

      if (total <= 4) {
        const padded = [...payload, 0, 0, 0, 0].slice(0, 4);

        bytes.push(...padded);
      } else {
        const at = overflowStart + overflow.length;

        bytes.push((at >>> 24) & 0xff, (at >>> 16) & 0xff, (at >>> 8) & 0xff, at & 0xff);
        overflow.push(...payload);
      }
    }

    bytes.push(0, 0, 0, 0);

    return bytes;
  }

  const main = encodeEntries([
    ...directories.main,
    ...(directories.exif ? [{ tag: 0x8769, type: 4, values: [exifOffset] }] : []),
    ...(directories.gps ? [{ tag: 0x8825, type: 4, values: [gpsOffset] }] : []),
  ]);
  const exif = directories.exif ? encodeEntries(directories.exif) : [];
  const gps = directories.gps ? encodeEntries(directories.gps) : [];

  return new Uint8Array([...header, ...main, ...exif, ...gps, ...overflow]);
}

/** A JPEG carrying one APP1 EXIF segment and nothing else. */
function buildJpeg(tiff: Uint8Array, extra: readonly number[] = []): Uint8Array {
  const prefix = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const length = prefix.length + tiff.length + 2;

  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...prefix, ...tiff,
    ...extra,
    0xff, 0xda, 0x00, 0x02,
  ]);
}

function buildPng(chunks: readonly { readonly type: string; readonly data: readonly number[] }[]): Uint8Array {
  const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  for (const chunk of chunks) {
    const length = chunk.data.length;

    bytes.push((length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff);
    for (const character of chunk.type) bytes.push(character.charCodeAt(0));
    bytes.push(...chunk.data, 0, 0, 0, 0);
  }

  bytes.push(0, 0, 0, 0, ...'IEND'.split('').map((character) => character.charCodeAt(0)), 0, 0, 0, 0);

  return new Uint8Array(bytes);
}

function textChunk(keyword: string, text: string): { readonly type: string; readonly data: readonly number[] } {
  return {
    type: 'tEXt',
    data: [
      ...keyword.split('').map((character) => character.charCodeAt(0)),
      0,
      ...text.split('').map((character) => character.charCodeAt(0)),
    ],
  };
}

const cameraTiff = buildTiff({
  main: [
    { tag: 0x010f, type: 2, values: 'Kamera' },
    { tag: 0x0110, type: 2, values: 'K-1000' },
    { tag: 0x0112, type: 3, values: [6] },
  ],
  exif: [
    { tag: 0x9003, type: 2, values: '2026:08:01 09:15:00' },
    { tag: 0x8827, type: 3, values: [400] },
    { tag: 0xa434, type: 2, values: '35mm' },
  ],
  gps: [
    { tag: 0x0001, type: 2, values: 'N' },
    { tag: 0x0002, type: 5, values: [51, 30, 26.4] },
    { tag: 0x0003, type: 2, values: 'W' },
    { tag: 0x0004, type: 5, values: [0, 7, 39.9] },
  ],
});

describe('reading a JPEG', () => {
  const metadata = readImageMetadata(buildJpeg(cameraTiff));

  it('finds where the photograph was taken, as one coordinate', () => {
    expect(hasLocationMetadata(metadata)).toBe(true);
    expect(getMetadataGroup(metadata, 'location')).toEqual([
      { label: 'Coordinates', value: '51.50733, -0.12775', group: 'location' },
    ]);
  });

  it('finds what took it and when', () => {
    const values = Object.fromEntries(metadata.fields.map((field) => [field.label, field.value]));

    expect(values['Camera make']).toBe('Kamera');
    expect(values['Camera model']).toBe('K-1000');
    expect(values.Lens).toBe('35mm');
    expect(values.ISO).toBe('400');
    expect(values.Taken).toBe('2026:08:01 09:15:00');
    expect(values.Orientation).toBe('6');
  });

  it('says which container it came out of', () => {
    expect(metadata.containers).toEqual(['EXIF']);
    expect(hasRemovableMetadata(metadata)).toBe(true);
  });

  it('folds the four GPS tags into one coordinate rather than listing them', () => {
    // Latitude, longitude and their two reference letters are one fact about a
    // person, so they are read together and nothing is left over to count.
    expect(metadata.fields.filter((field) => field.group === 'location')).toHaveLength(1);
    expect(metadata.unnamedCount).toBe(0);
  });

  it('reads a comment segment as a field', () => {
    const comment = 'Do not share';
    const withComment = readImageMetadata(
      buildJpeg(cameraTiff, [
        0xff, 0xfe, 0x00, comment.length + 2,
        ...comment.split('').map((character) => character.charCodeAt(0)),
      ]),
    );

    expect(withComment.fields).toContainEqual({
      label: 'Comment',
      value: comment,
      group: 'other',
    });
    expect(withComment.containers).toContain('Comment');
  });

  it('notices XMP without pretending to read it', () => {
    const marker = 'http://ns.adobe.com/xap/1.0/\0';
    const xmp = readImageMetadata(
      buildJpeg(cameraTiff, [
        0xff, 0xe1, 0x00, marker.length + 2,
        ...marker.split('').map((character) => character.charCodeAt(0)),
      ]),
    );

    expect(xmp.containers).toContain('XMP');
    expect(xmp.unnamedCount).toBeGreaterThan(metadata.unnamedCount);
  });
});

describe('reading a PNG', () => {
  it('reads text chunks and the time the file records', () => {
    const png = readImageMetadata(
      buildPng([
        textChunk('Author', 'Someone'),
        textChunk('Software', 'A camera app'),
        { type: 'tIME', data: [0x07, 0xea, 1, 1, 0, 0, 0] },
      ]),
    );

    expect(png.containers).toEqual(['PNG text', 'PNG time']);
    expect(png.fields).toContainEqual({ label: 'Author', value: 'Someone', group: 'other' });
    expect(png.fields).toContainEqual({ label: 'Software', value: 'A camera app', group: 'other' });
    expect(png.fields.some((field) => field.group === 'time')).toBe(true);
  });

  it('reads EXIF from the chunk PNG carries it in', () => {
    const png = readImageMetadata(
      buildPng([{ type: 'eXIf', data: [...cameraTiff] }]),
    );

    expect(png.containers).toEqual(['EXIF']);
    expect(hasLocationMetadata(png)).toBe(true);
  });
});

describe('reading a WebP', () => {
  it('reads EXIF out of the RIFF chunk it lives in', () => {
    const size = cameraTiff.length;
    const webp = readImageMetadata(
      new Uint8Array([
        ...'RIFF'.split('').map((character) => character.charCodeAt(0)),
        0, 0, 0, 0,
        ...'WEBP'.split('').map((character) => character.charCodeAt(0)),
        ...'EXIF'.split('').map((character) => character.charCodeAt(0)),
        size & 0xff, (size >>> 8) & 0xff, (size >>> 16) & 0xff, (size >>> 24) & 0xff,
        ...cameraTiff,
      ]),
    );

    expect(webp.containers).toEqual(['EXIF']);
    expect(hasLocationMetadata(webp)).toBe(true);
  });
});

describe('a file with nothing to remove', () => {
  it('says so rather than failing', () => {
    const bare = readImageMetadata(buildJpeg(buildTiff({ main: [] })));

    expect(bare.fields).toEqual([]);
    expect(bare.unnamedCount).toBe(0);
    expect(hasRemovableMetadata(bare)).toBe(false);
    expect(describeMetadata(bare)).toBe('No metadata this Gizlet can read.');
  });

  it('reads nothing out of a file it does not understand, rather than throwing', () => {
    expect(readImageMetadata(new Uint8Array([1, 2, 3]))).toEqual(emptyImageMetadata);
    expect(readImageMetadata(new Uint8Array(64))).toEqual(emptyImageMetadata);
    expect(() => readImageMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).not.toThrow();
  });

  it('survives a directory that points outside the file', () => {
    const broken = buildJpeg(new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0xff, 0xff, 0xff, 0xff]));

    expect(() => readImageMetadata(broken)).not.toThrow();
    expect(readImageMetadata(broken).fields).toEqual([]);
  });
});

describe('what the page is told to show', () => {
  const metadata = readImageMetadata(buildJpeg(cameraTiff));

  it('groups the fields, most alarming first, and drops the empty groups', () => {
    const groups = getPopulatedMetadataGroups(metadata);

    expect(groups[0].group).toBe('location');
    expect(groups[0].label).toBe(metadataGroupLabels.location);
    expect(groups.map((entry) => entry.group)).toEqual(
      metadataGroupOrder.filter((group) => getMetadataGroup(metadata, group).length > 0),
    );
    expect(groups.every((entry) => entry.fields.length > 0)).toBe(true);
  });

  it('counts what it found in one line, including what it cannot name', () => {
    expect(describeMetadata(metadata)).toBe('7 fields · EXIF');

    const withXmp = readImageMetadata(
      buildJpeg(cameraTiff, [
        0xff, 0xe1, 0x00, 'http://ns.adobe.com/xap/1.0/\0'.length + 2,
        ...'http://ns.adobe.com/xap/1.0/\0'.split('').map((character) => character.charCodeAt(0)),
      ]),
    );

    expect(describeMetadata(withXmp)).toBe('7 fields · 1 more this page does not name · EXIF, XMP');
  });

  it('names the cleaned file for what it is', () => {
    expect(getCleanedImageFilename('holiday.jpg', 'image/jpeg')).toBe('holiday-clean.jpg');
    expect(getCleanedImageFilename('a.b.png', 'image/webp')).toBe('a.b-clean.webp');
    expect(getCleanedImageFilename('', 'image/png')).toBe('image-clean.png');
  });
});
