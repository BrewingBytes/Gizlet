import { describe, expect, it } from 'vitest';

import { getPageMetadata, getToolMetadata } from '../../src/data/metadata';
import { getToolSocialImagePath } from '../../src/data/social-images';
import { getAvailableTools, toolRegistry } from '../../src/data/tools';

describe('getPageMetadata', () => {
  it('builds deterministic canonical and social URLs for a page', () => {
    expect(
      getPageMetadata({
        title: 'Image tools | Gizlet',
        description: 'Useful image utilities.',
        pathname: '/tools/resize-image',
      }),
    ).toMatchObject({
      canonicalUrl: 'https://gizlet.app/tools/resize-image/',
      socialImageUrl: 'https://gizlet.app/brand/brand-board.png',
      robots: 'index, follow',
    });
  });

  it('uses complete defaults when optional values are missing or blank', () => {
    expect(getPageMetadata({ title: ' ', description: '', image: ' ', robots: '  ' })).toEqual({
      title: 'Gizlet',
      description: 'Small, useful browser tools from Gizlet.',
      canonicalUrl: 'https://gizlet.app/',
      socialImageUrl: 'https://gizlet.app/brand/brand-board.png',
      robots: 'index, follow',
    });
  });
});

describe('getToolMetadata', () => {
  it('uses registry-backed tool defaults and respects explicit overrides', () => {
    expect(getToolMetadata(toolRegistry[0])).toMatchObject({
      title: 'Compress Image | Gizlet',
      description: toolRegistry[0].description,
      canonicalUrl: 'https://gizlet.app/tools/compress-image/',
    });

    expect(getToolMetadata(toolRegistry[0], { title: 'Custom title', robots: 'noindex, nofollow' })).toMatchObject({
      title: 'Custom title',
      robots: 'noindex, nofollow',
    });
  });

  it('previews each Gizlet with its own social image, at an absolute URL', () => {
    const socialImageUrls = getAvailableTools().map((tool) => getToolMetadata(tool).socialImageUrl);

    expect(socialImageUrls).toEqual(
      getAvailableTools().map((tool) => `https://gizlet.app${getToolSocialImagePath(tool)}`),
    );
    expect(new Set(socialImageUrls)).toHaveLength(socialImageUrls.length);
  });

  it('respects a social image a page supplies for itself', () => {
    expect(getToolMetadata(toolRegistry[0], { image: '/brand/brand-board.png' })).toMatchObject({
      socialImageUrl: 'https://gizlet.app/brand/brand-board.png',
    });
  });

  it('produces unique default titles and descriptions across the homepage and tool registry', () => {
    const metadata = [
      getPageMetadata({
        title: 'Gizlet | Useful internet things, without the nonsense.',
        description: 'Useful internet things, without the nonsense. Small browser tools from Gizlet.',
      }),
      ...toolRegistry.map((tool) => getToolMetadata(tool)),
    ];

    expect(new Set(metadata.map((page) => page.title))).toHaveLength(metadata.length);
    expect(new Set(metadata.map((page) => page.description))).toHaveLength(metadata.length);
  });
});
