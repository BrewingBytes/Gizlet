import { describe, expect, it } from 'vitest';
import { getToolProcessingStatus } from '../../src/data/tool-page-status';
import { getRelatedTools } from '../../src/data/tool-page-related';
import type { ToolRegistryEntry } from '../../src/data/tools';
import { toolRegistry } from '../../src/data/tools';

const remoteTool: ToolRegistryEntry = {
  ...toolRegistry[0],
  name: 'Remote Gizlet',
  slug: 'remote-gizlet',
  path: '/tools/remote-gizlet/',
  processesLocally: false,
};

describe('getToolProcessingStatus', () => {
  it('uses truthful local copy by default and allows its explanation to be tailored', () => {
    expect(getToolProcessingStatus(toolRegistry[0])).toEqual({
      label: 'Local processing',
      description: 'Your file stays on this device.',
      isLocal: true,
    });
    expect(getToolProcessingStatus(toolRegistry[0], 'Nothing leaves this browser.')).toMatchObject({
      label: 'Local processing',
      description: 'Nothing leaves this browser.',
      isLocal: true,
    });
  });

  it('never assigns a local label to a tool that is not marked local in the registry', () => {
    expect(getToolProcessingStatus(remoteTool)).toBeUndefined();
    expect(getToolProcessingStatus(remoteTool, 'This tool uses a remote service.')).toEqual({
      label: 'Processing details',
      description: 'This tool uses a remote service.',
      isLocal: false,
    });
  });
});

describe('getRelatedTools', () => {
  it('uses explicit registry-backed relationships instead of guessing recommendations', () => {
    expect(getRelatedTools(toolRegistry[0]).map((tool) => tool.slug)).toEqual([
      'resize-image',
      'convert-image',
    ]);
  });
});
