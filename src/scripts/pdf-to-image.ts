import type { ImageOutputFormat } from '../data/image-compression';
import {
  getPdfImageFilename,
  getPdfImagePageErrorMessage,
  getPdfImageScale,
  pdfImageQuality,
  type PdfImageResolution,
} from '../data/pdf-to-jpg';
import { encodeBrowserImage } from './image-processing';
import type { LocalPdfDocument } from './pdf-rendering';

/**
 * Draws PDF pages and encodes them as images.
 *
 * The two halves of the job already exist: `scripts/pdf-rendering` turns a page
 * into a canvas, and `scripts/image-processing` turns anything drawable into an
 * encoded file, which is what every image Gizlet uses. This module is only the
 * join between them, and it holds no decisions of its own — the scale, the
 * quality, the file names, and the wording all come from `data/pdf-to-jpg`.
 *
 * pdf.js is not imported here, only its type, which the compiler erases. A page
 * can therefore reach this module without shipping the library and load
 * `scripts/pdf-rendering` on its own terms.
 */

export interface PdfImage {
  readonly pageNumber: number;
  readonly file: File;
  readonly width: number;
  readonly height: number;
}

export interface PdfToImageOptions {
  /** The PDF's own file name, which every output file is named after. */
  readonly documentName: string;
  readonly pageNumbers: readonly number[];
  readonly format: ImageOutputFormat;
  readonly resolution: PdfImageResolution;
  /** The whole document's page count, which decides the number padding. */
  readonly pageCount: number;
  /** Runs before each page, so a workspace can report progress and repaint. */
  readonly onPage?: (position: number, total: number) => Promise<void> | void;
}

/**
 * Converts the chosen pages, in the order given.
 *
 * One canvas is reused for every page rather than one per page, so a hundred
 * pages hold one page's worth of pixels at a time. The encoded files are what
 * is kept, and those are what the visitor is about to download.
 */
export async function renderPdfPagesToImages(
  document: LocalPdfDocument,
  options: PdfToImageOptions,
): Promise<readonly PdfImage[]> {
  const { documentName, pageNumbers, format, resolution, pageCount, onPage } = options;
  const canvas = window.document.createElement('canvas');
  const images: PdfImage[] = [];

  try {
    for (const [position, pageNumber] of pageNumbers.entries()) {
      await onPage?.(position + 1, pageNumbers.length);

      try {
        const size = await document.getPageSize(pageNumber);
        await document.renderPage(pageNumber, canvas, getPdfImageScale(size, resolution));
      } catch {
        // A page the engine cannot draw is not an image that came out wrong;
        // it is a page that produced nothing, and saying which one is the only
        // way the visitor can convert the rest.
        throw new Error(getPdfImagePageErrorMessage(pageNumber));
      }

      const blob = await encodeBrowserImage(
        canvas,
        { width: canvas.width, height: canvas.height },
        format,
        pdfImageQuality,
      );

      images.push({
        pageNumber,
        file: new File([blob], getPdfImageFilename(documentName, pageNumber, pageCount, format), {
          type: blob.type,
        }),
        width: canvas.width,
        height: canvas.height,
      });
    }
  } finally {
    // Releases the last page's pixels rather than leaving them to the collector.
    canvas.width = 0;
    canvas.height = 0;
  }

  return images;
}
