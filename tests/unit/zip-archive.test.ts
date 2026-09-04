import { describe, expect, it } from 'vitest';

import {
  createZipArchive,
  crc32,
  maximumZipEntries,
  zipMimeType,
} from '../../src/data/zip-archive';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesOf = (value: string) => encoder.encode(value);

interface ReadEntry {
  readonly name: string;
  readonly crc: number;
  readonly storedSize: number;
  readonly data: string;
  readonly method: number;
  readonly flags: number;
}

/**
 * Reads an archive back the way an unpacker does: through the end record, then
 * the central directory, then each local header the directory points at. The
 * writer is only correct if a reader that trusts none of its own offsets can
 * still find every file.
 */
function readArchive(archive: Uint8Array): readonly ReadEntry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.length - 22;

  expect(view.getUint32(end, true)).toBe(0x06054b50);
  expect(view.getUint16(end + 8, true)).toBe(view.getUint16(end + 10, true));

  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);

  expect(directoryOffset + directorySize).toBe(end);

  const entries: ReadEntry[] = [];
  let position = directoryOffset;

  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(position, true)).toBe(0x02014b50);

    const crc = view.getUint32(position + 16, true);
    const storedSize = view.getUint32(position + 20, true);
    const nameLength = view.getUint16(position + 28, true);
    const localOffset = view.getUint32(position + 42, true);
    const name = decoder.decode(archive.subarray(position + 46, position + 46 + nameLength));

    expect(view.getUint32(position + 24, true)).toBe(storedSize);

    // The local header the directory points at has to agree with it.
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    expect(view.getUint32(localOffset + 14, true)).toBe(crc);
    expect(view.getUint16(localOffset + 26, true)).toBe(nameLength);
    expect(
      decoder.decode(archive.subarray(localOffset + 30, localOffset + 30 + nameLength)),
    ).toBe(name);

    const dataStart = localOffset + 30 + nameLength + view.getUint16(localOffset + 28, true);

    entries.push({
      name,
      crc,
      storedSize,
      method: view.getUint16(localOffset + 8, true),
      flags: view.getUint16(localOffset + 6, true),
      data: decoder.decode(archive.subarray(dataStart, dataStart + storedSize)),
    });

    position += 46 + nameLength;
  }

  return entries;
}

describe('crc32', () => {
  it('matches the published check values for the ZIP polynomial', () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(bytesOf('123456789'))).toBe(0xcbf43926);
    expect(crc32(bytesOf('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });

  it('is sensitive to order, not only to content', () => {
    expect(crc32(bytesOf('ab'))).not.toBe(crc32(bytesOf('ba')));
  });
});

describe('createZipArchive', () => {
  it('stores every file whole, findable through the central directory', () => {
    const archive = createZipArchive([
      { name: 'statement-page-1.jpg', data: bytesOf('first page') },
      { name: 'statement-page-2.jpg', data: bytesOf('second page, longer') },
    ]);

    expect(readArchive(archive)).toEqual([
      {
        name: 'statement-page-1.jpg',
        crc: crc32(bytesOf('first page')),
        storedSize: 10,
        data: 'first page',
        method: 0,
        flags: 0x0800,
      },
      {
        name: 'statement-page-2.jpg',
        crc: crc32(bytesOf('second page, longer')),
        storedSize: 19,
        data: 'second page, longer',
        method: 0,
        flags: 0x0800,
      },
    ]);
  });

  it('keeps a name that is not ASCII, which the UTF-8 flag is there to promise', () => {
    const archive = createZipArchive([{ name: 'reçu-page-1.jpg', data: bytesOf('x') }]);
    const [entry] = readArchive(archive);

    expect(entry.name).toBe('reçu-page-1.jpg');
    // The name is longer in bytes than in characters, so a length taken from
    // the string rather than the encoding would have truncated it.
    expect(entry.data).toBe('x');
  });

  it('writes the same bytes twice, because it reads no clock', () => {
    const entries = [{ name: 'page-1.png', data: bytesOf('same') }];

    expect(createZipArchive(entries)).toEqual(createZipArchive(entries));
  });

  it('holds an empty set as a valid archive rather than a broken one', () => {
    const archive = createZipArchive([]);

    expect(archive).toHaveLength(22);
    expect(readArchive(archive)).toEqual([]);
  });

  it('refuses two files under one name instead of writing one that shadows the other', () => {
    expect(() =>
      createZipArchive([
        { name: 'page-1.jpg', data: bytesOf('a') },
        { name: 'page-1.jpg', data: bytesOf('b') },
      ]),
    ).toThrow('two files called page-1.jpg');
  });

  it('refuses more entries than the format can index', () => {
    const entries = Array.from({ length: maximumZipEntries + 1 }, (_, index) => ({
      name: `page-${index}.jpg`,
      data: new Uint8Array(),
    }));

    expect(() => createZipArchive(entries)).toThrow(/holds up to/);
  });

  it('names the type a browser downloads it as', () => {
    expect(zipMimeType).toBe('application/zip');
  });
});
