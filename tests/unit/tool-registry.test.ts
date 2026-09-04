import { expect, test } from 'vitest';

import {
  getAvailableTools,
  getPlannedToolBySlug,
  getPlannedToolCategoryGroups,
  getPlannedTools,
  isAvailableTool,
  isPlannedTool,
  getToolCategoryGroups,
  toolCategoryLabels,
  toolRegistry,
  type ToolRegistryEntry,
} from '../../src/data/tools';

const plannedTool: ToolRegistryEntry = {
  ...toolRegistry[0],
  launchStatus: 'planned',
  processesLocally: false,
};

test('each Gizlet has a unique stable id and slug', () => {
  const ids = toolRegistry.map((tool) => tool.id);
  const slugs = toolRegistry.map((tool) => tool.slug);

  expect(new Set(ids)).toHaveLength(ids.length);
  expect(new Set(slugs)).toHaveLength(slugs.length);
});

test('each Gizlet path uses Astro’s canonical trailing-slash route', () => {
  expect(toolRegistry.every((tool) => tool.path.endsWith('/'))).toBe(true);
});

test('decides on launch status rather than on a list of slugs', () => {
  expect(toolRegistry.every((tool) => isAvailableTool(tool) !== isPlannedTool(tool))).toBe(true);
  expect(isAvailableTool(plannedTool)).toBe(false);
  expect(isPlannedTool(plannedTool)).toBe(true);
});

test('claims no locality for a Gizlet that has no implementation to be local about', () => {
  expect(getPlannedTools().every((tool) => tool.processesLocally === false)).toBe(true);
  expect(getPlannedTools().length).toBeGreaterThan(0);
});

test('groups planned categories separately from the ones a visitor can use today', () => {
  const plannedGroups = getPlannedToolCategoryGroups();
  const plannedCategories = new Set(getPlannedTools().map((tool) => tool.category));

  expect(plannedGroups.map((group) => group.category).sort()).toEqual(
    [...plannedCategories].sort(),
  );
  expect(
    plannedGroups.flatMap((group) => group.tools.map((tool) => tool.slug)).sort(),
  ).toEqual(getPlannedTools().map((tool) => tool.slug).sort());
  expect(
    plannedGroups.every((group) => group.tools.every((tool) => tool.launchStatus === 'planned')),
  ).toBe(true);
});

test('finds a planned Gizlet by slug and refuses an available or unknown one', () => {
  const [firstPlanned] = getPlannedTools();

  expect(getPlannedToolBySlug(firstPlanned.slug)).toBe(firstPlanned);
  expect(getPlannedToolBySlug('compress-image')).toBeUndefined();
  expect(getPlannedToolBySlug('not-a-gizlet')).toBeUndefined();
});

test('publishes only Gizlets that are available', () => {
  expect(getAvailableTools().every((tool) => tool.launchStatus === 'available')).toBe(true);
  expect(getAvailableTools()).toHaveLength(
    toolRegistry.filter((tool) => tool.launchStatus === 'available').length,
  );
});

test('groups categories only when an available Gizlet exists for them', () => {
  const groups = getToolCategoryGroups();
  const availableCategories = new Set(getAvailableTools().map((tool) => tool.category));

  expect(groups.map((group) => group.category).sort()).toEqual([...availableCategories].sort());
  expect(groups.every((group) => group.tools.length > 0)).toBe(true);
  expect(groups.every((group) => group.label === toolCategoryLabels[group.category])).toBe(true);
  expect(groups.every((group) => group.path === `/tools/#${group.category}`)).toBe(true);
});

test('keeps every available Gizlet reachable from exactly one category group', () => {
  const grouped = getToolCategoryGroups().flatMap((group) => group.tools.map((tool) => tool.slug));

  expect(grouped.sort()).toEqual(getAvailableTools().map((tool) => tool.slug).sort());
});
