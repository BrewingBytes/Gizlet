import { expect, test } from 'vitest';

import { toolRegistry } from '../../src/data/tools';

test('each Gizlet has a unique stable id and slug', () => {
  const ids = toolRegistry.map((tool) => tool.id);
  const slugs = toolRegistry.map((tool) => tool.slug);

  expect(new Set(ids)).toHaveLength(ids.length);
  expect(new Set(slugs)).toHaveLength(slugs.length);
});
