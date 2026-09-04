import {
  isAvailableTool,
  toolRegistry,
  type AvailableToolSlug,
  type RegisteredTool,
  type ToolRegistryEntry,
} from './tools';

/**
 * Keyed by the registry's own available slugs rather than by `string`, so a
 * Gizlet published without a related-tools entry fails `astro check` instead of
 * crashing the build inside `getStaticPaths`.
 *
 * Planned Gizlets are deliberately absent, and the totality is over the
 * available slugs for that reason: recommending anything from a page that does
 * not work is the wrong editorial move whatever the types would tolerate, so
 * the obligation begins when a Gizlet becomes available.
 */
const relatedToolSlugs: Record<AvailableToolSlug, readonly AvailableToolSlug[]> = {
  'compress-image': ['resize-image', 'convert-image', 'jpg-to-pdf'],
  'resize-image': ['compress-image', 'convert-image', 'jpg-to-pdf'],
  'convert-image': ['compress-image', 'resize-image', 'jpg-to-pdf'],
  'json-ld-generator': ['json-formatter'],
  'json-formatter': ['json-ld-generator'],
  'jpg-to-pdf': ['pdf-to-jpg', 'merge-pdf', 'pdf-viewer'],
  'pdf-viewer': ['pdf-to-jpg', 'merge-pdf', 'jpg-to-pdf'],
  'merge-pdf': ['split-pdf', 'pdf-viewer', 'jpg-to-pdf'],
  'pdf-to-jpg': ['split-pdf', 'pdf-viewer', 'jpg-to-pdf'],
  'split-pdf': ['merge-pdf', 'pdf-to-jpg', 'pdf-viewer'],
};

function getToolBySlug(slug: AvailableToolSlug): ToolRegistryEntry {
  const tool = toolRegistry.find((candidate) => candidate.slug === slug);

  if (!tool) {
    throw new Error(`Missing registry entry for related Gizlet: ${slug}`);
  }

  return tool;
}

/**
 * Returns the editorially selected related Gizlets for a registry entry.
 * This is deliberately explicit rather than an automatic recommendation rule.
 *
 * A planned Gizlet relates to nothing, and its page renders no related block.
 * The reverse also holds and matters more: no planned Gizlet appears in an
 * available Gizlet's list, because the map cannot name one.
 */
export function getRelatedTools(tool: RegisteredTool): readonly ToolRegistryEntry[] {
  if (!isAvailableTool(tool)) {
    return [];
  }

  return relatedToolSlugs[tool.slug].map(getToolBySlug);
}
