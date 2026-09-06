import { isSupportedImageFile } from './image-compression';
import { isSupportedPdfFile } from './pdf-viewer';
import {
  flowlessToolSlugs,
  getFlowToolsForInput,
  type FlowPayloadLineageKind,
} from './tool-flows';
import { getAvailableTools, type ToolRegistryEntry } from './tools';

/**
 * Starting from the file rather than from the name of a Gizlet.
 *
 * A visitor with a photograph to shrink has to guess what this site calls that
 * before the search box can help them. Dropping the photograph asks nothing:
 * the file says what it is, and every Gizlet that reads that kind of file can
 * say so for itself.
 *
 * Which Gizlets those are is derived, never listed. A Gizlet that declares an
 * executable flow contract is offered when its input matches; one that
 * deliberately has none — a viewer, a reader, a Gizlet whose work needs
 * something a link cannot carry — is offered on the payload its category is
 * about. Both facts already live in the registry, so a new Gizlet appears here
 * by existing rather than by being added to a list in this file.
 *
 * Nothing here reads a byte of the file. Detection is the name and the type the
 * browser reports, which is all that can be known without opening it, and the
 * file never leaves the device either way.
 */

/** What the categories are about, for the Gizlets that declare no contract. */
const categoryPayloads = {
  images: 'image-file',
  pdf: 'pdf-file',
} as const satisfies Partial<Record<ToolRegistryEntry['category'], FlowPayloadLineageKind>>;

export const droppedFileLabels = {
  'image-file': 'an image',
  'pdf-file': 'a PDF',
} as const satisfies Record<FlowPayloadLineageKind, string>;

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

/**
 * What kind of payload this file is, or nothing.
 *
 * The two checks are the ones the workspaces already use, so a file this says
 * is an image is a file those Gizlets will accept — one answer, in one place.
 */
export function getDroppedFileKind(file: FileDetails): FlowPayloadLineageKind | undefined {
  if (isSupportedPdfFile(file)) return 'pdf-file';
  if (isSupportedImageFile(file)) return 'image-file';

  return undefined;
}

/**
 * Every published Gizlet that reads this kind of file, in registry order.
 *
 * The flow contracts answer for most of them. The rest are the Gizlets that
 * declare no contract on purpose: they still read a file, and leaving a viewer
 * out of the list of things you can do with a document you just dropped would
 * be a worse answer than the one the graph gives.
 */
export function getGizletsForDroppedFile(
  kind: FlowPayloadLineageKind,
): readonly ToolRegistryEntry[] {
  const fromContracts = new Set(getFlowToolsForInput(kind).map((tool) => tool.toolSlug));
  const flowless = new Set<string>(flowlessToolSlugs);

  return getAvailableTools().filter((tool) => {
    if (fromContracts.has(tool.slug)) return true;
    if (!flowless.has(tool.slug)) return false;

    return categoryPayloads[tool.category as keyof typeof categoryPayloads] === kind;
  });
}

/** What the panel says it is holding, before anything is done with it. */
export function describeDroppedFile(
  file: { readonly name: string; readonly size: number },
  kind: FlowPayloadLineageKind,
  formatSize: (bytes: number) => string,
  dimensions?: { readonly width: number; readonly height: number },
): string {
  const parts = [file.name, droppedFileLabels[kind], formatSize(file.size)];

  if (dimensions) parts.push(`${dimensions.width} × ${dimensions.height} px`);

  return parts.join(' · ');
}

/** The line above the list, which counts what the file can actually go to. */
export function describeDroppedFileDestinations(
  kind: FlowPayloadLineageKind,
  count: number,
): string {
  if (count === 0) {
    return `Nothing published reads ${droppedFileLabels[kind]} yet.`;
  }

  return `${count} ${count === 1 ? 'Gizlet takes' : 'Gizlets take'} ${droppedFileLabels[kind]}.`;
}

/**
 * What to say about a file this site cannot start from.
 *
 * It names the file and what is read here, because "unsupported file" tells a
 * visitor nothing about what to do next, and the search box is still there.
 */
export function getUnsupportedDroppedFileMessage(name: string): string {
  return `${name} is not an image or a PDF, which are the files these Gizlets read. Search above for what you want to do instead.`;
}

export function getDroppedFileCountMessage(): string {
  return 'Drop one file at a time. It is read here to work out which Gizlets take it, and nothing is uploaded.';
}
