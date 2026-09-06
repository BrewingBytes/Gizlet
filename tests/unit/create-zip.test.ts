import { describe, expect, it } from 'vitest';

import {
  describeZipFileCount,
  describeZipProgress,
  describeZipResult,
  describeZipSelection,
  getUniqueZipPaths,
  getZipArchiveName,
  getZipEntryFolder,
  getZipEntryName,
  getZipWriteErrorMessage,
  largeZipJobFiles,
  maximumZipFiles,
  moveZipEntry,
  normaliseZipPath,
  validateZipSelection,
} from '../../src/data/create-zip';
import { createZipArchive, crc32 } from '../../src/data/zip-archive';

const formatSize = (bytes: number) => `${bytes} B`;
const candidate = (path: string, size = 10) => ({ path, size });

describe('the path an entry is written under', () => {
  it('keeps a folder a browser reported', () => {
    expect(normaliseZipPath('holiday/beach.jpg')).toBe('holiday/beach.jpg');
    expect(getZipEntryFolder('holiday/2024/beach.jpg')).toBe('holiday/2024');
    expect(getZipEntryName('holiday/2024/beach.jpg')).toBe('beach.jpg');
    expect(getZipEntryFolder('beach.jpg')).toBeUndefined();
  });

  it('reads a Windows path as a path', () => {
    expect(normaliseZipPath('C:\\Users\\ada\\notes.txt')).toBe('Users/ada/notes.txt');
  });

  it('never writes an entry that unpacks outside the folder it was unpacked into', () => {
    expect(normaliseZipPath('../../etc/passwd')).toBe('etc/passwd');
    expect(normaliseZipPath('/absolute/path.txt')).toBe('absolute/path.txt');
    expect(normaliseZipPath('holiday/../../../secrets.txt')).toBe('holiday/secrets.txt');
    expect(normaliseZipPath('./notes.txt')).toBe('notes.txt');
  });

  it('replaces what a reader cannot be trusted with rather than dropping it', () => {
    expect(normaliseZipPath('note\u0000one.txt')).toBe('note_one.txt');
    expect(normaliseZipPath('  spaced.txt  ')).toBe('spaced.txt');
  });

  it('always has a name to write, whatever it was given', () => {
    expect(normaliseZipPath('')).toBe('file');
    expect(normaliseZipPath('../..')).toBe('file');
    expect(normaliseZipPath('///')).toBe('file');
  });
});

describe('two files with one name', () => {
  it('keeps both, deterministically, in the order they were given', () => {
    expect(getUniqueZipPaths(['notes.txt', 'notes.txt', 'other.txt', 'notes.txt'])).toEqual([
      'notes.txt',
      'notes-2.txt',
      'other.txt',
      'notes-3.txt',
    ]);
  });

  it('numbers inside the folder rather than after it', () => {
    expect(getUniqueZipPaths(['a/notes.txt', 'a/notes.txt'])).toEqual([
      'a/notes.txt',
      'a/notes-2.txt',
    ]);
    // Two folders holding the same name are two different paths already.
    expect(getUniqueZipPaths(['a/notes.txt', 'b/notes.txt'])).toEqual([
      'a/notes.txt',
      'b/notes.txt',
    ]);
  });

  it('handles a name with no extension', () => {
    expect(getUniqueZipPaths(['README', 'README'])).toEqual(['README', 'README-2']);
  });

  it('resolves a collision the normalisation itself created', () => {
    // Two different paths that normalise to the same one are still two files.
    expect(getUniqueZipPaths(['../notes.txt', 'notes.txt'])).toEqual(['notes.txt', 'notes-2.txt']);
  });

  it('never hands the writer a name twice, which it refuses outright', () => {
    const paths = getUniqueZipPaths(['a.txt', 'a.txt', 'a.txt']);

    expect(() =>
      createZipArchive(paths.map((name) => ({ name, data: new Uint8Array([1]) }))),
    ).not.toThrow();
  });
});

describe('the order of the archive', () => {
  const entries = ['a', 'b', 'c', 'd'];

  it('moves an entry to where it was dropped', () => {
    expect(moveZipEntry(entries, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveZipEntry(entries, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('leaves the list alone when the move is not one', () => {
    expect(moveZipEntry(entries, 1, 1)).toBe(entries);
    expect(moveZipEntry(entries, -1, 2)).toBe(entries);
    expect(moveZipEntry(entries, 0, 9)).toBe(entries);
  });
});

describe('what it will take on, and what it says', () => {
  it('asks for something to archive', () => {
    expect(validateZipSelection([])).toMatch(/Choose the files/);
    expect(validateZipSelection([candidate('a.txt')])).toBeUndefined();
  });

  it('holds the job to what one tab can build', () => {
    const many = Array.from({ length: maximumZipFiles + 1 }, (_, index) => candidate(`${index}.txt`));

    expect(validateZipSelection(many)).toMatch(new RegExp(maximumZipFiles.toLocaleString()));
    expect(validateZipSelection([candidate('huge.bin', 600 * 1024 * 1024)])).toMatch(
      /more than this Gizlet builds in one archive/,
    );
    expect(largeZipJobFiles).toBeLessThan(maximumZipFiles);
  });

  it('describes what is chosen, folders included', () => {
    expect(describeZipSelection([], formatSize)).toBe('Nothing chosen yet.');
    expect(describeZipSelection([candidate('a.txt', 5), candidate('b.txt', 5)], formatSize)).toBe(
      '2 files · 10 B',
    );
    expect(
      describeZipSelection([candidate('holiday/a.jpg', 5), candidate('holiday/b.jpg', 5)], formatSize),
    ).toBe('2 files · 10 B · 1 folder kept');
    expect(describeZipFileCount(1)).toBe('1 file');
  });

  it('describes the archive rather than the files', () => {
    expect(describeZipResult(3, 1000, 400, formatSize)).toBe('3 files · 400 B · 60% smaller than the files');
    expect(describeZipResult(1, 1000, 1020, formatSize)).toMatch(/already compressed/);
    expect(describeZipProgress(2, 9)).toBe('Packing file 2 of 9 locally…');
    expect(getZipWriteErrorMessage()).toMatch(/files are untouched/);
  });

  it('names the archive after a folder, and only when there is one', () => {
    expect(getZipArchiveName([candidate('holiday/a.jpg'), candidate('holiday/2024/b.jpg')])).toBe(
      'holiday.zip',
    );
    expect(getZipArchiveName([candidate('holiday/a.jpg'), candidate('work/b.jpg')])).toBe('files.zip');
    expect(getZipArchiveName([candidate('a.jpg'), candidate('b.jpg')])).toBe('files.zip');
    expect(getZipArchiveName([])).toBe('files.zip');
  });
});

describe('the archive the writer produces', () => {
  const text = new TextEncoder().encode('hello '.repeat(200));

  it('writes a deflated entry the way a reader expects to find one', () => {
    // A stand-in for a compressor: the container has to record the payload it
    // was given, the original size, and the CRC of the original.
    const deflated = new Uint8Array(20);
    const archive = createZipArchive([{ name: 'a.txt', data: text, deflated }]);
    const view = new DataView(archive.buffer);

    expect(view.getUint16(8, true)).toBe(8);
    expect(view.getUint32(14, true)).toBe(crc32(text));
    expect(view.getUint32(18, true)).toBe(deflated.length);
    expect(view.getUint32(22, true)).toBe(text.length);
  });

  it('stores an entry its compressor made larger', () => {
    const archive = createZipArchive([
      { name: 'a.txt', data: text, deflated: new Uint8Array(text.length + 10) },
    ]);
    const view = new DataView(archive.buffer);

    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint32(18, true)).toBe(text.length);
    expect(view.getUint32(22, true)).toBe(text.length);
  });

  it('stores an entry nobody compressed, as it always did', () => {
    const archive = createZipArchive([{ name: 'a.txt', data: text }]);
    const view = new DataView(archive.buffer);

    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint32(18, true)).toBe(text.length);
  });
});
