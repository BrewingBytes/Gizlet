import { describe, expect, it } from 'vitest';

import { getAgentCatalog, getLlmsTxt } from '../../src/data/agent-catalog';
import { getPlannedTools, toolRegistry, type ToolRegistryEntry } from '../../src/data/tools';

/**
 * A planned entry built field by field rather than spread from an available
 * one: the union will not let a planned entry carry an `agent` block or a true
 * locality claim, and the fixture has to be the shape the catalogue actually
 * receives for the omissions below to mean anything.
 */
const plannedTool: ToolRegistryEntry = {
  id: 99,
  name: 'Planned Image Tool',
  slug: 'planned-image-tool',
  path: '/tools/planned-image-tool/',
  category: 'images',
  description: 'Not built yet.',
  keywords: ['planned'],
  processesLocally: false,
  launchStatus: 'planned',
};

describe('agent-readable catalogue', () => {
  it('derives available tool details and truthful local privacy details from the registry', () => {
    const catalogue = getAgentCatalog();
    const formatter = catalogue.tools.find((tool) => tool.slug === 'json-formatter');

    expect(catalogue.catalogueUrl).toBe('https://gizlet.app/tools.json');
    expect(catalogue.privacy).toContain('remain on-device');
    expect(formatter).toEqual({
      name: 'JSON Formatter',
      slug: 'json-formatter',
      route: 'https://gizlet.app/tools/json-formatter/',
      category: 'developer',
      availability: 'available',
      localProcessing: true,
      purpose: 'Format, validate, and read JSON with a clearer structure.',
      input: 'Valid JSON text pasted into the workspace.',
      output: 'Formatted or minified JSON text ready to copy.',
      privacy: 'Local: this tool processes its input in the browser. Input, files, and generated output stay on-device.',
    });
  });

  it('publishes a planned Gizlet as a plan rather than as an available action', () => {
    const catalogue = getAgentCatalog([...toolRegistry, plannedTool]);
    const llms = getLlmsTxt([...toolRegistry, plannedTool]);
    const planned = catalogue.planned.find((tool) => tool.slug === 'planned-image-tool');

    expect(catalogue.tools.map((tool) => tool.slug)).not.toContain('planned-image-tool');
    expect(planned).toEqual({
      name: 'Planned Image Tool',
      slug: 'planned-image-tool',
      route: 'https://gizlet.app/tools/planned-image-tool/',
      category: 'images',
      availability: 'planned',
      purpose: 'Not built yet.',
      roadmapUrl: 'https://gizlet.app/roadmap/',
    });
    // The omissions are the contract: nothing here says what to send it, what
    // it hands back, or where it processes anything, because it does none.
    expect(planned).not.toHaveProperty('localProcessing');
    expect(planned).not.toHaveProperty('input');
    expect(planned).not.toHaveProperty('output');
    expect(planned).not.toHaveProperty('privacy');
    expect(catalogue.plannedNotice).toContain('are not built');
    expect(llms).toContain('## Planned Gizlets — not available');
    expect(llms).toContain(
      '- Planned Image Tool (https://gizlet.app/tools/planned-image-tool/): Not built yet. Not built yet: https://gizlet.app/roadmap/',
    );
    // Plain text, not a Markdown link: the available half is linkable and this
    // half deliberately is not, so a reader lifting links gets only real ones.
    expect(llms).not.toContain('[Planned Image Tool]');
  });

  it('sends every planned Gizlet in the registry to the phase that explains it', () => {
    const catalogue = getAgentCatalog();

    expect(catalogue.planned.map((tool) => tool.slug)).toEqual(
      getPlannedTools().map((tool) => tool.slug),
    );
    expect(
      catalogue.planned.every((tool) => /^https:\/\/gizlet\.app\/roadmap\/#phase-\d+$/.test(tool.roadmapUrl)),
    ).toBe(true);
  });

  it('links the plain-text document to the catalogue and canonical available routes', () => {
    const llms = getLlmsTxt();

    expect(llms).toContain('[Machine-readable tool catalogue](https://gizlet.app/tools.json)');
    expect(llms).toContain('[Compress Image](https://gizlet.app/tools/compress-image/)');
    expect(llms).toContain('Input: One JPEG, PNG, WebP, AVIF, or BMP image');
    expect(llms.endsWith('\n')).toBe(true);
  });
});
