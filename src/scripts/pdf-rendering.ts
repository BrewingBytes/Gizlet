import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { getPdfOpenErrorMessage, type PdfZoom, getPdfRenderScale } from '../data/pdf-viewer';

/**
 * Reads a local PDF without an upload.
 *
 * pdf.js is used here rather than in a `src/data` module because it is a
 * browser-side dependency with its own worker. Every decision about which page
 * is showing and how large it is drawn stays in `data/pdf-viewer`, where it can
 * be tested without a document.
 *
 * The worker URL comes from Vite, which bundles and hashes the worker file, so
 * nothing is fetched from a CDN and the version cannot drift from the library.
 */
GlobalWorkerOptions.workerSrc = workerSrc;

/** A page's natural size in CSS pixels, at scale 1. */
export interface PdfPageSize {
  readonly width: number;
  readonly height: number;
}

export interface LocalPdfDocument {
  readonly pageCount: number;
  /** The natural size of a page, for working out the scale to draw it at. */
  getPageSize(pageNumber: number): Promise<PdfPageSize>;
  /** Draws a page into a canvas, sizing the canvas to match. */
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, scale: number): Promise<void>;
  /** Draws a page to a fixed width, for a thumbnail. */
  renderPageToWidth(pageNumber: number, canvas: HTMLCanvasElement, width: number): Promise<void>;
  close(): Promise<void>;
}

export interface OpenLocalPdfOptions {
  /**
   * Wording for a document that will not open, for a Gizlet whose job needs
   * its own. A converter's advice about a locked file is not a reader's, and
   * the wording is a decision like any other, so it stays in `src/data` and
   * arrives here rather than being written twice against pdf.js error names.
   */
  readonly getErrorMessage?: (errorName: string | undefined) => string;
}

/** An error carrying wording the visitor can act on. */
function toOpenError(
  caughtError: unknown,
  getErrorMessage: (errorName: string | undefined) => string,
): Error {
  const name = caughtError instanceof Error ? caughtError.name : undefined;

  return new Error(getErrorMessage(name));
}

async function paint(
  document: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Your browser cannot draw this page.');

  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  context.clearRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  page.cleanup();
}

/** Opens a local file as a PDF, or throws a message the visitor can act on. */
export async function openLocalPdf(
  file: Blob,
  options: OpenLocalPdfOptions = {},
): Promise<LocalPdfDocument> {
  // A copy of the bytes: pdf.js takes ownership of the buffer it is given.
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let document: PDFDocumentProxy;

  try {
    document = await task.promise;
  } catch (caughtError) {
    // Releases the worker even when the document never opened.
    await task.destroy().catch(() => undefined);
    throw toOpenError(caughtError, options.getErrorMessage ?? getPdfOpenErrorMessage);
  }

  return {
    pageCount: document.numPages,
    async getPageSize(pageNumber) {
      const page = await document.getPage(pageNumber);
      const { width, height } = page.getViewport({ scale: 1 });

      return { width, height };
    },
    async renderPage(pageNumber, canvas, scale) {
      await paint(document, pageNumber, canvas, scale);
    },
    async renderPageToWidth(pageNumber, canvas, width) {
      const page = await document.getPage(pageNumber);
      const natural = page.getViewport({ scale: 1 });

      await paint(document, pageNumber, canvas, width / natural.width);
    },
    async close() {
      // Destroying the loading task tears down the worker with the document.
      await task.destroy();
    },
  };
}

/** Re-exported so the component reads its scale from one place. */
export { getPdfRenderScale };
export type { PdfZoom };
