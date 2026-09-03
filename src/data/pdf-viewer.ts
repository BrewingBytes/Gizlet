/**
 * Deterministic logic for the PDF Viewer Gizlet: which files it accepts, how
 * many pages it will open, which page is showing, how large it is drawn, and
 * what to say when a document cannot be read.
 *
 * Nothing here touches pdf.js. The adapter in `src/scripts/pdf-rendering.ts`
 * owns the library; this module owns every decision about it, including how its
 * failures are worded, so those can be tested without a document or a worker.
 */

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/**
 * How many pages the viewer will open, and where a document stops being quick.
 *
 * These mirror the `maximumPdfPages` / `largePdfPages` pair in `jpg-to-pdf`: a
 * hard refusal the visitor is told about, and a softer threshold that only
 * changes what the Gizlet says while it works.
 */
export const maximumPdfViewerPages = 500;
export const largePdfViewerPages = 25;

/** Zoom steps, coarse enough that every press is a visible change. */
export const pdfZoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

export type PdfZoom = (typeof pdfZoomLevels)[number];

export const defaultPdfZoom: PdfZoom = 1;

/** Thumbnails are drawn at a fixed width, so a strip of them is predictable. */
export const pdfThumbnailWidth = 96;

export function isPdfZoom(value: number): value is PdfZoom {
  return pdfZoomLevels.includes(value as PdfZoom);
}

export function isSupportedPdfFile(file: FileDetails): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** The viewer opens one document at a time, so a selection is one PDF. */
export function validatePdfFileSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) {
    return 'Choose a PDF to open.';
  }

  if (files.length > 1) {
    return 'This Gizlet opens one PDF at a time. Choose a single file.';
  }

  if (!isSupportedPdfFile(files[0])) {
    return `${files[0].name} is not a PDF. Choose a file that ends in .pdf.`;
  }

  return undefined;
}

/** Checked once the page count is known, which needs the document parsed. */
export function validatePdfPageCount(pageCount: number): string | undefined {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return 'This PDF reports no pages, so there is nothing to show.';
  }

  if (pageCount > maximumPdfViewerPages) {
    return `This Gizlet opens up to ${maximumPdfViewerPages.toLocaleString()} pages, and this PDF has ${pageCount.toLocaleString()}.`;
  }

  return undefined;
}

export function isLargePdfViewerDocument(pageCount: number): boolean {
  return pageCount >= largePdfViewerPages;
}

/** Keeps a page number inside the document rather than failing on a stray one. */
export function clampPdfPage(pageNumber: number, pageCount: number): number {
  if (!Number.isFinite(pageNumber)) return 1;

  return Math.min(Math.max(Math.round(pageNumber), 1), Math.max(pageCount, 1));
}

/**
 * Reads a typed page number. Returns undefined for anything that is not a
 * whole page in this document, so the field can reject rather than coerce.
 */
export function parsePdfPageInput(value: string, pageCount: number): number | undefined {
  if (!/^\d{1,4}$/.test(value.trim())) return undefined;

  const pageNumber = Number(value.trim());

  return pageNumber >= 1 && pageNumber <= pageCount ? pageNumber : undefined;
}

/** "Page 3 of 12", so the number and its total cannot disagree. */
export function describePdfPagePosition(pageNumber: number, pageCount: number): string {
  return `Page ${pageNumber} of ${pageCount}`;
}

/** The next zoom step in a direction, stopping at the ends rather than wrapping. */
export function getNextPdfZoom(zoom: PdfZoom, direction: 'in' | 'out'): PdfZoom {
  const index = pdfZoomLevels.indexOf(zoom);
  const next = direction === 'in' ? index + 1 : index - 1;

  return pdfZoomLevels[Math.min(Math.max(next, 0), pdfZoomLevels.length - 1)];
}

export function canZoomPdf(zoom: PdfZoom, direction: 'in' | 'out'): boolean {
  return getNextPdfZoom(zoom, direction) !== zoom;
}

/** Zoom as the visitor reads it. */
export function describePdfZoom(zoom: PdfZoom): string {
  return `${Math.round(zoom * 100)}%`;
}

/**
 * Caps on how large a page may be drawn.
 *
 * A page is redrawn at whatever scale it is shown at rather than stretched, so
 * enlarging costs nothing in sharpness — but it does cost memory, and a canvas
 * grows with the square of the scale. These bound that.
 */
export const maximumPdfFitScale = 3;
export const maximumPdfRenderScale = 4;

/**
 * The scale that fits a page across the space available, so a document opens
 * filling its column rather than at whatever size it happens to declare.
 */
export function getPdfFitScale(pageWidth: number, availableWidth: number): number {
  if (pageWidth <= 0 || availableWidth <= 0) return 1;

  return Math.min(maximumPdfFitScale, availableWidth / pageWidth);
}

/** The scale a page is rendered at: fitted to the column, then zoomed. */
export function getPdfRenderScale(
  pageWidth: number,
  availableWidth: number,
  zoom: PdfZoom,
): number {
  return Math.min(getPdfFitScale(pageWidth, availableWidth) * zoom, maximumPdfRenderScale);
}

/**
 * Turns a pdf.js failure into something the visitor can act on.
 *
 * pdf.js reports these through the `name` on the error it throws, which is a
 * plain string, so the mapping needs no import and can be tested on its own.
 */
export function getPdfOpenErrorMessage(errorName: string | undefined): string {
  if (errorName === 'PasswordException') {
    return 'This PDF is password-protected. Open it in an app that can ask for the password, then save an unlocked copy.';
  }

  if (errorName === 'InvalidPDFException') {
    return 'This file is not a PDF that can be read. It may be damaged, or renamed from another format.';
  }

  if (errorName === 'MissingPDFException') {
    return 'This PDF could not be read from your device. Try choosing it again.';
  }

  return 'This PDF could not be opened.';
}

/** Wording for a single page that failed while the rest of the document is fine. */
export function getPdfPageErrorMessage(pageNumber: number): string {
  return `Page ${pageNumber} could not be drawn. The rest of the document is still readable.`;
}
