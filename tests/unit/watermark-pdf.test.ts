import { describe, expect, it } from 'vitest';

import { maximumPdfViewerPages } from '../../src/data/pdf-viewer';
import {
  clampWatermarkFontSize,
  clampWatermarkOpacity,
  clampWatermarkRotation,
  clampWatermarkScale,
  defaultWatermarkFontSize,
  defaultWatermarkOpacity,
  defaultWatermarkPosition,
  defaultWatermarkRotation,
  defaultWatermarkScale,
  describeWatermarkOpacity,
  describeWatermarkedPages,
  getPdfWatermarkErrorMessage,
  getVisiblePageBox,
  getWatermarkAnchor,
  getWatermarkCentre,
  getWatermarkDrawRotation,
  getWatermarkImageErrorMessage,
  getWatermarkImageSize,
  getWatermarkPdfOpenErrorMessage,
  getWatermarkPlacement,
  getWatermarkPositionLabel,
  getWatermarkPositionOptions,
  getWatermarkPreviewPlacement,
  getWatermarkWordOptions,
  getWatermarkWordText,
  getWatermarkWriteErrorMessage,
  getWatermarkedPdfFilename,
  isWatermarkKind,
  isWatermarkPosition,
  isWatermarkWord,
  largeWatermarkPdfPages,
  maximumWatermarkFontSize,
  maximumWatermarkPdfPages,
  maximumWatermarkTextLength,
  minimumWatermarkFontSize,
  toUnrotatedPoint,
  validateWatermarkPdfPageCount,
  validateWatermarkPdfSelection,
  validateWatermarkText,
  watermarkMarginRatio,
  watermarkPositions,
  watermarkWords,
  type WatermarkBox,
  type WatermarkPoint,
} from '../../src/data/watermark-pdf';

const pdf = (name: string) => ({ name, type: 'application/pdf' });

/** A portrait page, and a mark small enough to sit anywhere on it. */
const page: WatermarkBox = { width: 300, height: 400 };
const mark: WatermarkBox = { width: 60, height: 20 };
const margin = Math.min(page.width, page.height) * watermarkMarginRatio;

const round = (point: WatermarkPoint) => ({
  x: Math.round(point.x * 100) / 100,
  y: Math.round(point.y * 100) / 100,
});

describe('validateWatermarkPdfSelection', () => {
  it('accepts one PDF', () => {
    expect(validateWatermarkPdfSelection([pdf('contract.pdf')])).toBeUndefined();
    expect(validateWatermarkPdfSelection([{ name: 'scan.PDF', type: '' }])).toBeUndefined();
  });

  it('asks for a file, refuses several, and names one that is not a PDF', () => {
    expect(validateWatermarkPdfSelection([])).toBe('Choose a PDF to watermark.');
    expect(validateWatermarkPdfSelection([pdf('a.pdf'), pdf('b.pdf')])).toBe(
      'This Gizlet watermarks one PDF at a time. Choose a single file.',
    );
    expect(validateWatermarkPdfSelection([{ name: 'notes.txt', type: 'text/plain' }])).toBe(
      'notes.txt is not a PDF. Choose a file that ends in .pdf.',
    );
  });
});

describe('validateWatermarkPdfPageCount', () => {
  it('accepts a document with pages, up to the guard', () => {
    expect(validateWatermarkPdfPageCount(1)).toBeUndefined();
    expect(validateWatermarkPdfPageCount(maximumWatermarkPdfPages)).toBeUndefined();
  });

  it('refuses a document with nothing in it, and one past the guard', () => {
    expect(validateWatermarkPdfPageCount(0)).toBe(
      'This PDF has no pages, so there is nothing to watermark.',
    );
    expect(validateWatermarkPdfPageCount(maximumWatermarkPdfPages + 1)).toContain(
      maximumWatermarkPdfPages.toLocaleString(),
    );
  });

  it('guards at the page count the viewer opens', () => {
    expect(maximumWatermarkPdfPages).toBe(maximumPdfViewerPages);
    expect(largeWatermarkPdfPages).toBeLessThan(maximumWatermarkPdfPages);
  });
});

describe('validateWatermarkText', () => {
  it('wants something to stamp', () => {
    expect(validateWatermarkText('DRAFT')).toBeUndefined();
    expect(validateWatermarkText('   ')).toBe('Write the text you want stamped on the pages.');
    expect(validateWatermarkText('')).toBe('Write the text you want stamped on the pages.');
  });

  it('keeps a mark a mark rather than a paragraph', () => {
    const long = 'x'.repeat(maximumWatermarkTextLength + 1);

    expect(validateWatermarkText('x'.repeat(maximumWatermarkTextLength))).toBeUndefined();
    expect(validateWatermarkText(long)).toContain(String(maximumWatermarkTextLength));
  });
});

describe('the number controls', () => {
  it('clamps to whole numbers inside their range', () => {
    expect(clampWatermarkFontSize(64)).toBe(64);
    expect(clampWatermarkFontSize(1)).toBe(minimumWatermarkFontSize);
    expect(clampWatermarkFontSize(9_000)).toBe(maximumWatermarkFontSize);
    expect(clampWatermarkFontSize(12.4)).toBe(12);
    expect(clampWatermarkFontSize(Number.NaN)).toBe(defaultWatermarkFontSize);

    expect(clampWatermarkScale(0)).toBe(5);
    expect(clampWatermarkScale(400)).toBe(100);
    expect(clampWatermarkScale(Number.NaN)).toBe(defaultWatermarkScale);

    expect(clampWatermarkOpacity(0)).toBe(5);
    expect(clampWatermarkOpacity(140)).toBe(100);
    expect(clampWatermarkOpacity(Number.NaN)).toBe(defaultWatermarkOpacity);
  });

  it('wraps a turn rather than clamping it, because a turn is a circle', () => {
    expect(clampWatermarkRotation(45)).toBe(45);
    expect(clampWatermarkRotation(370)).toBe(10);
    expect(clampWatermarkRotation(-90)).toBe(270);
    expect(clampWatermarkRotation(720)).toBe(0);
    expect(clampWatermarkRotation(Number.NaN)).toBe(defaultWatermarkRotation);
  });
});

describe('the closed lists', () => {
  it('names nine positions, each labelled once', () => {
    const options = getWatermarkPositionOptions();

    expect(options.map((option) => option.value)).toEqual([...watermarkPositions]);
    expect(new Set(options.map((option) => option.label)).size).toBe(watermarkPositions.length);
    expect(getWatermarkPositionLabel('bottom-right')).toBe('Bottom right');
    expect(isWatermarkPosition(defaultWatermarkPosition)).toBe(true);
    expect(isWatermarkPosition('middle')).toBe(false);
  });

  it('names the words a link may carry, stamped as they are read', () => {
    expect(isWatermarkWord('draft')).toBe(true);
    expect(isWatermarkWord('anything')).toBe(false);
    expect(getWatermarkWordText('confidential')).toBe('CONFIDENTIAL');
    expect(getWatermarkWordOptions().map((option) => option.label)).toEqual(
      watermarkWords.map((word) => word.toUpperCase()),
    );
  });

  it('knows the two kinds of mark and nothing else', () => {
    expect(isWatermarkKind('text')).toBe(true);
    expect(isWatermarkKind('image')).toBe(true);
    expect(isWatermarkKind('stamp')).toBe(false);
  });
});

describe('getVisiblePageBox', () => {
  it('swaps the sides of a quarter-turned page, and leaves the others', () => {
    expect(getVisiblePageBox(page, 0)).toEqual(page);
    expect(getVisiblePageBox(page, 180)).toEqual(page);
    expect(getVisiblePageBox(page, 90)).toEqual({ width: 400, height: 300 });
    expect(getVisiblePageBox(page, 270)).toEqual({ width: 400, height: 300 });
  });
});

describe('getWatermarkCentre', () => {
  it('puts the centre in the middle of the page', () => {
    expect(getWatermarkCentre(page, mark, 'centre')).toEqual({ x: 150, y: 200 });
  });

  it('keeps a corner a margin in from both edges', () => {
    expect(getWatermarkCentre(page, mark, 'bottom-left')).toEqual({
      x: margin + mark.width / 2,
      y: margin + mark.height / 2,
    });
    expect(getWatermarkCentre(page, mark, 'top-right')).toEqual({
      x: page.width - margin - mark.width / 2,
      y: page.height - margin - mark.height / 2,
    });
  });

  it('centres an edge on the axis it does not name', () => {
    expect(getWatermarkCentre(page, mark, 'top')).toEqual({
      x: 150,
      y: page.height - margin - mark.height / 2,
    });
    expect(getWatermarkCentre(page, mark, 'left')).toEqual({
      x: margin + mark.width / 2,
      y: 200,
    });
  });

  /**
   * A mark wider than the page has no corner to sit in, and pushing it off the
   * edge would be a worse answer than the middle of the axis it cannot fit on.
   */
  it('centres an axis the mark is too big for, and keeps the other one', () => {
    const wide: WatermarkBox = { width: 900, height: 20 };

    expect(getWatermarkCentre(page, wide, 'bottom-left')).toEqual({
      x: 150,
      y: margin + 10,
    });
    expect(getWatermarkCentre(page, wide, 'top-right')).toEqual({
      x: 150,
      y: page.height - margin - 10,
    });
  });
});

describe('getWatermarkAnchor', () => {
  it('is the bottom-left corner when the mark is not turned', () => {
    expect(round(getWatermarkAnchor({ x: 150, y: 200 }, mark, 0))).toEqual({ x: 120, y: 190 });
  });

  /**
   * pdf-lib turns what it draws about the point it is given, so the anchor has
   * to move as the mark turns for the mark to stay where it was put. A quarter
   * turn is the case with no rounding in it.
   */
  it('moves so the mark stays centred where it was placed', () => {
    const centre = { x: 150, y: 200 };

    expect(round(getWatermarkAnchor(centre, mark, 90))).toEqual({ x: 160, y: 170 });
    expect(round(getWatermarkAnchor(centre, mark, 180))).toEqual({ x: 180, y: 210 });
    expect(round(getWatermarkAnchor(centre, mark, 270))).toEqual({ x: 140, y: 230 });
  });

  it('turns the mark about its own centre, whatever the angle', () => {
    const centre = { x: 150, y: 200 };

    for (const rotation of [0, 30, 45, 90, 137, 180, 270, 315]) {
      const anchor = getWatermarkAnchor(centre, mark, rotation);
      const radians = (rotation * Math.PI) / 180;
      // The centre, worked forward from the anchor, is the centre it was given.
      const back = {
        x: anchor.x + (mark.width / 2) * Math.cos(radians) - (mark.height / 2) * Math.sin(radians),
        y: anchor.y + (mark.width / 2) * Math.sin(radians) + (mark.height / 2) * Math.cos(radians),
      };

      expect(round(back), String(rotation)).toEqual(centre);
    }
  });
});

describe('toUnrotatedPoint', () => {
  it('leaves a page that is not turned alone', () => {
    expect(toUnrotatedPoint({ x: 10, y: 20 }, page, 0)).toEqual({ x: 10, y: 20 });
  });

  /**
   * The corners are the cases worth naming. A page displayed a quarter turn
   * clockwise shows its unrotated bottom-left corner at the top left, so a mark
   * meant for the visible bottom-left is drawn at the unrotated bottom-right.
   */
  it('maps the visible bottom-left corner onto the page for each quarter turn', () => {
    expect(toUnrotatedPoint({ x: 0, y: 0 }, page, 90)).toEqual({ x: 300, y: 0 });
    expect(toUnrotatedPoint({ x: 0, y: 0 }, page, 180)).toEqual({ x: 300, y: 400 });
    expect(toUnrotatedPoint({ x: 0, y: 0 }, page, 270)).toEqual({ x: 0, y: 400 });
  });

  it('keeps every mapped point inside the page it was mapped onto', () => {
    for (const pageRotation of [0, 90, 180, 270]) {
      const visible = getVisiblePageBox(page, pageRotation);

      for (const point of [
        { x: 0, y: 0 },
        { x: visible.width, y: 0 },
        { x: 0, y: visible.height },
        { x: visible.width, y: visible.height },
        { x: visible.width / 2, y: visible.height / 2 },
      ]) {
        const mapped = toUnrotatedPoint(point, page, pageRotation);

        expect(mapped.x, `${pageRotation}`).toBeGreaterThanOrEqual(0);
        expect(mapped.x, `${pageRotation}`).toBeLessThanOrEqual(page.width);
        expect(mapped.y, `${pageRotation}`).toBeGreaterThanOrEqual(0);
        expect(mapped.y, `${pageRotation}`).toBeLessThanOrEqual(page.height);
      }
    }
  });
});

describe('getWatermarkDrawRotation', () => {
  it('adds the rotation the page itself carries, so a mark reads level on it', () => {
    expect(getWatermarkDrawRotation(0, 0)).toBe(0);
    expect(getWatermarkDrawRotation(0, 90)).toBe(90);
    expect(getWatermarkDrawRotation(45, 90)).toBe(135);
    expect(getWatermarkDrawRotation(315, 90)).toBe(45);
    expect(getWatermarkDrawRotation(270, 270)).toBe(180);
  });
});

describe('getWatermarkPlacement', () => {
  it('places a mark on an unturned page from its corner', () => {
    const placement = getWatermarkPlacement(page, mark, {
      position: 'bottom-left',
      rotation: 0,
      pageRotation: 0,
    });

    expect(round(placement.anchor)).toEqual({ x: margin, y: margin });
    expect(placement.rotation).toBe(0);
  });

  /**
   * The whole point of the page-rotation correction: the same request on the
   * same page, turned, lands in the corner the visitor is looking at rather
   * than off the edge of it. Each anchor is inside the page's own box.
   */
  it('keeps a bottom-left mark bottom-left on every page rotation', () => {
    for (const pageRotation of [0, 90, 180, 270]) {
      const placement = getWatermarkPlacement(page, mark, {
        position: 'bottom-left',
        rotation: 0,
        pageRotation,
      });

      expect(placement.rotation, `${pageRotation}`).toBe(pageRotation);
      expect(placement.anchor.x, `${pageRotation}`).toBeGreaterThanOrEqual(0);
      expect(placement.anchor.x, `${pageRotation}`).toBeLessThanOrEqual(page.width);
      expect(placement.anchor.y, `${pageRotation}`).toBeGreaterThanOrEqual(0);
      expect(placement.anchor.y, `${pageRotation}`).toBeLessThanOrEqual(page.height);
    }
  });

  it('draws a centred mark from the middle of the page, turned about itself', () => {
    const placement = getWatermarkPlacement(page, mark, {
      position: 'centre',
      rotation: 45,
      pageRotation: 0,
    });

    expect(placement.rotation).toBe(45);
    // Turned about its centre, so the anchor is no longer the corner it was.
    expect(round(placement.anchor)).not.toEqual({ x: 120, y: 190 });
    expect(placement.anchor.x).toBeLessThan(150);
  });
});

describe('getWatermarkImageSize', () => {
  it('sizes a picture as a share of the page width, keeping its shape', () => {
    expect(getWatermarkImageSize(page, { width: 200, height: 100 }, 50)).toEqual({
      width: 150,
      height: 75,
    });
    expect(getWatermarkImageSize(page, { width: 100, height: 400 }, 20)).toEqual({
      width: 60,
      height: 240,
    });
  });

  it('clamps a share outside the range, and survives a picture with no width', () => {
    expect(getWatermarkImageSize(page, { width: 100, height: 100 }, 900).width).toBe(300);
    expect(getWatermarkImageSize(page, { width: 0, height: 0 }, 50)).toEqual({
      width: 150,
      height: 150,
    });
  });
});

describe('getWatermarkPreviewPlacement', () => {
  it('reports the centre as a fraction of the page, counting down from the top', () => {
    expect(getWatermarkPreviewPlacement(page, mark, { position: 'centre', pageRotation: 0 })).toEqual({
      left: 0.5,
      top: 0.5,
    });

    const bottomLeft = getWatermarkPreviewPlacement(page, mark, {
      position: 'bottom-left',
      pageRotation: 0,
    });

    // A browser counts down, so the bottom of the page is a large `top`.
    expect(bottomLeft.left).toBeLessThan(0.5);
    expect(bottomLeft.top).toBeGreaterThan(0.5);
  });

  it('says the middle of nothing rather than dividing by a page with no size', () => {
    expect(
      getWatermarkPreviewPlacement({ width: 0, height: 0 }, mark, {
        position: 'top-left',
        pageRotation: 0,
      }),
    ).toEqual({ left: 0.5, top: 0.5 });
  });
});

describe('what the workspace says', () => {
  it('names the pages being marked, and says so when it is all of them', () => {
    expect(describeWatermarkedPages([1, 2, 3], 3)).toBe('Every page · 3 pages');
    expect(describeWatermarkedPages([1], 1)).toBe('Every page · 1 page');
    expect(describeWatermarkedPages([2, 4], 9)).toBe('2 of 9 pages');
  });

  it('reads a strength back as the percentage it is', () => {
    expect(describeWatermarkOpacity(30)).toBe('30%');
    expect(describeWatermarkOpacity(0)).toBe('5%');
  });

  it('names the marked document after the one it came from', () => {
    expect(getWatermarkedPdfFilename('contract.pdf')).toBe('contract-watermarked.pdf');
    expect(getWatermarkedPdfFilename('scan')).toBe('scan-watermarked.pdf');
    expect(getWatermarkedPdfFilename('.pdf')).toBe('document-watermarked.pdf');
  });
});

describe('the wording of a refusal', () => {
  it('tells a visitor with a locked document what to do about it', () => {
    expect(getWatermarkPdfOpenErrorMessage('PasswordException')).toContain('unlocked copy');
    expect(getPdfWatermarkErrorMessage('encrypted')).toContain('unlocked copy');
  });

  it('separates a file that is not a PDF from one that will not read', () => {
    expect(getWatermarkPdfOpenErrorMessage('InvalidPDFException')).toContain(
      'not a PDF that can be read',
    );
    expect(getWatermarkPdfOpenErrorMessage('MissingPDFException')).toContain('from your device');
    expect(getWatermarkPdfOpenErrorMessage(undefined)).toBe(
      'This PDF could not be opened, so there is nothing to watermark.',
    );
    expect(getPdfWatermarkErrorMessage('empty')).toBe(
      'This PDF has no pages, so there is nothing to watermark.',
    );
    expect(getPdfWatermarkErrorMessage('unreadable')).toContain('could not be read as a PDF');
  });

  it('names a picture it could not read, and says the pages are unchanged', () => {
    expect(getWatermarkImageErrorMessage('logo.svg')).toContain('logo.svg');
    expect(getWatermarkImageErrorMessage('logo.svg')).toContain('PNG or a JPEG');
    expect(getWatermarkWriteErrorMessage()).toContain('pages are unchanged');
  });
});
