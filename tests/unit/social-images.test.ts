import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fallbackSocialImagePath,
  getBespokeSocialImageSlugs,
  getToolSocialImagePath,
  homeSocialImagePath,
  socialImageDirectory,
  toolIndexSocialImagePath,
} from '../../src/data/social-images';
import { getAvailableTools, type ToolRegistryEntry } from '../../src/data/tools';

const publicDirectory = join(import.meta.dirname, '..', '..', 'public');

/** Reads the dimensions an actual PNG declares in its IHDR chunk. */
function readPngSize(path: string): { width: number; height: number } {
  const file = readFileSync(join(publicDirectory, path));

  expect(file.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

const plannedTool = {
  id: 99,
  name: 'Planned Gizlet',
  slug: 'planned-gizlet',
  path: '/tools/planned-gizlet/',
  category: 'developer',
  description: 'Not built yet.',
  keywords: [],
  processesLocally: false,
  launchStatus: 'planned',
} as const satisfies ToolRegistryEntry;

describe('getToolSocialImagePath', () => {
  it('gives every available Gizlet its own image under the social directory', () => {
    for (const tool of getAvailableTools()) {
      expect(getToolSocialImagePath(tool)).toBe(`${socialImageDirectory}${tool.slug}.png`);
    }
  });

  it('falls back to the brand board for a Gizlet without an image of its own', () => {
    expect(getToolSocialImagePath(plannedTool)).toBe(fallbackSocialImagePath);
  });
});

describe('the committed social images', () => {
  it('covers exactly the available Gizlets, so no card is drawn for a page that does not exist', () => {
    expect([...getBespokeSocialImageSlugs()].sort()).toEqual(
      getAvailableTools()
        .map((tool) => tool.slug)
        .sort(),
    );
  });

  it('ships a 1200x630 PNG for every Gizlet page, the Gizlet index, and the home page', () => {
    const paths = [
      ...getAvailableTools().map((tool) => getToolSocialImagePath(tool)),
      toolIndexSocialImagePath,
      homeSocialImagePath,
      fallbackSocialImagePath,
    ];

    for (const path of paths) {
      expect(() => readPngSize(path), path).not.toThrow();
    }

    for (const path of paths.filter((candidate) => candidate !== fallbackSocialImagePath)) {
      expect(readPngSize(path), path).toEqual({ width: 1200, height: 630 });
    }
  });
});
