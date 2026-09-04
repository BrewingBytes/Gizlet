import { describePdfPageCount } from './jpg-to-pdf';
import type { SelectOption } from './pdf-to-jpg';
import { isSupportedPdfFile, maximumPdfViewerPages } from './pdf-viewer';

/**
 * Deterministic logic for the Split PDF Gizlet: which files it accepts, how a
 * page range is written and read, how many documents come out, what each one is
 * called, and what to say when the document cannot be taken apart.
 *
 * Nothing here touches pdf-lib. The adapter in `src/scripts/pdf-generation.ts`
 * owns the library; this module owns every decision about it, including how a
 * refusal is worded, so those can be tested without a document.
 */

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/**
 * A run of pages that becomes one document, inclusive at both ends. A single
 * page is a range whose ends are equal, so one shape covers both jobs the
 * Gizlet does and nothing downstream has to ask which it is looking at.
 */
export interface PdfPageRange {
  readonly first: number;
  readonly last: number;
}

/** How the visitor says which documents they want out. */
export type PdfSplitMode = 'ranges' | 'pages';

export const pdfSplitModeNames = ['ranges', 'pages'] as const satisfies readonly PdfSplitMode[];

export const defaultPdfSplitMode: PdfSplitMode = 'ranges';

export function isPdfSplitMode(value: string): value is PdfSplitMode {
  return pdfSplitModeNames.includes(value as PdfSplitMode);
}

const pdfSplitModeLabels: Record<PdfSplitMode, string> = {
  ranges: 'Page ranges you name',
  pages: 'Every page separately',
};

export function getPdfSplitModeLabel(mode: PdfSplitMode): string {
  return pdfSplitModeLabels[mode];
}

export function getPdfSplitModeOptions(): readonly SelectOption<PdfSplitMode>[] {
  return pdfSplitModeNames.map((mode) => ({ value: mode, label: pdfSplitModeLabels[mode] }));
}

/** Whether the mode is one the Pages field has any say over. */
export function usesNamedRanges(mode: PdfSplitMode): boolean {
  return mode === 'ranges';
}

/**
 * The memory guard, in pages of the document being split.
 *
 * pdf-lib holds the source document and every document it writes in memory at
 * once, but each output is a subset of the source rather than a new rendering,
 * so the ceiling is the number of pages the PDF Viewer will open: a document
 * this Gizlet can take apart is one the Gizlet downstream of it can read.
 */
export const maximumSplitPdfPages = maximumPdfViewerPages;

/** Above this the Gizlet reports its progress rather than looking stalled. */
export const largeSplitPdfOutputs = 20;

/** Why the document cannot be taken apart. */
export type PdfSplitFailure = 'encrypted' | 'empty' | 'unreadable';

/** The Gizlet splits one document at a time, so a selection is one PDF. */
export function validateSplitPdfSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) {
    return 'Choose a PDF to split.';
  }

  if (files.length > 1) {
    return 'This Gizlet splits one PDF at a time. Choose a single file.';
  }

  if (!isSupportedPdfFile(files[0])) {
    return `${files[0].name} is not a PDF. Choose a file that ends in .pdf.`;
  }

  return undefined;
}

/** Checked once the page count is known, which needs the document parsed. */
export function validateSplitPdfPageCount(pageCount: number): string | undefined {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return 'This PDF has no pages, so there is nothing to split.';
  }

  if (pageCount === 1) {
    return 'This PDF has one page, so there is nothing to split it into.';
  }

  if (pageCount > maximumSplitPdfPages) {
    return `This Gizlet splits documents of up to ${maximumSplitPdfPages.toLocaleString()} pages, and this PDF has ${pageCount.toLocaleString()}. Split it in a couple of passes.`;
  }

  return undefined;
}

/**
 * Reads a list of ranges such as `1-3, 5, 8-10`, keeping each one whole.
 *
 * This is deliberately not `parsePdfPageSelection` from `pdf-to-jpg`, which
 * answers a different question: converting cares only about the set of pages,
 * so it flattens `1-3` into three numbers and sorts them. Splitting cares about
 * the grouping and the order, because each range written here becomes one
 * document — `1-3, 5` is two PDFs, and swapping them names the files
 * differently.
 *
 * Anything that is not a run of pages in this document returns undefined, so
 * the field can refuse rather than write a set nobody asked for: a range that
 * runs backwards, a page past the end, a stray character, or an empty field,
 * which in this Gizlet is not a shorthand for anything.
 *
 * A range repeated exactly is refused too. It would write the same pages to the
 * same file name twice, which is a typed comma rather than an intention.
 */
export function parsePdfPageRanges(
  value: string,
  pageCount: number,
): readonly PdfPageRange[] | undefined {
  const trimmed = value.trim();

  if (trimmed === '' || pageCount < 1) return undefined;

  const ranges: PdfPageRange[] = [];
  const seen = new Set<string>();

  for (const part of trimmed.split(',')) {
    const item = part.trim();
    const match = /^(\d{1,4})(?:\s*-\s*(\d{1,4}))?$/.exec(item);

    if (!match) return undefined;

    const first = Number(match[1]);
    const last = match[2] === undefined ? first : Number(match[2]);

    if (first < 1 || last > pageCount || first > last) return undefined;

    const key = `${first}-${last}`;

    if (seen.has(key)) return undefined;

    seen.add(key);
    ranges.push({ first, last });
  }

  return ranges.length > 0 ? ranges : undefined;
}

/** Every page as a document of its own, which is the other way to split. */
export function getSinglePageRanges(pageCount: number): readonly PdfPageRange[] {
  return Array.from({ length: Math.max(pageCount, 0) }, (_, index) => ({
    first: index + 1,
    last: index + 1,
  }));
}

/**
 * The documents a mode and a field between them ask for. The two modes are one
 * question — which runs of pages come out — so the workspace and the flow can
 * both ask it here rather than branching on the mode themselves.
 */
export function getPdfSplitRanges(
  mode: PdfSplitMode,
  value: string,
  pageCount: number,
): readonly PdfPageRange[] | undefined {
  if (mode === 'pages') {
    return pageCount > 0 ? getSinglePageRanges(pageCount) : undefined;
  }

  return parsePdfPageRanges(value, pageCount);
}

/** How many pages a range holds. */
export function getPdfPageRangeLength(range: PdfPageRange): number {
  return range.last - range.first + 1;
}

/** The pages a whole plan writes out, counting a page in two ranges twice. */
export function getSplitPdfPageTotal(ranges: readonly PdfPageRange[]): number {
  return ranges.reduce((total, range) => total + getPdfPageRangeLength(range), 0);
}

/** Wording for a field the Gizlet could not read. */
export function getPdfPageRangeErrorMessage(pageCount: number): string {
  return `Pages has to be ranges between 1 and ${pageCount}, like 1-3, 5, each one written once.`;
}

/** Above this the split reports its progress rather than looking stalled. */
export function isLargeSplitWorkload(ranges: readonly PdfPageRange[]): boolean {
  return ranges.length >= largeSplitPdfOutputs;
}

function basenameOf(documentName: string, fallback: string): string {
  return documentName.replace(/\.[^.]+$/, '') || fallback;
}

/**
 * One output document's file name.
 *
 * The numbers are padded to the width of the source document's page count, so
 * the files sort into reading order in a folder rather than putting pages 10-12
 * before pages 2-3. A single page is named for that page rather than for a
 * range of one, because that is what the visitor asked for.
 */
export function getSplitPdfFilename(
  documentName: string,
  range: PdfPageRange,
  pageCount: number,
): string {
  const padding = String(Math.max(pageCount, 1)).length;
  const pad = (pageNumber: number) => String(pageNumber).padStart(padding, '0');
  const basename = basenameOf(documentName, 'document');

  return range.first === range.last
    ? `${basename}-page-${pad(range.first)}.pdf`
    : `${basename}-pages-${pad(range.first)}-${pad(range.last)}.pdf`;
}

/** The archive holding the whole set. */
export function getSplitPdfArchiveName(documentName: string): string {
  return `${basenameOf(documentName, 'document')}-split.zip`;
}

/** "Page 5" / "Pages 1-3", the line an output in the result panel carries. */
export function describePdfPageRange(range: PdfPageRange): string {
  return range.first === range.last
    ? `Page ${range.first}`
    : `Pages ${range.first}-${range.last}`;
}

/** "3 PDFs" / "1 PDF", so the count and its noun cannot disagree. */
export function describeSplitPdfCount(count: number): string {
  return `${count} ${count === 1 ? 'PDF' : 'PDFs'}`;
}

/** "3 PDFs · 12 pages", the line the result panel shows. */
export function describeSplitPdfPlan(ranges: readonly PdfPageRange[]): string {
  return `${describeSplitPdfCount(ranges.length)} · ${describePdfPageCount(getSplitPdfPageTotal(ranges))}`;
}

/**
 * Turns a pdf.js failure into something the visitor can act on.
 *
 * The workspace draws a preview so the pages can be found before they are
 * named, which means pdf.js meets the document first and its refusals are the
 * ones a visitor actually reads. pdf.js reports the kind of failure through the
 * `name` on the error it throws, which is a plain string, so the mapping needs
 * no import and can be tested on its own.
 */
export function getSplitPdfOpenErrorMessage(errorName: string | undefined): string {
  if (errorName === 'PasswordException') {
    return 'This PDF is password-protected, so its pages cannot be read to split them. Open it in an app that can ask for the password, save an unlocked copy, and split that.';
  }

  if (errorName === 'InvalidPDFException') {
    return 'This file is not a PDF that can be read, so there is nothing to split. It may be damaged, or renamed from another format.';
  }

  if (errorName === 'MissingPDFException') {
    return 'This PDF could not be read from your device. Try choosing it again.';
  }

  return 'This PDF could not be opened, so there is nothing to split.';
}

/**
 * Turns a document pdf-lib cannot take apart into something the visitor can act
 * on. These are the second line: pdf.js has usually refused the document
 * already, and this is what the flow builder — which splits a PDF it made
 * itself, with no preview to draw — reports instead.
 *
 * One document goes in, so none of these name a file: unlike a merge, there is
 * no question about which of several inputs the visitor has to replace.
 */
export function getPdfSplitErrorMessage(reason: PdfSplitFailure): string {
  if (reason === 'encrypted') {
    return 'This PDF is password-protected, so its pages cannot be copied out. Open it in an app that can ask for the password, save an unlocked copy, and split that.';
  }

  if (reason === 'empty') {
    return 'This PDF has no pages, so there is nothing to split.';
  }

  return 'This file could not be read as a PDF, so there is nothing to split. It may be damaged, or renamed from another format.';
}

/** Wording for one output that will not write, which stops the set being made. */
export function getSplitPdfPartErrorMessage(range: PdfPageRange): string {
  return `${describePdfPageRange(range)} could not be copied into a document of its own, so the split was not made. Try naming the other pages in Pages.`;
}
