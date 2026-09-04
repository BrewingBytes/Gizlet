import { describe, expect, it } from 'vitest';

import { maximumImagePixels } from '../../src/data/image-resize';
import {
  defaultPdfImageFormat,
  defaultPdfImageResolution,
  describePdfImageCount,
  describePdfPageSelection,
  getPdfImageArchiveName,
  getPdfImageFilename,
  getPdfImageFormatOptions,
  getPdfImageResolutionLabel,
  getPdfImageResolutionOptions,
  getPdfImageScale,
  getPdfImagePageErrorMessage,
  getPdfPageSelectionErrorMessage,
  getPdfToImageErrorMessage,
  isLargePdfToImageDocument,
  isPdfImageResolution,
  isPdfImageScaleReduced,
  largePdfToImagePages,
  maximumPdfToImagePages,
  parsePdfPageSelection,
  pdfImageResolutionNames,
  pdfImageResolutions,
  validatePdfToImagePageCount,
  validatePdfToImageSelection,
} from '../../src/data/pdf-to-jpg';

const pdf = { name: 'statement.pdf', type: 'application/pdf' };

describe('validatePdfToImageSelection', () => {
  it('accepts one PDF, by type or by extension', () => {
    expect(validatePdfToImageSelection([pdf])).toBeUndefined();
    expect(validatePdfToImageSelection([{ name: 'scan.PDF', type: '' }])).toBeUndefined();
  });

  it('asks for a file when none was chosen', () => {
    expect(validatePdfToImageSelection([])).toBe('Choose a PDF to turn into images.');
  });

  it('converts one document at a time', () => {
    expect(validatePdfToImageSelection([pdf, pdf])).toBe(
      'This Gizlet converts one PDF at a time. Choose a single file.',
    );
  });

  it('names the file it will not take, rather than refusing anonymously', () => {
    expect(validatePdfToImageSelection([{ name: 'notes.txt', type: 'text/plain' }])).toBe(
      'notes.txt is not a PDF. Choose a file that ends in .pdf.',
    );
  });
});

describe('validatePdfToImagePageCount', () => {
  it('accepts a document from one page up to the ceiling', () => {
    expect(validatePdfToImagePageCount(1)).toBeUndefined();
    expect(validatePdfToImagePageCount(maximumPdfToImagePages)).toBeUndefined();
  });

  it('explains a PDF that reports no pages rather than showing an empty result', () => {
    expect(validatePdfToImagePageCount(0)).toBe(
      'This PDF has no pages, so there is nothing to convert.',
    );
    expect(validatePdfToImagePageCount(-1)).toBe(
      'This PDF has no pages, so there is nothing to convert.',
    );
  });

  it('states the limit and the document’s own count when it is too long', () => {
    const message = validatePdfToImagePageCount(1200);

    expect(message).toContain(String(maximumPdfToImagePages));
    expect(message).toContain('1,200');
  });

  it('warns about a long document before it looks stalled', () => {
    expect(isLargePdfToImageDocument(largePdfToImagePages)).toBe(true);
    expect(isLargePdfToImageDocument(largePdfToImagePages - 1)).toBe(false);
  });
});

describe('parsePdfPageSelection', () => {
  it('takes every page when the field is left alone', () => {
    expect(parsePdfPageSelection('', 3)).toEqual([1, 2, 3]);
    expect(parsePdfPageSelection('   ', 3)).toEqual([1, 2, 3]);
    expect(parsePdfPageSelection('All', 2)).toEqual([1, 2]);
  });

  it('reads single pages and ranges, in order and without repeats', () => {
    expect(parsePdfPageSelection('3', 5)).toEqual([3]);
    expect(parsePdfPageSelection('1-3, 5', 5)).toEqual([1, 2, 3, 5]);
    expect(parsePdfPageSelection('5,1-2,2', 5)).toEqual([1, 2, 5]);
    expect(parsePdfPageSelection(' 2 - 4 ', 5)).toEqual([2, 3, 4]);
  });

  it('refuses anything that is not a whole page in this document', () => {
    expect(parsePdfPageSelection('0', 5)).toBeUndefined();
    expect(parsePdfPageSelection('6', 5)).toBeUndefined();
    expect(parsePdfPageSelection('4-2', 5)).toBeUndefined();
    expect(parsePdfPageSelection('1,', 5)).toBeUndefined();
    expect(parsePdfPageSelection('first', 5)).toBeUndefined();
    expect(parsePdfPageSelection('1.5', 5)).toBeUndefined();
    expect(parsePdfPageSelection('-2', 5)).toBeUndefined();
  });

  it('has nothing to select in a document with no pages', () => {
    expect(parsePdfPageSelection('1', 0)).toBeUndefined();
  });

  it('says what a selection has to look like, in this document’s terms', () => {
    expect(getPdfPageSelectionErrorMessage(12)).toContain('between 1 and 12');
  });
});

describe('describing a selection', () => {
  it('says all of them when that is what was chosen', () => {
    expect(describePdfPageSelection([1, 2, 3], 3)).toBe('All 3 pages');
    expect(describePdfPageSelection([1], 1)).toBe('All 1 page');
    expect(describePdfPageSelection([1, 4], 12)).toBe('2 of 12 pages');
  });

  it('keeps a count and its noun together', () => {
    expect(describePdfImageCount(1)).toBe('1 image');
    expect(describePdfImageCount(9)).toBe('9 images');
  });
});

describe('getPdfImageScale', () => {
  const a4 = { width: 595.28, height: 841.89 };

  it('draws a page at the whole multiple the chosen resolution asks for', () => {
    for (const resolution of pdfImageResolutionNames) {
      expect(getPdfImageScale(a4, resolution)).toBe(pdfImageResolutions[resolution].scale);
      expect(isPdfImageScaleReduced(a4, resolution)).toBe(false);
    }
  });

  it('reduces the scale rather than asking for a canvas the device cannot hold', () => {
    // A 200-inch page, the largest a PDF may declare, at 216 dpi would be
    // roughly 900 megapixels.
    const huge = { width: 14_400, height: 14_400 };
    const scale = getPdfImageScale(huge, 'print');

    expect(scale).toBeLessThan(pdfImageResolutions.print.scale);
    expect(huge.width * scale * (huge.height * scale)).toBeLessThanOrEqual(maximumImagePixels + 1);
    expect(isPdfImageScaleReduced(huge, 'print')).toBe(true);
  });

  it('leaves a page with no size to the resolution it was asked for', () => {
    expect(getPdfImageScale({ width: 0, height: 0 }, 'sharp')).toBe(2);
  });
});

describe('the format and resolution choices', () => {
  it('offers the three formats the image Gizlets already encode', () => {
    expect(getPdfImageFormatOptions().map((option) => option.value)).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(defaultPdfImageFormat).toBe('image/jpeg');
  });

  it('offers each resolution once, labelled with the dpi it produces', () => {
    const options = getPdfImageResolutionOptions();

    expect(options.map((option) => option.value)).toEqual([...pdfImageResolutionNames]);
    expect(new Set(options.map((option) => option.label))).toHaveLength(options.length);

    for (const option of options) {
      expect(option.label).toContain(`${pdfImageResolutions[option.value].dpi} dpi`);
      expect(getPdfImageResolutionLabel(option.value)).toBe(option.label);
    }
  });

  it('recognises only the resolutions it declares', () => {
    expect(isPdfImageResolution(defaultPdfImageResolution)).toBe(true);
    expect(isPdfImageResolution('enormous')).toBe(false);
  });

  it('keeps each step a whole multiple of the PDF’s own 72 points per inch', () => {
    for (const resolution of pdfImageResolutionNames) {
      const { scale, dpi } = pdfImageResolutions[resolution];

      expect(Number.isInteger(scale)).toBe(true);
      expect(dpi).toBe(scale * 72);
    }
  });
});

describe('naming the output', () => {
  it('numbers a page to the width of the document’s page count, so a folder sorts', () => {
    expect(getPdfImageFilename('statement.pdf', 2, 9, 'image/jpeg')).toBe('statement-page-2.jpg');
    expect(getPdfImageFilename('statement.pdf', 2, 12, 'image/png')).toBe('statement-page-02.png');
    expect(getPdfImageFilename('statement.pdf', 100, 100, 'image/webp')).toBe(
      'statement-page-100.webp',
    );
  });

  it('falls back to a name when the PDF has none worth keeping', () => {
    expect(getPdfImageFilename('.pdf', 1, 1, 'image/jpeg')).toBe('document-page-1.jpg');
  });

  it('names the archive after the document it came from', () => {
    expect(getPdfImageArchiveName('statement.pdf')).toBe('statement-pages.zip');
    expect(getPdfImageArchiveName('.pdf')).toBe('document-pages.zip');
  });
});

describe('getPdfToImageErrorMessage', () => {
  it('tells the visitor how to get past a password-protected PDF', () => {
    const message = getPdfToImageErrorMessage('PasswordException');

    expect(message).toContain('password-protected');
    expect(message).toContain('unlocked copy');
  });

  it('says a file that is not really a PDF is not one, and why that happens', () => {
    const message = getPdfToImageErrorMessage('InvalidPDFException');

    expect(message).toContain('not a PDF that can be read');
    expect(message).toContain('renamed from another format');
  });

  it('points a file that could not be read back at the device it came from', () => {
    expect(getPdfToImageErrorMessage('MissingPDFException')).toContain('from your device');
  });

  it('still says something specific for a failure it does not recognise', () => {
    expect(getPdfToImageErrorMessage(undefined)).toBe(
      'This PDF could not be opened, so there is nothing to convert.',
    );
    expect(getPdfToImageErrorMessage('UnexpectedResponseException')).toBe(
      'This PDF could not be opened, so there is nothing to convert.',
    );
  });

  it('names the page that stopped a set being made, and how to convert the rest', () => {
    const message = getPdfImagePageErrorMessage(4);

    expect(message).toContain('Page 4');
    expect(message).toContain('Pages');
  });

  it('never leaves a failure without wording a visitor can act on', () => {
    for (const name of ['PasswordException', 'InvalidPDFException', 'MissingPDFException', undefined]) {
      expect(getPdfToImageErrorMessage(name).length).toBeGreaterThan(40);
    }
  });
});
