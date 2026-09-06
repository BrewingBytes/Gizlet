import { describe, expect, it } from 'vitest';

import {
  clampPageNumberFontSize,
  clampPageNumberMargin,
  clampPageNumberSkip,
  clampPageNumberStart,
  defaultPageNumberFormat,
  defaultPageNumberPosition,
  describePageNumberPlan,
  describePageNumbering,
  formatPageNumber,
  getNumberedPdfFilename,
  getPageNumberAnchor,
  getPageNumberFormatOptions,
  getPageNumberLabel,
  getPageNumberPositionOptions,
  getPageNumberPreviewPlacement,
  getPageNumberTotal,
  getPageNumbersOpenErrorMessage,
  isLargePageNumberDocument,
  isPageNumberFormat,
  isPageNumberPosition,
  largePageNumberPdfPages,
  maximumPageNumberFontSize,
  maximumPageNumberMargin,
  maximumPageNumberPdfPages,
  minimumPageNumberFontSize,
  minimumPageNumberMargin,
  pageNumberFormats,
  pageNumberPositions,
  planPageNumbers,
  validatePageNumberPlan,
  validatePageNumbersPageCount,
  validatePageNumbersSelection,
} from '../../src/data/pdf-page-numbers';

const options = (overrides: Partial<Parameters<typeof planPageNumbers>[1]> = {}) => ({
  format: defaultPageNumberFormat,
  startAt: 1,
  skip: 0,
  pages: '',
  ...overrides,
});

describe('the choices on offer', () => {
  it('resolves every format and position it names', () => {
    for (const format of pageNumberFormats) expect(isPageNumberFormat(format), format).toBe(true);
    for (const position of pageNumberPositions) {
      expect(isPageNumberPosition(position), position).toBe(true);
    }

    expect(isPageNumberFormat('roman')).toBe(false);
    expect(isPageNumberPosition('centre')).toBe(false);
  });

  it('labels a format with an example of itself', () => {
    expect(getPageNumberFormatOptions().map((option) => option.label)).toEqual([
      '1',
      'Page 1',
      '1 of 12',
      'Page 1 of 12',
    ]);
    expect(getPageNumberPositionOptions()).toHaveLength(pageNumberPositions.length);
  });

  it('writes a number the way each format writes it', () => {
    expect(formatPageNumber('number', 3, 12)).toBe('3');
    expect(formatPageNumber('page-number', 3, 12)).toBe('Page 3');
    expect(formatPageNumber('number-of', 3, 12)).toBe('3 of 12');
    expect(formatPageNumber('page-number-of', 3, 12)).toBe('Page 3 of 12');
  });
});

describe('planPageNumbers', () => {
  it('numbers every page of an untouched document', () => {
    const plan = planPageNumbers(4, options());

    expect(plan).toEqual([
      { pageNumber: 1, value: 1 },
      { pageNumber: 2, value: 2 },
      { pageNumber: 3, value: 3 },
      { pageNumber: 4, value: 4 },
    ]);
  });

  it('leaves the skipped pages at the front alone', () => {
    // A cover and a title page: unnumbered, and the numbering starts after them.
    expect(planPageNumbers(5, options({ skip: 2 }))).toEqual([
      { pageNumber: 3, value: 1 },
      { pageNumber: 4, value: 2 },
      { pageNumber: 5, value: 3 },
    ]);
  });

  it('starts at the number it was given', () => {
    expect(planPageNumbers(3, options({ startAt: 47 }))).toEqual([
      { pageNumber: 1, value: 47 },
      { pageNumber: 2, value: 48 },
      { pageNumber: 3, value: 49 },
    ]);
  });

  it('counts across the pages that survived the range, not the document', () => {
    // Numbering 5-8 of a report starting at 1 gives 1 to 4, because that is
    // what was asked for; the offset is not the visitor's to work out.
    expect(planPageNumbers(10, options({ pages: '5-8' }))).toEqual([
      { pageNumber: 5, value: 1 },
      { pageNumber: 6, value: 2 },
      { pageNumber: 7, value: 3 },
      { pageNumber: 8, value: 4 },
    ]);
  });

  it('composes skipping and the range, in that order', () => {
    // The skip removes pages 1 and 2; the range then asks for 2-5, of which
    // only 3, 4 and 5 are left.
    expect(planPageNumbers(6, options({ skip: 2, pages: '2-5' }))).toEqual([
      { pageNumber: 3, value: 1 },
      { pageNumber: 4, value: 2 },
      { pageNumber: 5, value: 3 },
    ]);
  });

  it('numbers nothing rather than everything when the range cannot be read', () => {
    // The field refuses it where it is typed, and this agrees rather than
    // quietly numbering the whole document.
    expect(planPageNumbers(4, options({ pages: 'nonsense' }))).toEqual([]);
    expect(planPageNumbers(4, options({ pages: '9-12' }))).toEqual([]);
  });

  it('numbers nothing when every page is skipped', () => {
    expect(planPageNumbers(3, options({ skip: 3 }))).toEqual([]);
    expect(planPageNumbers(3, options({ skip: 99 }))).toEqual([]);
  });

  it('plans nothing for a document with no pages', () => {
    expect(planPageNumbers(0, options())).toEqual([]);
    expect(planPageNumbers(-1, options())).toEqual([]);
  });
});

describe('the total a format names', () => {
  it('is the last number printed rather than the document’s page count', () => {
    // Two unnumbered pages at the front: a reader counting the numbers gets 10.
    const plan = planPageNumbers(12, options({ skip: 2 }));

    expect(getPageNumberTotal(plan)).toBe(10);
    expect(describePageNumberPlan(plan, 'number-of')[0]).toEqual({
      pageNumber: 3,
      label: '1 of 10',
    });
  });

  it('follows the starting number too', () => {
    const plan = planPageNumbers(3, options({ startAt: 5 }));

    expect(getPageNumberTotal(plan)).toBe(7);
    expect(getPageNumberLabel(plan, 'page-number-of', 3)).toBe('Page 7 of 7');
  });

  it('has no total, and no label, when nothing is numbered', () => {
    expect(getPageNumberTotal([])).toBe(0);
    expect(getPageNumberLabel([], 'number', 1)).toBeUndefined();
    expect(getPageNumberLabel(planPageNumbers(3, options({ skip: 2 })), 'number', 1)).toBeUndefined();
  });
});

describe('the numbers a field may hold', () => {
  it('keeps every setting inside what the Gizlet will draw', () => {
    expect(clampPageNumberFontSize(0)).toBe(minimumPageNumberFontSize);
    expect(clampPageNumberFontSize(999)).toBe(maximumPageNumberFontSize);
    expect(clampPageNumberFontSize(11.6)).toBe(12);
    expect(clampPageNumberMargin(0)).toBe(minimumPageNumberMargin);
    expect(clampPageNumberMargin(1000)).toBe(maximumPageNumberMargin);
    expect(clampPageNumberStart(0)).toBe(1);
    expect(clampPageNumberStart(Number.NaN)).toBe(1);
  });

  it('cannot skip more pages than the document has', () => {
    expect(clampPageNumberSkip(50, 4)).toBe(4);
    expect(clampPageNumberSkip(-3, 4)).toBe(0);
  });
});

describe('refusals', () => {
  it('takes one PDF and says why anything else is not one', () => {
    expect(validatePageNumbersSelection([])).toMatch(/Choose a PDF/);
    expect(
      validatePageNumbersSelection([
        { name: 'a.pdf', type: 'application/pdf' },
        { name: 'b.pdf', type: 'application/pdf' },
      ]),
    ).toMatch(/one PDF at a time/);
    expect(validatePageNumbersSelection([{ name: 'notes.txt', type: 'text/plain' }])).toMatch(
      /is not a PDF/,
    );
    expect(
      validatePageNumbersSelection([{ name: 'report.pdf', type: 'application/pdf' }]),
    ).toBeUndefined();
  });

  it('keeps the page ceiling the reader keeps', () => {
    expect(validatePageNumbersPageCount(0)).toMatch(/no pages/);
    expect(validatePageNumbersPageCount(maximumPageNumberPdfPages + 1)).toMatch(
      new RegExp(maximumPageNumberPdfPages.toLocaleString()),
    );
    expect(validatePageNumbersPageCount(10)).toBeUndefined();
    expect(isLargePageNumberDocument(largePageNumberPdfPages)).toBe(true);
    expect(isLargePageNumberDocument(2)).toBe(false);
  });

  it('says which of the two ways of naming nothing was taken', () => {
    const skipped = planPageNumbers(3, options({ skip: 3 }));
    const outside = planPageNumbers(6, options({ skip: 4, pages: '1-3' }));

    expect(validatePageNumberPlan(skipped, 3, options({ skip: 3 }))).toMatch(/Every page is skipped/);
    expect(validatePageNumberPlan(outside, 6, options({ skip: 4, pages: '1-3' }))).toMatch(
      /inside the range and past the skipped/,
    );
    expect(validatePageNumberPlan([], 4, options({ pages: 'nonsense' }))).toMatch(/numbers or ranges/);
    expect(
      validatePageNumberPlan(planPageNumbers(4, options()), 4, options()),
    ).toBeUndefined();
  });

  it('words a document that will not open in its own terms', () => {
    expect(getPageNumbersOpenErrorMessage('PasswordException')).toMatch(/password/);
    expect(getPageNumbersOpenErrorMessage('InvalidPDFException')).toMatch(/not a PDF/);
    expect(getPageNumbersOpenErrorMessage(undefined)).toMatch(/could not be opened/);
  });
});

describe('where a number lands', () => {
  const a4 = { width: 595, height: 842 };
  const label = { width: 20, height: 10 };

  it('sits a margin in from the edge it was sent to', () => {
    expect(getPageNumberAnchor(a4, label, { position: 'bottom-left', margin: 36, pageRotation: 0 })).toEqual({
      x: 36,
      y: 36,
    });
    expect(getPageNumberAnchor(a4, label, { position: 'bottom-right', margin: 36, pageRotation: 0 })).toEqual({
      x: 595 - 36 - 20,
      y: 36,
    });
    expect(getPageNumberAnchor(a4, label, { position: 'top', margin: 36, pageRotation: 0 })).toEqual({
      x: (595 - 20) / 2,
      y: 842 - 36 - 10,
    });
  });

  it('puts a number on a quarter-turned page where it can be read', () => {
    // The page is displayed sideways, so the visible bottom-left corner is not
    // the page's own: the anchor has to move with it.
    const turned = getPageNumberAnchor(a4, label, {
      position: 'bottom-left',
      margin: 36,
      pageRotation: 90,
    });

    expect(turned).toEqual({ x: 595 - 36, y: 36 });
    expect(turned).not.toEqual(
      getPageNumberAnchor(a4, label, { position: 'bottom-left', margin: 36, pageRotation: 0 }),
    );
  });

  it('places the preview as a fraction of the visible page, counting down', () => {
    const bottom = getPageNumberPreviewPlacement(a4, {
      position: 'bottom',
      margin: 36,
      pageRotation: 0,
    });

    expect(bottom.left).toBe(0.5);
    expect(bottom.top).toBeCloseTo(1 - 36 / 842, 5);

    const topLeft = getPageNumberPreviewPlacement(a4, {
      position: 'top-left',
      margin: 36,
      pageRotation: 0,
    });

    expect(topLeft.left).toBeCloseTo(36 / 595, 5);
    expect(topLeft.top).toBeCloseTo(36 / 842, 5);
  });

  it('uses the same default position and format the workspace opens on', () => {
    expect(defaultPageNumberPosition).toBe('bottom');
    expect(defaultPageNumberFormat).toBe('number');
  });
});

describe('what the panel says', () => {
  it('counts what will be numbered and what is being left alone', () => {
    expect(describePageNumbering(planPageNumbers(4, options()), 4)).toBe('4 pages numbered.');
    expect(describePageNumbering(planPageNumbers(4, options({ skip: 1 })), 4)).toBe(
      '3 pages numbered · 1 left alone.',
    );
    expect(describePageNumbering([], 4)).toBe('No pages numbered.');
  });

  it('names the file for what happened to it', () => {
    expect(getNumberedPdfFilename('report.pdf')).toBe('report-numbered.pdf');
    expect(getNumberedPdfFilename('a.b.pdf')).toBe('a.b-numbered.pdf');
    expect(getNumberedPdfFilename('')).toBe('document-numbered.pdf');
  });
});
