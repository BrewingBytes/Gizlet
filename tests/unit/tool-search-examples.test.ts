import { expect, test } from 'vitest';

import { toolSearchExamples, toolSearchPlaceholder } from '../../src/data/tool-search-examples';
import { searchTools } from '../../src/scripts/tool-search';
import { getAvailableTools } from '../../src/data/tools';

test('every search example the home page suggests returns an available Gizlet', () => {
  const availableSlugs = new Set<string>(getAvailableTools().map((tool) => tool.path));

  for (const example of toolSearchExamples) {
    const results = searchTools(example, getAvailableTools());

    expect(results, `"${example}" suggests a search that finds nothing`).not.toHaveLength(0);
    expect(results.every((tool) => availableSlugs.has(tool.path))).toBe(true);
  }
});

test('renders the examples as one comma-separated placeholder', () => {
  // Both the home-page field and the global overlay render this one string, so
  // the two cannot suggest different things.
  expect(toolSearchPlaceholder).toBe('compress a photo, resize an image, format JSON…');
});
