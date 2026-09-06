import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage } from 'pdf-lib';

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
import {
  getOrganizePdfWriteErrorMessage,
  getPdfOrganizeErrorMessage,
  type OrganizedPdfPage,
} from '../data/organize-pdf';
import {
  formatPageNumber,
  getNumberedPdfFilename,
  getPageNumberAnchor,
  getPageNumbersWriteErrorMessage,
  type NumberedPage,
  type PageNumberFormat,
  type PageNumberPosition,
} from '../data/pdf-page-numbers';
import {
  clampWatermarkOpacity,
  getPdfWatermarkErrorMessage,
  getVisiblePageBox,
  getWatermarkImageSize,
  getWatermarkPlacement,
  getWatermarkWriteErrorMessage,
  type WatermarkBox,
  type WatermarkPosition,
} from '../data/watermark-pdf';
import {
  getPdfSplitErrorMessage,
  getSplitPdfFilename,
  getSplitPdfPartErrorMessage,
  type PdfPageRange,
} from '../data/split-pdf';
import { encodeBrowserImage, loadBrowserImage } from './image-processing';

/**
 * Writes PDFs on this device, without an upload: one built from local images,
 * one joined from local PDFs, a set taken back out of a local PDF, and one
 * written back from a local PDF's pages in the order a visitor put them in.
 *
 * pdf-lib is used here rather than in a `src/data` module because it is a
 * browser-side dependency: there is no platform API that writes a PDF, but
 * every decision about *where* the image lands stays in `data/jpg-to-pdf`,
 * every decision about what may be merged stays in `data/merge-pdf`, every
 * decision about which pages come out and under what name stays in
 * `data/split-pdf`, and every decision about where a page ends up and which way
 * up it is stays in `data/organize-pdf` — including how each refusal is worded,
 * so all four can be tested without a document.
 *
 * The four jobs share this one module so the library is imported in one place
 * and the page pays for it once.
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

/**
 * Why a document cannot contribute its pages. Every job that copies pages out
 * of a document fails in exactly these three ways and words them differently,
 * so the shape is shared here and the wording stays in each Gizlet's own module.
 */
type PdfSourceFailure = 'encrypted' | 'empty' | 'unreadable';

/**
 * Opens a local PDF far enough to know whether its pages can be copied.
 *
 * `ignoreEncryption` is how the encrypted case is detected rather than
 * accepted: pdf-lib's own `EncryptedPDFError` is an ES5-style subclass whose
 * identity does not survive as anything a caller can test — `instanceof` is
 * false and `name` is plain `Error` — so the flag turns that throw into the
 * `isEncrypted` property this module reads, instead of matching on a message.
 * An encrypted document is still refused: its pages would copy as ciphertext.
 *
 * The caller supplies the wording, because a merge names the file it is about
 * and a split has only the one document to talk about.
 */
async function openLocalPdfSource(
  source: Blob,
  word: (reason: PdfSourceFailure) => Error,
): Promise<{ readonly pageCount: number; readonly document: PDFDocument }> {
  let document: PDFDocument;

  try {
    document = await PDFDocument.load(await source.arrayBuffer(), { ignoreEncryption: true });
  } catch {
    throw word('unreadable');
  }

  if (document.isEncrypted) throw word('encrypted');

  let pageCount: number;

  try {
    // A file carrying a PDF header but a damaged page tree parses and fails
    // only here, so the page count is part of opening it rather than a later step.
    pageCount = document.getPageCount();
  } catch {
    throw word('unreadable');
  }

  if (pageCount < 1) throw word('empty');

  return { pageCount, document };
}

/** An error carrying wording the visitor can act on, naming the file it is about. */
function toMergeError(reason: PdfMergeFailure, file: File): Error {
  return new Error(getPdfMergeErrorMessage(reason, file.name));
}

/** Opens one of the documents a merge was given. */
export async function openLocalPdfForMerge(file: File): Promise<LocalMergeSource> {
  const { pageCount, document } = await openLocalPdfSource(file, (reason) =>
    toMergeError(reason, file),
  );

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

/** A local PDF opened for splitting, parsed once and kept for the split itself. */
export interface LocalSplitSource {
  readonly pageCount: number;
  /** The parsed document. Held so splitting does not re-read the same bytes. */
  readonly document: PDFDocument;
}

/** One document a split wrote, and the pages it holds. */
export interface SplitPdfPart {
  readonly range: PdfPageRange;
  readonly file: File;
}

export interface PdfSplitOptions {
  /** The PDF's own file name, which every output file is named after. */
  readonly documentName: string;
  /** The source's page count, which decides the number padding. */
  readonly pageCount: number;
  /** Called before each output, so a long split can report its progress. */
  readonly onPart?: (position: number, total: number) => Promise<void> | void;
}

/** Opens the document a split was given. */
export async function openLocalPdfForSplit(source: Blob): Promise<LocalSplitSource> {
  return openLocalPdfSource(source, (reason) => new Error(getPdfSplitErrorMessage(reason)));
}

/**
 * Writes one local PDF per range, in the order the ranges were given.
 *
 * Each output is a fresh document holding copies of the pages it names, so the
 * source is never modified and a page appearing in two ranges appears in both
 * outputs. Copying pages is what pdf-lib is for here; which pages, in what
 * order, and under what name all come from `data/split-pdf`.
 */
export async function splitLocalPdf(
  source: LocalSplitSource,
  ranges: readonly PdfPageRange[],
  options: PdfSplitOptions,
): Promise<readonly SplitPdfPart[]> {
  if (ranges.length === 0) throw new Error('Name the pages you want split out.');

  const { documentName, pageCount, onPart } = options;
  const parts: SplitPdfPart[] = [];

  for (const [index, range] of ranges.entries()) {
    await onPart?.(index + 1, ranges.length);

    let bytes: Uint8Array;

    try {
      const part = await PDFDocument.create();
      // pdf-lib counts pages from zero; a range counts from one, as the
      // visitor typed it.
      const indices = Array.from(
        { length: range.last - range.first + 1 },
        (_, offset) => range.first - 1 + offset,
      );

      for (const page of await part.copyPages(source.document, indices)) part.addPage(page);

      bytes = await part.save();
    } catch {
      // A range the library cannot copy is not a document that came out wrong;
      // it is one that produced nothing, and saying which range is the only way
      // the visitor can split the rest.
      throw new Error(getSplitPdfPartErrorMessage(range));
    }

    parts.push({
      range,
      // A copy of the bytes, so the file does not hold a view onto pdf-lib's buffer.
      file: new File([bytes.slice()], getSplitPdfFilename(documentName, range, pageCount), {
        type: 'application/pdf',
      }),
    });
  }

  return parts;
}

/** A local PDF opened to be rearranged, parsed once and kept for the write. */
export interface LocalOrganizeSource {
  readonly pageCount: number;
  /** The parsed document. Held so organizing does not re-read the same bytes. */
  readonly document: PDFDocument;
}

export interface PdfOrganizeOptions {
  /** Called before each page, so a long document can report its progress. */
  readonly onPage?: (position: number, total: number) => Promise<void> | void;
}

/** Opens the document an organize was given. */
export async function openLocalPdfForOrganize(source: Blob): Promise<LocalOrganizeSource> {
  return openLocalPdfSource(source, (reason) => new Error(getPdfOrganizeErrorMessage(reason)));
}

/**
 * Writes the planned pages as one local PDF, in the order the plan holds them.
 *
 * The source is never modified: every page in the plan is copied into a fresh
 * document, which is what lets one source page appear twice, in two different
 * places, turned two different ways. A turn is composed onto the rotation the
 * page already carried rather than replacing it, so a page that arrived
 * sideways and was turned once ends up upright rather than back where it began.
 */
export async function organizeLocalPdf(
  source: LocalOrganizeSource,
  pages: readonly OrganizedPdfPage[],
  options: PdfOrganizeOptions = {},
): Promise<Blob> {
  if (pages.length === 0) throw new Error('A PDF needs at least one page, so choose the pages to keep.');

  const organized = await PDFDocument.create();
  let copied: Awaited<ReturnType<PDFDocument['copyPages']>>;

  try {
    // pdf-lib counts pages from zero; a plan counts from one, as the visitor
    // reads them. A page named twice is copied twice, into two pages of their
    // own, which is what makes a duplicate independently turnable.
    copied = await organized.copyPages(
      source.document,
      pages.map((page) => page.sourcePage - 1),
    );
  } catch {
    throw new Error(getOrganizePdfWriteErrorMessage());
  }

  for (const [index, page] of copied.entries()) {
    await options.onPage?.(index + 1, copied.length);

    try {
      const turned = (((page.getRotation().angle + pages[index].rotation) % 360) + 360) % 360;

      page.setRotation(degrees(turned));
      organized.addPage(page);
    } catch {
      throw new Error(getOrganizePdfWriteErrorMessage());
    }
  }

  const bytes = await organized.save();

  // A copy of the bytes, so the blob does not hold a view onto pdf-lib's buffer.
  return new Blob([bytes.slice()], { type: 'application/pdf' });
}

/** A local PDF opened to be stamped, parsed once and kept for the write. */
export interface LocalWatermarkSource {
  readonly pageCount: number;
  /** The parsed document. Held so stamping does not re-read the same bytes. */
  readonly document: PDFDocument;
}

/** What the mark is made of, already measured so its box is known. */
export type WatermarkContent =
  | { readonly kind: 'text'; readonly text: string; readonly fontSize: number }
  | { readonly kind: 'image'; readonly source: PdfSourceImage; readonly scale: number };

export interface PdfWatermarkOptions {
  /** The pages to stamp, counted from one as the visitor reads them. */
  readonly pages: readonly number[];
  readonly position: WatermarkPosition;
  /** The turn the mark is read at, in degrees counter-clockwise. */
  readonly rotation: number;
  /** How solid the mark is, as the percentage the controls carry. */
  readonly opacity: number;
  /** Called before each page, so a long document can report its progress. */
  readonly onPage?: (position: number, total: number) => Promise<void> | void;
}

/** Opens the document a watermark was given. */
export async function openLocalPdfForWatermark(source: Blob): Promise<LocalWatermarkSource> {
  return openLocalPdfSource(source, (reason) => new Error(getPdfWatermarkErrorMessage(reason)));
}

/**
 * The mark's box in PDF points.
 *
 * A text box is measured from the font's own metrics rather than guessed, and
 * deliberately excludes the descender: the box's bottom edge is then the
 * baseline, which is the y `drawText` actually takes, so the placement
 * arithmetic and the library agree about what the box is.
 */
function getTextWatermarkBox(font: PDFFont, text: string, fontSize: number): WatermarkBox {
  return {
    width: font.widthOfTextAtSize(text, fontSize),
    height: font.heightAtSize(fontSize, { descender: false }),
  };
}

/**
 * Draws the mark onto the named pages and returns the document as a local blob.
 *
 * The pages are drawn onto rather than copied, so everything already on them is
 * untouched and nothing is re-encoded. Where the mark lands, and which way up,
 * comes entirely from `data/watermark-pdf` — including the correction for a
 * page carrying its own rotation, which is the difference between a mark in the
 * corner of a sideways page and a mark off the edge of it.
 */
export async function watermarkLocalPdf(
  source: LocalWatermarkSource,
  content: WatermarkContent,
  options: PdfWatermarkOptions,
): Promise<Blob> {
  if (options.pages.length === 0) throw new Error('Choose the pages you want the watermark on.');

  const { document } = source;
  const opacity = clampWatermarkOpacity(options.opacity) / 100;

  let font: PDFFont | undefined;
  let image: PDFImage | undefined;

  try {
    if (content.kind === 'text') font = await document.embedFont(StandardFonts.HelveticaBold);
    else image = await embedImage(document, content.source);
  } catch {
    throw new Error(getWatermarkWriteErrorMessage());
  }

  for (const [index, pageNumber] of options.pages.entries()) {
    await options.onPage?.(index + 1, options.pages.length);

    try {
      // pdf-lib counts pages from zero; a selection counts from one.
      const page = document.getPage(pageNumber - 1);
      const media: WatermarkBox = { width: page.getWidth(), height: page.getHeight() };
      const pageRotation = page.getRotation().angle;
      const mark =
        content.kind === 'text'
          ? getTextWatermarkBox(font as PDFFont, content.text, content.fontSize)
          : getWatermarkImageSize(
              // An image is sized against the page as the visitor sees it, so a
              // half-width mark is half the width they are looking at.
              getVisiblePageBox(media, pageRotation),
              { width: content.source.width, height: content.source.height },
              content.scale,
            );
      const placement = getWatermarkPlacement(media, mark, {
        position: options.position,
        rotation: options.rotation,
        pageRotation,
      });

      if (content.kind === 'text' && font) {
        page.drawText(content.text, {
          x: placement.anchor.x,
          y: placement.anchor.y,
          size: content.fontSize,
          font,
          color: rgb(0.4, 0.4, 0.4),
          opacity,
          rotate: degrees(placement.rotation),
        });
      } else if (image) {
        page.drawImage(image, {
          x: placement.anchor.x,
          y: placement.anchor.y,
          width: mark.width,
          height: mark.height,
          opacity,
          rotate: degrees(placement.rotation),
        });
      }
    } catch {
      throw new Error(getWatermarkWriteErrorMessage());
    }
  }

  const bytes = await document.save();

  // A copy of the bytes, so the blob does not hold a view onto pdf-lib's buffer.
  return new Blob([bytes.slice()], { type: 'application/pdf' });
}


/** Opens the document a page numbering was given. */
export async function openLocalPdfForPageNumbers(source: Blob): Promise<LocalWatermarkSource> {
  return openLocalPdfSource(source, (reason) => new Error(getPdfWatermarkErrorMessage(reason)));
}

export interface PdfPageNumberOptions {
  readonly plan: readonly NumberedPage[];
  readonly format: PageNumberFormat;
  readonly position: PageNumberPosition;
  readonly fontSize: number;
  readonly margin: number;
  readonly onPage?: (position: number, total: number) => Promise<void> | void;
}

/**
 * Writes the numbers onto the pages the plan names.
 *
 * Like the watermark, the pages are drawn onto rather than copied, so
 * everything already on them is untouched and nothing is re-encoded — and
 * every decision about where a number lands comes from `src/data`, including
 * the correction for a page that carries its own rotation. What differs is
 * that each page gets its own text, so the label is worked out per page rather
 * than once for the document.
 */
export async function addPageNumbersToLocalPdf(
  source: LocalWatermarkSource,
  options: PdfPageNumberOptions,
): Promise<Blob> {
  if (options.plan.length === 0) throw new Error('There are no pages to number.');

  const { document } = source;
  let font: PDFFont;

  try {
    font = await document.embedFont(StandardFonts.Helvetica);
  } catch {
    throw new Error(getPageNumbersWriteErrorMessage());
  }

  const total = options.plan[options.plan.length - 1].value;

  for (const [index, entry] of options.plan.entries()) {
    await options.onPage?.(index + 1, options.plan.length);

    try {
      // pdf-lib counts pages from zero; a plan counts from one.
      const page = document.getPage(entry.pageNumber - 1);
      const media: WatermarkBox = { width: page.getWidth(), height: page.getHeight() };
      const pageRotation = page.getRotation().angle;
      const label = formatPageNumber(options.format, entry.value, total);
      const box: WatermarkBox = {
        width: font.widthOfTextAtSize(label, options.fontSize),
        height: font.heightAtSize(options.fontSize, { descender: false }),
      };
      const anchor = getPageNumberAnchor(media, box, {
        position: options.position,
        margin: options.margin,
        pageRotation,
      });

      page.drawText(label, {
        x: anchor.x,
        y: anchor.y,
        size: options.fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1),
        // The page's own rotation turns everything drawn on it, so the number
        // is drawn turned by the same amount to be read level.
        rotate: degrees(pageRotation),
      });
    } catch {
      throw new Error(getPageNumbersWriteErrorMessage());
    }
  }

  const bytes = await document.save();

  return new Blob([bytes.slice()], { type: 'application/pdf' });
}

export { getNumberedPdfFilename };
