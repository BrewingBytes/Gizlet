import { describe, expect, it } from 'vitest';

import { maximumPdfViewerPages } from '../../src/data/pdf-viewer';
import {
  defaultPdfSplitMode,
  describePdfPageRange,
  describeSplitPdfCount,
  describeSplitPdfPlan,
  getPdfPageRangeErrorMessage,
  getPdfPageRangeLength,
  getPdfSplitErrorMessage,
  getPdfSplitModeLabel,
  getPdfSplitModeOptions,
  getPdfSplitRanges,
  getSinglePageRanges,
  getSplitPdfArchiveName,
  getSplitPdfFilename,
  getSplitPdfPageTotal,
  getSplitPdfPartErrorMessage,
  getSplitPdfOpenErrorMessage,
  isLargeSplitWorkload,
  isPdfSplitMode,
  largeSplitPdfOutputs,
  maximumSplitPdfPages,
  parsePdfPageRanges,
  pdfSplitModeNames,
  usesNamedRanges,
  validateSplitPdfPageCount,
  validateSplitPdfSelection,
} from '../../src/data/split-pdf';

const pdf = (name: string) => ({ name, type: 'application/pdf' });

describe('validateSplitPdfSelection', () => {
  it('accepts one PDF', () => {
    expect(validateSplitPdfSelection([pdf('statement.pdf')])).toBeUndefined();
    expect(validateSplitPdfSelection([{ name: 'scan.PDF', type: '' }])).toBeUndefined();
  });

  it('asks for a file when nothing was chosen', () => {
    expect(validateSplitPdfSelection([])).toBe('Choose a PDF to split.');
  });

  it('splits one document at a time', () => {
    expect(validateSplitPdfSelection([pdf('one.pdf'), pdf('two.pdf')])).toBe(
      'This Gizlet splits one PDF at a time. Choose a single file.',
    );
  });

  it('names a file that is not a PDF', () => {
    expect(validateSplitPdfSelection([{ name: 'notes.txt', type: 'text/plain' }])).toBe(
      'notes.txt is not a PDF. Choose a file that ends in .pdf.',
    );
  });
});

describe('validateSplitPdfPageCount', () => {
  it('accepts a document with pages to split', () => {
    expect(validateSplitPdfPageCount(2)).toBeUndefined();
    expect(validateSplitPdfPageCount(maximumSplitPdfPages)).toBeUndefined();
  });

  it('refuses a document with no pages', () => {
    expect(validateSplitPdfPageCount(0)).toBe('This PDF has no pages, so there is nothing to split.');
    expect(validateSplitPdfPageCount(1.5)).toBe('This PDF has no pages, so there is nothing to split.');
  });

  it('refuses a single page, which has nothing to split into', () => {
    expect(validateSplitPdfPageCount(1)).toBe(
      'This PDF has one page, so there is nothing to split it into.',
    );
  });

  it('refuses a document longer than it will take apart in one pass', () => {
    expect(validateSplitPdfPageCount(maximumSplitPdfPages + 1)).toContain(
      `up to ${maximumSplitPdfPages.toLocaleString()} pages`,
    );
  });

  it('bounds the source by what the PDF Viewer will open, so every part can be read', () => {
    expect(maximumSplitPdfPages).toBe(maximumPdfViewerPages);
  });
});

describe('parsePdfPageRanges', () => {
  it('reads a single page as a range of one', () => {
    expect(parsePdfPageRanges('5', 10)).toEqual([{ first: 5, last: 5 }]);
  });

  it('reads a range', () => {
    expect(parsePdfPageRanges('1-3', 10)).toEqual([{ first: 1, last: 3 }]);
  });

  it('reads every page of the document as one range', () => {
    expect(parsePdfPageRanges('1-10', 10)).toEqual([{ first: 1, last: 10 }]);
  });

  it('keeps each range whole and in the order it was written', () => {
    // Not a flattened set of pages: each entry becomes one document, so
    // `1-3, 5` is two PDFs and the order names their files.
    expect(parsePdfPageRanges('1-3, 5, 8-10', 10)).toEqual([
      { first: 1, last: 3 },
      { first: 5, last: 5 },
      { first: 8, last: 10 },
    ]);
    expect(parsePdfPageRanges('5, 1-3', 10)).toEqual([
      { first: 5, last: 5 },
      { first: 1, last: 3 },
    ]);
  });

  it('tolerates the spacing around a separator', () => {
    expect(parsePdfPageRanges('  1 - 3 ,4 ', 10)).toEqual([
      { first: 1, last: 3 },
      { first: 4, last: 4 },
    ]);
  });

  it('allows two ranges to overlap, which is two documents sharing a page', () => {
    expect(parsePdfPageRanges('1-3, 2-4', 10)).toEqual([
      { first: 1, last: 3 },
      { first: 2, last: 4 },
    ]);
  });

  it('refuses an empty field, which is not a shorthand here', () => {
    expect(parsePdfPageRanges('', 10)).toBeUndefined();
    expect(parsePdfPageRanges('   ', 10)).toBeUndefined();
  });

  it('refuses an invalid range string', () => {
    expect(parsePdfPageRanges('one to three', 10)).toBeUndefined();
    expect(parsePdfPageRanges('1..3', 10)).toBeUndefined();
    expect(parsePdfPageRanges('1-3;5', 10)).toBeUndefined();
    expect(parsePdfPageRanges('1-3,', 10)).toBeUndefined();
    expect(parsePdfPageRanges('-3', 10)).toBeUndefined();
    expect(parsePdfPageRanges('1-2-3', 10)).toBeUndefined();
    expect(parsePdfPageRanges('all', 10)).toBeUndefined();
  });

  it('refuses a range beyond the last page', () => {
    expect(parsePdfPageRanges('11', 10)).toBeUndefined();
    expect(parsePdfPageRanges('8-11', 10)).toBeUndefined();
    expect(parsePdfPageRanges('1-3, 12', 10)).toBeUndefined();
  });

  it('refuses a reversed range rather than turning it around', () => {
    expect(parsePdfPageRanges('3-1', 10)).toBeUndefined();
    expect(parsePdfPageRanges('1-3, 9-8', 10)).toBeUndefined();
  });

  it('refuses page zero', () => {
    expect(parsePdfPageRanges('0', 10)).toBeUndefined();
    expect(parsePdfPageRanges('0-3', 10)).toBeUndefined();
  });

  it('refuses the same range written twice, which would name one file twice', () => {
    expect(parsePdfPageRanges('1-3, 1-3', 10)).toBeUndefined();
    expect(parsePdfPageRanges('5, 5', 10)).toBeUndefined();
    // A single page and a range of one over it are the same document.
    expect(parsePdfPageRanges('5, 5-5', 10)).toBeUndefined();
  });

  it('refuses anything at all when the document has no pages', () => {
    expect(parsePdfPageRanges('1', 0)).toBeUndefined();
  });
});

describe('getSinglePageRanges', () => {
  it('gives every page a range of its own', () => {
    expect(getSinglePageRanges(3)).toEqual([
      { first: 1, last: 1 },
      { first: 2, last: 2 },
      { first: 3, last: 3 },
    ]);
  });

  it('gives nothing for a document with no pages', () => {
    expect(getSinglePageRanges(0)).toEqual([]);
    expect(getSinglePageRanges(-2)).toEqual([]);
  });
});

describe('getPdfSplitRanges', () => {
  it('reads the field in the mode that has one', () => {
    expect(getPdfSplitRanges('ranges', '2-4', 10)).toEqual([{ first: 2, last: 4 }]);
    expect(getPdfSplitRanges('ranges', 'nonsense', 10)).toBeUndefined();
  });

  it('ignores the field in the mode that does not', () => {
    expect(getPdfSplitRanges('pages', '', 2)).toEqual([
      { first: 1, last: 1 },
      { first: 2, last: 2 },
    ]);
    expect(getPdfSplitRanges('pages', 'nonsense', 2)).toHaveLength(2);
  });

  it('has nothing to split when the document has no pages', () => {
    expect(getPdfSplitRanges('pages', '', 0)).toBeUndefined();
  });
});

describe('the split modes', () => {
  it('offers exactly the two ways of asking, ranges first', () => {
    expect(pdfSplitModeNames).toEqual(['ranges', 'pages']);
    expect(defaultPdfSplitMode).toBe('ranges');
    expect(getPdfSplitModeOptions()).toEqual([
      { value: 'ranges', label: 'Page ranges you name' },
      { value: 'pages', label: 'Every page separately' },
    ]);
    expect(getPdfSplitModeLabel('pages')).toBe('Every page separately');
  });

  it('reads a mode from a field rather than trusting it', () => {
    expect(isPdfSplitMode('ranges')).toBe(true);
    expect(isPdfSplitMode('halves')).toBe(false);
  });

  it('knows which mode the Pages field has a say over', () => {
    expect(usesNamedRanges('ranges')).toBe(true);
    expect(usesNamedRanges('pages')).toBe(false);
  });
});

describe('counting the pages a split writes', () => {
  it('measures one range', () => {
    expect(getPdfPageRangeLength({ first: 1, last: 3 })).toBe(3);
    expect(getPdfPageRangeLength({ first: 7, last: 7 })).toBe(1);
  });

  it('totals a whole plan, counting a shared page in both documents', () => {
    expect(getSplitPdfPageTotal([{ first: 1, last: 3 }, { first: 5, last: 5 }])).toBe(4);
    expect(getSplitPdfPageTotal([{ first: 1, last: 3 }, { first: 2, last: 4 }])).toBe(6);
    expect(getSplitPdfPageTotal([])).toBe(0);
  });

  it('reports its progress once the split is a long one', () => {
    expect(isLargeSplitWorkload(getSinglePageRanges(largeSplitPdfOutputs - 1))).toBe(false);
    expect(isLargeSplitWorkload(getSinglePageRanges(largeSplitPdfOutputs))).toBe(true);
  });
});

describe('getSplitPdfFilename', () => {
  it('names a single page for that page', () => {
    expect(getSplitPdfFilename('statement.pdf', { first: 5, last: 5 }, 9)).toBe(
      'statement-page-5.pdf',
    );
  });

  it('names a range for its ends', () => {
    expect(getSplitPdfFilename('statement.pdf', { first: 1, last: 3 }, 9)).toBe(
      'statement-pages-1-3.pdf',
    );
  });

  it('pads to the source page count, so the files sort into reading order', () => {
    expect(getSplitPdfFilename('report.pdf', { first: 2, last: 2 }, 120)).toBe(
      'report-page-002.pdf',
    );
    expect(getSplitPdfFilename('report.pdf', { first: 10, last: 12 }, 120)).toBe(
      'report-pages-010-012.pdf',
    );
  });

  it('falls back to a name when the document has none of its own', () => {
    expect(getSplitPdfFilename('.pdf', { first: 1, last: 1 }, 4)).toBe('document-page-1.pdf');
  });

  it('replaces the source extension rather than appending to it', () => {
    expect(getSplitPdfFilename('scan.PDF', { first: 1, last: 2 }, 5)).toBe('scan-pages-1-2.pdf');
  });
});

describe('getSplitPdfArchiveName', () => {
  it('names the archive after the document it came out of', () => {
    expect(getSplitPdfArchiveName('statement.pdf')).toBe('statement-split.zip');
    expect(getSplitPdfArchiveName('.pdf')).toBe('document-split.zip');
  });
});

describe('the lines the workspace shows', () => {
  it('describes a range as the visitor reads it', () => {
    expect(describePdfPageRange({ first: 5, last: 5 })).toBe('Page 5');
    expect(describePdfPageRange({ first: 1, last: 3 })).toBe('Pages 1-3');
  });

  it('keeps a count and its noun in agreement', () => {
    expect(describeSplitPdfCount(1)).toBe('1 PDF');
    expect(describeSplitPdfCount(3)).toBe('3 PDFs');
  });

  it('summarises a whole plan', () => {
    expect(describeSplitPdfPlan([{ first: 1, last: 3 }, { first: 5, last: 5 }])).toBe(
      '2 PDFs · 4 pages',
    );
    expect(describeSplitPdfPlan([{ first: 2, last: 2 }])).toBe('1 PDF · 1 page');
  });

  it('says what a field it could not read has to hold', () => {
    expect(getPdfPageRangeErrorMessage(12)).toBe(
      'Pages has to be ranges between 1 and 12, like 1-3, 5, each one written once.',
    );
  });
});

describe('getSplitPdfOpenErrorMessage', () => {
  it('tells a visitor with a password-protected PDF what to do about it', () => {
    const message = getSplitPdfOpenErrorMessage('PasswordException');

    expect(message).toContain('password-protected');
    expect(message).toContain('unlocked copy');
    expect(message).toContain('split');
  });

  it('tells a visitor with a corrupt PDF what is wrong with it', () => {
    const message = getSplitPdfOpenErrorMessage('InvalidPDFException');

    expect(message).toContain('not a PDF that can be read');
    expect(message).toContain('damaged');
  });

  it('points a file that would not read again at choosing it again', () => {
    expect(getSplitPdfOpenErrorMessage('MissingPDFException')).toContain('choosing it again');
  });

  it('still says something useful about a failure it does not recognise', () => {
    expect(getSplitPdfOpenErrorMessage(undefined)).toBe(
      'This PDF could not be opened, so there is nothing to split.',
    );
  });

  it('talks about splitting rather than borrowing another Gizlet’s sentence', () => {
    for (const name of ['PasswordException', 'InvalidPDFException', undefined]) {
      expect(getSplitPdfOpenErrorMessage(name)).toContain('split');
    }
  });
});

describe('getPdfSplitErrorMessage', () => {
  it('tells a visitor with a password-protected PDF what to do about it', () => {
    const message = getPdfSplitErrorMessage('encrypted');

    expect(message).toContain('password-protected');
    expect(message).toContain('unlocked copy');
  });

  it('tells a visitor with a corrupt PDF what is wrong with it', () => {
    const message = getPdfSplitErrorMessage('unreadable');

    expect(message).toContain('could not be read as a PDF');
    expect(message).toContain('damaged');
  });

  it('says a document with no pages has nothing to split', () => {
    expect(getPdfSplitErrorMessage('empty')).toBe(
      'This PDF has no pages, so there is nothing to split.',
    );
  });

  it('names no file, because a split has only one document to talk about', () => {
    for (const reason of ['encrypted', 'empty', 'unreadable'] as const) {
      expect(getPdfSplitErrorMessage(reason)).not.toContain('.pdf');
    }
  });
});

describe('getSplitPdfPartErrorMessage', () => {
  it('names the range that produced nothing, so the rest can still be split', () => {
    expect(getSplitPdfPartErrorMessage({ first: 4, last: 6 })).toContain('Pages 4-6');
    expect(getSplitPdfPartErrorMessage({ first: 4, last: 4 })).toContain('Page 4');
    expect(getSplitPdfPartErrorMessage({ first: 1, last: 2 })).toContain('the split was not made');
  });
});
