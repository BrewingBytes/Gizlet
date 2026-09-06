import { describe, expect, it } from 'vitest';

import {
  clampSignaturePlacement,
  clampSignatureWidth,
  defaultSignatureKind,
  defaultSignaturePlacement,
  describeSignedPages,
  getSignatureBox,
  getSignatureHeightFraction,
  getSignatureKindOptions,
  getSignaturePlan,
  getSignPdfOpenErrorMessage,
  getSignPdfSourceErrorMessage,
  getSignPdfWriteErrorMessage,
  getSignedPdfFilename,
  isSignatureKind,
  maximumSignPdfPages,
  maximumSignatureTextLength,
  maximumSignatureWidth,
  minimumSignatureWidth,
  moveSignature,
  resizeSignature,
  signatureDisclaimer,
  signatureKinds,
  validateDrawnSignature,
  validateSignPdfPageCount,
  validateSignPdfSelection,
  validateSignatureText,
} from '../../src/data/sign-pdf';

/** A4 in points, and a signature three times wider than it is tall. */
const page = { width: 600, height: 800 };
const aspect = 3;

describe('what a signature may be', () => {
  it('resolves each kind it offers', () => {
    for (const kind of signatureKinds) expect(isSignatureKind(kind), kind).toBe(true);

    expect(isSignatureKind('scanned')).toBe(false);
    expect(getSignatureKindOptions().map((option) => option.value)).toEqual([...signatureKinds]);
    expect(defaultSignatureKind).toBe('drawn');
  });

  it('asks for something to sign with', () => {
    expect(validateSignatureText('')).toMatch(/Type the name/);
    expect(validateSignatureText('   ')).toMatch(/Type the name/);
    expect(validateSignatureText('a'.repeat(maximumSignatureTextLength + 1))).toMatch(
      new RegExp(String(maximumSignatureTextLength)),
    );
    expect(validateSignatureText('A. Visitor')).toBeUndefined();
    expect(validateDrawnSignature(0)).toMatch(/Draw your signature/);
    expect(validateDrawnSignature(3)).toBeUndefined();
  });

  it('never claims to be more than a picture on a page', () => {
    expect(signatureDisclaimer).toMatch(/not a certificate-based or cryptographic signature/);
    expect(signatureDisclaimer).toMatch(/proves nothing about who signed/);
  });
});

describe('keeping the signature on the page', () => {
  it('bounds the centre by the signature’s own size, not the page edge', () => {
    const height = getSignatureHeightFraction(0.3, aspect, page);
    const pushed = clampSignaturePlacement({ x: 5, y: -5, width: 0.3 }, aspect, page);

    expect(pushed.x).toBeCloseTo(1 - 0.15, 5);
    expect(pushed.y).toBeCloseTo(height / 2, 5);
  });

  it('keeps the width inside what it will draw', () => {
    expect(clampSignatureWidth(0)).toBe(minimumSignatureWidth);
    expect(clampSignatureWidth(5)).toBe(maximumSignatureWidth);
    expect(clampSignatureWidth(Number.NaN)).toBe(defaultSignaturePlacement.width);
  });

  it('moves and resizes about its own centre, and stops at the edge', () => {
    const moved = moveSignature(defaultSignaturePlacement, { x: 0.1, y: 0 }, aspect, page);

    expect(moved.x).toBeCloseTo(0.72, 5);

    const shoved = moveSignature(defaultSignaturePlacement, { x: 1, y: 1 }, aspect, page);

    expect(shoved.x).toBeLessThanOrEqual(1);
    expect(shoved.y).toBeLessThanOrEqual(1);

    const bigger = resizeSignature(defaultSignaturePlacement, 0.1, aspect, page);

    expect(bigger.width).toBeCloseTo(0.4, 5);
    expect(resizeSignature(defaultSignaturePlacement, 5, aspect, page).width).toBe(
      maximumSignatureWidth,
    );
  });
});

describe('getSignatureBox', () => {
  it('turns fractions of the page into points, counting up from the bottom', () => {
    // A signature at the middle of the page: its centre is half way up, and a
    // page counts from the bottom while the placement counts from the top.
    const box = getSignatureBox(page, { x: 0.5, y: 0.5, width: 0.3 }, aspect);

    expect(box.width).toBeCloseTo(180, 5);
    expect(box.height).toBeCloseTo(60, 5);
    expect(box.x).toBeCloseTo(300 - 90, 5);
    expect(box.y).toBeCloseTo(400 - 30, 5);
  });

  it('puts a signature low on the screen low on the page', () => {
    const low = getSignatureBox(page, { x: 0.5, y: 0.9, width: 0.2 }, aspect);

    expect(low.y).toBeLessThan(page.height / 2);
  });
});

describe('getSignaturePlan', () => {
  it('draws where it was placed on an unrotated page', () => {
    const plan = getSignaturePlan(page, { x: 0.5, y: 0.5, width: 0.3 }, aspect, 0);

    expect(plan.rotation).toBe(0);
    expect(plan.width).toBeCloseTo(180, 5);
    expect(plan.anchor.x).toBeCloseTo(210, 5);
    expect(plan.anchor.y).toBeCloseTo(370, 5);
  });

  it('moves the corner and turns the drawing on a quarter-turned page', () => {
    // The page is displayed sideways, so the visible box is the swapped one and
    // the corner pdf-lib draws from is not the one on the visible page.
    const plan = getSignaturePlan(page, { x: 0.5, y: 0.9, width: 0.2 }, aspect, 90);

    expect(plan.rotation).toBe(90);
    // Turned or not, the signature keeps the size it was given on screen.
    expect(plan.width).toBeCloseTo(800 * 0.2, 5);
    expect(plan.anchor).not.toEqual(
      getSignaturePlan(page, { x: 0.5, y: 0.9, width: 0.2 }, aspect, 0).anchor,
    );
  });

  it('never leaves the signature off the page it was placed on', () => {
    for (const rotation of [0, 90, 180, 270]) {
      const plan = getSignaturePlan(page, { x: 0.5, y: 0.5, width: 0.3 }, aspect, rotation);

      expect(plan.anchor.x, `${rotation}`).toBeGreaterThanOrEqual(0);
      expect(plan.anchor.y, `${rotation}`).toBeGreaterThanOrEqual(0);
      expect(plan.anchor.x, `${rotation}`).toBeLessThanOrEqual(page.width);
      expect(plan.anchor.y, `${rotation}`).toBeLessThanOrEqual(page.height);
    }
  });
});

describe('refusals and wording', () => {
  it('takes one PDF, and says what anything else is', () => {
    expect(validateSignPdfSelection([])).toMatch(/Choose a PDF/);
    expect(
      validateSignPdfSelection([
        { name: 'a.pdf', type: 'application/pdf' },
        { name: 'b.pdf', type: 'application/pdf' },
      ]),
    ).toMatch(/one PDF at a time/);
    expect(validateSignPdfSelection([{ name: 'notes.txt', type: 'text/plain' }])).toMatch(
      /is not a PDF/,
    );
  });

  it('keeps the page ceiling the reader keeps', () => {
    expect(validateSignPdfPageCount(0)).toMatch(/no pages/);
    expect(validateSignPdfPageCount(maximumSignPdfPages + 1)).toMatch(
      new RegExp(maximumSignPdfPages.toLocaleString()),
    );
    expect(validateSignPdfPageCount(4)).toBeUndefined();
  });

  it('words a document that will not open in its own terms', () => {
    expect(getSignPdfOpenErrorMessage('PasswordException')).toMatch(/password-protected/);
    expect(getSignPdfOpenErrorMessage('InvalidPDFException')).toMatch(/not a PDF/);
    expect(getSignPdfOpenErrorMessage(undefined)).toMatch(/could not be signed/);
  });

  it('words a document the writer will not draw onto, without a preview to blame', () => {
    expect(getSignPdfSourceErrorMessage('encrypted')).toMatch(/password-protected/);
    expect(getSignPdfSourceErrorMessage('empty')).toMatch(/no pages/);
    expect(getSignPdfSourceErrorMessage('unreadable')).toMatch(/could not be read as a PDF/);
    expect(getSignPdfWriteErrorMessage()).toMatch(/original is untouched/);
  });

  it('counts the pages it will sign', () => {
    expect(describeSignedPages([1, 2, 3], 3)).toMatch(/every page/);
    expect(describeSignedPages([2], 3)).toBe('Signed on 1 page of 3');
    expect(describeSignedPages([], 3)).toBe('No pages chosen.');
  });

  it('names the file for what happened to it', () => {
    expect(getSignedPdfFilename('contract.pdf')).toBe('contract-signed.pdf');
    expect(getSignedPdfFilename('')).toBe('document-signed.pdf');
  });
});
