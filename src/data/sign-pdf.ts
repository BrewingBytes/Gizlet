import { describePdfPageCount } from './jpg-to-pdf';
import type { SelectOption } from './pdf-to-jpg';
import { isSupportedPdfFile, maximumPdfViewerPages } from './pdf-viewer';
import {
  getVisiblePageBox,
  toUnrotatedPoint,
  type WatermarkBox,
  type WatermarkPoint,
} from './watermark-pdf';

/**
 * Deterministic logic for the Sign PDF Gizlet: what a signature may be, where
 * on the page it sits, and how big it is drawn.
 *
 * A signature is placed rather than positioned: the visitor drags it to a line
 * on the page, which is a place no list of corners can name. So placement here
 * is a pair of fractions of the visible page rather than points — a signature
 * two thirds down and a third of the width across means the same thing on A4
 * and on US Letter, and survives the preview being drawn at whatever size the
 * screen allows.
 *
 * The rotation correction is the watermark's, imported rather than written
 * again. What this module adds is the dragging, the resizing and the rule that
 * keeps a signature on the page it is being put on.
 *
 * Nothing here signs anything in the cryptographic sense, and nothing in this
 * module or the Gizlet above it says otherwise: this places a picture of a
 * signature onto a page. The roadmap refuses certificate-based signing by name.
 */

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/** What the signature is made of. */
export const signatureKinds = ['drawn', 'typed', 'image'] as const;

export type SignatureKind = (typeof signatureKinds)[number];

export const defaultSignatureKind: SignatureKind = 'drawn';

const signatureKindLabels = {
  drawn: 'Draw it',
  typed: 'Type it',
  image: 'Use a picture',
} as const satisfies Record<SignatureKind, string>;

export function isSignatureKind(value: string): value is SignatureKind {
  return (signatureKinds as readonly string[]).includes(value);
}

export function getSignatureKindOptions(): readonly SelectOption<SignatureKind>[] {
  return signatureKinds.map((kind) => ({ value: kind, label: signatureKindLabels[kind] }));
}

/**
 * Where the signature sits and how wide it is, as fractions of the visible page.
 *
 * `x` and `y` are the centre, counted from the top left the way a screen counts,
 * because that is the space a visitor drags in. The writer flips it.
 */
export interface SignaturePlacement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

/** Above the bottom edge, right of centre: where a signature line usually is. */
export const defaultSignaturePlacement: SignaturePlacement = { x: 0.62, y: 0.82, width: 0.3 };

export const minimumSignatureWidth = 0.05;
export const maximumSignatureWidth = 0.9;

export const maximumSignatureTextLength = 40;

/** The ceiling the reader keeps, so a document that opens can be signed. */
export const maximumSignPdfPages = maximumPdfViewerPages;

export function clampSignatureWidth(value: number): number {
  if (!Number.isFinite(value)) return defaultSignaturePlacement.width;

  return Math.min(maximumSignatureWidth, Math.max(minimumSignatureWidth, value));
}

/**
 * Keeps the whole signature on the page.
 *
 * A signature half off the edge is not a placement anybody meant, and it is the
 * easy end state of a drag, so the centre is bounded by half the signature's
 * own size rather than by the page's edges.
 */
export function clampSignaturePlacement(
  placement: SignaturePlacement,
  aspect: number,
  page: WatermarkBox,
): SignaturePlacement {
  const width = clampSignatureWidth(placement.width);
  const ratio = page.width > 0 && page.height > 0 ? page.width / page.height : 1;
  // The height as a fraction of the page: a signature's own aspect, corrected
  // for the page not being square.
  const height = Math.min(1, width * (aspect > 0 ? 1 / aspect : 1) * ratio);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return {
    width,
    x: Math.min(1 - halfWidth, Math.max(halfWidth, Number.isFinite(placement.x) ? placement.x : 0.5)),
    y: Math.min(1 - halfHeight, Math.max(halfHeight, Number.isFinite(placement.y) ? placement.y : 0.5)),
  };
}

/** The signature's height as a fraction of the page, for a preview or a bound. */
export function getSignatureHeightFraction(
  width: number,
  aspect: number,
  page: WatermarkBox,
): number {
  const ratio = page.width > 0 && page.height > 0 ? page.width / page.height : 1;

  return Math.min(1, clampSignatureWidth(width) * (aspect > 0 ? 1 / aspect : 1) * ratio);
}

/** Moves the signature by fractions of the page, staying on it. */
export function moveSignature(
  placement: SignaturePlacement,
  delta: { readonly x: number; readonly y: number },
  aspect: number,
  page: WatermarkBox,
): SignaturePlacement {
  return clampSignaturePlacement(
    { ...placement, x: placement.x + delta.x, y: placement.y + delta.y },
    aspect,
    page,
  );
}

/** Grows or shrinks it about its own centre, staying on the page. */
export function resizeSignature(
  placement: SignaturePlacement,
  delta: number,
  aspect: number,
  page: WatermarkBox,
): SignaturePlacement {
  return clampSignaturePlacement({ ...placement, width: placement.width + delta }, aspect, page);
}

/** The signature's box in visible page points, with its bottom-left corner. */
export interface SignatureBox extends WatermarkBox {
  readonly x: number;
  readonly y: number;
}

/**
 * The signature in the page's own points, counted from the bottom left.
 *
 * The y axis flips here and only here: a screen counts down from the top and a
 * page counts up from the bottom, and doing it in one place is what stops a
 * signature from appearing at the top of the document it was put at the foot of.
 */
export function getSignatureBox(
  page: WatermarkBox,
  placement: SignaturePlacement,
  aspect: number,
): SignatureBox {
  const clamped = clampSignaturePlacement(placement, aspect, page);
  const width = page.width * clamped.width;
  const height = width * (aspect > 0 ? 1 / aspect : 1);

  return {
    width,
    height,
    x: page.width * clamped.x - width / 2,
    y: page.height * (1 - clamped.y) - height / 2,
  };
}

/** Everything the writer needs for one page, in the space pdf-lib draws in. */
export interface SignaturePlan {
  readonly anchor: WatermarkPoint;
  readonly width: number;
  readonly height: number;
  /** The angle to draw at, which is the page's own rotation and nothing else. */
  readonly rotation: number;
}

/**
 * Where to draw the signature on one page.
 *
 * The placement is against the page as the visitor sees it; the page may carry
 * its own rotation, so the corner is moved into the unrotated space pdf-lib
 * draws in and the drawing is turned to match. That correction is the
 * watermark's, which is why it is imported rather than repeated.
 */
export function getSignaturePlan(
  media: WatermarkBox,
  placement: SignaturePlacement,
  aspect: number,
  pageRotation: number,
): SignaturePlan {
  const visible = getVisiblePageBox(media, pageRotation);
  const box = getSignatureBox(visible, placement, aspect);
  const rotation = ((Math.round(pageRotation) % 360) + 360) % 360;
  // pdf-lib turns what it draws about the corner it is given, so the corner
  // that ends up at the bottom left of the drawn signature depends on the turn.
  const corners = {
    0: { x: box.x, y: box.y },
    90: { x: box.x, y: box.y + box.height },
    180: { x: box.x + box.width, y: box.y + box.height },
    270: { x: box.x + box.width, y: box.y },
  } as const;
  const corner = corners[(rotation as 0 | 90 | 180 | 270)] ?? corners[0];

  return {
    anchor: toUnrotatedPoint(corner, media, rotation),
    width: box.width,
    height: box.height,
    rotation,
  };
}

export function validateSignPdfSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) return 'Choose a PDF to sign.';
  if (files.length > 1) return 'This Gizlet signs one PDF at a time. Choose a single file.';
  if (!isSupportedPdfFile(files[0])) {
    return `${files[0].name} is not a PDF. Choose a file that ends in .pdf.`;
  }

  return undefined;
}

export function validateSignPdfPageCount(pageCount: number): string | undefined {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return 'This PDF reports no pages, so there is nothing to sign.';
  }

  if (pageCount > maximumSignPdfPages) {
    return `This Gizlet signs up to ${maximumSignPdfPages.toLocaleString()} pages, and this PDF has ${pageCount.toLocaleString()}.`;
  }

  return undefined;
}

export function validateSignatureText(text: string): string | undefined {
  const trimmed = text.trim();

  if (trimmed === '') return 'Type the name you want to sign with.';
  if (trimmed.length > maximumSignatureTextLength) {
    return `Keep the signature to ${maximumSignatureTextLength} characters or fewer.`;
  }

  return undefined;
}

/** Whether a drawn signature has anything in it yet. */
export function validateDrawnSignature(strokeCount: number): string | undefined {
  return strokeCount > 0 ? undefined : 'Draw your signature in the box first.';
}

/** What is about to happen, as the visitor reads it. */
export function describeSignedPages(
  pages: readonly number[],
  pageCount: number,
): string {
  if (pages.length === 0) return 'No pages chosen.';
  if (pages.length === pageCount) return `Signed on every page · ${describePdfPageCount(pageCount)}`;

  return `Signed on ${describePdfPageCount(pages.length)} of ${pageCount}`;
}

/**
 * The line the Gizlet says about what it just did.
 *
 * It is here rather than in the markup because it is the sentence that has to
 * stay true: this places a picture of a signature onto a page, and nothing
 * about it verifies who placed it.
 */
export const signatureDisclaimer =
  'This is a visible signature drawn onto the page. It is not a certificate-based or cryptographic signature, and it proves nothing about who signed.';

export function getSignedPdfFilename(documentName: string): string {
  return `${documentName.replace(/\.[^.]+$/, '') || 'document'}-signed.pdf`;
}

export function getSignPdfOpenErrorMessage(errorName: string | undefined): string {
  if (errorName === 'PasswordException') {
    return 'This PDF is password-protected, so nothing can be drawn onto it. Open it in an app that can ask for the password, save an unlocked copy, and sign that.';
  }

  if (errorName === 'InvalidPDFException') {
    return 'This file is not a PDF that can be read. It may be damaged, or renamed from another format.';
  }

  return 'This PDF could not be opened, so it could not be signed.';
}

export function getSignatureImageErrorMessage(name: string): string {
  return `${name} could not be read as a picture. Choose a PNG, JPEG or WebP.`;
}

/**
 * Wording for a document pdf-lib will not draw onto.
 *
 * This is the second line: pdf.js has usually refused the document already at
 * the reader, and this is what a caller with no preview reports instead.
 */
export function getSignPdfSourceErrorMessage(reason: 'encrypted' | 'empty' | 'unreadable'): string {
  if (reason === 'encrypted') {
    return 'This PDF is password-protected, so nothing can be drawn onto its pages. Open it in an app that can ask for the password, save an unlocked copy, and sign that.';
  }

  if (reason === 'empty') {
    return 'This PDF has no pages, so there is nothing to sign.';
  }

  return 'This file could not be read as a PDF, so there is nothing to sign. It may be damaged, or renamed from another format.';
}

export function getSignPdfWriteErrorMessage(): string {
  return 'The signature could not be drawn onto this PDF on this device. Nothing was changed, and your original is untouched.';
}
