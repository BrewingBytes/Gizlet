import { isSupportedImageFile, type ImageInputFormat } from './image-compression';
import { maximumImagePixels, validateResizeDimensions, type ImageDimensions } from './image-resize';

/**
 * Deterministic logic for the JPG to PDF Gizlet: which files it accepts, how
 * many pages it will build, where an image sits on a page, and what the finished
 * file is called.
 *
 * Page geometry is expressed in PDF points, the unit a PDF page box uses. One
 * point is 1/72 inch, and an image pixel is treated as one point, which is the
 * 72 DPI convention every browser uses when it has no better information.
 */

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/**
 * How many pages one document may hold, and where it stops being quick.
 *
 * These mirror the `maximumImagePixels` / `largeImagePixels` pair in
 * `image-resize`: a hard refusal the visitor is told about, and a softer
 * threshold that only changes what the Gizlet says while it works.
 */
export const maximumPdfPages = 100;
export const largePdfPages = 20;

/** The white border around an image on a fixed-size page, in points. */
export const pdfPageMargin = 24;

/**
 * The largest page a PDF may declare: 200 inches, the limit PDF readers have
 * enforced since Acrobat 5. A fitted page is one point per pixel, so an image
 * past 14,400 pixels on a side would otherwise ask for a page no reader would
 * open. Such a page is scaled down to the limit instead; the embedded image
 * keeps every pixel, and only its nominal print size changes.
 */
export const maximumPdfPageDimension = 14_400;

/**
 * The quality used when a source image has to be re-encoded as JPEG before it
 * can be embedded. High enough that the page is not visibly softer than the
 * source, low enough that a photograph does not double the document.
 */
export const pdfReEncodeQuality = 0.92;

/**
 * The paper sizes, in portrait points. A landscape page swaps the two.
 * `fit` is deliberately not here: it has no box of its own, because the page
 * becomes whatever the image is.
 */
export const fixedPdfPageSizes = {
  a4: { width: 595.28, height: 841.89, label: 'A4' },
  letter: { width: 612, height: 792, label: 'US Letter' },
  legal: { width: 612, height: 1008, label: 'US Legal' },
} as const;

export type FixedPdfPageSizeName = keyof typeof fixedPdfPageSizes;

export type PdfPageSizeName = FixedPdfPageSizeName | 'fit';

export const pdfPageSizeNames = [
  ...(Object.keys(fixedPdfPageSizes) as FixedPdfPageSizeName[]),
  'fit',
] as const satisfies readonly PdfPageSizeName[];

export const defaultPdfPageSize: PdfPageSizeName = 'a4';

const fitPageSizeLabel = 'Fit each image';

export type PdfOrientation = 'auto' | 'portrait' | 'landscape';

export interface PdfPageSizeOption {
  readonly value: PdfPageSizeName;
  readonly label: string;
}

/** Where an image sits on its page, in points, with the page box it needs. */
export interface PdfPageLayout {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly imageX: number;
  readonly imageY: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
}

/**
 * pdf-lib embeds JPEG and PNG bytes directly and nothing else, so a WebP,
 * AVIF, or BMP source has to be re-encoded before it can become a page. The
 * decision is here rather than in the browser module so it can be tested.
 */
export type PdfEmbedStrategy = 'jpeg' | 'png' | 're-encode';

export function isPdfPageSizeName(value: string): value is PdfPageSizeName {
  return pdfPageSizeNames.includes(value as PdfPageSizeName);
}

export function isPdfOrientation(value: string): value is PdfOrientation {
  return value === 'auto' || value === 'portrait' || value === 'landscape';
}

/** A fitted page has no fixed box, so orientation has nothing to rotate. */
export function usesFixedPageSize(pageSize: PdfPageSizeName): pageSize is FixedPdfPageSizeName {
  return pageSize !== 'fit';
}

export function getPdfPageSizeLabel(pageSize: PdfPageSizeName): string {
  return usesFixedPageSize(pageSize) ? fixedPdfPageSizes[pageSize].label : fitPageSizeLabel;
}

/** The page-size choices, so the control is built from this module. */
export function getPdfPageSizeOptions(): readonly PdfPageSizeOption[] {
  return pdfPageSizeNames.map((value) => ({ value, label: getPdfPageSizeLabel(value) }));
}

export function getPdfEmbedStrategy(format: ImageInputFormat | undefined): PdfEmbedStrategy {
  if (format === 'image/jpeg') return 'jpeg';
  if (format === 'image/png') return 'png';

  return 're-encode';
}

/** Points, rounded so a layout is comparable rather than merely close. */
function roundedPoints(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Places one image on one page.
 *
 * A fitted page is the image itself: nothing is cropped or bordered, and
 * nothing is scaled until the image would ask for a page past
 * `maximumPdfPageDimension`. A fixed page scales the image to fit inside its
 * margins, keeping the aspect ratio, and centres it.
 */
export function getPdfPageLayout(
  image: ImageDimensions,
  pageSize: PdfPageSizeName,
  orientation: PdfOrientation,
): PdfPageLayout {
  if (!usesFixedPageSize(pageSize)) {
    const fitScale = Math.min(
      1,
      maximumPdfPageDimension / image.width,
      maximumPdfPageDimension / image.height,
    );
    const fittedWidth = roundedPoints(image.width * fitScale);
    const fittedHeight = roundedPoints(image.height * fitScale);

    return {
      pageWidth: fittedWidth,
      pageHeight: fittedHeight,
      imageX: 0,
      imageY: 0,
      imageWidth: fittedWidth,
      imageHeight: fittedHeight,
    };
  }

  const box = fixedPdfPageSizes[pageSize];
  const isLandscape =
    orientation === 'landscape' || (orientation === 'auto' && image.width > image.height);
  const pageWidth = isLandscape ? box.height : box.width;
  const pageHeight = isLandscape ? box.width : box.height;
  const scale = Math.min(
    (pageWidth - pdfPageMargin * 2) / image.width,
    (pageHeight - pdfPageMargin * 2) / image.height,
  );
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;

  return {
    pageWidth,
    pageHeight,
    imageX: roundedPoints((pageWidth - imageWidth) / 2),
    imageY: roundedPoints((pageHeight - imageHeight) / 2),
    imageWidth: roundedPoints(imageWidth),
    imageHeight: roundedPoints(imageHeight),
  };
}

/**
 * Checks a whole selection before any of it is read.
 *
 * The unreadable files are named rather than counted, because a visitor who
 * dropped a folder needs to know which file to take out.
 */
export function validatePdfSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) {
    return 'Choose at least one image to put in a PDF.';
  }

  const unsupported = files.filter((file) => !isSupportedImageFile(file));

  if (unsupported.length > 0) {
    const named = unsupported.slice(0, 3).map((file) => file.name).join(', ');
    const remainder = unsupported.length - 3;

    return `${remainder > 0 ? `${named}, and ${remainder} more` : named} ${
      unsupported.length === 1 ? 'is not an image' : 'are not images'
    } this Gizlet can read. Choose JPEG, PNG, WebP, AVIF, or BMP files.`;
  }

  if (files.length > maximumPdfPages) {
    return `One PDF holds up to ${maximumPdfPages} pages here, and you chose ${files.length} images. Make it in a couple of passes.`;
  }

  return undefined;
}

/**
 * Checks one decoded image against the limits the resize Gizlet already
 * enforces. The same canvas does the work when a page has to be re-encoded, so
 * the ceiling is the same ceiling.
 */
export function validatePdfImage(name: string, dimensions: ImageDimensions): string | undefined {
  if (!dimensions.width || !dimensions.height) {
    return `${name} has no usable dimensions.`;
  }

  const problem = validateResizeDimensions(dimensions);

  return problem ? `${name} is too large to make a page from. ${problem}` : undefined;
}

/** Above this the Gizlet says the document is a big one before it starts. */
export function isLargePdfDocument(pageCount: number): boolean {
  return pageCount >= largePdfPages;
}

/** The total pixel budget a selection asks the browser to decode. */
export function getPdfPixelTotal(images: readonly ImageDimensions[]): number {
  return images.reduce((total, image) => total + image.width * image.height, 0);
}

/** Whether a selection is large enough to be worth warning about at all. */
export function isLargePdfWorkload(images: readonly ImageDimensions[]): boolean {
  return isLargePdfDocument(images.length) || getPdfPixelTotal(images) >= maximumImagePixels;
}

export function getPdfOutputFilename(firstName: string, pageCount: number): string {
  const basename = firstName.replace(/\.[^.]+$/, '') || 'images';

  if (pageCount <= 1) {
    return `${basename}.pdf`;
  }

  return `${basename}-and-${pageCount - 1}-more.pdf`;
}

/** "1 page" / "12 pages", so the count and its noun cannot disagree. */
export function describePdfPageCount(pageCount: number): string {
  return `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`;
}

/**
 * Moves one image within the page order, returning a new list. An index
 * outside the list leaves the order untouched rather than dropping a page.
 */
export function reorderPdfImages<Item>(
  items: readonly Item[],
  fromIndex: number,
  toIndex: number,
): readonly Item[] {
  if (
    fromIndex < 0 || fromIndex >= items.length ||
    toIndex < 0 || toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const reordered = [...items];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);

  return reordered;
}
