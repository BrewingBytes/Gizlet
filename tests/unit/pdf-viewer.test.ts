import { describe, expect, it } from 'vitest';

import {
  canZoomPdf,
  clampPdfPage,
  defaultPdfZoom,
  describePdfPagePosition,
  describePdfZoom,
  getNextPdfZoom,
  getPdfFitScale,
  getPdfOpenErrorMessage,
  getPdfPageErrorMessage,
  getPdfRenderScale,
  isLargePdfViewerDocument,
  isPdfZoom,
  isSupportedPdfFile,
  largePdfViewerPages,
  maximumPdfFitScale,
  maximumPdfRenderScale,
  maximumPdfViewerPages,
  parsePdfPageInput,
  pdfZoomLevels,
  validatePdfFileSelection,
  validatePdfPageCount,
  type PdfZoom,
} from '../../src/data/pdf-viewer';

const pdf = { name: 'statement.pdf', type: 'application/pdf' };

describe('isSupportedPdfFile', () => {
  it('accepts a PDF by type or by extension', () => {
    expect(isSupportedPdfFile(pdf)).toBe(true);
    expect(isSupportedPdfFile({ name: 'scan.PDF', type: '' })).toBe(true);
  });

  it('rejects anything else, including a PDF-ish name', () => {
    expect(isSupportedPdfFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
    expect(isSupportedPdfFile({ name: 'holiday.jpg', type: 'image/jpeg' })).toBe(false);
    expect(isSupportedPdfFile({ name: 'pdf-notes.doc', type: '' })).toBe(false);
  });
});

describe('validatePdfFileSelection', () => {
  it('asks for a PDF when nothing was chosen', () => {
    expect(validatePdfFileSelection([])).toBe('Choose a PDF to open.');
  });

  it('accepts exactly one PDF', () => {
    expect(validatePdfFileSelection([pdf])).toBeUndefined();
  });

  it('opens one document at a time rather than silently using the first', () => {
    expect(validatePdfFileSelection([pdf, pdf])).toContain('one PDF at a time');
  });

  it('names a file that is not a PDF', () => {
    expect(validatePdfFileSelection([{ name: 'notes.txt', type: 'text/plain' }])).toBe(
      'notes.txt is not a PDF. Choose a file that ends in .pdf.',
    );
  });
});

describe('validatePdfPageCount', () => {
  it('accepts a document within the cap', () => {
    expect(validatePdfPageCount(1)).toBeUndefined();
    expect(validatePdfPageCount(maximumPdfViewerPages)).toBeUndefined();
  });

  it('refuses a document with no pages to show', () => {
    expect(validatePdfPageCount(0)).toContain('no pages');
    expect(validatePdfPageCount(-3)).toContain('no pages');
    expect(validatePdfPageCount(1.5)).toContain('no pages');
  });

  it('refuses one past the cap, and says both numbers', () => {
    const problem = validatePdfPageCount(maximumPdfViewerPages + 1);

    expect(problem).toContain(maximumPdfViewerPages.toLocaleString());
    expect(problem).toContain((maximumPdfViewerPages + 1).toLocaleString());
  });
});

describe('the large-document threshold', () => {
  it('flags a document once it reaches the threshold', () => {
    expect(isLargePdfViewerDocument(largePdfViewerPages - 1)).toBe(false);
    expect(isLargePdfViewerDocument(largePdfViewerPages)).toBe(true);
  });
});

describe('page navigation', () => {
  it('keeps a page inside the document', () => {
    expect(clampPdfPage(0, 10)).toBe(1);
    expect(clampPdfPage(5, 10)).toBe(5);
    expect(clampPdfPage(11, 10)).toBe(10);
    expect(clampPdfPage(3.6, 10)).toBe(4);
  });

  it('falls back to the first page rather than propagating a bad number', () => {
    expect(clampPdfPage(Number.NaN, 10)).toBe(1);
    expect(clampPdfPage(Number.POSITIVE_INFINITY, 10)).toBe(1);
    expect(clampPdfPage(5, 0)).toBe(1);
  });

  it('reads a typed page number only when it is a page in this document', () => {
    expect(parsePdfPageInput('7', 12)).toBe(7);
    expect(parsePdfPageInput(' 7 ', 12)).toBe(7);
    expect(parsePdfPageInput('13', 12)).toBeUndefined();
    expect(parsePdfPageInput('0', 12)).toBeUndefined();
  });

  it('refuses a malformed page rather than coercing it', () => {
    expect(parsePdfPageInput('', 12)).toBeUndefined();
    expect(parsePdfPageInput('3.5', 12)).toBeUndefined();
    expect(parsePdfPageInput('-3', 12)).toBeUndefined();
    expect(parsePdfPageInput('+3', 12)).toBeUndefined();
    expect(parsePdfPageInput('3a', 12)).toBeUndefined();
    expect(parsePdfPageInput('last', 12)).toBeUndefined();
  });

  it('keeps the page number and its total in agreement', () => {
    expect(describePdfPagePosition(3, 12)).toBe('Page 3 of 12');
  });
});

describe('zoom', () => {
  it('starts at a level it actually offers', () => {
    expect(isPdfZoom(defaultPdfZoom)).toBe(true);
    expect(isPdfZoom(1.1)).toBe(false);
  });

  it('steps through the levels in order', () => {
    expect(getNextPdfZoom(1, 'in')).toBe(1.25);
    expect(getNextPdfZoom(1, 'out')).toBe(0.75);
  });

  it('stops at each end rather than wrapping round', () => {
    const smallest = pdfZoomLevels[0];
    const largest = pdfZoomLevels[pdfZoomLevels.length - 1];

    expect(getNextPdfZoom(smallest, 'out')).toBe(smallest);
    expect(getNextPdfZoom(largest, 'in')).toBe(largest);
    expect(canZoomPdf(smallest, 'out')).toBe(false);
    expect(canZoomPdf(largest, 'in')).toBe(false);
    expect(canZoomPdf(1, 'in')).toBe(true);
  });

  it('walks the whole range in both directions without getting stuck', () => {
    let zoom: PdfZoom = pdfZoomLevels[0];
    for (let step = 0; step < pdfZoomLevels.length; step += 1) zoom = getNextPdfZoom(zoom, 'in');
    expect(zoom).toBe(pdfZoomLevels[pdfZoomLevels.length - 1]);

    for (let step = 0; step < pdfZoomLevels.length; step += 1) zoom = getNextPdfZoom(zoom, 'out');
    expect(zoom).toBe(pdfZoomLevels[0]);
  });

  it('reads zoom as a percentage', () => {
    expect(describePdfZoom(0.5)).toBe('50%');
    expect(describePdfZoom(1)).toBe('100%');
    expect(describePdfZoom(3)).toBe('300%');
  });
});

describe('render scale', () => {
  it('shrinks a page that is wider than the space available', () => {
    expect(getPdfFitScale(1000, 500)).toBe(0.5);
  });

  it('fills a column wider than the page, because the page is redrawn not stretched', () => {
    expect(getPdfFitScale(400, 800)).toBe(2);
    expect(getPdfFitScale(595, 1000)).toBeCloseTo(1.68, 2);
  });

  it('caps how far it will enlarge, so a wide monitor cannot ask for a vast canvas', () => {
    expect(getPdfFitScale(100, 100_000)).toBe(maximumPdfFitScale);
  });

  it('survives a container that has not been measured yet', () => {
    expect(getPdfFitScale(0, 500)).toBe(1);
    expect(getPdfFitScale(500, 0)).toBe(1);
  });

  it('applies zoom on top of the fitted scale', () => {
    expect(getPdfRenderScale(1000, 500, 2)).toBe(1);
    expect(getPdfRenderScale(400, 800, 1)).toBe(2);
    expect(getPdfRenderScale(1000, 500, 0.5)).toBe(0.25);
  });

  it('caps the scale a page is ever drawn at, whatever the zoom asks for', () => {
    expect(getPdfRenderScale(400, 800, 3)).toBe(maximumPdfRenderScale);
    expect(getPdfRenderScale(100, 100_000, 3)).toBe(maximumPdfRenderScale);
  });
});

describe('failure wording', () => {
  it('explains a password-protected document and what to do about it', () => {
    const message = getPdfOpenErrorMessage('PasswordException');

    expect(message).toContain('password-protected');
    expect(message).toContain('unlocked copy');
  });

  it('explains a file that is not really a PDF', () => {
    expect(getPdfOpenErrorMessage('InvalidPDFException')).toContain('not a PDF');
  });

  it('explains a file that could not be read back off the device', () => {
    expect(getPdfOpenErrorMessage('MissingPDFException')).toContain('could not be read');
  });

  it('still says something useful for a failure it does not recognise', () => {
    expect(getPdfOpenErrorMessage('SomethingElse')).toBe('This PDF could not be opened.');
    expect(getPdfOpenErrorMessage(undefined)).toBe('This PDF could not be opened.');
  });

  it('names the page that failed and says the rest is still readable', () => {
    const message = getPdfPageErrorMessage(4);

    expect(message).toContain('Page 4');
    expect(message).toContain('rest of the document');
  });
});
