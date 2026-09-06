import { describePdfPageCount } from './jpg-to-pdf';
import type { SelectOption } from './pdf-to-jpg';
import { isSupportedPdfFile, maximumPdfViewerPages } from './pdf-viewer';

/**
 * Deterministic logic for the Watermark PDF Gizlet: which files it accepts,
 * where a mark lands on a page, which way up it is drawn, and which pages get
 * one.
 *
 * The placement is the part worth testing, and all of it is here: a page is a
 * box, a mark is a box, and where the second goes on the first is arithmetic
 * that needs no document. The workspace draws its preview from these same
 * functions, so the overlay a visitor positions the mark with and the document
 * that comes out cannot disagree about where it went.
 *
 * Nothing here touches pdf-lib. The adapter in `src/scripts/pdf-generation.ts`
 * owns the library; this module owns every decision about it, including how a
 * refusal is worded.
 */

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/** A width and a height, in PDF points. Both a page and a mark are one. */
export interface WatermarkBox {
  readonly width: number;
  readonly height: number;
}

export interface WatermarkPoint {
  readonly x: number;
  readonly y: number;
}

/** What the mark is made of. */
export type WatermarkKind = 'text' | 'image';

export const watermarkKinds = ['text', 'image'] as const satisfies readonly WatermarkKind[];

export const defaultWatermarkKind: WatermarkKind = 'text';

export function isWatermarkKind(value: string): value is WatermarkKind {
  return (watermarkKinds as readonly string[]).includes(value);
}

/**
 * Where on the page the mark sits.
 *
 * Nine places rather than a pair of coordinates: a watermark is put somewhere
 * on every page at once, and a position that means the same thing on a portrait
 * page and a landscape one has to be named rather than measured.
 */
export const watermarkPositions = [
  'centre',
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const;

export type WatermarkPosition = (typeof watermarkPositions)[number];

export const defaultWatermarkPosition: WatermarkPosition = 'centre';

const watermarkPositionLabels = {
  centre: 'Centre',
  'top-left': 'Top left',
  top: 'Top',
  'top-right': 'Top right',
  left: 'Left',
  right: 'Right',
  'bottom-left': 'Bottom left',
  bottom: 'Bottom',
  'bottom-right': 'Bottom right',
} as const satisfies Record<WatermarkPosition, string>;

export function isWatermarkPosition(value: string): value is WatermarkPosition {
  return (watermarkPositions as readonly string[]).includes(value);
}

export function getWatermarkPositionLabel(position: WatermarkPosition): string {
  return watermarkPositionLabels[position];
}

export function getWatermarkPositionOptions(): readonly SelectOption<WatermarkPosition>[] {
  return watermarkPositions.map((position) => ({
    value: position,
    label: watermarkPositionLabels[position],
  }));
}

/**
 * The words a Flow may stamp.
 *
 * The workspace takes any text. A recipe link cannot: every value that format
 * carries is a whole number or one of a closed list of names, precisely so a
 * link can never hold something a visitor typed. A watermark is the one Gizlet
 * where that rule bites, and this is the honest answer to it — the words
 * anybody actually stamps, named rather than typed.
 */
export const watermarkWords = ['draft', 'confidential', 'copy', 'sample', 'void'] as const;

export type WatermarkWord = (typeof watermarkWords)[number];

export const defaultWatermarkWord: WatermarkWord = 'draft';

export function isWatermarkWord(value: string): value is WatermarkWord {
  return (watermarkWords as readonly string[]).includes(value);
}

/** The word as it is stamped, which is the word as it is read: in capitals. */
export function getWatermarkWordText(word: WatermarkWord): string {
  return word.toUpperCase();
}

export function getWatermarkWordOptions(): readonly SelectOption<WatermarkWord>[] {
  return watermarkWords.map((word) => ({ value: word, label: getWatermarkWordText(word) }));
}

/** How far the mark stays from the edge, as a fraction of the page's shorter side. */
export const watermarkMarginRatio = 0.04;

/** The text controls, in points and in whole numbers. */
export const minimumWatermarkFontSize = 8;
export const maximumWatermarkFontSize = 240;
export const defaultWatermarkFontSize = 64;

/** An image mark is sized against the page rather than in points it has no feel for. */
export const minimumWatermarkScale = 5;
export const maximumWatermarkScale = 100;
export const defaultWatermarkScale = 40;

export const minimumWatermarkOpacity = 5;
export const maximumWatermarkOpacity = 100;
export const defaultWatermarkOpacity = 30;

/** A turn in whole degrees, counter-clockwise, as the mark is read. */
export const maximumWatermarkRotation = 359;
export const defaultWatermarkRotation = 45;

/** The longest text this Gizlet will stamp, so a mark stays a mark. */
export const maximumWatermarkTextLength = 60;

/**
 * The memory guard, in pages.
 *
 * A watermark draws onto pages already in the document rather than copying them
 * anywhere, so the ceiling is the one the PDF Viewer opens: a document this
 * Gizlet can stamp is one the Gizlet next to it can read.
 */
export const maximumWatermarkPdfPages = maximumPdfViewerPages;

/** Above this the Gizlet reports its progress rather than looking stalled. */
export const largeWatermarkPdfPages = 50;

/** Why a document cannot be stamped. */
export type PdfWatermarkFailure = 'encrypted' | 'empty' | 'unreadable';

/** The Gizlet stamps one document at a time, so a selection is one PDF. */
export function validateWatermarkPdfSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) {
    return 'Choose a PDF to watermark.';
  }

  if (files.length > 1) {
    return 'This Gizlet watermarks one PDF at a time. Choose a single file.';
  }

  if (!isSupportedPdfFile(files[0])) {
    return `${files[0].name} is not a PDF. Choose a file that ends in .pdf.`;
  }

  return undefined;
}

/** Checked once the page count is known, which needs the document parsed. */
export function validateWatermarkPdfPageCount(pageCount: number): string | undefined {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return 'This PDF has no pages, so there is nothing to watermark.';
  }

  if (pageCount > maximumWatermarkPdfPages) {
    return `This Gizlet watermarks documents of up to ${maximumWatermarkPdfPages.toLocaleString()} pages, and this PDF has ${pageCount.toLocaleString()}. Split it into shorter documents first.`;
  }

  return undefined;
}

/** The mark itself has to say something. */
export function validateWatermarkText(text: string): string | undefined {
  if (text.trim() === '') {
    return 'Write the text you want stamped on the pages.';
  }

  if (text.trim().length > maximumWatermarkTextLength) {
    return `A watermark is at most ${maximumWatermarkTextLength} characters, and this is ${text.trim().length}.`;
  }

  return undefined;
}

/** Whole numbers inside their range, so a crafted value cannot reach the writer. */
function clampWhole(value: number, minimum: number, maximum: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;

  return Math.min(Math.max(Math.round(value), minimum), maximum);
}

export function clampWatermarkFontSize(value: number): number {
  return clampWhole(value, minimumWatermarkFontSize, maximumWatermarkFontSize, defaultWatermarkFontSize);
}

export function clampWatermarkScale(value: number): number {
  return clampWhole(value, minimumWatermarkScale, maximumWatermarkScale, defaultWatermarkScale);
}

export function clampWatermarkOpacity(value: number): number {
  return clampWhole(value, minimumWatermarkOpacity, maximumWatermarkOpacity, defaultWatermarkOpacity);
}

/** A turn wraps rather than clamping: 370 degrees is 10, not 359. */
export function clampWatermarkRotation(value: number): number {
  if (!Number.isFinite(value)) return defaultWatermarkRotation;

  return ((Math.round(value) % 360) + 360) % 360;
}

/**
 * The page as the visitor sees it.
 *
 * A PDF page carries its own rotation, and a quarter-turned page is displayed
 * with its sides swapped — which is the difference between a mark in the corner
 * of the page and a mark off the edge of it. Everything about placement below
 * happens in this space, the one the viewer draws and the visitor points at.
 */
export function getVisiblePageBox(media: WatermarkBox, pageRotation: number): WatermarkBox {
  return clampWatermarkRotation(pageRotation) % 180 === 90
    ? { width: media.height, height: media.width }
    : media;
}

/**
 * Where the centre of the mark goes, in visible page space.
 *
 * A mark larger than the space it was given is centred rather than pushed off
 * the page: the visitor asked for a corner, and the honest reading of a corner
 * that cannot hold it is the middle of the axis it does not fit on.
 */
export function getWatermarkCentre(
  page: WatermarkBox,
  mark: WatermarkBox,
  position: WatermarkPosition,
): WatermarkPoint {
  const margin = Math.min(page.width, page.height) * watermarkMarginRatio;
  const halfWidth = mark.width / 2;
  const halfHeight = mark.height / 2;

  const near = (extent: number, half: number) =>
    half * 2 + margin * 2 > extent ? extent / 2 : margin + half;
  const far = (extent: number, half: number) =>
    half * 2 + margin * 2 > extent ? extent / 2 : extent - margin - half;

  const left = near(page.width, halfWidth);
  const right = far(page.width, halfWidth);
  const bottom = near(page.height, halfHeight);
  const top = far(page.height, halfHeight);
  const middleX = page.width / 2;
  const middleY = page.height / 2;

  const places = {
    centre: { x: middleX, y: middleY },
    'top-left': { x: left, y: top },
    top: { x: middleX, y: top },
    'top-right': { x: right, y: top },
    left: { x: left, y: middleY },
    right: { x: right, y: middleY },
    'bottom-left': { x: left, y: bottom },
    bottom: { x: middleX, y: bottom },
    'bottom-right': { x: right, y: bottom },
  } as const satisfies Record<WatermarkPosition, WatermarkPoint>;

  return places[position];
}

/**
 * The bottom-left corner to draw from, for a mark turned about its own centre.
 *
 * pdf-lib turns what it draws about the point it is given, so a rotated mark
 * placed by its corner drifts away from where it was meant to be. The corner is
 * therefore worked back from the centre: the offset to the centre, turned by
 * the same angle, subtracted.
 */
export function getWatermarkAnchor(
  centre: WatermarkPoint,
  mark: WatermarkBox,
  rotation: number,
): WatermarkPoint {
  const radians = (clampWatermarkRotation(rotation) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = mark.width / 2;
  const halfHeight = mark.height / 2;

  return {
    x: centre.x - (halfWidth * cos - halfHeight * sin),
    y: centre.y - (halfWidth * sin + halfHeight * cos),
  };
}

/**
 * A point in visible page space, in the unrotated space pdf-lib draws in.
 *
 * The four cases are the four quarter turns a page may carry. A page displayed
 * a quarter turn clockwise, for instance, shows its unrotated bottom-left
 * corner at the top left, so a mark meant for the visible bottom-left has to be
 * drawn somewhere else entirely.
 */
export function toUnrotatedPoint(
  point: WatermarkPoint,
  media: WatermarkBox,
  pageRotation: number,
): WatermarkPoint {
  const rotation = clampWatermarkRotation(pageRotation);

  if (rotation === 90) return { x: media.width - point.y, y: point.x };
  if (rotation === 180) return { x: media.width - point.x, y: media.height - point.y };
  if (rotation === 270) return { x: point.y, y: media.height - point.x };

  return point;
}

/**
 * The angle to draw at so the mark is read at `rotation` on the displayed page.
 *
 * The page's own rotation turns everything drawn on it, the mark included, so
 * the mark is drawn turned by that much again to come back level.
 */
export function getWatermarkDrawRotation(rotation: number, pageRotation: number): number {
  return clampWatermarkRotation(clampWatermarkRotation(rotation) + clampWatermarkRotation(pageRotation));
}

/** An image mark's size on the page: a share of the visible page's width. */
export function getWatermarkImageSize(
  page: WatermarkBox,
  image: WatermarkBox,
  scale: number,
): WatermarkBox {
  const width = (page.width * clampWatermarkScale(scale)) / 100;
  const ratio = image.width > 0 ? image.height / image.width : 1;

  return { width, height: width * ratio };
}

/** Everything the writer needs for one page, worked out before it is drawn. */
export interface WatermarkPlacement {
  /** Where to draw from, in the page's own unrotated coordinates. */
  readonly anchor: WatermarkPoint;
  /** The angle to draw at, which includes the page's own rotation. */
  readonly rotation: number;
}

/**
 * The whole placement for one page, from the page's own dimensions and the
 * mark's. This is the function the workspace's preview and the writer both use,
 * which is what stops the two from disagreeing.
 */
export function getWatermarkPlacement(
  media: WatermarkBox,
  mark: WatermarkBox,
  options: {
    readonly position: WatermarkPosition;
    readonly rotation: number;
    readonly pageRotation: number;
  },
): WatermarkPlacement {
  const visible = getVisiblePageBox(media, options.pageRotation);
  const centre = getWatermarkCentre(visible, mark, options.position);
  const drawRotation = getWatermarkDrawRotation(options.rotation, options.pageRotation);
  const visibleAnchor = getWatermarkAnchor(centre, mark, options.rotation);

  return {
    anchor: toUnrotatedPoint(visibleAnchor, media, options.pageRotation),
    rotation: drawRotation,
  };
}

/**
 * Where the mark sits as a fraction of the visible page, for a preview drawn
 * over a canvas that has no idea what a PDF point is.
 *
 * The y axis is flipped on the way out, because a page counts up from the
 * bottom and a browser counts down from the top.
 */
export function getWatermarkPreviewPlacement(
  media: WatermarkBox,
  mark: WatermarkBox,
  options: { readonly position: WatermarkPosition; readonly pageRotation: number },
): { readonly left: number; readonly top: number } {
  const visible = getVisiblePageBox(media, options.pageRotation);
  const centre = getWatermarkCentre(visible, mark, options.position);

  return {
    left: visible.width > 0 ? centre.x / visible.width : 0.5,
    top: visible.height > 0 ? 1 - centre.y / visible.height : 0.5,
  };
}

function basenameOf(documentName: string, fallback: string): string {
  return documentName.replace(/\.[^.]+$/, '') || fallback;
}

export function getWatermarkedPdfFilename(documentName: string): string {
  return `${basenameOf(documentName, 'document')}-watermarked.pdf`;
}

/** "3 of 12 pages", the line the workspace shows about the selection. */
export function describeWatermarkedPages(
  selected: readonly number[],
  pageCount: number,
): string {
  return selected.length === pageCount
    ? `Every page · ${describePdfPageCount(pageCount)}`
    : `${selected.length} of ${pageCount} pages`;
}

/** Wording for a mark nobody can see, which is a setting rather than a failure. */
export function describeWatermarkOpacity(opacity: number): string {
  return `${clampWatermarkOpacity(opacity)}%`;
}

/**
 * Turns a pdf.js failure into something the visitor can act on.
 *
 * The workspace draws the document so the mark can be placed on a page the
 * visitor can see, which means pdf.js meets the document first and its refusals
 * are the ones actually read.
 */
export function getWatermarkPdfOpenErrorMessage(errorName: string | undefined): string {
  if (errorName === 'PasswordException') {
    return 'This PDF is password-protected, so nothing can be drawn onto its pages. Open it in an app that can ask for the password, save an unlocked copy, and watermark that.';
  }

  if (errorName === 'InvalidPDFException') {
    return 'This file is not a PDF that can be read, so there is nothing to watermark. It may be damaged, or renamed from another format.';
  }

  if (errorName === 'MissingPDFException') {
    return 'This PDF could not be read from your device. Try choosing it again.';
  }

  return 'This PDF could not be opened, so there is nothing to watermark.';
}

/**
 * Turns a document pdf-lib cannot stamp into something the visitor can act on.
 * These are the second line: pdf.js has usually refused the document already,
 * and this is what the flow builder — which stamps a PDF it made itself, with
 * no preview to draw — reports instead.
 */
export function getPdfWatermarkErrorMessage(reason: PdfWatermarkFailure): string {
  if (reason === 'encrypted') {
    return 'This PDF is password-protected, so nothing can be drawn onto its pages. Open it in an app that can ask for the password, save an unlocked copy, and watermark that.';
  }

  if (reason === 'empty') {
    return 'This PDF has no pages, so there is nothing to watermark.';
  }

  return 'This file could not be read as a PDF, so there is nothing to watermark. It may be damaged, or renamed from another format.';
}

/** Wording for an image that will not go onto a page. */
export function getWatermarkImageErrorMessage(name: string): string {
  return `${name} could not be read as an image, so it cannot be stamped onto the pages. Try a PNG or a JPEG.`;
}

/** Wording for a document the library would not write. */
export function getWatermarkWriteErrorMessage(): string {
  return 'The watermark could not be drawn onto this document. Its pages are unchanged, and the settings above are as you left them.';
}
