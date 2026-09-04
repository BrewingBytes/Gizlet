import { toolRegistry, type RegisteredTool, type ToolRegistryEntry, type ToolSlug } from './tools';

/**
 * Keyed by the registry's own slugs rather than by `string`, so a Gizlet added
 * without a related-tools entry fails `astro check` instead of crashing the
 * build inside `getStaticPaths`.
 */
const relatedToolSlugs: Record<ToolSlug, readonly ToolSlug[]> = {
  'compress-image': ['resize-image', 'convert-image', 'jpg-to-pdf'],
  'resize-image': ['compress-image', 'convert-image', 'jpg-to-pdf'],
  'convert-image': ['compress-image', 'resize-image', 'jpg-to-pdf'],
  'json-ld-generator': ['json-formatter'],
  'json-formatter': ['json-ld-generator'],
  'jpg-to-pdf': ['pdf-to-jpg', 'merge-pdf', 'pdf-viewer'],
  'pdf-viewer': ['pdf-to-jpg', 'merge-pdf', 'jpg-to-pdf'],
  'merge-pdf': ['pdf-viewer', 'jpg-to-pdf', 'compress-image'],
  'pdf-to-jpg': ['pdf-viewer', 'jpg-to-pdf', 'compress-image'],
};

function getToolBySlug(slug: ToolSlug): ToolRegistryEntry {
  const tool = toolRegistry.find((candidate) => candidate.slug === slug);

  if (!tool) {
    throw new Error(`Missing registry entry for related Gizlet: ${slug}`);
  }

  return tool;
}

/**
 * Returns the editorially selected related Gizlets for a registry entry.
 * This is deliberately explicit rather than an automatic recommendation rule.
 */
export function getRelatedTools(tool: RegisteredTool): readonly ToolRegistryEntry[] {
  return relatedToolSlugs[tool.slug].map(getToolBySlug);
}
