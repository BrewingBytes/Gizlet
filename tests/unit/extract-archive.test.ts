import { deflateRawSync, inflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  ArchiveReadError,
  buildArchiveTree,
  describeArchive,
  describeArchiveFormat,
  describeArchiveSelection,
  describeEntry,
  describeExtractionProgress,
  detectArchiveFormat,
  getArchiveBlockedMessage,
  getArchiveFiles,
  getArchiveFormatMessage,
  getArchiveReadErrorMessage,
  getEntryBlocker,
  getExtractionErrorMessage,
  getExtractionName,
  getExtractionPaths,
  getFileIndexesUnder,
  getFolderSelectionState,
  hasExtractableEntry,
  isSingleFileExtraction,
  isUnsafeArchivePath,
  maximumArchiveBytes,
  maximumArchiveEntries,
  readArchiveEntries,
  readEntryPayload,
  storedMethod,
  validateArchiveFile,
  verifyEntry,
  type ArchiveEntry,
} from '../../src/data/extract-archive';
import { createZipArchive, crc32 } from '../../src/data/zip-archive';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const formatSize = (bytes: number) => `${bytes} B`;

/** An archive of stored entries, which is what the writing half produces. */
const archiveOf = (files: readonly { readonly name: string; readonly body: string }[]) =>
  createZipArchive(files.map((file) => ({ name: file.name, data: encoder.encode(file.body) })));

const entryOf = (entry: Partial<ArchiveEntry> = {}): ArchiveEntry => ({
  storedPath: 'notes.txt',
  path: 'notes.txt',
  renamed: false,
  isDirectory: false,
  method: storedMethod,
  compressedSize: 10,
  size: 10,
  crc: 0,
  encrypted: false,
  headerOffset: 0,
  ...entry,
});

describe('what a file actually is', () => {
  it('reads the signature rather than the name', () => {
    expect(detectArchiveFormat(archiveOf([{ name: 'a.txt', body: 'a' }]))).toBe('zip');
    expect(detectArchiveFormat(new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0]))).toBe('zip');
    expect(detectArchiveFormat(new Uint8Array([0x50, 0x4b, 0x07, 0x08, 0, 0]))).toBe('zip');
    expect(detectArchiveFormat(new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]))).toBe('rar');
    expect(detectArchiveFormat(new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))).toBe('seven-zip');
    expect(detectArchiveFormat(new Uint8Array([0x1f, 0x8b, 0x08]))).toBe('gzip');
    expect(detectArchiveFormat(encoder.encode('hello, this is prose'))).toBe('unknown');
  });

  it('calls an empty file unknown rather than guessing at it', () => {
    expect(detectArchiveFormat(new Uint8Array())).toBe('unknown');
    expect(detectArchiveFormat(new Uint8Array([0x50]))).toBe('unknown');
  });

  it('names every format it recognises', () => {
    expect(describeArchiveFormat('zip')).toBe('ZIP');
    expect(describeArchiveFormat('rar')).toBe('RAR');
    expect(describeArchiveFormat('seven-zip')).toBe('7-Zip');
    expect(describeArchiveFormat('gzip')).toBe('gzip');
    expect(describeArchiveFormat('unknown')).toBe('an unrecognised format');
  });

  it('says what to do about a format it cannot read, and nothing about the one it can', () => {
    expect(getArchiveFormatMessage('zip')).toBeUndefined();
    expect(getArchiveFormatMessage('rar')).toContain('RAR');
    expect(getArchiveFormatMessage('rar')).toContain('ZIP archives only');
    expect(getArchiveFormatMessage('seven-zip')).toContain('7z');
    expect(getArchiveFormatMessage('gzip')).toContain('one compressed stream');
    expect(getArchiveFormatMessage('unknown')).toContain('does not begin like an archive');
  });
});

describe('the file a visitor chose', () => {
  it('refuses an empty file and an oversized one, and accepts an ordinary one', () => {
    expect(validateArchiveFile({ size: 0 })).toContain('empty');
    expect(validateArchiveFile({ size: maximumArchiveBytes + 1 })).toContain('larger than');
    expect(validateArchiveFile({ size: maximumArchiveBytes })).toBeUndefined();
    expect(validateArchiveFile({ size: 4_096 })).toBeUndefined();
  });
});

describe('reading what an archive lists', () => {
  it('reads back every entry the writing half wrote', () => {
    const archive = archiveOf([
      { name: 'notes.txt', body: 'first' },
      { name: 'holiday/beach.txt', body: 'second' },
    ]);
    const entries = readArchiveEntries(archive);

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.path)).toEqual(['notes.txt', 'holiday/beach.txt']);
    expect(entries[0].size).toBe(5);
    expect(entries[1].size).toBe(6);
    expect(entries.every((entry) => entry.method === storedMethod)).toBe(true);
    expect(entries.every((entry) => !entry.encrypted)).toBe(true);
  });

  it('finds the index behind an archive comment', () => {
    const archive = archiveOf([{ name: 'notes.txt', body: 'first' }]);
    const comment = encoder.encode('a comment nobody reads');
    const commented = new Uint8Array(archive.length + comment.length);

    commented.set(archive);
    commented.set(comment, archive.length);
    // The end record's comment length is the last field of the record.
    new DataView(commented.buffer).setUint16(archive.length - 2, comment.length, true);

    expect(readArchiveEntries(commented).map((entry) => entry.path)).toEqual(['notes.txt']);
  });

  it('reads a name written in UTF-8', () => {
    const entries = readArchiveEntries(archiveOf([{ name: 'sommerferie/blåbær.txt', body: 'x' }]));

    expect(entries[0].path).toBe('sommerferie/blåbær.txt');
  });

  it('marks a folder entry as one', () => {
    const entries = readArchiveEntries(archiveOf([{ name: 'holiday/', body: '' }]));

    expect(entries[0].isDirectory).toBe(true);
    expect(getArchiveFiles(entries)).toHaveLength(0);
  });

  it('refuses a file that does not end like an archive', () => {
    expect(() => readArchiveEntries(encoder.encode('this is prose, not an archive at all'))).toThrow(
      ArchiveReadError,
    );
    expect(() => readArchiveEntries(new Uint8Array(4))).toThrow(/too small/);
  });

  it('refuses an archive whose index has been cut short', () => {
    const archive = archiveOf([{ name: 'notes.txt', body: 'first' }]);
    const truncated = archive.slice();

    // Point the end record at an offset where no central header can be read.
    new DataView(truncated.buffer).setUint32(truncated.length - 6, truncated.length - 4, true);

    expect(() => readArchiveEntries(truncated)).toThrow(ArchiveReadError);
  });

  it('refuses an archive listing more files than it opens at once', () => {
    const archive = archiveOf([{ name: 'notes.txt', body: 'first' }]);
    const many = archive.slice();

    new DataView(many.buffer).setUint16(many.length - 12, maximumArchiveEntries + 1, true);

    expect(() => readArchiveEntries(many)).toThrow(
      new RegExp(maximumArchiveEntries.toLocaleString().replace(/[.,]/g, '\\$&')),
    );
  });
});

describe('a path that would unpack somewhere nobody asked for', () => {
  it('recognises the shapes that escape a folder', () => {
    expect(isUnsafeArchivePath('../../etc/passwd')).toBe(true);
    expect(isUnsafeArchivePath('/etc/passwd')).toBe(true);
    expect(isUnsafeArchivePath('C:\\Windows\\system32\\evil.dll')).toBe(true);
    expect(isUnsafeArchivePath('holiday/../../secrets.txt')).toBe(true);
    expect(isUnsafeArchivePath('holiday/beach.jpg')).toBe(false);
    expect(isUnsafeArchivePath('a..b/notes.txt')).toBe(false);
  });

  it('corrects the path it is written under, and says it had to', () => {
    const entries = readArchiveEntries(
      archiveOf([
        { name: '../../etc/passwd', body: 'root:x' },
        { name: 'holiday/beach.txt', body: 'sand' },
      ]),
    );

    expect(entries[0].path).toBe('etc/passwd');
    expect(entries[0].storedPath).toBe('../../etc/passwd');
    expect(entries[0].renamed).toBe(true);
    expect(entries[1].renamed).toBe(false);
  });

  it('never lets a corrected path collide silently with another one', () => {
    const files = getArchiveFiles(
      readArchiveEntries(
        archiveOf([
          { name: 'notes.txt', body: 'first' },
          { name: '../notes.txt', body: 'second' },
        ]),
      ),
    );

    expect(getExtractionPaths(files, [0, 1])).toEqual(['notes.txt', 'notes-2.txt']);
  });
});

describe('what can and cannot come out', () => {
  it('lets a stored and a deflated entry through', () => {
    expect(getEntryBlocker(entryOf({ method: 0 }))).toBeUndefined();
    expect(getEntryBlocker(entryOf({ method: 8 }))).toBeUndefined();
  });

  it('stops an encrypted entry without asking for a password', () => {
    expect(getEntryBlocker(entryOf({ encrypted: true }))).toBe('Encrypted');
  });

  it('names the method it cannot read rather than failing vaguely', () => {
    expect(getEntryBlocker(entryOf({ method: 14 }))).toBe('Compressed with method 14');
    expect(getEntryBlocker(entryOf({ method: 93 }))).toBe('Compressed with method 93');
  });

  it('refuses an entry that unpacks to an implausible size', () => {
    expect(getEntryBlocker(entryOf({ compressedSize: 1_024, size: 900 * 1024 * 1024 }))).toContain(
      'Too large',
    );
    expect(getEntryBlocker(entryOf({ compressedSize: 100, size: 40 * 1024 * 1024 }))).toBe(
      'Refused: unpacks to an implausible size',
    );
  });

  it('leaves a small file that compressed well alone', () => {
    expect(getEntryBlocker(entryOf({ compressedSize: 20, size: 60 * 1024 }))).toBeUndefined();
  });

  it('says when an archive holds nothing it can take out', () => {
    const encrypted = [entryOf({ encrypted: true }), entryOf({ path: 'b.txt', encrypted: true })];

    expect(hasExtractableEntry(encrypted)).toBe(false);
    expect(getArchiveBlockedMessage(encrypted)).toContain('encrypted');
    expect(getArchiveBlockedMessage([entryOf({ method: 14 })])).toContain('compression method');
    expect(getArchiveBlockedMessage([entryOf({ isDirectory: true })])).toContain('no files');
    expect(getArchiveBlockedMessage([entryOf()])).toBeUndefined();
  });
});

describe('the archive as a tree', () => {
  const files = getArchiveFiles(
    readArchiveEntries(
      archiveOf([
        { name: 'readme.txt', body: 'read me' },
        { name: 'holiday/beach.txt', body: 'sand' },
        { name: 'holiday/2024/pier.txt', body: 'wood' },
        { name: 'admin/notes.txt', body: 'note' },
      ]),
    ),
  );
  const tree = buildArchiveTree(files);

  it('draws folders from the paths, in the order a file manager reads', () => {
    expect(tree.map((node) => `${'  '.repeat(node.depth)}${node.name}`)).toEqual([
      'admin',
      '  notes.txt',
      'holiday',
      '  2024',
      '    pier.txt',
      '  beach.txt',
      'readme.txt',
    ]);
    expect(tree.map((node) => node.kind)).toEqual([
      'folder',
      'file',
      'folder',
      'folder',
      'file',
      'file',
      'file',
    ]);
  });

  it('counts what sits under a folder at any depth', () => {
    const holiday = tree.find((node) => node.path === 'holiday');

    expect(holiday?.fileCount).toBe(2);
    expect(holiday?.size).toBe(8);
    expect(tree.find((node) => node.path === 'holiday/2024')?.fileCount).toBe(1);
  });

  it('points every file row at its entry', () => {
    const beach = tree.find((node) => node.path === 'holiday/beach.txt');

    expect(beach?.fileIndex).toBe(1);
    expect(files[beach?.fileIndex as number].path).toBe('holiday/beach.txt');
  });

  it('knows which files a folder tick acts on', () => {
    expect([...getFileIndexesUnder(tree, 'holiday')].sort()).toEqual([1, 2]);
    expect(getFileIndexesUnder(tree, 'holiday/2024')).toEqual([2]);
    expect(getFileIndexesUnder(tree, 'admin')).toEqual([3]);
  });

  it('reads a folder tick as on, off, or somewhere between', () => {
    expect(getFolderSelectionState([1, 2], new Set())).toBe('none');
    expect(getFolderSelectionState([1, 2], new Set([1]))).toBe('some');
    expect(getFolderSelectionState([1, 2], new Set([1, 2]))).toBe('all');
    expect(getFolderSelectionState([], new Set())).toBe('none');
  });

  it('holds a file at the top of an archive at depth zero', () => {
    expect(tree.find((node) => node.path === 'readme.txt')?.depth).toBe(0);
  });
});

describe('what the page says', () => {
  const files = getArchiveFiles(
    readArchiveEntries(
      archiveOf([
        { name: 'readme.txt', body: 'read me' },
        { name: 'holiday/beach.txt', body: 'sand' },
      ]),
    ),
  );

  it('describes the archive itself', () => {
    expect(describeArchive(files, formatSize)).toBe('2 files · 11 B unpacked · 1 folder');
    expect(describeArchive([files[0]], formatSize)).toBe('1 file · 7 B unpacked');
  });

  it('describes what is ticked against what there is', () => {
    expect(describeArchiveSelection(files, new Set(), formatSize)).toBe('nothing ticked yet');
    expect(describeArchiveSelection(files, new Set([0]), formatSize)).toBe('1 of 2 ticked · 7 B');
    expect(describeArchiveSelection(files, new Set([0, 1]), formatSize)).toBe('everything ticked');
  });

  it('describes a row by what it is, or by why it cannot come out', () => {
    expect(describeEntry(files[0], formatSize)).toBe('7 B · stored');
    expect(describeEntry(entryOf({ method: 8, size: 40 }), formatSize)).toBe('40 B · deflated');
    expect(describeEntry(entryOf({ encrypted: true }), formatSize)).toBe('Encrypted');
  });

  it('counts a job in the progress line', () => {
    expect(describeExtractionProgress(3, 40)).toBe('Unpacking file 3 of 40 locally…');
  });

  it('never blames the visitor’s device for their file', () => {
    expect(getArchiveReadErrorMessage()).toContain('Nothing was sent anywhere');
    expect(getExtractionErrorMessage()).toContain('archive is untouched');
  });
});

describe('what the download is called', () => {
  const files = getArchiveFiles(
    readArchiveEntries(
      archiveOf([
        { name: 'holiday/beach.txt', body: 'sand' },
        { name: 'readme.txt', body: 'read me' },
      ]),
    ),
  );

  it('hands one file back as itself', () => {
    expect(isSingleFileExtraction([0])).toBe(true);
    expect(getExtractionName('holiday.zip', getExtractionPaths(files, [0]))).toBe('beach.txt');
  });

  it('hands several back as an archive named after the one they came from', () => {
    expect(isSingleFileExtraction([0, 1])).toBe(false);
    expect(getExtractionName('holiday.zip', getExtractionPaths(files, [0, 1]))).toBe('holiday-extracted.zip');
    expect(getExtractionName('holiday', ['a', 'b'])).toBe('holiday-extracted.zip');
    expect(getExtractionName('../../etc/holiday.zip', ['a', 'b'])).toBe('holiday-extracted.zip');
  });

  it('never hands back an archive named after nothing', () => {
    expect(getExtractionName('.zip', ['a', 'b'])).toBe('zip-extracted.zip');
    // A file always has a name, so this is only the shared normaliser's own
    // fallback showing through rather than a case anyone reaches.
    expect(getExtractionName('', ['a', 'b'])).toBe('file-extracted.zip');
  });
});

describe('taking the bytes out', () => {
  it('finds an entry where the archive says it is', () => {
    const archive = archiveOf([
      { name: 'first.txt', body: 'alpha' },
      { name: 'second.txt', body: 'beta' },
    ]);
    const entries = readArchiveEntries(archive);

    expect(decoder.decode(readEntryPayload(archive, entries[0]))).toBe('alpha');
    expect(decoder.decode(readEntryPayload(archive, entries[1]))).toBe('beta');
  });

  it('refuses an entry that is not where the archive says it is', () => {
    const archive = archiveOf([{ name: 'first.txt', body: 'alpha' }]);
    const [entry] = readArchiveEntries(archive);

    expect(() => readEntryPayload(archive, { ...entry, headerOffset: 12 })).toThrow(/damaged/);
    expect(() => readEntryPayload(archive, { ...entry, headerOffset: archive.length - 4 })).toThrow(
      ArchiveReadError,
    );
  });

  it('refuses an entry that runs past the end of the archive', () => {
    const archive = archiveOf([{ name: 'first.txt', body: 'alpha' }]);
    const [entry] = readArchiveEntries(archive);

    expect(() => readEntryPayload(archive, { ...entry, compressedSize: archive.length })).toThrow(
      /incomplete/,
    );
  });

  it('checks what came out against what the archive recorded', () => {
    const data = encoder.encode('alpha');
    const entry = entryOf({ size: data.length, crc: crc32(data) });

    expect(verifyEntry(entry, data)).toBeUndefined();
    expect(verifyEntry(entry, encoder.encode('alpht'))).toContain('checksum');
    expect(verifyEntry(entry, encoder.encode('alphabet'))).toContain('different size');
  });
});

describe('an entry the browser will have to inflate', () => {
  /** An archive holding one deflated entry, which is what most writers make. */
  const deflatedArchive = (name: string, body: string) => {
    const data = encoder.encode(body);

    return createZipArchive([{ name, data, deflated: deflateRawSync(data) }]);
  };

  it('reads it as deflated and hands back the compressed bytes', () => {
    const body = 'the same sentence over and over. '.repeat(40);
    const archive = deflatedArchive('notes.txt', body);
    const [entry] = readArchiveEntries(archive);

    expect(entry.method).toBe(8);
    expect(entry.size).toBe(encoder.encode(body).length);
    expect(entry.compressedSize).toBeLessThan(entry.size);
    expect(getEntryBlocker(entry)).toBeUndefined();
    expect(decoder.decode(inflateRawSync(readEntryPayload(archive, entry)))).toBe(body);
    expect(verifyEntry(entry, inflateRawSync(readEntryPayload(archive, entry)))).toBeUndefined();
  });
});

describe('an archive written in ZIP64 form', () => {
  /**
   * One stored entry whose sizes and offset are all in the ZIP64 extra field,
   * which is what a writer that always emits ZIP64 produces even for a small
   * archive. Built by hand because the writing half never makes one.
   */
  const zip64ArchiveOf = (name: string, body: string) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(body);
    const extraSize = 28;
    const local = 30 + nameBytes.length;
    const central = 46 + nameBytes.length + extraSize;
    const directory = local + data.length;
    const archive = new Uint8Array(directory + central + 56 + 20 + 22);
    const view = new DataView(archive.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint32(14, crc32(data), true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    archive.set(nameBytes, 30);
    archive.set(data, local);

    view.setUint32(directory, 0x02014b50, true);
    view.setUint16(directory + 8, 0x0800, true);
    view.setUint32(directory + 16, crc32(data), true);
    // Every one of the three is the marker, so all three come from the extra.
    view.setUint32(directory + 20, 0xffffffff, true);
    view.setUint32(directory + 24, 0xffffffff, true);
    view.setUint16(directory + 28, nameBytes.length, true);
    view.setUint16(directory + 30, extraSize, true);
    view.setUint32(directory + 42, 0xffffffff, true);
    archive.set(nameBytes, directory + 46);

    const extra = directory + 46 + nameBytes.length;

    view.setUint16(extra, 0x0001, true);
    view.setUint16(extra + 2, 24, true);
    view.setBigUint64(extra + 4, BigInt(data.length), true);
    view.setBigUint64(extra + 12, BigInt(data.length), true);
    view.setBigUint64(extra + 20, 0n, true);

    const zip64 = directory + central;

    view.setUint32(zip64, 0x06064b50, true);
    view.setBigUint64(zip64 + 4, 44n, true);
    view.setBigUint64(zip64 + 24, 1n, true);
    view.setBigUint64(zip64 + 32, 1n, true);
    view.setBigUint64(zip64 + 40, BigInt(central), true);
    view.setBigUint64(zip64 + 48, BigInt(directory), true);

    view.setUint32(zip64 + 56, 0x07064b50, true);
    view.setBigUint64(zip64 + 64, BigInt(zip64), true);
    view.setUint32(zip64 + 72, 1, true);

    const end = zip64 + 76;

    view.setUint32(end, 0x06054b50, true);
    view.setUint16(end + 8, 0xffff, true);
    view.setUint16(end + 10, 0xffff, true);
    view.setUint32(end + 12, central, true);
    view.setUint32(end + 16, 0xffffffff, true);

    return archive;
  };

  it('reads its index through the ZIP64 records', () => {
    const archive = zip64ArchiveOf('holiday/beach.txt', 'sand');
    const entries = readArchiveEntries(archive);

    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('holiday/beach.txt');
    expect(entries[0].size).toBe(4);
    expect(entries[0].compressedSize).toBe(4);
    expect(entries[0].headerOffset).toBe(0);
    expect(decoder.decode(readEntryPayload(archive, entries[0]))).toBe('sand');
  });

  it('refuses one that claims ZIP64 and carries no records for it', () => {
    const archive = zip64ArchiveOf('beach.txt', 'sand');
    const broken = archive.slice();

    // Break the locator's signature, leaving the end record still saying ZIP64.
    new DataView(broken.buffer).setUint32(broken.length - 42, 0, true);

    expect(() => readArchiveEntries(broken)).toThrow(/ZIP64/);
  });
});
