import { siteUrl } from './metadata';
import { toolRegistry } from './tools';

const sitemapPathname = '/sitemap.xml';
const publicInformationPathnames = ['/tools/', '/privacy/', '/terms/', '/about/', '/request-a-gizlet/'] as const;

/**
 * Returns every route that is ready for public search discovery.
 *
 * Tool routes deliberately come from the canonical registry so a tool cannot
 * be listed in the sitemap before its launch status is marked available.
 */
export function getSitemapUrls(): readonly string[] {
  const urls = [
    new URL('/', siteUrl).toString(),
    ...publicInformationPathnames.map((pathname) => new URL(pathname, siteUrl).toString()),
  ];

  for (const tool of toolRegistry) {
    if (tool.launchStatus === 'available') {
      urls.push(new URL(tool.path, siteUrl).toString());
    }
  }

  assertUniqueSitemapUrls(urls);
  return urls;
}

/** Throws during the static build if two sitemap entries resolve to one URL. */
export function assertUniqueSitemapUrls(urls: readonly string[]): void {
  const uniqueUrls = new Set(urls);

  if (uniqueUrls.size !== urls.length) {
    const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
    throw new Error(`Duplicate sitemap URLs generated: ${[...new Set(duplicates)].join(', ')}`);
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    };

    return entities[character];
  });
}

/** Produces the static XML document served from /sitemap.xml. */
export function getSitemapXml(): string {
  const entries = getSitemapUrls()
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

/** Produces a cautious crawler policy that advertises the production sitemap. */
export function getRobotsTxt(): string {
  const sitemapUrl = new URL(sitemapPathname, siteUrl).toString();

  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
}
