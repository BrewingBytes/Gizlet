import { describe, expect, it } from 'vitest';

import { maximumPdfViewerPages } from '../../src/data/pdf-viewer';
import {
  canDuplicatePdfPlanPages,
  canRemovePdfPlanPages,
  createOrganizePdfPlan,
  defaultPdfPageTurn,
  describeOrganizedPdfPage,
  describeOrganizePdfPlan,
  describePdfPageRotation,
  duplicatePdfPlanPages,
  getDuplicatedPdfPlanPageCount,
  getExtractedPdfFilename,
  getOrganizePdfFilename,
  getOrganizePdfOpenErrorMessage,
  getOrganizePdfWriteErrorMessage,
  getPdfExtractSelectionMessage,
  getPdfOrganizeErrorMessage,
  getPdfPageTurnLabel,
  getPdfPageTurnOptions,
  getPdfPlanEmptyMessage,
  getPdfPlanExtract,
  getPdfPlanLimitMessage,
  getPdfPlanPage,
  getPdfPlanPageIndex,
  getRemovedPdfPlanPageCount,
  getSelectedPdfPlanIds,
  getTurnedPdfPlanPageCount,
  hasPdfPlanChanges,
  isPdfPageTurn,
  largeOrganizePdfPages,
  maximumOrganizePdfPages,
  movePdfPlanPage,
  pdfPageTurns,
  removePdfPlanPages,
  setPdfPlanSelection,
  shiftPdfPlanPage,
  togglePdfPlanSelection,
  turnEveryPdfPlanPage,
  turnPdfPlanPages,
  turnPdfRotation,
  validateOrganizePdfPageCount,
  validateOrganizePdfSelection,
  type OrganizePdfPlan,
} from '../../src/data/organize-pdf';

const pdf = (name: string) => ({ name, type: 'application/pdf' });

/** The plan as a reader sees it: which source page sits where, and its turn. */
const order = (plan: OrganizePdfPlan) => plan.pages.map((page) => page.sourcePage);
const turns = (plan: OrganizePdfPlan) => plan.pages.map((page) => page.rotation);
const ids = (plan: OrganizePdfPlan) => plan.pages.map((page) => page.id);

describe('validateOrganizePdfSelection', () => {
  it('accepts one PDF', () => {
    expect(validateOrganizePdfSelection([pdf('scan.pdf')])).toBeUndefined();
    expect(validateOrganizePdfSelection([{ name: 'scan.PDF', type: '' }])).toBeUndefined();
  });

  it('asks for a file when nothing was chosen', () => {
    expect(validateOrganizePdfSelection([])).toBe('Choose a PDF to organize.');
  });

  it('organizes one document at a time', () => {
    expect(validateOrganizePdfSelection([pdf('a.pdf'), pdf('b.pdf')])).toBe(
      'This Gizlet organizes one PDF at a time. Choose a single file.',
    );
  });

  it('refuses a file that is not a PDF, naming it', () => {
    expect(validateOrganizePdfSelection([{ name: 'notes.txt', type: 'text/plain' }])).toBe(
      'notes.txt is not a PDF. Choose a file that ends in .pdf.',
    );
  });
});

describe('validateOrganizePdfPageCount', () => {
  it('accepts a document with pages, including a single-page one', () => {
    // Unlike splitting, one page is a document this Gizlet can still turn.
    expect(validateOrganizePdfPageCount(1)).toBeUndefined();
    expect(validateOrganizePdfPageCount(maximumOrganizePdfPages)).toBeUndefined();
  });

  it('refuses a document with nothing in it', () => {
    for (const count of [0, -1, 1.5, Number.NaN]) {
      expect(validateOrganizePdfPageCount(count)).toBe(
        'This PDF has no pages, so there is nothing to organize.',
      );
    }
  });

  it('refuses a document past the guard, saying both numbers', () => {
    const message = validateOrganizePdfPageCount(maximumOrganizePdfPages + 1);

    expect(message).toContain(maximumOrganizePdfPages.toLocaleString());
    expect(message).toContain((maximumOrganizePdfPages + 1).toLocaleString());
  });

  it('guards at the page count the viewer opens, so its output stays readable', () => {
    expect(maximumOrganizePdfPages).toBe(maximumPdfViewerPages);
    expect(largeOrganizePdfPages).toBeLessThan(maximumOrganizePdfPages);
  });
});

describe('createOrganizePdfPlan', () => {
  it('is the document as it arrived: every page once, in order, unturned', () => {
    const plan = createOrganizePdfPlan(3);

    expect(order(plan)).toEqual([1, 2, 3]);
    expect(turns(plan)).toEqual([0, 0, 0]);
    expect(getSelectedPdfPlanIds(plan)).toEqual([]);
    expect(hasPdfPlanChanges(plan, 3)).toBe(false);
  });

  it('gives every page an id that is not its page number, and never reuses one', () => {
    const plan = duplicatePdfPlanPages(createOrganizePdfPlan(2), [1]);

    expect(ids(plan)).toEqual([1, 3, 2]);
    expect(new Set(ids(plan)).size).toBe(3);
  });

  it('holds nothing for a document with no pages', () => {
    expect(createOrganizePdfPlan(0).pages).toEqual([]);
  });
});

describe('movePdfPlanPage', () => {
  it('moves a page to the position it was dropped on', () => {
    const plan = createOrganizePdfPlan(4);

    expect(order(movePdfPlanPage(plan, 4, 0))).toEqual([4, 1, 2, 3]);
    expect(order(movePdfPlanPage(plan, 1, 3))).toEqual([2, 3, 4, 1]);
    expect(order(movePdfPlanPage(plan, 2, 2))).toEqual([1, 3, 2, 4]);
  });

  it('clamps a drop past either end rather than refusing it', () => {
    const plan = createOrganizePdfPlan(3);

    expect(order(movePdfPlanPage(plan, 3, 9))).toEqual([1, 2, 3]);
    expect(order(movePdfPlanPage(plan, 3, -4))).toEqual([3, 1, 2]);
  });

  it('leaves the plan alone for a page it does not hold, or a move to the same place', () => {
    const plan = createOrganizePdfPlan(3);

    expect(movePdfPlanPage(plan, 99, 0)).toBe(plan);
    expect(movePdfPlanPage(plan, 2, 1)).toBe(plan);
  });

  it('moves one place at a time for a keyboard, and stops at the ends', () => {
    const plan = createOrganizePdfPlan(3);

    expect(order(shiftPdfPlanPage(plan, 3, 'earlier'))).toEqual([1, 3, 2]);
    expect(order(shiftPdfPlanPage(plan, 1, 'later'))).toEqual([2, 1, 3]);
    expect(order(shiftPdfPlanPage(plan, 1, 'earlier'))).toEqual([1, 2, 3]);
    expect(order(shiftPdfPlanPage(plan, 3, 'later'))).toEqual([1, 2, 3]);
  });
});

describe('turning pages', () => {
  it('composes a turn onto the one the page already has', () => {
    expect(turnPdfRotation(0, 'right')).toBe(90);
    expect(turnPdfRotation(90, 'right')).toBe(180);
    expect(turnPdfRotation(270, 'right')).toBe(0);
    expect(turnPdfRotation(0, 'left')).toBe(270);
    expect(turnPdfRotation(90, 'left')).toBe(0);
    expect(turnPdfRotation(90, 'half')).toBe(270);
    expect(turnPdfRotation(180, 'half')).toBe(0);
  });

  it('turns only the pages it was given', () => {
    const plan = turnPdfPlanPages(createOrganizePdfPlan(3), [2], 'right');

    expect(turns(plan)).toEqual([0, 90, 0]);
    expect(turns(turnPdfPlanPages(plan, [2], 'right'))).toEqual([0, 180, 0]);
    expect(turnPdfPlanPages(plan, [], 'right')).toBe(plan);
  });

  it('turns every page, which is what a Flow asks for', () => {
    expect(turns(turnEveryPdfPlanPage(createOrganizePdfPlan(3), 'left'))).toEqual([270, 270, 270]);
  });

  it('leaves the order and the selection alone', () => {
    const plan = togglePdfPlanSelection(createOrganizePdfPlan(3), 1);
    const turned = turnPdfPlanPages(plan, [3], 'half');

    expect(order(turned)).toEqual([1, 2, 3]);
    expect(getSelectedPdfPlanIds(turned)).toEqual([1]);
  });

  it('names the turns a control may ask for, and no free angle', () => {
    expect(pdfPageTurns).toEqual(['right', 'left', 'half']);
    expect(isPdfPageTurn(defaultPdfPageTurn)).toBe(true);
    expect(isPdfPageTurn('45')).toBe(false);
    expect(isPdfPageTurn('')).toBe(false);
  });

  it('labels each turn once, for a select that has to read as English', () => {
    const options = getPdfPageTurnOptions();

    expect(options.map((option) => option.value)).toEqual([...pdfPageTurns]);
    expect(new Set(options.map((option) => option.label)).size).toBe(pdfPageTurns.length);

    for (const turn of pdfPageTurns) {
      expect(getPdfPageTurnLabel(turn)).toBe(
        options.find((option) => option.value === turn)?.label,
      );
    }
  });

  it('says where a page is now, and says nothing florid about a page that is upright', () => {
    expect(describePdfPageRotation(0)).toBe('Not turned');
    expect(describePdfPageRotation(90)).toBe('Turned right');
    expect(describePdfPageRotation(180)).toBe('Upside down');
    expect(describePdfPageRotation(270)).toBe('Turned left');
  });
});

describe('duplicatePdfPlanPages', () => {
  it('puts each copy directly after the page it copies', () => {
    const plan = duplicatePdfPlanPages(createOrganizePdfPlan(3), [2]);

    expect(order(plan)).toEqual([1, 2, 2, 3]);
    expect(getPdfPlanPageIndex(plan, 4)).toBe(2);
  });

  it('copies several at once, each one after its own page', () => {
    expect(order(duplicatePdfPlanPages(createOrganizePdfPlan(3), [1, 3]))).toEqual([
      1, 1, 2, 3, 3,
    ]);
  });

  it('copies the turn, and leaves the copy independent of the original', () => {
    const turned = turnPdfPlanPages(createOrganizePdfPlan(2), [1], 'right');
    const copied = duplicatePdfPlanPages(turned, [1]);
    const separately = turnPdfPlanPages(copied, [3], 'right');

    expect(turns(copied)).toEqual([90, 90, 0]);
    expect(turns(separately)).toEqual([90, 180, 0]);
  });

  it('does not tick the copy, because a copy was not asked for twice', () => {
    const selected = togglePdfPlanSelection(createOrganizePdfPlan(2), 1);
    const copied = duplicatePdfPlanPages(selected, [1]);

    expect(getSelectedPdfPlanIds(copied)).toEqual([1]);
    expect(getPdfPlanPage(copied, 3)?.selected).toBe(false);
  });

  it('refuses a copy that would take the document past the guard', () => {
    const plan = createOrganizePdfPlan(maximumOrganizePdfPages);
    const full = duplicatePdfPlanPages(plan, [1]);

    expect(canDuplicatePdfPlanPages(plan, [1])).toBe(false);
    expect(full).toBe(plan);
    expect(canDuplicatePdfPlanPages(plan, [])).toBe(false);
  });

  it('allows a copy that lands exactly on the guard', () => {
    const plan = createOrganizePdfPlan(maximumOrganizePdfPages - 1);

    expect(canDuplicatePdfPlanPages(plan, [1])).toBe(true);
    expect(duplicatePdfPlanPages(plan, [1]).pages).toHaveLength(maximumOrganizePdfPages);
  });
});

describe('removePdfPlanPages', () => {
  it('drops the pages it was given', () => {
    expect(order(removePdfPlanPages(createOrganizePdfPlan(4), [2, 3]))).toEqual([1, 4]);
  });

  it('will not empty the document, because a PDF with no pages is not a PDF', () => {
    const one = createOrganizePdfPlan(1);
    const three = createOrganizePdfPlan(3);

    expect(canRemovePdfPlanPages(one, [1])).toBe(false);
    expect(removePdfPlanPages(one, [1])).toBe(one);
    expect(canRemovePdfPlanPages(three, [1, 2, 3])).toBe(false);
    expect(removePdfPlanPages(three, [1, 2, 3])).toBe(three);
    expect(canRemovePdfPlanPages(three, [1, 2])).toBe(true);
  });

  it('ignores a page it does not hold rather than counting it as a removal', () => {
    const plan = createOrganizePdfPlan(2);

    expect(canRemovePdfPlanPages(plan, [99])).toBe(false);
    expect(canRemovePdfPlanPages(plan, [])).toBe(false);
  });

  it('leaves a dropped page droppable again as a copy', () => {
    const copied = duplicatePdfPlanPages(createOrganizePdfPlan(2), [1]);
    const dropped = removePdfPlanPages(copied, [1]);

    expect(order(dropped)).toEqual([1, 2]);
    expect(ids(dropped)).toEqual([3, 2]);
  });
});

describe('ticking pages', () => {
  it('flips one page, and reports the ticked set in plan order', () => {
    const plan = togglePdfPlanSelection(togglePdfPlanSelection(createOrganizePdfPlan(3), 3), 1);

    expect(getSelectedPdfPlanIds(plan)).toEqual([1, 3]);
    expect(getSelectedPdfPlanIds(togglePdfPlanSelection(plan, 3))).toEqual([1]);
  });

  it('ticks everything, or nothing', () => {
    const all = setPdfPlanSelection(createOrganizePdfPlan(3), true);

    expect(getSelectedPdfPlanIds(all)).toEqual([1, 2, 3]);
    expect(getSelectedPdfPlanIds(setPdfPlanSelection(all, false))).toEqual([]);
  });

  it('extracts the ticked pages in the order the plan holds them, turns included', () => {
    const moved = movePdfPlanPage(createOrganizePdfPlan(3), 3, 0);
    const turned = turnPdfPlanPages(moved, [3], 'right');
    const ticked = togglePdfPlanSelection(togglePdfPlanSelection(turned, 3), 2);
    const extract = getPdfPlanExtract(ticked);

    expect(extract.map((page) => page.sourcePage)).toEqual([3, 2]);
    expect(extract.map((page) => page.rotation)).toEqual([90, 0]);
  });

  it('extracts nothing when nothing is ticked', () => {
    expect(getPdfPlanExtract(createOrganizePdfPlan(3))).toEqual([]);
  });
});

describe('describing a plan', () => {
  it('counts the pages, and says nothing else about an untouched document', () => {
    expect(describeOrganizePdfPlan(createOrganizePdfPlan(6), 6)).toBe('6 pages');
    expect(describeOrganizePdfPlan(createOrganizePdfPlan(1), 1)).toBe('1 page');
  });

  it('names only what happened', () => {
    const turned = turnPdfPlanPages(createOrganizePdfPlan(4), [1, 2], 'right');

    expect(describeOrganizePdfPlan(turned, 4)).toBe('4 pages · 2 turned');
    expect(describeOrganizePdfPlan(duplicatePdfPlanPages(turned, [3]), 4)).toBe(
      '5 pages · 2 turned · 1 duplicated',
    );
    expect(describeOrganizePdfPlan(removePdfPlanPages(turned, [4]), 4)).toBe(
      '3 pages · 2 turned · 1 dropped',
    );
  });

  it('counts a turn, a copy and a drop as the plan itself defines them', () => {
    const plan = removePdfPlanPages(
      duplicatePdfPlanPages(turnPdfPlanPages(createOrganizePdfPlan(4), [1], 'half'), [2]),
      [4],
    );

    expect(getTurnedPdfPlanPageCount(plan)).toBe(1);
    expect(getDuplicatedPdfPlanPageCount(plan)).toBe(1);
    expect(getRemovedPdfPlanPageCount(plan, 4)).toBe(1);
    expect(hasPdfPlanChanges(plan, 4)).toBe(true);
  });

  it('reads a reorder as a change even though the page count is the same', () => {
    expect(hasPdfPlanChanges(movePdfPlanPage(createOrganizePdfPlan(3), 3, 0), 3)).toBe(true);
    expect(hasPdfPlanChanges(turnPdfPlanPages(createOrganizePdfPlan(3), [1], 'right'), 3)).toBe(
      true,
    );
  });

  it('names a page by where it is, where it came from, and which way up it is', () => {
    const plan = turnPdfPlanPages(movePdfPlanPage(createOrganizePdfPlan(3), 3, 0), [3], 'right');

    expect(describeOrganizedPdfPage(plan.pages[0], 1, 3)).toBe(
      'Position 1 of 3, page 3 of the original, turned right',
    );
    expect(describeOrganizedPdfPage(plan.pages[1], 2, 3)).toBe(
      'Position 2 of 3, page 1 of the original',
    );
  });
});

describe('file names', () => {
  it('names the rearranged document after the one it came from', () => {
    expect(getOrganizePdfFilename('statement.pdf')).toBe('statement-organized.pdf');
    expect(getExtractedPdfFilename('statement.pdf')).toBe('statement-extract.pdf');
  });

  it('keeps a name that has no extension, and falls back for one that is only an extension', () => {
    expect(getOrganizePdfFilename('scan')).toBe('scan-organized.pdf');
    expect(getOrganizePdfFilename('.pdf')).toBe('document-organized.pdf');
    expect(getExtractedPdfFilename('.pdf')).toBe('document-extract.pdf');
  });
});

describe('the wording of a refusal', () => {
  it('tells a visitor with a locked document what to do about it', () => {
    const opening = getOrganizePdfOpenErrorMessage('PasswordException');

    expect(opening).toContain('password-protected');
    expect(opening).toContain('unlocked copy');
    expect(getPdfOrganizeErrorMessage('encrypted')).toContain('unlocked copy');
  });

  it('separates a file that is not a PDF from one that will not read', () => {
    expect(getOrganizePdfOpenErrorMessage('InvalidPDFException')).toContain(
      'not a PDF that can be read',
    );
    expect(getOrganizePdfOpenErrorMessage('MissingPDFException')).toContain('from your device');
    expect(getOrganizePdfOpenErrorMessage(undefined)).toBe(
      'This PDF could not be opened, so there is nothing to organize.',
    );
    expect(getPdfOrganizeErrorMessage('unreadable')).toContain('could not be read as a PDF');
    expect(getPdfOrganizeErrorMessage('empty')).toBe(
      'This PDF has no pages, so there is nothing to organize.',
    );
  });

  it('says what the visitor has to do next, for each guard', () => {
    expect(getPdfPlanEmptyMessage()).toContain('at least one page');
    expect(getPdfPlanLimitMessage()).toContain(maximumOrganizePdfPages.toLocaleString());
    expect(getPdfExtractSelectionMessage()).toContain('Tick the pages');
    expect(getOrganizePdfWriteErrorMessage()).toContain('still as you arranged them');
  });
});
