import { describe, expect, it } from 'vitest';

import {
  batchArchiveLabels,
  describeBatchCount,
  describeBatchItem,
  getBatchArchiveName,
  getBatchFailures,
  getBatchSuccesses,
  getUniqueBatchNames,
  hasBatchOutput,
  maximumBatchImages,
  maximumBatchPixels,
  summariseBatch,
  validateBatchPixels,
  validateBatchSelection,
  type BatchOutcome,
} from '../../src/data/image-batches';
import { getBatchResizeDimensions } from '../../src/data/image-resize';

const image = (name: string) => ({ name, type: 'image/jpeg' });

const done = (name: string): BatchOutcome<string> => ({ status: 'done', name, output: name });
const failed = (name: string, reason = 'This image could not be read.'): BatchOutcome<string> => ({
  status: 'failed',
  name,
  reason,
});

describe('what a batch will take on', () => {
  it('takes several images, and says what a file that is not one is', () => {
    expect(validateBatchSelection([image('a.jpg'), image('b.png')])).toBeUndefined();
    expect(validateBatchSelection([])).toMatch(/at least one image/);
    expect(validateBatchSelection([image('a.jpg'), { name: 'notes.txt', type: 'text/plain' }])).toMatch(
      /notes\.txt is not a JPEG/,
    );
  });

  it('counts what is already chosen, so dropping more says the same as choosing more', () => {
    const files = Array.from({ length: maximumBatchImages }, (_, index) => image(`${index}.jpg`));

    expect(validateBatchSelection(files)).toBeUndefined();
    expect(validateBatchSelection([image('one-more.jpg')], maximumBatchImages)).toMatch(
      new RegExp(`${maximumBatchImages + 1} images`),
    );
    expect(validateBatchSelection([...files, image('one-more.jpg')])).toMatch(/up to 25 images/);
  });

  it('holds the batch to what one tab can work through', () => {
    expect(validateBatchPixels([{ width: 4000, height: 3000 }, { width: 4000, height: 3000 }])).toBeUndefined();
    expect(validateBatchPixels([{ width: 20_000, height: 20_000 }])).toMatch(
      new RegExp(maximumBatchPixels.toLocaleString()),
    );
  });

  it('counts images the way a sentence does', () => {
    expect(describeBatchCount(1)).toBe('1 image');
    expect(describeBatchCount(12)).toBe('12 images');
  });
});

describe('one file failing is one row failing', () => {
  const outcomes = [done('a.jpg'), failed('b.jpg', 'This image could not be read.'), done('c.jpg')];

  it('keeps the results that worked', () => {
    expect(getBatchSuccesses(outcomes)).toEqual(['a.jpg', 'c.jpg']);
    expect(getBatchFailures(outcomes)).toEqual([
      { name: 'b.jpg', reason: 'This image could not be read.' },
    ]);
    expect(hasBatchOutput(outcomes)).toBe(true);
  });

  it('says what happened without hiding either half', () => {
    expect(summariseBatch(outcomes, 2048)).toBe('2 images of 3 · 2.0 KB · 1 could not be processed');
    expect(summariseBatch([done('a.jpg'), done('b.jpg')], 1024)).toBe('2 images · 1.0 KB');
    expect(summariseBatch([failed('a.jpg'), failed('b.jpg')])).toBe(
      'None of these 2 images could be processed.',
    );
    expect(hasBatchOutput([failed('a.jpg')])).toBe(false);
  });

  it('writes a row the way the list shows it', () => {
    expect(describeBatchItem('a.jpg', 'JPEG · 12 KB')).toBe('a.jpg · JPEG · 12 KB');
  });
});

describe('the archive', () => {
  it('is named for the job rather than for whichever file was first', () => {
    expect(getBatchArchiveName('compressed')).toBe('compressed-images.zip');
    expect(getBatchArchiveName('resized')).toBe('resized-images.zip');
    expect(getBatchArchiveName('converted')).toBe('converted-images.zip');
    expect(getBatchArchiveName('flow')).toBe('flow-images.zip');

    for (const label of batchArchiveLabels) {
      expect(getBatchArchiveName(label)).toMatch(/^[a-z]+-images\.zip$/);
    }
  });

  it('keeps two files of the same name apart, in the order they ran', () => {
    expect(getUniqueBatchNames(['photo.jpg', 'photo.jpg', 'other.jpg', 'photo.jpg'])).toEqual([
      'photo.jpg',
      'photo-2.jpg',
      'other.jpg',
      'photo-3.jpg',
    ]);
    expect(getUniqueBatchNames(['README', 'README'])).toEqual(['README', 'README-2']);
    expect(getUniqueBatchNames([])).toEqual([]);
  });
});

describe('one settings panel, several pictures', () => {
  const landscape = { width: 4000, height: 2000 };
  const portrait = { width: 1000, height: 2000 };

  it('scales every picture by the same percentage', () => {
    expect(getBatchResizeDimensions(landscape, { mode: 'percentage', percentage: 50 })).toEqual({
      width: 2000,
      height: 1000,
    });
    expect(getBatchResizeDimensions(portrait, { mode: 'percentage', percentage: 50 })).toEqual({
      width: 500,
      height: 1000,
    });
  });

  it('lets each picture keep its own proportions from one width', () => {
    const request = { mode: 'dimensions', width: 800, height: 600, keepProportions: true } as const;

    expect(getBatchResizeDimensions(landscape, request)).toEqual({ width: 800, height: 400 });
    expect(getBatchResizeDimensions(portrait, request)).toEqual({ width: 800, height: 1600 });
  });

  it('forces every picture to the same box when proportions are off', () => {
    const request = { mode: 'dimensions', width: 800, height: 600, keepProportions: false } as const;

    expect(getBatchResizeDimensions(landscape, request)).toEqual({ width: 800, height: 600 });
    expect(getBatchResizeDimensions(portrait, request)).toEqual({ width: 800, height: 600 });
  });

  it('refuses what it cannot resize to rather than guessing', () => {
    expect(getBatchResizeDimensions(landscape, { mode: 'percentage', percentage: 0 })).toBeUndefined();
    expect(
      getBatchResizeDimensions(landscape, { mode: 'dimensions', width: 0, height: 600, keepProportions: true }),
    ).toBeUndefined();
    expect(
      getBatchResizeDimensions({ width: 0, height: 0 }, { mode: 'percentage', percentage: 50 }),
    ).toBeUndefined();
  });
});
