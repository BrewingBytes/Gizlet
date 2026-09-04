import { describePdfPageCount } from './jpg-to-pdf';
import { isSupportedPdfFile, maximumPdfViewerPages } from './pdf-viewer';

/**
 * Deterministic logic for the Merge PDF Gizlet: which files it accepts, how
 * many documents and pages it will join, when there is enough to merge at all,
 * what the finished file is called, and what to say when one of the chosen
 * documents cannot be read.
 *
 * Nothing here touches pdf-lib. The adapter in `src/scripts/pdf-generation.ts`
 * owns the library; this module owns every decision about it, including how a
 * refusal is worded, so those can be tested without a document.
 */

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/** A chosen document, once its page count is known. */
export interface MergeDocument {
  readonly pageCount: number;
}

/** Merging is joining, so one document is not yet a merge. */
export const minimumMergeDocuments = 2;

/**
 * How many documents one merge may take. Reordering by hand stops being a
 * usable way to arrange a document somewhere around here, and a visitor with
 * more than twenty files to join has a different problem from this Gizlet.
 */
export const maximumMergeDocuments = 20;

/**
 * The memory guard, in pages of the finished document.
 *
 * pdf-lib holds every source document and the merged one in memory at once, so
 * the ceiling is a real one rather than a policy. It is set to the number of
 * pages the PDF Viewer will open, so a document this Gizlet produces can always
 * be read in the Gizlet that sits downstream of it.
 */
export const maximumMergedPages = maximumPdfViewerPages;

/** Above this the Gizlet says it is joining a big document before it starts. */
export const largeMergedPages = 50;

/** Why one of the chosen documents cannot contribute its pages. */
export type PdfMergeFailure = 'encrypted' | 'empty' | 'unreadable';

/**
 * Checks a whole selection before any of it is read.
 *
 * The unreadable files are named rather than counted, because a visitor who
 * dropped a folder needs to know which file to take out.
 */
export function validateMergeSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) {
    return 'Choose the PDFs you want to merge.';
  }

  const unsupported = files.filter((file) => !isSupportedPdfFile(file));

  if (unsupported.length > 0) {
    const named = unsupported.slice(0, 3).map((file) => file.name).join(', ');
    const remainder = unsupported.length - 3;

    return `${remainder > 0 ? `${named}, and ${remainder} more` : named} ${
      unsupported.length === 1 ? 'is not a PDF' : 'are not PDFs'
    }. Choose files that end in .pdf.`;
  }

  if (files.length > maximumMergeDocuments) {
    return `One merge joins up to ${maximumMergeDocuments} PDFs here, and you chose ${files.length}. Merge them in a couple of passes.`;
  }

  return undefined;
}

/** Whether there is anything to join yet. */
export function canMergeDocuments(documentCount: number): boolean {
  return documentCount >= minimumMergeDocuments;
}

/**
 * What to tell a visitor who has chosen files but cannot merge them yet. The
 * button is disabled at the same moment, so this says why rather than leaving
 * a dead control on the page.
 */
export function getMergeReadinessMessage(documentCount: number): string | undefined {
  if (documentCount === 0) return undefined;

  return canMergeDocuments(documentCount)
    ? undefined
    : 'One PDF is not a merge. Add another one to join it to.';
}

/** The pages the finished document would hold. */
export function getMergedPageTotal(documents: readonly MergeDocument[]): number {
  return documents.reduce((total, document) => total + document.pageCount, 0);
}

/** Checked once every chosen document has reported its page count. */
export function validateMergedPageCount(pageCount: number): string | undefined {
  if (pageCount > maximumMergedPages) {
    return `A merged document holds up to ${maximumMergedPages.toLocaleString()} pages here, and these come to ${pageCount.toLocaleString()}. Leave one out, or merge them in a couple of passes.`;
  }

  return undefined;
}

/** Above this the merge reports its progress rather than looking stalled. */
export function isLargeMergeWorkload(documents: readonly MergeDocument[]): boolean {
  return getMergedPageTotal(documents) >= largeMergedPages;
}

/**
 * Names the merged file after the document it starts with, so a visitor can
 * tell one merge from the next in a downloads folder.
 */
export function getMergedPdfFilename(firstName: string): string {
  const basename = firstName.replace(/\.[^.]+$/, '') || 'documents';

  return `${basename}-merged.pdf`;
}

/** "2 PDFs" / "12 PDFs", so the count and its noun cannot disagree. */
export function describeMergeDocumentCount(documentCount: number): string {
  return `${documentCount} ${documentCount === 1 ? 'PDF' : 'PDFs'}`;
}

/** "3 PDFs · 12 pages", the line the result panel shows. */
export function describeMergedDocument(documents: readonly MergeDocument[]): string {
  return `${describeMergeDocumentCount(documents.length)} · ${describePdfPageCount(getMergedPageTotal(documents))}`;
}

/**
 * Turns a document that cannot be merged into something the visitor can act on.
 *
 * The file is named in every case: a merge has several inputs, so "this PDF
 * could not be read" would leave the visitor guessing which one to replace.
 */
export function getPdfMergeErrorMessage(reason: PdfMergeFailure, fileName: string): string {
  if (reason === 'encrypted') {
    return `${fileName} is password-protected, so its pages cannot be copied. Open it in an app that can ask for the password, then save an unlocked copy and merge that.`;
  }

  if (reason === 'empty') {
    return `${fileName} has no pages, so there is nothing of it to merge.`;
  }

  return `${fileName} could not be read as a PDF. It may be damaged, or renamed from another format.`;
}
