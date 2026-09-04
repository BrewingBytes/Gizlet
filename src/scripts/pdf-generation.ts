import { PDFDocument, type PDFImage } from 'pdf-lib';

import {
  getPdfEmbedStrategy,
  getPdfPageLayout,
  pdfReEncodeQuality,
  type PdfOrientation,
  type PdfPageSizeName,
} from '../data/jpg-to-pdf';
import { getInputImageFormat } from '../data/image-compression';
import {
  canMergeDocuments,
  getMergeReadinessMessage,
  getPdfMergeErrorMessage,
  type PdfMergeFailure,
} from '../data/merge-pdf';
import { encodeBrowserImage, loadBrowserImage } from './image-processing';

/**
 * Writes PDFs on this device, without an upload: one built from local images,
 * and one joined from local PDFs.
 *
 * pdf-lib is used here rather than in a `src/data` module because it is a
 * browser-side dependency: there is no platform API that writes a PDF, but
 * every decision about *where* the image lands stays in `data/jpg-to-pdf`, and
 * every decision about what may be merged and how a refusal is worded stays in
 * `data/merge-pdf`, where both can be tested without a document.
 *
 * Both jobs share this one module so the library is imported in one place and
 * the page pays for it once.
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

/** A local PDF opened for merging, parsed once and kept for the merge itself. */
export interface LocalMergeSource {
  readonly file: File;
  readonly pageCount: number;
  /** The parsed document. Held so merging does not re-read the same bytes. */
  readonly document: PDFDocument;
}

export interface PdfMergeOptions {
  /** Called before each document, so a long merge can report its progress. */
  readonly onDocument?: (documentNumber: number, documentCount: number) => Promise<void> | void;
}

/** An error carrying wording the visitor can act on, naming the file it is about. */
function toMergeError(reason: PdfMergeFailure, file: File): Error {
  return new Error(getPdfMergeErrorMessage(reason, file.name));
}

/**
 * Opens a local PDF far enough to know whether its pages can be copied.
 *
 * `ignoreEncryption` is how the encrypted case is detected rather than
 * accepted: pdf-lib's own `EncryptedPDFError` is an ES5-style subclass whose
 * identity does not survive as anything a caller can test — `instanceof` is
 * false and `name` is plain `Error` — so the flag turns that throw into the
 * `isEncrypted` property this module reads, instead of matching on a message.
 * An encrypted document is still refused: its pages would copy as ciphertext.
 */
export async function openLocalPdfForMerge(file: File): Promise<LocalMergeSource> {
  let document: PDFDocument;

  try {
    document = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  } catch {
    throw toMergeError('unreadable', file);
  }

  if (document.isEncrypted) throw toMergeError('encrypted', file);

  let pageCount: number;

  try {
    // A file carrying a PDF header but a damaged page tree parses and fails
    // only here, so the page count is part of opening it rather than a later step.
    pageCount = document.getPageCount();
  } catch {
    throw toMergeError('unreadable', file);
  }

  if (pageCount < 1) throw toMergeError('empty', file);

  return { file, pageCount, document };
}

/** Joins the opened documents, in order, into one local PDF blob. */
export async function mergeLocalPdfs(
  sources: readonly LocalMergeSource[],
  options: PdfMergeOptions = {},
): Promise<Blob> {
  if (!canMergeDocuments(sources.length)) {
    throw new Error(
      getMergeReadinessMessage(sources.length) ?? 'Choose the PDFs you want to merge.',
    );
  }

  const merged = await PDFDocument.create();

  for (const [index, source] of sources.entries()) {
    await options.onDocument?.(index + 1, sources.length);

    try {
      const pages = await merged.copyPages(source.document, source.document.getPageIndices());

      for (const page of pages) merged.addPage(page);
    } catch {
      throw toMergeError('unreadable', source.file);
    }
  }

  const bytes = await merged.save();

  // A copy of the bytes, so the blob does not hold a view onto pdf-lib's buffer.
  return new Blob([bytes.slice()], { type: 'application/pdf' });
}
