import { getDroppedFileKind, getGizletsForDroppedFile } from './file-drop';
import type { FlowPayloadLineageKind } from './tool-flows';
import type { ToolRegistryEntry } from './tools';

/**
 * Carrying a result on to the next Gizlet, without downloading it first.
 *
 * A visitor who has just compressed a photograph and now wants it cropped
 * should not have to save it, find the next Gizlet, and choose the same file
 * again. The result is already in this browser, and the handoff that carries a
 * dropped file from the home page carries this one just as well.
 *
 * Where it can go is the rule the home page already uses, read off the result
 * rather than off a list: the file says what it is, and every Gizlet that takes
 * that kind of file is offered, in registry order, minus the one that just made
 * it. Nothing here names a Gizlet, so one added later is offered by existing.
 */

/**
 * The payload kinds a handoff can actually deliver.
 *
 * A destination receives a handed-over file through its own file picker, which
 * is what makes the transfer work for every workspace without any of them
 * knowing about it. The two text kinds are absent because the Gizlets that read
 * them — JSON Formatter, JSON ↔ CSV Converter — have a box you type into rather
 * than a picker, so a link offering to carry a table into one would arrive
 * empty. The day one of them takes a file, its kind belongs here and nothing
 * else in this module changes.
 */
export const handoffPayloadKinds = ['image-file', 'pdf-file'] as const satisfies readonly FlowPayloadLineageKind[];

export type HandoffPayloadKind = (typeof handoffPayloadKinds)[number];

export function isHandoffPayloadKind(kind: FlowPayloadLineageKind): kind is HandoffPayloadKind {
  return (handoffPayloadKinds as readonly FlowPayloadLineageKind[]).includes(kind);
}

/**
 * What a produced file is, if it is something a handoff can carry.
 *
 * The same detection the home page does, narrowed to the kinds that can be
 * delivered: the name and the type the browser reports, and not a byte of the
 * file itself.
 */
export function getSendablePayloadKind(file: {
  readonly name: string;
  readonly type: string;
}): HandoffPayloadKind | undefined {
  const kind = getDroppedFileKind(file);

  return kind && isHandoffPayloadKind(kind) ? kind : undefined;
}

/** A download a result is offering, as the panel finds it in the page. */
export interface ResultFileCandidate {
  readonly name: string;
  readonly href: string;
  readonly isHidden: boolean;
}

/** One of those that can be sent on, and what it turned out to be. */
export interface SendableResultFile {
  readonly name: string;
  readonly href: string;
  readonly kind: HandoffPayloadKind;
}

/** A result is held in this browser, so the link to it is one of these two. */
function isLocalHref(href: string): boolean {
  return href.startsWith('blob:') || href.startsWith('data:');
}

/**
 * The files a result is offering that another Gizlet could read, in the order
 * the result offers them.
 *
 * A workspace publishes its result as ordinary download links, so this reads
 * those rather than asking each Gizlet what it made. An archive falls out on
 * its own: no Gizlet here reads a ZIP, so a batch's "download all" is dropped
 * while the per-file links beside it survive, and a Gizlet whose whole result
 * is an archive offers nothing at all rather than a link that would arrive
 * with something unreadable.
 */
export function getSendableResultFiles(
  candidates: readonly ResultFileCandidate[],
): readonly SendableResultFile[] {
  const sendable: SendableResultFile[] = [];

  for (const candidate of candidates) {
    if (candidate.isHidden || !isLocalHref(candidate.href)) continue;

    const kind = getSendablePayloadKind({ name: candidate.name, type: '' });

    if (kind) sendable.push({ name: candidate.name, href: candidate.href, kind });
  }

  return sendable;
}

/**
 * Where a result of this kind can go, in registry order.
 *
 * The Gizlet that made it is left out: sending a cropped picture back to Crop
 * Image is the "start over" button that workspace already has.
 */
export function getSendDestinations(
  fromToolSlug: ToolRegistryEntry['slug'],
  kind: HandoffPayloadKind,
): readonly ToolRegistryEntry[] {
  return getGizletsForDroppedFile(kind).filter((tool) => tool.slug !== fromToolSlug);
}

/** The line above the destinations, which says what is about to travel. */
export function describeSendableResult(files: readonly SendableResultFile[]): string {
  const [first] = files;

  if (!first) return '';

  if (files.length === 1) {
    return `${first.name} can go straight into another Gizlet, without saving it first.`;
  }

  return `${files.length} files came out of this. Pick one to send on, without saving it first.`;
}

/** What the panel says while the links are still just links. */
export function getSendNote(name: string): string {
  return `${name} goes with you: the Gizlet you pick opens with it already chosen, on this device.`;
}

/** What it says when this browser will not hold a file between pages. */
export function getSendFailureMessage(name: string, toolName: string): string {
  return `This browser will not hold a file between pages, so ${name} cannot travel. Download it, then open ${toolName} and choose it there.`;
}

/** What a destination link says it will do, for a reader who cannot see the list. */
export function getSendDestinationLabel(toolName: string, name: string): string {
  return `Send ${name} to ${toolName}`;
}
