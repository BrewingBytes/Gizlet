import { describePdfPageCount } from './jpg-to-pdf';
import { parsePdfPageSelection, type SelectOption } from './pdf-to-jpg';
import { isSupportedPdfFile, maximumPdfViewerPages } from './pdf-viewer';
import {
  getVisiblePageBox,
  toUnrotatedPoint,
  type WatermarkBox,
  type WatermarkPoint,
} from './watermark-pdf';

/**
 * Deterministic logic for the PDF Page Numbers Gizlet: which pages get a
 * number, what that number is, and where on the page it goes.
 *
 * The numbering is the part with rules worth arguing about — a cover that is
 * skipped, a document that starts at 5, a range that ends before the last page
 * — and all of it is one pure function over a page count, so every combination
 * can be checked without a document.
 *
 * The geometry is deliberately not reimplemented. A page carrying its own
 * rotation is the same problem the watermark solved, and the same functions
 * solve it here; what differs is the margin, which a watermark takes as a
 * share of the page and a page number takes in points, because a footer sits
 * where a printer's margin is rather than where a proportion falls.
 */

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/**
 * Where a number sits. Six places, all of them edges: a page number in the
 * middle of the page is not a page number.
 */
export const pageNumberPositions = [
  'bottom',
  'bottom-left',
  'bottom-right',
  'top',
  'top-left',
  'top-right',
] as const;

export type PageNumberPosition = (typeof pageNumberPositions)[number];

export const defaultPageNumberPosition: PageNumberPosition = 'bottom';

const pageNumberPositionLabels = {
  bottom: 'Bottom centre',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
  top: 'Top centre',
  'top-left': 'Top left',
  'top-right': 'Top right',
} as const satisfies Record<PageNumberPosition, string>;

export function isPageNumberPosition(value: string): value is PageNumberPosition {
  return (pageNumberPositions as readonly string[]).includes(value);
}

export function getPageNumberPositionOptions(): readonly SelectOption<PageNumberPosition>[] {
  return pageNumberPositions.map((position) => ({
    value: position,
    label: pageNumberPositionLabels[position],
  }));
}

/**
 * How a number is written.
 *
 * Four, and the two that name a total are the reason this is a closed list
 * rather than a text field: the total has to be worked out rather than typed,
 * and a field would let a visitor write one that is wrong.
 */
export const pageNumberFormats = ['number', 'page-number', 'number-of', 'page-number-of'] as const;

export type PageNumberFormat = (typeof pageNumberFormats)[number];

export const defaultPageNumberFormat: PageNumberFormat = 'number';

const pageNumberFormatExamples = {
  number: '1',
  'page-number': 'Page 1',
  'number-of': '1 of 12',
  'page-number-of': 'Page 1 of 12',
} as const satisfies Record<PageNumberFormat, string>;

export function isPageNumberFormat(value: string): value is PageNumberFormat {
  return (pageNumberFormats as readonly string[]).includes(value);
}

export function getPageNumberFormatOptions(): readonly SelectOption<PageNumberFormat>[] {
  return pageNumberFormats.map((format) => ({
    value: format,
    label: pageNumberFormatExamples[format],
  }));
}

/** One number, written the way the chosen format writes it. */
export function formatPageNumber(
  format: PageNumberFormat,
  value: number,
  total: number,
): string {
  if (format === 'page-number') return `Page ${value}`;
  if (format === 'number-of') return `${value} of ${total}`;
  if (format === 'page-number-of') return `Page ${value} of ${total}`;

  return `${value}`;
}

export const minimumPageNumberFontSize = 6;
export const maximumPageNumberFontSize = 36;
export const defaultPageNumberFontSize = 11;

/** The gap from the edge of the page, in points. 36pt is half an inch. */
export const minimumPageNumberMargin = 6;
export const maximumPageNumberMargin = 144;
export const defaultPageNumberMargin = 36;

export const minimumPageNumberStart = 1;
export const maximumPageNumberStart = 9_999;
export const defaultPageNumberStart = 1;

export const maximumPageNumberSkip = 99;
export const defaultPageNumberSkip = 0;

/** The ceiling the reader keeps, so a document that opens can be numbered. */
export const maximumPageNumberPdfPages = maximumPdfViewerPages;

/** Past this, the Gizlet says it is working rather than looking stalled. */
export const largePageNumberPdfPages = 50;

export function clampPageNumberFontSize(value: number): number {
  if (!Number.isFinite(value)) return defaultPageNumberFontSize;

  return Math.min(maximumPageNumberFontSize, Math.max(minimumPageNumberFontSize, Math.round(value)));
}

export function clampPageNumberMargin(value: number): number {
  if (!Number.isFinite(value)) return defaultPageNumberMargin;

  return Math.min(maximumPageNumberMargin, Math.max(minimumPageNumberMargin, Math.round(value)));
}

export function clampPageNumberStart(value: number): number {
  if (!Number.isFinite(value)) return defaultPageNumberStart;

  return Math.min(maximumPageNumberStart, Math.max(minimumPageNumberStart, Math.round(value)));
}

export function clampPageNumberSkip(value: number, pageCount: number): number {
  if (!Number.isFinite(value)) return defaultPageNumberSkip;

  // Skipping every page is refused elsewhere with an explanation; the clamp
  // only keeps the field inside the document.
  return Math.min(Math.max(pageCount, 0), Math.min(maximumPageNumberSkip, Math.max(0, Math.round(value))));
}

export function validatePageNumbersSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) return 'Choose a PDF to number.';
  if (files.length > 1) return 'This Gizlet numbers one PDF at a time. Choose a single file.';
  if (!isSupportedPdfFile(files[0])) {
    return `${files[0].name} is not a PDF. Choose a file that ends in .pdf.`;
  }

  return undefined;
}

export function validatePageNumbersPageCount(pageCount: number): string | undefined {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return 'This PDF reports no pages, so there is nothing to number.';
  }

  if (pageCount > maximumPageNumberPdfPages) {
    return `This Gizlet numbers up to ${maximumPageNumberPdfPages.toLocaleString()} pages, and this PDF has ${pageCount.toLocaleString()}.`;
  }

  return undefined;
}

export function isLargePageNumberDocument(pageCount: number): boolean {
  return pageCount >= largePageNumberPdfPages;
}

export interface PageNumberOptions {
  readonly format: PageNumberFormat;
  readonly startAt: number;
  /** Pages at the front that get no number at all: a cover, a title page. */
  readonly skip: number;
  /** A range such as `2-9`, restricting which pages are numbered. Blank is all. */
  readonly pages: string;
}

/** One page that gets a number, and the number it gets. */
export interface NumberedPage {
  readonly pageNumber: number;
  readonly value: number;
}

/**
 * Which pages are numbered, and what each one says.
 *
 * Three rules, and they compose in this order: the skipped pages at the front
 * are out, the range narrows what is left, and the numbering then counts from
 * the starting number across the pages that survived. Counting after the
 * narrowing is the point — numbering pages 5 to 9 of a report starting at 1
 * gives 1 to 5, not 5 to 9, because the visitor asked for the first number to
 * be 1 and would otherwise have to work out the offset themselves.
 */
export function planPageNumbers(
  pageCount: number,
  options: PageNumberOptions,
): readonly NumberedPage[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) return [];

  const skip = clampPageNumberSkip(options.skip, pageCount);
  const start = clampPageNumberStart(options.startAt);
  const selection = parsePdfPageSelection(options.pages, pageCount);

  // An unreadable range numbers nothing rather than quietly numbering
  // everything: the field is refused where it is typed, and this agrees.
  if (!selection) return [];

  const pages = selection.filter((pageNumber) => pageNumber > skip);

  return pages.map((pageNumber, index) => ({ pageNumber, value: start + index }));
}

/**
 * The total a format names, which is the last number printed rather than the
 * document's page count.
 *
 * "Page 3 of 12" on a document whose first two pages are unnumbered would be a
 * lie about the sequence the reader is actually holding: they can count to 10.
 */
export function getPageNumberTotal(plan: readonly NumberedPage[]): number {
  return plan.length === 0 ? 0 : plan[plan.length - 1].value;
}

/** Every label the plan will print, in page order. */
export function describePageNumberPlan(
  plan: readonly NumberedPage[],
  format: PageNumberFormat,
): readonly { readonly pageNumber: number; readonly label: string }[] {
  const total = getPageNumberTotal(plan);

  return plan.map((entry) => ({
    pageNumber: entry.pageNumber,
    label: formatPageNumber(format, entry.value, total),
  }));
}

/** The label one page gets, or nothing when that page is not numbered. */
export function getPageNumberLabel(
  plan: readonly NumberedPage[],
  format: PageNumberFormat,
  pageNumber: number,
): string | undefined {
  const entry = plan.find((candidate) => candidate.pageNumber === pageNumber);

  return entry === undefined ? undefined : formatPageNumber(format, entry.value, getPageNumberTotal(plan));
}

/** Why a document cannot be numbered as asked, if it cannot. */
export function validatePageNumberPlan(
  plan: readonly NumberedPage[],
  pageCount: number,
  options: PageNumberOptions,
): string | undefined {
  if (pageCount < 1) return 'This PDF reports no pages, so there is nothing to number.';

  if (!parsePdfPageSelection(options.pages, pageCount)) {
    return `Pages has to be numbers or ranges between 1 and ${pageCount}, like 2-9. Leave it empty for every page.`;
  }

  if (plan.length === 0) {
    return clampPageNumberSkip(options.skip, pageCount) >= pageCount
      ? 'Every page is skipped, so there is nothing left to number.'
      : 'No page is both inside the range and past the skipped pages.';
  }

  return undefined;
}

/** What is about to happen, as the visitor reads it. */
export function describePageNumbering(
  plan: readonly NumberedPage[],
  pageCount: number,
): string {
  if (plan.length === 0) return 'No pages numbered.';

  const skipped = pageCount - plan.length;

  return skipped === 0
    ? `${describePdfPageCount(plan.length)} numbered.`
    : `${describePdfPageCount(plan.length)} numbered · ${skipped} left alone.`;
}

/**
 * Where the number's box goes, in the page's own unrotated coordinates.
 *
 * The margin is the visitor's, in points, measured from the edge of the page
 * as it is displayed — which is why the visible box and the rotation
 * correction are borrowed from the watermark rather than written again.
 */
export function getPageNumberAnchor(
  media: WatermarkBox,
  label: WatermarkBox,
  options: {
    readonly position: PageNumberPosition;
    readonly margin: number;
    readonly pageRotation: number;
  },
): WatermarkPoint {
  const visible = getVisiblePageBox(media, options.pageRotation);
  const margin = clampPageNumberMargin(options.margin);
  const atTop = options.position.startsWith('top');
  const y = atTop ? visible.height - margin - label.height : margin;
  const x = options.position.endsWith('left')
    ? margin
    : options.position.endsWith('right')
      ? visible.width - margin - label.width
      : (visible.width - label.width) / 2;

  return toUnrotatedPoint(
    { x: Math.max(0, x), y: Math.max(0, y) },
    media,
    options.pageRotation,
  );
}

/**
 * Where the number sits as a fraction of the visible page, for a preview drawn
 * over a canvas that knows nothing about PDF points.
 */
export function getPageNumberPreviewPlacement(
  media: WatermarkBox,
  options: { readonly position: PageNumberPosition; readonly margin: number; readonly pageRotation: number },
): { readonly left: number; readonly top: number } {
  const visible = getVisiblePageBox(media, options.pageRotation);
  const margin = clampPageNumberMargin(options.margin);
  const width = Math.max(visible.width, 1);
  const height = Math.max(visible.height, 1);
  const top = options.position.startsWith('top') ? margin / height : 1 - margin / height;
  const left = options.position.endsWith('left')
    ? margin / width
    : options.position.endsWith('right')
      ? 1 - margin / width
      : 0.5;

  return { left, top };
}

export function getNumberedPdfFilename(documentName: string): string {
  return `${documentName.replace(/\.[^.]+$/, '') || 'document'}-numbered.pdf`;
}

/** Wording for a document that will not open, in this Gizlet's own terms. */
export function getPageNumbersOpenErrorMessage(errorName: string | undefined): string {
  if (errorName === 'PasswordException') {
    return 'This PDF is password-protected, so its pages cannot be numbered. Open it in an app that can ask for the password, save an unlocked copy, and number that.';
  }

  if (errorName === 'InvalidPDFException') {
    return 'This file is not a PDF that can be read. It may be damaged, or renamed from another format.';
  }

  return 'This PDF could not be opened, so it could not be numbered.';
}

/** Wording for a document that opened and could not be written back. */
export function getPageNumbersWriteErrorMessage(): string {
  return 'The numbers could not be written onto this PDF on this device. Nothing was changed, and your original is untouched.';
}
