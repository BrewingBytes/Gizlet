import { PDFDocument, type PDFImage } from 'pdf-lib';

import {
  getPdfEmbedStrategy,
  getPdfPageLayout,
  pdfReEncodeQuality,
  type PdfOrientation,
  type PdfPageSizeName,
} from '../data/jpg-to-pdf';
import { getInputImageFormat } from '../data/image-compression';
import { encodeBrowserImage, loadBrowserImage } from './image-processing';

/**
 * Builds a PDF from local images without an upload.
 *
 * pdf-lib is used here rather than in a `src/data` module because it is a
 * browser-side dependency: there is no platform API that writes a PDF, but
 * every decision about *where* the image lands stays in `data/jpg-to-pdf`
 * where it can be tested without a document.
 */

/** One selected image, already decoded so its page can be measured. */
export interface PdfSourceImage {
  readonly file: File;
  readonly width: number;
  readonly height: number;
}

export interface PdfDocumentOptions {
  readonly pageSize: PdfPageSizeName;
  readonly orientation: PdfOrientation;
  /** Called before each page, so a long document can report its progress. */
  readonly onPage?: (pageNumber: number, pageCount: number) => Promise<void> | void;
}

/** Re-encodes a source pdf-lib cannot embed, using the same canvas path as the image Gizlets. */
async function toEmbeddableJpeg(source: PdfSourceImage): Promise<ArrayBuffer> {
  const image = await loadBrowserImage(source.file);
  const encoded = await encodeBrowserImage(
    image,
    { width: source.width, height: source.height },
    'image/jpeg',
    pdfReEncodeQuality,
  );

  return encoded.arrayBuffer();
}

async function embedImage(document: PDFDocument, source: PdfSourceImage): Promise<PDFImage> {
  const strategy = getPdfEmbedStrategy(getInputImageFormat(source.file));

  if (strategy === 'png') {
    return document.embedPng(await source.file.arrayBuffer());
  }

  return document.embedJpg(
    strategy === 'jpeg' ? await source.file.arrayBuffer() : await toEmbeddableJpeg(source),
  );
}

/** Renders the selected images, in order, as one local PDF blob. */
export async function createImagePdf(
  images: readonly PdfSourceImage[],
  options: PdfDocumentOptions,
): Promise<Blob> {
  if (images.length === 0) throw new Error('Choose at least one image to put in a PDF.');

  const document = await PDFDocument.create();

  for (const [index, source] of images.entries()) {
    await options.onPage?.(index + 1, images.length);

    const layout = getPdfPageLayout(source, options.pageSize, options.orientation);
    const embedded = await embedImage(document, source);
    const page = document.addPage([layout.pageWidth, layout.pageHeight]);

    page.drawImage(embedded, {
      x: layout.imageX,
      y: layout.imageY,
      width: layout.imageWidth,
      height: layout.imageHeight,
    });
  }

  const bytes = await document.save();

  // A copy of the bytes, so the blob does not hold a view onto pdf-lib's buffer.
  return new Blob([bytes.slice()], { type: 'application/pdf' });
}
