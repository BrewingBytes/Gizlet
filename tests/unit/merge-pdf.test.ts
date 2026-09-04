import { describe, expect, it } from 'vitest';

import {
  canMergeDocuments,
  describeMergeDocumentCount,
  describeMergedDocument,
  getMergeReadinessMessage,
  getMergedPageTotal,
  getMergedPdfFilename,
  getPdfMergeErrorMessage,
  isLargeMergeWorkload,
  largeMergedPages,
  maximumMergeDocuments,
  maximumMergedPages,
  minimumMergeDocuments,
  validateMergeSelection,
  validateMergedPageCount,
} from '../../src/data/merge-pdf';
import { maximumPdfViewerPages } from '../../src/data/pdf-viewer';

const pdf = (name: string) => ({ name, type: 'application/pdf' });
const pages = (pageCount: number) => ({ pageCount });

describe('validateMergeSelection', () => {
  it('accepts a selection of PDFs', () => {
    expect(validateMergeSelection([pdf('statement.pdf'), pdf('receipt.pdf')])).toBeUndefined();
  });

  it('asks for files when there are none', () => {
    expect(validateMergeSelection([])).toBe('Choose the PDFs you want to merge.');
  });

  it('names the file that is not a PDF rather than counting it', () => {
    expect(validateMergeSelection([pdf('statement.pdf'), { name: 'photo.jpg', type: 'image/jpeg' }]))
      .toBe('photo.jpg is not a PDF. Choose files that end in .pdf.');
  });

  it('names the first few and counts the rest when several are not PDFs', () => {
    const problem = validateMergeSelection([
      { name: 'a.jpg', type: 'image/jpeg' },
      { name: 'b.png', type: 'image/png' },
      { name: 'c.txt', type: 'text/plain' },
      { name: 'd.zip', type: 'application/zip' },
    ]);

    expect(problem).toBe('a.jpg, b.png, c.txt, and 1 more are not PDFs. Choose files that end in .pdf.');
  });

  /**
   * A file is taken on its extension when the browser reports no type, which
   * is what lets a renamed file through. Nothing here can tell: only parsing
   * it can, so the refusal belongs to the merge rather than to the selection.
   */
  it('accepts a file that only claims to be a PDF by its name', () => {
    expect(validateMergeSelection([pdf('statement.pdf'), { name: '.pdf', type: '' }])).toBeUndefined();
  });

  it('refuses more documents than one merge takes', () => {
    const chosen = Array.from({ length: maximumMergeDocuments + 1 }, (_, index) =>
      pdf(`part-${index}.pdf`),
    );

    expect(validateMergeSelection(chosen)).toBe(
      `One merge joins up to ${maximumMergeDocuments} PDFs here, and you chose ${maximumMergeDocuments + 1}. Merge them in a couple of passes.`,
    );
    expect(validateMergeSelection(chosen.slice(0, maximumMergeDocuments))).toBeUndefined();
  });
});

describe('having enough to merge', () => {
  it('treats joining as needing two documents', () => {
    expect(minimumMergeDocuments).toBe(2);
    expect(canMergeDocuments(0)).toBe(false);
    expect(canMergeDocuments(1)).toBe(false);
    expect(canMergeDocuments(2)).toBe(true);
    expect(canMergeDocuments(maximumMergeDocuments)).toBe(true);
  });

  it('says why a single document cannot be merged, and stays quiet otherwise', () => {
    expect(getMergeReadinessMessage(1)).toBe('One PDF is not a merge. Add another one to join it to.');
    // Nothing chosen yet is not a problem to report: the workspace is empty.
    expect(getMergeReadinessMessage(0)).toBeUndefined();
    expect(getMergeReadinessMessage(2)).toBeUndefined();
  });
});

describe('the page guard', () => {
  it('counts the pages the finished document would hold', () => {
    expect(getMergedPageTotal([])).toBe(0);
    expect(getMergedPageTotal([pages(3), pages(1), pages(12)])).toBe(16);
  });

  it('caps a merged document at the pages the viewer will open', () => {
    expect(maximumMergedPages).toBe(maximumPdfViewerPages);
    expect(validateMergedPageCount(maximumMergedPages)).toBeUndefined();
    expect(validateMergedPageCount(maximumMergedPages + 1)).toBe(
      `A merged document holds up to ${maximumMergedPages.toLocaleString()} pages here, and these come to ${(maximumMergedPages + 1).toLocaleString()}. Leave one out, or merge them in a couple of passes.`,
    );
  });

  it('refuses a combined page count no single document would have reached', () => {
    const half = Math.ceil(maximumMergedPages / 2) + 1;

    expect(validateMergedPageCount(half)).toBeUndefined();
    expect(validateMergedPageCount(getMergedPageTotal([pages(half), pages(half)]))).toBeDefined();
  });

  it('calls a merge large by its pages rather than by its documents', () => {
    expect(isLargeMergeWorkload([pages(largeMergedPages - 1)])).toBe(false);
    expect(isLargeMergeWorkload([pages(largeMergedPages)])).toBe(true);
    expect(isLargeMergeWorkload([pages(largeMergedPages - 1), pages(1)])).toBe(true);
  });
});

describe('what the visitor is told about the result', () => {
  it('keeps a document count and its noun in agreement', () => {
    expect(describeMergeDocumentCount(1)).toBe('1 PDF');
    expect(describeMergeDocumentCount(3)).toBe('3 PDFs');
  });

  it('describes the merged document by what went into it', () => {
    expect(describeMergedDocument([pages(2), pages(1)])).toBe('2 PDFs · 3 pages');
    expect(describeMergedDocument([pages(1)])).toBe('1 PDF · 1 page');
  });

  it('names the merged file after the document it starts with', () => {
    expect(getMergedPdfFilename('statement.pdf')).toBe('statement-merged.pdf');
    expect(getMergedPdfFilename('Statement 2026.PDF')).toBe('Statement 2026-merged.pdf');
    expect(getMergedPdfFilename('scan')).toBe('scan-merged.pdf');
    // A file called nothing but its extension leaves no name to build on.
    expect(getMergedPdfFilename('.pdf')).toBe('documents-merged.pdf');
  });
});

describe('getPdfMergeErrorMessage', () => {
  it('sends an encrypted document somewhere it can be unlocked', () => {
    const message = getPdfMergeErrorMessage('encrypted', 'payslip.pdf');

    expect(message).toContain('payslip.pdf');
    expect(message).toContain('password-protected');
    expect(message).toContain('save an unlocked copy');
  });

  it('explains a document that cannot be read as a PDF at all', () => {
    const message = getPdfMergeErrorMessage('unreadable', 'not-really.pdf');

    expect(message).toContain('not-really.pdf');
    expect(message).toContain('could not be read as a PDF');
    expect(message).toContain('renamed from another format');
  });

  it('explains a PDF with no pages in it', () => {
    expect(getPdfMergeErrorMessage('empty', 'blank.pdf')).toBe(
      'blank.pdf has no pages, so there is nothing of it to merge.',
    );
  });

  /**
   * A merge has several inputs, so a message that did not name the file would
   * leave the visitor guessing which of them to replace.
   */
  it('names the file in every refusal', () => {
    for (const reason of ['encrypted', 'empty', 'unreadable'] as const) {
      expect(getPdfMergeErrorMessage(reason, 'chosen.pdf'), reason).toContain('chosen.pdf');
    }
  });
});
