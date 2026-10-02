/**
 * Checks the production build in dist/ against its own sitemap:
 *
 *   pnpm run build
 *   pnpm run site:check
 *
 * Every sitemap URL has to resolve to a generated, indexable page whose
 * canonical, title, H1, description and social image are in place; every
 * page the sitemap leaves out has to be noindex; JSON-LD has to parse and stay
 * on the site's host without presenting a planned Gizlet as an app; and every
 * same-site link and fragment has to land on something the build wrote. The
 * rules live in scripts/lib/built-site.mjs, which is unit tested.
 *
 * Which routes the sitemap must and must not list comes from the registry in
 * `src/data/tools.ts`, which Node can import directly because it imports
 * nothing; the site's address comes from astro.config.mjs, which the build
 * itself reads.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import astroConfig from '../astro.config.mjs';
import { getAvailableTools, getPlannedTools } from '../src/data/tools.ts';
import { checkBuiltSite, formatFindings } from './lib/built-site.mjs';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = join(repositoryRoot, 'dist');

/** @param {string} directory @returns {Promise<string[]>} */
async function listFiles(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(distDirectory, join(entry.parentPath, entry.name)).split(sep).join('/'));
}

let files;

try {
  files = await listFiles(distDirectory);
} catch {
  console.error('No dist/ directory to check. Run `pnpm run build` first.');
  process.exit(1);
}

const contents = new Map(
  await Promise.all(
    files
      .filter((file) => file.endsWith('.html') || file === 'sitemap.xml' || file === '_redirects')
      .map(async (file) => [file, await readFile(join(distDirectory, file), 'utf8')]),
  ),
);

if (!astroConfig.site) {
  console.error('astro.config.mjs sets no `site`, so there is no canonical host to check against.');
  process.exit(1);
}

const { findings, pages, sitemapUrls } = checkBuiltSite({
  siteUrl: astroConfig.site,
  registry: { available: getAvailableTools(), planned: getPlannedTools() },
  files: new Set(files),
  read: (file) => contents.get(file) ?? '',
});

if (findings.length > 0) {
  console.error(formatFindings(findings));
  console.error(`\n${findings.length} problem(s) in the built site.`);
  process.exit(1);
}

console.log(`Checked ${pages} generated page(s) against ${sitemapUrls} sitemap URL(s): no problems.`);
