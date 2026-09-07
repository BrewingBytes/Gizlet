import { siteUrl } from './metadata';
import { roadmapPath } from './roadmap';
import { sitemapDates } from './sitemap-dates';
import { toolRegistry } from './tools';

const sitemapPathname = '/sitemap.xml';
const publicInformationPathnames = [
  '/tools/',
  '/flows/',
  roadmapPath,
  '/privacy/',
  '/terms/',
  '/about/',
  '/request-a-gizlet/',
] as const;

export interface SitemapEntry {
  readonly pathname: string;
  readonly url: string;
  /**
   * When the page last changed, as YYYY-MM-DD, or nothing when no date is
   * known. Nothing is the right answer to serve in that case: a crawler that
   * has been told a page changed when it did not learns to disregard the
   * dates on every other page too.
   */
  readonly lastModified?: string;
}

/**
 * Returns every route that is ready for public search discovery.
 *
 * Tool routes deliberately come from the canonical registry so a tool cannot
 * be listed in the sitemap before its launch status is marked available.
 */
export function getSitemapEntries(): readonly SitemapEntry[] {
  const pathnames = [
    '/',
    ...publicInformationPathnames,
    ...toolRegistry.filter((tool) => tool.launchStatus === 'available').map((tool) => tool.path),
  ];
  const entries = pathnames.map((pathname) => {
    const lastModified = sitemapDates[pathname];

    return {
      pathname,
      url: new URL(pathname, siteUrl).toString(),
      ...(lastModified ? { lastModified } : {}),
    };
  });

  assertUniqueSitemapUrls(entries.map((entry) => entry.url));
  return entries;
}

export function getSitemapUrls(): readonly string[] {
  return getSitemapEntries().map((entry) => entry.url);
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

/**
 * Produces the static XML document served from /sitemap.xml.
 *
 * A page carries a `<lastmod>` only when a date is known for it. The dates
 * come from `data/sitemap-dates`, which is generated from the git history of
 * the files behind each page rather than from the clock — a sitemap that says
 * every page changed on the day it was built is a sitemap saying nothing, and
 * a crawler treats it accordingly.
 */
export function getSitemapXml(): string {
  const entries = getSitemapEntries()
    .map((entry) => {
      const lastModified = entry.lastModified
        ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>`
        : '';

      return `  <url><loc>${escapeXml(entry.url)}</loc>${lastModified}</url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

/** Produces a cautious crawler policy that advertises the production sitemap. */
export function getRobotsTxt(): string {
  const sitemapUrl = new URL(sitemapPathname, siteUrl).toString();

  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
}
