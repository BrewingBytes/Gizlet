import { describe, expect, it } from 'vitest';

import { getAgentCatalog, getLlmsTxt } from '../../src/data/agent-catalog';
import { toolRegistry, type ToolRegistryEntry } from '../../src/data/tools';

const plannedTool: ToolRegistryEntry = {
  ...toolRegistry[0],
  id: 99,
  name: 'Planned Image Tool',
  slug: 'planned-image-tool',
  path: '/tools/planned-image-tool/',
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

  it('does not advertise planned Gizlets as available actions', () => {
    const catalogue = getAgentCatalog([...toolRegistry, plannedTool]);
    const llms = getLlmsTxt([...toolRegistry, plannedTool]);

    expect(catalogue.tools.map((tool) => tool.slug)).not.toContain('planned-image-tool');
    expect(llms).not.toContain('Planned Image Tool');
  });

  it('links the plain-text document to the catalogue and canonical available routes', () => {
    const llms = getLlmsTxt();

    expect(llms).toContain('[Machine-readable tool catalogue](https://gizlet.app/tools.json)');
    expect(llms).toContain('[Compress Image](https://gizlet.app/tools/compress-image/)');
    expect(llms).toContain('Input: One JPEG, PNG, WebP, AVIF, or BMP image');
    expect(llms.endsWith('\n')).toBe(true);
  });
});
