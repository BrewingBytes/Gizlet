import { toolRegistry, type RegisteredTool, type ToolRegistryEntry, type ToolSlug } from './tools';

/**
 * Keyed by the registry's own slugs rather than by `string`, so a Gizlet added
 * without a related-tools entry fails `astro check` instead of crashing the
 * build inside `getStaticPaths`.
 */
const relatedToolSlugs: Record<ToolSlug, readonly ToolSlug[]> = {
  'compress-image': ['resize-image', 'convert-image'],
  'resize-image': ['compress-image', 'convert-image'],
  'convert-image': ['compress-image', 'resize-image'],
  'json-ld-generator': ['json-formatter'],
  'json-formatter': ['json-ld-generator'],
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
