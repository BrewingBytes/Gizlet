import { describe, expect, it } from 'vitest';

import {
  defaultPdfPageSize,
  describePdfPageCount,
  fixedPdfPageSizes,
  getPdfEmbedStrategy,
  getPdfOutputFilename,
  getPdfPageLayout,
  getPdfPageSizeLabel,
  getPdfPageSizeOptions,
  getPdfPixelTotal,
  isLargePdfDocument,
  isLargePdfWorkload,
  isPdfOrientation,
  isPdfPageSizeName,
  largePdfPages,
  maximumPdfPageDimension,
  maximumPdfPages,
  pdfPageMargin,
  reorderPdfImages,
  usesFixedPageSize,
  validatePdfImage,
  validatePdfSelection,
} from '../../src/data/jpg-to-pdf';
import { maximumImageDimension, maximumImagePixels } from '../../src/data/image-resize';

const jpeg = { name: 'receipt.jpg', type: 'image/jpeg' };
const png = { name: 'scan.png', type: 'image/png' };

describe('page size and orientation choices', () => {
  it('offers every fixed paper size plus a page fitted to the image', () => {
    expect(getPdfPageSizeOptions().map((option) => option.value)).toEqual([
      'a4',
      'letter',
      'legal',
      'fit',
    ]);
    expect(getPdfPageSizeLabel('a4')).toBe('A4');
    expect(getPdfPageSizeLabel('fit')).toBe('Fit each image');
  });

  it('defaults to a paper size the document can be printed on', () => {
    expect(getPdfPageSizeOptions()[0].value).toBe(defaultPdfPageSize);
    expect(usesFixedPageSize(defaultPdfPageSize)).toBe(true);
  });

  it('recognises only the page sizes and orientations it can honour', () => {
    expect(isPdfPageSizeName('letter')).toBe(true);
    expect(isPdfPageSizeName('fit')).toBe(true);
    expect(isPdfPageSizeName('a3')).toBe(false);
    expect(isPdfOrientation('landscape')).toBe(true);
    expect(isPdfOrientation('sideways')).toBe(false);
  });

  it('treats only the paper sizes as having a box to rotate', () => {
    expect(usesFixedPageSize('a4')).toBe(true);
    expect(usesFixedPageSize('fit')).toBe(false);
  });
});

describe('getPdfPageLayout', () => {
  it('makes a fitted page exactly the image, with no margin and no scaling', () => {
    expect(getPdfPageLayout({ width: 1024, height: 768 }, 'fit', 'auto')).toEqual({
      pageWidth: 1024,
      pageHeight: 768,
      imageX: 0,
      imageY: 0,
      imageWidth: 1024,
      imageHeight: 768,
    });
  });

  it('shrinks a fitted page to the largest one a PDF reader will open', () => {
    const layout = getPdfPageLayout({ width: 16_000, height: 8_000 }, 'fit', 'auto');

    expect(layout.pageWidth).toBe(maximumPdfPageDimension);
    expect(layout.pageHeight).toBe(maximumPdfPageDimension / 2);
    expect(layout.imageWidth).toBe(layout.pageWidth);
    expect(layout.imageHeight).toBe(layout.pageHeight);
  });

  it('never declares a page larger than a PDF reader will open', () => {
    for (const pageSize of getPdfPageSizeOptions().map((option) => option.value)) {
      const layout = getPdfPageLayout(
        { width: maximumImageDimension, height: maximumImageDimension },
        pageSize,
        'auto',
      );

      expect(layout.pageWidth, pageSize).toBeLessThanOrEqual(maximumPdfPageDimension);
      expect(layout.pageHeight, pageSize).toBeLessThanOrEqual(maximumPdfPageDimension);
    }
  });

  it('ignores orientation on a fitted page, which already has the image’s own', () => {
    expect(getPdfPageLayout({ width: 1024, height: 768 }, 'fit', 'portrait')).toEqual(
      getPdfPageLayout({ width: 1024, height: 768 }, 'fit', 'landscape'),
    );
  });

  it('centres an image inside a fixed page and keeps its aspect ratio', () => {
    const layout = getPdfPageLayout({ width: 1000, height: 500 }, 'letter', 'portrait');
    const { width, height } = fixedPdfPageSizes.letter;

    expect(layout.pageWidth).toBe(width);
    expect(layout.pageHeight).toBe(height);
    expect(layout.imageWidth).toBe(width - pdfPageMargin * 2);
    expect(layout.imageHeight).toBe((width - pdfPageMargin * 2) / 2);
    expect(layout.imageX).toBe(pdfPageMargin);
    expect(layout.imageY).toBeCloseTo((height - layout.imageHeight) / 2, 2);
    expect(layout.imageWidth / layout.imageHeight).toBeCloseTo(2, 5);
  });

  it('never lets the image cross the page margin, whichever side is tight', () => {
    for (const image of [
      { width: 4000, height: 200 },
      { width: 200, height: 4000 },
      { width: 900, height: 900 },
    ]) {
      const layout = getPdfPageLayout(image, 'a4', 'portrait');

      expect(layout.imageX, `${image.width}x${image.height}`).toBeGreaterThanOrEqual(pdfPageMargin - 0.01);
      expect(layout.imageY, `${image.width}x${image.height}`).toBeGreaterThanOrEqual(pdfPageMargin - 0.01);
      expect(layout.imageX + layout.imageWidth).toBeLessThanOrEqual(layout.pageWidth - pdfPageMargin + 0.01);
      expect(layout.imageY + layout.imageHeight).toBeLessThanOrEqual(layout.pageHeight - pdfPageMargin + 0.01);
    }
  });

  it('turns the page for a wide image only when the orientation asks it to', () => {
    const wide = { width: 1600, height: 900 };
    const tall = { width: 900, height: 1600 };

    expect(getPdfPageLayout(wide, 'a4', 'auto').pageWidth).toBe(fixedPdfPageSizes.a4.height);
    expect(getPdfPageLayout(tall, 'a4', 'auto').pageWidth).toBe(fixedPdfPageSizes.a4.width);
    expect(getPdfPageLayout(wide, 'a4', 'portrait').pageWidth).toBe(fixedPdfPageSizes.a4.width);
    expect(getPdfPageLayout(tall, 'a4', 'landscape').pageWidth).toBe(fixedPdfPageSizes.a4.height);
  });

  it('keeps a square image portrait under auto rather than guessing', () => {
    expect(getPdfPageLayout({ width: 800, height: 800 }, 'a4', 'auto').pageHeight).toBe(
      fixedPdfPageSizes.a4.height,
    );
  });
});

describe('validatePdfSelection', () => {
  it('asks for at least one image', () => {
    expect(validatePdfSelection([])).toBe('Choose at least one image to put in a PDF.');
  });

  it('accepts a single image and a long-but-permitted run of them', () => {
    expect(validatePdfSelection([jpeg])).toBeUndefined();
    expect(validatePdfSelection(Array.from({ length: maximumPdfPages }, () => png))).toBeUndefined();
  });

  it('names the files it cannot read rather than only counting them', () => {
    const problem = validatePdfSelection([jpeg, { name: 'notes.txt', type: 'text/plain' }]);

    expect(problem).toContain('notes.txt');
    expect(problem).toContain('is not an image');
    expect(problem).toContain('JPEG, PNG, WebP, AVIF, or BMP');
  });

  it('summarises a long list of unreadable files instead of printing all of them', () => {
    const problem = validatePdfSelection([
      { name: 'a.txt', type: 'text/plain' },
      { name: 'b.txt', type: 'text/plain' },
      { name: 'c.txt', type: 'text/plain' },
      { name: 'd.txt', type: 'text/plain' },
    ]);

    expect(problem).toContain('a.txt, b.txt, c.txt, and 1 more');
    expect(problem).toContain('are not images');
    expect(problem).not.toContain('d.txt');
  });

  it('refuses more pages than one document holds, and says how many were chosen', () => {
    const problem = validatePdfSelection(Array.from({ length: maximumPdfPages + 1 }, () => jpeg));

    expect(problem).toContain(String(maximumPdfPages));
    expect(problem).toContain(String(maximumPdfPages + 1));
  });

  it('reports an unreadable file before the page limit, since that is the fixable one', () => {
    const problem = validatePdfSelection([
      ...Array.from({ length: maximumPdfPages + 1 }, () => jpeg),
      { name: 'notes.txt', type: 'text/plain' },
    ]);

    expect(problem).toContain('notes.txt');
  });
});

describe('validatePdfImage', () => {
  it('accepts an ordinary photograph', () => {
    expect(validatePdfImage('holiday.jpg', { width: 4032, height: 3024 })).toBeUndefined();
  });

  it('rejects an image the browser decoded to nothing', () => {
    expect(validatePdfImage('broken.jpg', { width: 0, height: 0 })).toBe(
      'broken.jpg has no usable dimensions.',
    );
  });

  it('holds an image to the same ceiling the resize Gizlet enforces', () => {
    const wide = validatePdfImage('huge.jpg', {
      width: maximumImageDimension + 1,
      height: 100,
    });
    const dense = validatePdfImage('dense.jpg', { width: 8000, height: 8000 });

    expect(wide).toContain('huge.jpg is too large to make a page from.');
    expect(wide).toContain(maximumImageDimension.toLocaleString());
    expect(dense).toContain(maximumImagePixels.toLocaleString());
  });
});

describe('the large-document threshold', () => {
  it('flags a document once it reaches the page threshold', () => {
    expect(isLargePdfDocument(largePdfPages - 1)).toBe(false);
    expect(isLargePdfDocument(largePdfPages)).toBe(true);
  });

  it('adds up the pixels a selection asks the browser to decode', () => {
    expect(getPdfPixelTotal([{ width: 100, height: 100 }, { width: 200, height: 50 }])).toBe(20_000);
    expect(getPdfPixelTotal([])).toBe(0);
  });

  it('treats a few enormous images as a large workload even below the page threshold', () => {
    expect(isLargePdfWorkload([{ width: 1000, height: 1000 }])).toBe(false);
    expect(isLargePdfWorkload([{ width: 8000, height: 5000 }])).toBe(true);
    expect(
      isLargePdfWorkload(Array.from({ length: largePdfPages }, () => ({ width: 10, height: 10 }))),
    ).toBe(true);
  });
});

describe('getPdfEmbedStrategy', () => {
  it('embeds JPEG and PNG bytes as they are', () => {
    expect(getPdfEmbedStrategy('image/jpeg')).toBe('jpeg');
    expect(getPdfEmbedStrategy('image/png')).toBe('png');
  });

  it('re-encodes everything a PDF cannot carry, including an undetected format', () => {
    expect(getPdfEmbedStrategy('image/webp')).toBe('re-encode');
    expect(getPdfEmbedStrategy('image/avif')).toBe('re-encode');
    expect(getPdfEmbedStrategy('image/bmp')).toBe('re-encode');
    expect(getPdfEmbedStrategy(undefined)).toBe('re-encode');
  });
});

describe('getPdfOutputFilename', () => {
  it('names a one-page document after its only image', () => {
    expect(getPdfOutputFilename('receipt.jpg', 1)).toBe('receipt.pdf');
  });

  it('says how many more pages followed the first one', () => {
    expect(getPdfOutputFilename('receipt.jpg', 5)).toBe('receipt-and-4-more.pdf');
  });

  it('keeps a name for a file that has no extension to strip', () => {
    expect(getPdfOutputFilename('receipt', 1)).toBe('receipt.pdf');
    expect(getPdfOutputFilename('.jpg', 2)).toBe('images-and-1-more.pdf');
  });
});

describe('describePdfPageCount', () => {
  it('keeps the count and its noun in agreement', () => {
    expect(describePdfPageCount(1)).toBe('1 page');
    expect(describePdfPageCount(12)).toBe('12 pages');
  });
});

describe('reorderPdfImages', () => {
  const pages = ['a', 'b', 'c'] as const;

  it('moves a page to a new position without losing any', () => {
    expect(reorderPdfImages(pages, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(reorderPdfImages(pages, 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the order untouched rather than dropping a page for an impossible move', () => {
    expect(reorderPdfImages(pages, 0, 0)).toBe(pages);
    expect(reorderPdfImages(pages, -1, 0)).toBe(pages);
    expect(reorderPdfImages(pages, 0, 3)).toBe(pages);
    expect(reorderPdfImages([], 0, 0)).toEqual([]);
  });
});
