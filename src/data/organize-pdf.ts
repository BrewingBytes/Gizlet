import { describePdfPageCount } from './jpg-to-pdf';
import type { SelectOption } from './pdf-to-jpg';
import { isSupportedPdfFile, maximumPdfViewerPages } from './pdf-viewer';

/**
 * Deterministic logic for the Organize PDF Gizlet: which files it accepts, and
 * the page plan a visitor builds by moving, turning, duplicating and dropping
 * pages before any of it is written.
 *
 * The plan is the whole Gizlet. Everything the workspace does is a pure
 * function from one plan to the next — a page moved, a page turned, a page
 * copied, a page gone — so the behaviour that decides what comes out of the
 * document can be tested without a document, a canvas, or a drag.
 *
 * Nothing here touches pdf-lib. The adapter in `src/scripts/pdf-generation.ts`
 * owns the library; this module owns every decision about it, including how a
 * refusal is worded.
 */

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/**
 * A page's turn, in the degrees a PDF records. A page carries its own rotation
 * already, so this is the turn the visitor added on top of it rather than the
 * angle the page will end up at; composing the two is the writer's job.
 */
export type PdfPageRotation = 0 | 90 | 180 | 270;

/** The turns a control can ask for. There is no free angle: a page turns in quarters. */
export const pdfPageTurns = ['right', 'left', 'half'] as const;

export type PdfPageTurn = (typeof pdfPageTurns)[number];

export const defaultPdfPageTurn: PdfPageTurn = 'right';

const pdfPageTurnDegrees = {
  right: 90,
  left: 270,
  half: 180,
} as const satisfies Record<PdfPageTurn, number>;

const pdfPageTurnLabels = {
  right: 'A quarter turn right',
  left: 'A quarter turn left',
  half: 'Upside down',
} as const satisfies Record<PdfPageTurn, string>;

export function isPdfPageTurn(value: string): value is PdfPageTurn {
  return pdfPageTurns.includes(value as PdfPageTurn);
}

export function getPdfPageTurnLabel(turn: PdfPageTurn): string {
  return pdfPageTurnLabels[turn];
}

export function getPdfPageTurnOptions(): readonly SelectOption<PdfPageTurn>[] {
  return pdfPageTurns.map((turn) => ({ value: turn, label: pdfPageTurnLabels[turn] }));
}

/** The turn applied to a rotation, kept inside one revolution. */
export function turnPdfRotation(rotation: PdfPageRotation, turn: PdfPageTurn): PdfPageRotation {
  return (((rotation + pdfPageTurnDegrees[turn]) % 360 + 360) % 360) as PdfPageRotation;
}

/**
 * One page in the plan.
 *
 * `id` is not the page number and never changes: it is what a control, a drag
 * and a selection refer to, so moving a page does not renumber the thing the
 * visitor is holding. `sourcePage` is which page of the opened document this
 * entry copies, and two entries may name the same one — that is a duplicate.
 */
export interface OrganizedPdfPage {
  readonly id: number;
  readonly sourcePage: number;
  readonly rotation: PdfPageRotation;
  /** Whether this page is in the set an extract would take. */
  readonly selected: boolean;
}

/**
 * The document as it will be written.
 *
 * `nextId` travels with the plan rather than living in the workspace, so
 * duplicating a page is a pure function: the same plan and the same page always
 * produce the same next plan, which is what makes the operations testable.
 */
export interface OrganizePdfPlan {
  readonly pages: readonly OrganizedPdfPage[];
  readonly nextId: number;
}

/**
 * The memory guard, in pages.
 *
 * Organizing copies pages between documents rather than redrawing them, so the
 * ceiling is the one the PDF Viewer opens: a document this Gizlet can rearrange
 * is one the Gizlet next to it can read. It bounds the plan as well as the
 * source, because duplicating is the one operation here that can grow a
 * document without opening a bigger one.
 */
export const maximumOrganizePdfPages = maximumPdfViewerPages;

/** Above this the Gizlet reports its progress rather than looking stalled. */
export const largeOrganizePdfPages = 50;

/** Why a document cannot be rearranged. */
export type PdfOrganizeFailure = 'encrypted' | 'empty' | 'unreadable';

/** The Gizlet organizes one document at a time, so a selection is one PDF. */
export function validateOrganizePdfSelection(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) {
    return 'Choose a PDF to organize.';
  }

  if (files.length > 1) {
    return 'This Gizlet organizes one PDF at a time. Choose a single file.';
  }

  if (!isSupportedPdfFile(files[0])) {
    return `${files[0].name} is not a PDF. Choose a file that ends in .pdf.`;
  }

  return undefined;
}

/** Checked once the page count is known, which needs the document parsed. */
export function validateOrganizePdfPageCount(pageCount: number): string | undefined {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return 'This PDF has no pages, so there is nothing to organize.';
  }

  if (pageCount > maximumOrganizePdfPages) {
    return `This Gizlet organizes documents of up to ${maximumOrganizePdfPages.toLocaleString()} pages, and this PDF has ${pageCount.toLocaleString()}. Split it into shorter documents first.`;
  }

  return undefined;
}

/** The document as it arrived: every page once, in order, turned as it already was. */
export function createOrganizePdfPlan(pageCount: number): OrganizePdfPlan {
  const pages = Array.from({ length: Math.max(pageCount, 0) }, (_, index) => ({
    id: index + 1,
    sourcePage: index + 1,
    rotation: 0 as PdfPageRotation,
    selected: false,
  }));

  return { pages, nextId: pages.length + 1 };
}

/** Where a page sits in the plan, or -1 for a page the plan no longer holds. */
export function getPdfPlanPageIndex(plan: OrganizePdfPlan, id: number): number {
  return plan.pages.findIndex((page) => page.id === id);
}

export function getPdfPlanPage(plan: OrganizePdfPlan, id: number): OrganizedPdfPage | undefined {
  return plan.pages.find((page) => page.id === id);
}

function withPages(plan: OrganizePdfPlan, pages: readonly OrganizedPdfPage[]): OrganizePdfPlan {
  return { pages, nextId: plan.nextId };
}

/**
 * Moves one page to a position, counted in the plan as the visitor sees it.
 *
 * A destination outside the document is clamped rather than refused: this is
 * the end of a drag, and a page dropped past the last one means the end.
 */
export function movePdfPlanPage(
  plan: OrganizePdfPlan,
  id: number,
  toIndex: number,
): OrganizePdfPlan {
  const from = getPdfPlanPageIndex(plan, id);

  if (from === -1) return plan;

  const target = Math.min(Math.max(Math.round(toIndex), 0), plan.pages.length - 1);

  if (target === from) return plan;

  const pages = [...plan.pages];
  const [moved] = pages.splice(from, 1);

  pages.splice(target, 0, moved);

  return withPages(plan, pages);
}

/** Moves a page one place towards the front or the back, for a keyboard. */
export function shiftPdfPlanPage(
  plan: OrganizePdfPlan,
  id: number,
  direction: 'earlier' | 'later',
): OrganizePdfPlan {
  const from = getPdfPlanPageIndex(plan, id);

  if (from === -1) return plan;

  return movePdfPlanPage(plan, id, from + (direction === 'earlier' ? -1 : 1));
}

/** Turns the named pages, leaving the rest of the plan alone. */
export function turnPdfPlanPages(
  plan: OrganizePdfPlan,
  ids: readonly number[],
  turn: PdfPageTurn,
): OrganizePdfPlan {
  if (ids.length === 0) return plan;

  const turning = new Set(ids);

  return withPages(
    plan,
    plan.pages.map((page) =>
      turning.has(page.id) ? { ...page, rotation: turnPdfRotation(page.rotation, turn) } : page,
    ),
  );
}

/** Turns every page, which is the one page job a Flow can ask for without a field. */
export function turnEveryPdfPlanPage(plan: OrganizePdfPlan, turn: PdfPageTurn): OrganizePdfPlan {
  return turnPdfPlanPages(
    plan,
    plan.pages.map((page) => page.id),
    turn,
  );
}

/**
 * Whether the named pages can be copied without the plan outgrowing the guard.
 *
 * Duplicating is the only operation that adds pages, so it is the only one that
 * has to ask.
 */
export function canDuplicatePdfPlanPages(
  plan: OrganizePdfPlan,
  ids: readonly number[],
): boolean {
  const copies = plan.pages.filter((page) => ids.includes(page.id)).length;

  return copies > 0 && plan.pages.length + copies <= maximumOrganizePdfPages;
}

/**
 * Copies the named pages, each one landing directly after the page it copies.
 *
 * The copy is not selected. A selection here is the set an extract would take,
 * and a page copied because it is wanted twice in this document has not been
 * asked for twice in another one.
 */
export function duplicatePdfPlanPages(
  plan: OrganizePdfPlan,
  ids: readonly number[],
): OrganizePdfPlan {
  if (!canDuplicatePdfPlanPages(plan, ids)) return plan;

  const copying = new Set(ids);
  const pages: OrganizedPdfPage[] = [];
  let nextId = plan.nextId;

  for (const page of plan.pages) {
    pages.push(page);

    if (copying.has(page.id)) {
      pages.push({ ...page, id: nextId, selected: false });
      nextId += 1;
    }
  }

  return { pages, nextId };
}

/** Whether the named pages can go without emptying the document. */
export function canRemovePdfPlanPages(plan: OrganizePdfPlan, ids: readonly number[]): boolean {
  const removing = plan.pages.filter((page) => ids.includes(page.id)).length;

  return removing > 0 && removing < plan.pages.length;
}

/** Drops the named pages. A plan that would end up empty is left as it was. */
export function removePdfPlanPages(
  plan: OrganizePdfPlan,
  ids: readonly number[],
): OrganizePdfPlan {
  if (!canRemovePdfPlanPages(plan, ids)) return plan;

  const removing = new Set(ids);

  return withPages(
    plan,
    plan.pages.filter((page) => !removing.has(page.id)),
  );
}

/** The plan with one page's selection flipped. */
export function togglePdfPlanSelection(plan: OrganizePdfPlan, id: number): OrganizePdfPlan {
  return withPages(
    plan,
    plan.pages.map((page) => (page.id === id ? { ...page, selected: !page.selected } : page)),
  );
}

/** Every page selected, or none of them. */
export function setPdfPlanSelection(plan: OrganizePdfPlan, selected: boolean): OrganizePdfPlan {
  return withPages(
    plan,
    plan.pages.map((page) => ({ ...page, selected })),
  );
}

export function getSelectedPdfPlanIds(plan: OrganizePdfPlan): readonly number[] {
  return plan.pages.filter((page) => page.selected).map((page) => page.id);
}

/**
 * The pages an extract would write: the selected ones, in the order the plan
 * holds them and turned the way the plan turns them. Extracting is the same
 * write as saving, over a subset, which is why it needs no second code path.
 */
export function getPdfPlanExtract(plan: OrganizePdfPlan): readonly OrganizedPdfPage[] {
  return plan.pages.filter((page) => page.selected);
}

/** Whether the plan still says anything the source document does not already say. */
export function hasPdfPlanChanges(plan: OrganizePdfPlan, sourcePageCount: number): boolean {
  if (plan.pages.length !== sourcePageCount) return true;

  return plan.pages.some(
    (page, index) => page.sourcePage !== index + 1 || page.rotation !== 0,
  );
}

/** How many pages of the plan are turned from the way they arrived. */
export function getTurnedPdfPlanPageCount(plan: OrganizePdfPlan): number {
  return plan.pages.filter((page) => page.rotation !== 0).length;
}

/** How many pages of the plan are a second copy of a page already in it. */
export function getDuplicatedPdfPlanPageCount(plan: OrganizePdfPlan): number {
  const seen = new Set<number>();
  let duplicated = 0;

  for (const page of plan.pages) {
    if (seen.has(page.sourcePage)) duplicated += 1;
    else seen.add(page.sourcePage);
  }

  return duplicated;
}

/** How many of the source document's pages the plan no longer holds. */
export function getRemovedPdfPlanPageCount(
  plan: OrganizePdfPlan,
  sourcePageCount: number,
): number {
  const kept = new Set(plan.pages.map((page) => page.sourcePage));
  let removed = 0;

  for (let pageNumber = 1; pageNumber <= sourcePageCount; pageNumber += 1) {
    if (!kept.has(pageNumber)) removed += 1;
  }

  return removed;
}

/**
 * "12 pages · 2 turned · 1 dropped", the line the workspace shows above the
 * pages. Only the parts that happened are named, so an untouched document says
 * what it is rather than listing four zeroes.
 */
export function describeOrganizePdfPlan(
  plan: OrganizePdfPlan,
  sourcePageCount: number,
): string {
  const parts = [describePdfPageCount(plan.pages.length)];
  const turned = getTurnedPdfPlanPageCount(plan);
  const duplicated = getDuplicatedPdfPlanPageCount(plan);
  const removed = getRemovedPdfPlanPageCount(plan, sourcePageCount);

  if (turned > 0) parts.push(`${turned} turned`);
  if (duplicated > 0) parts.push(`${duplicated} duplicated`);
  if (removed > 0) parts.push(`${removed} dropped`);

  return parts.join(' · ');
}

/** How a page's turn reads, for a control that has to say where the page is now. */
export function describePdfPageRotation(rotation: PdfPageRotation): string {
  if (rotation === 90) return 'Turned right';
  if (rotation === 180) return 'Upside down';
  if (rotation === 270) return 'Turned left';

  return 'Not turned';
}

/**
 * A page's accessible name: where it is now, which page of the original it is,
 * and how it has been turned. All three change under the visitor's hands, and a
 * card that only said "Page 4" would be describing the wrong thing after a drag.
 */
export function describeOrganizedPdfPage(
  page: OrganizedPdfPage,
  position: number,
  total: number,
): string {
  const rotation = page.rotation === 0 ? '' : `, ${describePdfPageRotation(page.rotation).toLowerCase()}`;

  return `Position ${position} of ${total}, page ${page.sourcePage} of the original${rotation}`;
}

function basenameOf(documentName: string, fallback: string): string {
  return documentName.replace(/\.[^.]+$/, '') || fallback;
}

/** The rearranged document's file name. */
export function getOrganizePdfFilename(documentName: string): string {
  return `${basenameOf(documentName, 'document')}-organized.pdf`;
}

/** The file name for a set of pages taken out on their own. */
export function getExtractedPdfFilename(documentName: string): string {
  return `${basenameOf(documentName, 'document')}-extract.pdf`;
}

/** Wording for an extract nobody has chosen pages for yet. */
export function getPdfExtractSelectionMessage(): string {
  return 'Tick the pages you want in a document of their own, then extract them.';
}

/** Wording for the last page, which cannot go. */
export function getPdfPlanEmptyMessage(): string {
  return 'A PDF needs at least one page, so the last page cannot be dropped. Drop the others instead, or start over.';
}

/** Wording for a duplicate that would take the document past the guard. */
export function getPdfPlanLimitMessage(): string {
  return `This Gizlet writes documents of up to ${maximumOrganizePdfPages.toLocaleString()} pages, and copying these would take it past that.`;
}

/**
 * Turns a pdf.js failure into something the visitor can act on.
 *
 * The workspace draws every page before anything is moved, so pdf.js meets the
 * document first and its refusals are the ones a visitor actually reads.
 */
export function getOrganizePdfOpenErrorMessage(errorName: string | undefined): string {
  if (errorName === 'PasswordException') {
    return 'This PDF is password-protected, so its pages cannot be read to rearrange them. Open it in an app that can ask for the password, save an unlocked copy, and organize that.';
  }

  if (errorName === 'InvalidPDFException') {
    return 'This file is not a PDF that can be read, so there is nothing to organize. It may be damaged, or renamed from another format.';
  }

  if (errorName === 'MissingPDFException') {
    return 'This PDF could not be read from your device. Try choosing it again.';
  }

  return 'This PDF could not be opened, so there is nothing to organize.';
}

/**
 * Turns a document pdf-lib cannot rearrange into something the visitor can act
 * on. These are the second line: pdf.js has usually refused the document
 * already, and this is what the flow builder — which organizes a PDF it made
 * itself, with no preview to draw — reports instead.
 */
export function getPdfOrganizeErrorMessage(reason: PdfOrganizeFailure): string {
  if (reason === 'encrypted') {
    return 'This PDF is password-protected, so its pages cannot be copied into a new order. Open it in an app that can ask for the password, save an unlocked copy, and organize that.';
  }

  if (reason === 'empty') {
    return 'This PDF has no pages, so there is nothing to organize.';
  }

  return 'This file could not be read as a PDF, so there is nothing to organize. It may be damaged, or renamed from another format.';
}

/** Wording for a plan the library would not write, which leaves the plan intact. */
export function getOrganizePdfWriteErrorMessage(): string {
  return 'These pages could not be written into a new document. The pages above are still as you arranged them, so try dropping the page that will not copy.';
}
