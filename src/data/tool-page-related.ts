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
  'compress-image': ['resize-image', 'crop-image', 'convert-image', 'remove-image-metadata', 'jpg-to-pdf'],
  'resize-image': ['crop-image', 'image-dimensions', 'image-background', 'compress-image', 'convert-image'],
  'convert-image': ['compress-image', 'resize-image', 'image-background', 'crop-image', 'jpg-to-pdf'],
  'crop-image': ['rotate-flip-image', 'resize-image', 'compress-image', 'convert-image', 'jpg-to-pdf'],
  'rotate-flip-image': ['crop-image', 'resize-image', 'compress-image', 'convert-image', 'jpg-to-pdf'],
  'image-background': ['resize-image', 'crop-image', 'convert-image', 'collage-maker', 'jpg-to-pdf'],
  'remove-image-metadata': ['compress-image', 'resize-image', 'convert-image', 'crop-image', 'jpg-to-pdf'],
  'image-dimensions': ['resize-image', 'crop-image', 'compress-image', 'convert-image', 'jpg-to-pdf'],
  'collage-maker': ['resize-image', 'crop-image', 'compress-image', 'convert-image', 'jpg-to-pdf'],
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
