import { toolRegistry, type ToolRegistryEntry } from './tools';

const relatedToolSlugs: Record<ToolRegistryEntry['slug'], readonly ToolRegistryEntry['slug'][]> = {
  'compress-image': ['resize-image', 'convert-image'],
  'resize-image': ['compress-image', 'convert-image'],
  'convert-image': ['compress-image', 'resize-image'],
  'json-ld-generator': ['json-formatter'],
  'json-formatter': ['json-ld-generator'],
};

function getToolBySlug(slug: ToolRegistryEntry['slug']): ToolRegistryEntry {
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
export function getRelatedTools(tool: ToolRegistryEntry): readonly ToolRegistryEntry[] {
  return relatedToolSlugs[tool.slug].map(getToolBySlug);
}
