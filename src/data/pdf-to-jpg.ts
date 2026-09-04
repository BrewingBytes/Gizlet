import { getFormatLabel, imageOutputFormats, type ImageOutputFormat } from './image-compression';
import { maximumImagePixels } from './image-resize';
import { isSupportedPdfFile } from './pdf-viewer';
import { zipExtension } from './zip-archive';

/**
 * Deterministic logic for the PDF to Image Gizlet: which files it accepts, how
 * many pages it will convert, which pages the visitor asked for, how large each
 * one is drawn, what every output file is called, and what to say when a
 * document cannot be read.
 *
 * Nothing here touches pdf.js or a canvas. `src/scripts/pdf-rendering.ts` owns
 * the library and `src/scripts/pdf-to-image.ts` owns the drawing; this module
 * owns every decision either of them makes, so the decisions can be tested
 * without a document, a worker, or a browser.
 */

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/** A page's natural size in PDF points, which is what decides its scale. */
interface PageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * How many pages one pass converts, and where a document stops being quick.
 *
 * Converting is heavier than reading: every page becomes a canvas and then an
 * encoded image that is held until the visitor downloads it. The ceiling is
 * therefore the `maximumPdfPages` of Image to PDF rather than the 500 pages the
 * PDF Viewer will open, and it is a refusal the visitor is told about, paired
 * with a softer threshold that only changes what the Gizlet says while it works.
 */
export const maximumPdfToImagePages = 100;
export const largePdfToImagePages = 20;

/**
 * The quality a page is encoded at, where the format has one. High enough that
 * text on a rendered page keeps its edges, which is the whole point of taking a
 * picture of a document.
 */
export const pdfImageQuality = 0.92;

/**
 * How large a page is drawn.
 *
 * A PDF page is measured in points, and a point is 1/72 inch, so drawing at
 * scale 1 gives exactly 72 pixels per inch — legible, and rarely enough. Each
 * step up is a whole multiple of that, because a page redrawn at a round
 * multiple keeps its hairlines even.
 */
export const pdfImageResolutions = {
  screen: { scale: 1, dpi: 72, label: 'Screen · 72 dpi' },
  sharp: { scale: 2, dpi: 144, label: 'Sharp · 144 dpi' },
  print: { scale: 3, dpi: 216, label: 'Print · 216 dpi' },
} as const;

export type PdfImageResolution = keyof typeof pdfImageResolutions;

export const pdfImageResolutionNames = [
  'screen',
  'sharp',
  'print',
] as const satisfies readonly PdfImageResolution[];

export const defaultPdfImageResolution: PdfImageResolution = 'sharp';

/** JPEG first: it is what a page of a scanned document should usually become. */
export const defaultPdfImageFormat: ImageOutputFormat = 'image/jpeg';

export function isPdfImageResolution(value: string): value is PdfImageResolution {
  return pdfImageResolutionNames.includes(value as PdfImageResolution);
}

export function getPdfImageResolutionLabel(resolution: PdfImageResolution): string {
  return pdfImageResolutions[resolution].label;
}

export interface SelectOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

export function getPdfImageResolutionOptions(): readonly SelectOption<PdfImageResolution>[] {
  return pdfImageResolutionNames.map((resolution) => ({
    value: resolution,
    label: pdfImageResolutions[resolution].label,
  }));
}

export function getPdfImageFormatOptions(): readonly SelectOption<ImageOutputFormat>[] {
  return imageOutputFormats.map((format) => ({ value: format, label: getFormatLabel(format) }));
}

/** The Gizlet converts one document at a time, so a selection is one PDF. */
export function validatePdfToImageSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) {
    return 'Choose a PDF to turn into images.';
  }

  if (files.length > 1) {
    return 'This Gizlet converts one PDF at a time. Choose a single file.';
  }

  if (!isSupportedPdfFile(files[0])) {
    return `${files[0].name} is not a PDF. Choose a file that ends in .pdf.`;
  }

  return undefined;
}

/** Checked once the page count is known, which needs the document parsed. */
export function validatePdfToImagePageCount(pageCount: number): string | undefined {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return 'This PDF has no pages, so there is nothing to convert.';
  }

  if (pageCount > maximumPdfToImagePages) {
    return `This Gizlet converts up to ${maximumPdfToImagePages} pages at a time, and this PDF has ${pageCount.toLocaleString()}. Split it first, or convert it in a couple of passes.`;
  }

  return undefined;
}

export function isLargePdfToImageDocument(pageCount: number): boolean {
  return pageCount >= largePdfToImagePages;
}

/**
 * The scale a page is drawn at.
 *
 * A canvas grows with the square of the scale, and a large page at 216 dpi can
 * ask for more pixels than a browser will allocate, so the chosen resolution is
 * an intent rather than a promise: it is reduced to fit the same pixel ceiling
 * the Resize Image Gizlet already enforces, which is what the canvas doing the
 * work can actually hold.
 */
export function getPdfImageScale(page: PageSize, resolution: PdfImageResolution): number {
  const { scale } = pdfImageResolutions[resolution];

  if (page.width <= 0 || page.height <= 0) return scale;

  const pixels = page.width * page.height * scale * scale;

  return pixels <= maximumImagePixels
    ? scale
    : scale * Math.sqrt(maximumImagePixels / pixels);
}

/** Whether a page had to be drawn smaller than the resolution asked for. */
export function isPdfImageScaleReduced(page: PageSize, resolution: PdfImageResolution): boolean {
  return getPdfImageScale(page, resolution) < pdfImageResolutions[resolution].scale;
}

/** Every page, which is what an empty selection means. */
function allPages(pageCount: number): readonly number[] {
  return Array.from({ length: Math.max(pageCount, 0) }, (_, index) => index + 1);
}

/**
 * Reads a page selection such as `1-3, 5`.
 *
 * Blank means every page, because that is what a visitor who ignores the field
 * expects. Anything that is not a whole page in this document returns
 * undefined, so the field can refuse rather than convert a set nobody asked
 * for: a range that runs backwards, a page past the end, or a stray character.
 */
export function parsePdfPageSelection(
  value: string,
  pageCount: number,
): readonly number[] | undefined {
  const trimmed = value.trim();

  if (trimmed === '' || trimmed.toLowerCase() === 'all') {
    return allPages(pageCount);
  }

  if (pageCount < 1) return undefined;

  const selected = new Set<number>();

  for (const part of trimmed.split(',')) {
    const item = part.trim();
    const range = /^(\d{1,4})(?:\s*-\s*(\d{1,4}))?$/.exec(item);

    if (!range) return undefined;

    const first = Number(range[1]);
    const last = range[2] === undefined ? first : Number(range[2]);

    if (first < 1 || last > pageCount || first > last) return undefined;

    for (let pageNumber = first; pageNumber <= last; pageNumber += 1) {
      selected.add(pageNumber);
    }
  }

  return selected.size > 0 ? [...selected].sort((left, right) => left - right) : undefined;
}

/** Wording for a selection the field could not read. */
export function getPdfPageSelectionErrorMessage(pageCount: number): string {
  return `Pages has to be numbers or ranges between 1 and ${pageCount}, like 1-3, 5. Leave it empty for every page.`;
}

/** "12 images" / "1 image", so the count and its noun cannot disagree. */
export function describePdfImageCount(count: number): string {
  return `${count} ${count === 1 ? 'image' : 'images'}`;
}

/** What the Gizlet is about to make, as the visitor reads it. */
export function describePdfPageSelection(
  selected: readonly number[],
  pageCount: number,
): string {
  return selected.length === pageCount
    ? `All ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`
    : `${selected.length} of ${pageCount} pages`;
}

function basenameOf(documentName: string, fallback: string): string {
  return documentName.replace(/\.[^.]+$/, '') || fallback;
}

const outputExtensions: Record<ImageOutputFormat, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * One page's file name.
 *
 * The number is padded to the width of the document's own page count, so the
 * images sort into reading order in a folder rather than putting page 10 before
 * page 2.
 */
export function getPdfImageFilename(
  documentName: string,
  pageNumber: number,
  pageCount: number,
  format: ImageOutputFormat,
): string {
  const padding = String(Math.max(pageCount, 1)).length;
  const number = String(pageNumber).padStart(padding, '0');

  return `${basenameOf(documentName, 'document')}-page-${number}.${outputExtensions[format]}`;
}

/** The archive holding the whole set. */
export function getPdfImageArchiveName(documentName: string): string {
  return `${basenameOf(documentName, 'document')}-pages.${zipExtension}`;
}

/**
 * Turns a pdf.js failure into something the visitor can act on.
 *
 * The PDF Viewer words these as a document that will not open. Here the
 * document is on its way to becoming images, and the way out of a locked file
 * is different from the way out of an unreadable one, so this Gizlet says what
 * to do about its own job rather than borrowing the reader's sentence.
 *
 * pdf.js reports the kind of failure through the `name` on the error it throws,
 * which is a plain string, so the mapping needs no import and can be tested on
 * its own.
 */
export function getPdfToImageErrorMessage(errorName: string | undefined): string {
  if (errorName === 'PasswordException') {
    return 'This PDF is password-protected, so its pages cannot be read to convert them. Open it in an app that can ask for the password, save an unlocked copy, and convert that.';
  }

  if (errorName === 'InvalidPDFException') {
    return 'This file is not a PDF that can be read, so there is nothing to convert. It may be damaged, or renamed from another format.';
  }

  if (errorName === 'MissingPDFException') {
    return 'This PDF could not be read from your device. Try choosing it again.';
  }

  return 'This PDF could not be opened, so there is nothing to convert.';
}

/** Wording for one page that will not draw, which stops the set being made. */
export function getPdfImagePageErrorMessage(pageNumber: number): string {
  return `Page ${pageNumber} could not be drawn, so the images were not made. Convert the other pages by naming them in Pages.`;
}
