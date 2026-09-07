/**
 * Writes the <lastmod> dates the sitemap serves, into
 * src/data/sitemap-dates.ts, from the git history of the files behind each
 * page:
 *
 *   pnpm run sitemap:dates            # print what it would write
 *   pnpm run sitemap:dates -- --write # write the file
 *   pnpm run sitemap:dates -- --check # fail if the committed file is stale
 *
 * The dates are generated and committed rather than read at build time, for
 * the same reason the social cards are: the build must not depend on a git
 * history being present. Continuous integration checks out shallowly, and a
 * deploy that quietly lost its dates would be worse than one that never had
 * them, because a sitemap whose lastmod cannot be trusted is one a crawler
 * learns to ignore.
 *
 * Which files date a page is declared, not inferred. Following imports was
 * tried and does not work here: `formatFileSize` lives in `data/image-compression`,
 * which twenty-five files import, so an import graph cannot tell a page's own
 * content from a utility it borrows. The declaration below is the honest
 * version of the same question, and the script refuses to run if a Gizlet is
 * missing from it.
 *
 * Understating a date is safe and overstating it is not. A crawler that is
 * told a page changed when it did not learns to disregard the whole file, so
 * where a page's prose lives in a module shared with its neighbours — the
 * per-Gizlet copy in `data/tool-page-content` — that module deliberately dates
 * nothing. The date a page carries is a date it certainly changed on.
 *
 * The file is keyed by pathname rather than by URL, because the site's own
 * address belongs to `data/metadata` and this script has no business holding a
 * second copy of it. `data/sitemap` joins the two. That module cannot be
 * imported here at all — Node resolves no extensionless TypeScript import, and
 * `data/tools` is the only module in the chain with no imports of its own — so
 * the routes below are declared here and a unit test holds the two lists to
 * each other.
 */
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { getAvailableTools } from '../src/data/tools.ts';

const run = promisify(execFile);
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(repositoryRoot, 'src/data/sitemap-dates.ts');

/**
 * The files behind each page that is not a Gizlet.
 *
 * A page's prose is usually in its own `.astro` file, but not always: the
 * privacy policy and the terms are rendered from `data/legal`, and an edit
 * there is the only kind of edit those two pages ever get.
 */
const staticPageSources = [
  { pathname: '/', files: ['src/pages/index.astro', 'src/data/home-page.ts'] },
  { pathname: '/tools/', files: ['src/pages/tools/index.astro'] },
  { pathname: '/flows/', files: ['src/pages/flows.astro', 'src/components/FlowBuilder.astro'] },
  { pathname: '/roadmap/', files: ['src/pages/roadmap.astro', 'src/data/roadmap.ts'] },
  { pathname: '/privacy/', files: ['src/pages/privacy.astro', 'src/data/legal.ts'] },
  { pathname: '/terms/', files: ['src/pages/terms.astro', 'src/data/legal.ts'] },
  { pathname: '/about/', files: ['src/pages/about.astro'] },
  {
    pathname: '/request-a-gizlet/',
    files: ['src/pages/request-a-gizlet.astro', 'src/data/gizlet-request.ts'],
  },
];

/**
 * Each Gizlet's own component, read out of the route that renders it.
 *
 * The map in `pages/tools/[slug].astro` already has to name a component for
 * every available Gizlet or the page will not build, so reading it is one less
 * list to keep in step. A Gizlet whose logic lives in `data/<slug>.ts` — most
 * of them — has that counted too, by the naming convention rather than by a
 * table; the ones whose module is named differently are dated by their
 * component alone, which is where their workspace lives.
 */
async function getToolSources() {
  const route = await readFile(join(repositoryRoot, 'src/pages/tools/[slug].astro'), 'utf8');
  const components = new Map(
    [...route.matchAll(/'([a-z0-9-]+)':\s*([A-Za-z]+),/g)].map((match) => [match[1], match[2]]),
  );
  const sources = [];

  for (const tool of getAvailableTools()) {
    const component = components.get(tool.slug);

    if (!component) {
      throw new Error(
        `No component is mapped for ${tool.slug} in src/pages/tools/[slug].astro, so its page cannot be dated.`,
      );
    }

    const files = [`src/components/${component}.astro`];
    const ownModule = `src/data/${tool.slug}.ts`;

    if (await exists(ownModule)) files.push(ownModule);

    sources.push({ pathname: tool.path, files });
  }

  return sources;
}

async function exists(relativePath) {
  try {
    await readFile(join(repositoryRoot, relativePath));

    return true;
  } catch {
    return false;
  }
}

/** The date of the last commit that touched any of some files, as YYYY-MM-DD. */
async function lastChanged(files) {
  const { stdout } = await run('git', ['log', '-1', '--format=%cs', '--', ...files], {
    cwd: repositoryRoot,
  });
  const date = stdout.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      `git has no commit date for ${files.join(', ')}. A shallow clone cannot produce these dates; fetch the full history.`,
    );
  }

  return date;
}

function formatModule(dates) {
  const entries = dates.map(([pathname, date]) => `  '${pathname}': '${date}',`).join('\n');

  return `/**
 * When each page in the sitemap last changed, by pathname, as the sitemap's
 * <lastmod>.
 *
 * Generated. Do not edit by hand: run \`pnpm run sitemap:dates -- --write\`,
 * which reads the dates out of the git history of the files behind each page.
 * scripts/generate-sitemap-dates.mjs says which files those are and why the
 * dates are committed rather than read during the build.
 */
export const sitemapDates: Readonly<Record<string, string>> = {
${entries}
};
`;
}

async function main() {
  const argv = process.argv.slice(2).filter((argument) => argument !== '--');
  const write = argv.includes('--write');
  const check = argv.includes('--check');
  const sources = [...staticPageSources, ...(await getToolSources())];
  const dates = [];

  for (const source of sources) {
    dates.push([source.pathname, await lastChanged(source.files)]);
  }

  const generated = formatModule(dates);

  if (check) {
    const committed = await readFile(outputPath, 'utf8').catch(() => '');

    if (committed !== generated) {
      console.error(
        'src/data/sitemap-dates.ts is out of date. Run `pnpm run sitemap:dates -- --write` and commit the result.',
      );
      process.exitCode = 1;

      return;
    }

    console.log(`Sitemap dates are current for ${dates.length} pages.`);

    return;
  }

  if (write) {
    await writeFile(outputPath, generated, 'utf8');
    console.log(`Wrote ${dates.length} dates to src/data/sitemap-dates.ts.`);

    return;
  }

  process.stdout.write(generated);
}

await main();
