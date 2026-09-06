import { describe, expect, it } from 'vitest';

import {
  defaultFaviconFit,
  describeFaviconSet,
  faviconArchiveName,
  faviconAssets,
  faviconIcoFilename,
  faviconIcoSizes,
  getFaviconCrop,
  getFaviconFitOptions,
  getFaviconFilenames,
  getFaviconManifestSnippet,
  getFaviconSnippet,
  getFaviconSourceWarning,
  isFaviconBackground,
  isFaviconFit,
  isSquareEnough,
  validateFaviconDimensions,
  validateFaviconSource,
} from '../../src/data/favicon';
import { createIcoFile, maximumIcoSize } from '../../src/data/ico-file';

describe('the set that gets made', () => {
  it('names every file once, in one place', () => {
    const names = getFaviconFilenames();

    expect(names).toContain(faviconIcoFilename);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(faviconAssets.length + 1);
  });

  it('offers only sizes a browser or a phone actually asks for', () => {
    expect(faviconAssets.map((asset) => asset.size)).toEqual([16, 32, 180, 192, 512]);
    expect([...faviconIcoSizes]).toEqual([16, 32, 48]);

    for (const asset of faviconAssets) {
      expect(asset.purpose.length).toBeGreaterThan(0);
      expect(asset.filename).toMatch(/\.png$/);
    }
  });

  it('names the archive after what is in it', () => {
    expect(faviconArchiveName).toBe('favicon.zip');
  });
});

describe('the snippet', () => {
  const snippet = getFaviconSnippet();

  it('references files the download really contains', () => {
    const names = getFaviconFilenames();

    for (const match of snippet.matchAll(/href="\/([^"]+)"/g)) {
      expect(names, match[1]).toContain(match[1]);
    }
  });

  it('points at the ICO, both PNG tab sizes, and the Apple icon', () => {
    expect(snippet).toContain('rel="icon" href="/favicon.ico"');
    expect(snippet).toContain('sizes="32x32"');
    expect(snippet).toContain('sizes="16x16"');
    expect(snippet).toContain('rel="apple-touch-icon"');
  });

  it('writes the manifest fragment from the same list', () => {
    const manifest = getFaviconManifestSnippet();

    expect(manifest).toContain('"/icon-192.png"');
    expect(manifest).toContain('"512x512"');
    expect(() => JSON.parse(`{${manifest}}`)).not.toThrow();
  });
});

describe('a picture that is not square', () => {
  it('takes the largest centred square when it fills', () => {
    expect(getFaviconCrop({ width: 1000, height: 600 }, 'cover')).toEqual({ x: 200, y: 0, size: 600 });
    expect(getFaviconCrop({ width: 600, height: 1000 }, 'cover')).toEqual({ x: 0, y: 200, size: 600 });
  });

  it('draws the whole picture into a square of the longer side when it fits', () => {
    expect(getFaviconCrop({ width: 1000, height: 600 }, 'contain')).toEqual({
      x: 0,
      y: -200,
      size: 1000,
    });
  });

  it('leaves a square picture alone either way', () => {
    expect(getFaviconCrop({ width: 512, height: 512 }, 'cover')).toEqual({ x: 0, y: 0, size: 512 });
    expect(getFaviconCrop({ width: 512, height: 512 }, 'contain')).toEqual({ x: 0, y: 0, size: 512 });
  });

  it('knows when the choice does not matter', () => {
    expect(isSquareEnough({ width: 512, height: 512 })).toBe(true);
    expect(isSquareEnough({ width: 500, height: 505 })).toBe(true);
    expect(isSquareEnough({ width: 1000, height: 600 })).toBe(false);
    expect(isSquareEnough({ width: 0, height: 0 })).toBe(false);
  });

  it('resolves the controls it offers', () => {
    expect(getFaviconFitOptions().map((option) => option.value)).toEqual(['cover', 'contain']);
    expect(isFaviconFit(defaultFaviconFit)).toBe(true);
    expect(isFaviconFit('squish')).toBe(false);
    expect(isFaviconBackground('#ffffff')).toBe(true);
    expect(isFaviconBackground('rebeccapurple')).toBe(false);
  });
});

describe('what it will take on', () => {
  it('takes one picture, and says what anything else is', () => {
    expect(validateFaviconSource([{ name: 'logo.png', type: 'image/png' }])).toBeUndefined();
    expect(validateFaviconSource([])).toMatch(/Choose the picture/);
    expect(
      validateFaviconSource([
        { name: 'a.png', type: 'image/png' },
        { name: 'b.png', type: 'image/png' },
      ]),
    ).toMatch(/one icon set at a time/);
    expect(validateFaviconSource([{ name: 'notes.txt', type: 'text/plain' }])).toMatch(/is not a JPEG/);
  });

  it('warns about a picture smaller than the largest icon rather than refusing it', () => {
    expect(getFaviconSourceWarning({ width: 512, height: 512 })).toBeUndefined();
    expect(getFaviconSourceWarning({ width: 128, height: 900 })).toMatch(/128 pixels on its shortest side/);
    expect(validateFaviconDimensions({ width: 0, height: 10 })).toMatch(/could not be read/);
    expect(validateFaviconDimensions({ width: 512, height: 512 })).toBeUndefined();
  });

  it('describes the set it made', () => {
    expect(describeFaviconSet(6, (bytes) => `${bytes} B`, 1024)).toBe(
      "6 files · 1024 B · ready to drop into a site's root",
    );
  });
});

describe('the ICO container', () => {
  const png = (length: number, fill: number) => new Uint8Array(length).fill(fill);

  it('writes a header, a record per image, and then the images', () => {
    const file = createIcoFile([
      { size: 16, png: png(10, 1) },
      { size: 32, png: png(20, 2) },
    ]);
    const view = new DataView(file.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);
    expect(file.length).toBe(6 + 16 * 2 + 30);

    // The first record: 16x16, no palette, one plane, 32 bits, then where to
    // find its bytes and how many there are.
    expect(view.getUint8(6)).toBe(16);
    expect(view.getUint8(7)).toBe(16);
    expect(view.getUint16(10, true)).toBe(1);
    expect(view.getUint16(12, true)).toBe(32);
    expect(view.getUint32(14, true)).toBe(10);
    expect(view.getUint32(18, true)).toBe(38);

    // The second image starts where the first one ends.
    expect(view.getUint32(30, true)).toBe(20);
    expect(view.getUint32(34, true)).toBe(48);
    expect(file[38]).toBe(1);
    expect(file[48]).toBe(2);
  });

  it('writes a 256-pixel side the way the format does, as zero', () => {
    const file = createIcoFile([{ size: 256, png: png(4, 3) }]);

    expect(new DataView(file.buffer).getUint8(6)).toBe(0);
  });

  it('refuses what it cannot describe', () => {
    expect(() => createIcoFile([])).toThrow(/at least one image/);
    expect(() => createIcoFile([{ size: 0, png: png(4, 0) }])).toThrow(/1 to 256/);
    expect(() => createIcoFile([{ size: maximumIcoSize + 1, png: png(4, 0) }])).toThrow(/1 to 256/);
  });
});
