import { describe, expect, it } from 'vitest';

import {
  assertUniqueSitemapUrls,
  getRobotsTxt,
  getSitemapUrls,
  getSitemapXml,
} from '../../src/data/sitemap';
import { siteUrl } from '../../src/data/metadata';
import { toolRegistry } from '../../src/data/tools';

describe('sitemap generation', () => {
  it('contains the homepage and only available registry tools', () => {
    const expectedUrls = [
      new URL('/', siteUrl).toString(),
      ...toolRegistry
        .filter((tool) => tool.launchStatus === 'available')
        .map((tool) => new URL(tool.path, siteUrl).toString()),
    ];

    expect(getSitemapUrls()).toEqual(expectedUrls);
    expect(getSitemapXml()).toContain('<loc>https://gizlet.com/</loc>');
    expect(getSitemapXml()).not.toContain('json-ld-generator');
    expect(getSitemapXml()).not.toContain('json-formatter');
  });

  it('rejects duplicate URLs so they cannot be emitted during a build', () => {
    expect(() =>
      assertUniqueSitemapUrls(['https://gizlet.com/', 'https://gizlet.com/']),
    ).toThrow('Duplicate sitemap URLs generated');
  });
});

describe('robots.txt generation', () => {
  it('allows crawling and points crawlers to the production sitemap', () => {
    expect(getRobotsTxt()).toBe('User-agent: *\nAllow: /\n\nSitemap: https://gizlet.com/sitemap.xml\n');
  });
});
