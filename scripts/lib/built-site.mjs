/**
 * Checks the built site in `dist/` against its own sitemap.
 *
 * The metadata, the structured data, and the sitemap are each unit tested as
 * data, but a page is assembled from all three by a route, and the route is
 * where they can disagree: a page the sitemap lists may not exist, may carry
 * another page's canonical, or may be marked noindex. This module reads what
 * the build actually wrote and holds the pieces to each other.
 *
 * It is deliberately pure: it reads no files, so tests/unit/built-site.test.ts
 * can cover every rule with small HTML fixtures. scripts/check-built-site.mjs
 * supplies the files from `dist/` and the registry from `src/data/tools.ts`.
 *
 * The HTML is read with a small tokenizer rather than a parser dependency.
 * Astro writes well-formed, quoted markup, and the checks need only tags,
 * attributes, the text of four elements, and the contents of JSON-LD scripts.
 *
 * Each finding names the page, the offending value, and the rule it breaks, so
 * a failing report says what to fix without a second run.
 */

/**
 * @typedef {{ page: string, rule: string, value: string, message: string }} Finding
 * @typedef {{ slug: string, path: string, category: string }} RegistryTool
 * @typedef {{ available: readonly RegistryTool[], planned: readonly RegistryTool[] }} Registry
 * @typedef {{
 *   siteUrl: string,
 *   registry: Registry,
 *   files: ReadonlySet<string>,
 *   read: (file: string) => string,
 * }} BuiltSite
 */

/** Where the site's category pages live; `data/tool-categories` owns the same path. */
export const categoryPagesPath = '/categories/';

/** The page a deployment serves for an unknown address. */
export const notFoundFile = '404.html';

/** Element and attribute pairs that name another resource on the site. */
const linkAttributes = {
  a: ['href'],
  area: ['href'],
  link: ['href'],
  img: ['src', 'srcset'],
  source: ['src', 'srcset'],
  script: ['src'],
  iframe: ['src'],
  video: ['src', 'poster'],
  audio: ['src'],
  form: ['action'],
};

/** JSON-LD properties whose value is an address the markup claims for the site. */
const structuredDataUrlKeys = new Set(['url', 'item', '@id', 'image', 'logo', 'mainEntityOfPage']);

/** Schema.org types that present the thing they describe as a working app. */
const applicationTypes = new Set(['SoftwareApplication', 'WebApplication', 'MobileApplication']);

/**
 * The routes the registry says the sitemap must list, and the ones it must
 * not: every available Gizlet, the category page of every category holding
 * one, and none of the planned Gizlets. `data/sitemap` applies the same rule,
 * and the unit test holds the two to each other.
 *
 * @param {Registry} registry
 */
export function getRegistryRoutes(registry) {
  const categories = [...new Set(registry.available.map((tool) => tool.category))];

  return {
    listed: [
      ...categories.map((category) => `${categoryPagesPath}${category}/`),
      ...registry.available.map((tool) => tool.path),
    ],
    planned: registry.planned.map((tool) => tool.path),
  };
}

const namedEntities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** @param {string} value */
function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, name) => {
    if (name[0] === '#') {
      const codePoint = name[1] === 'x' || name[1] === 'X'
        ? Number.parseInt(name.slice(2), 16)
        : Number.parseInt(name.slice(1), 10);
      return String.fromCodePoint(codePoint);
    }

    return namedEntities[/** @type {keyof typeof namedEntities} */ (name.toLowerCase())] ?? entity;
  });
}

/** @param {string} source */
function parseAttributes(source) {
  /** @type {Record<string, string>} */
  const attributes = {};

  for (const match of source.matchAll(/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }

  return attributes;
}

/** @param {string} html */
function textOf(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/**
 * Reads what the checks need out of one HTML document.
 *
 * Script and style bodies are skipped rather than scanned for tags, so a
 * string in a script that looks like markup is not mistaken for a link. A
 * JSON-LD script's body is kept, unparsed, for the structured-data rules.
 *
 * @param {string} html
 */
export function parseHtml(html) {
  /** @type {{ tag: string, attributes: Record<string, string> }[]} */
  const elements = [];
  /** @type {string[]} */
  const jsonLd = [];
  /** @type {Record<string, string[]>} */
  const texts = { title: [], h1: [] };
  /** @type {{ tag: string, start: number }[]} */
  const open = [];
  // An inline icon's <title> labels the icon, not the document.
  let svgDepth = 0;
  const tagPattern = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let match;

  while ((match = tagPattern.exec(html))) {
    if (!match[2]) continue;

    const tag = match[2].toLowerCase();

    if (tag === 'svg') svgDepth = Math.max(0, svgDepth + (match[1] ? -1 : 1));

    if (match[1]) {
      const index = open.findLastIndex((entry) => entry.tag === tag);

      if (index !== -1) {
        const [entry] = open.splice(index);
        texts[tag]?.push(textOf(html.slice(entry.start, match.index)));
      }
      continue;
    }

    const attributes = parseAttributes(match[3]);
    elements.push({ tag, attributes });

    if (tag === 'script' || tag === 'style') {
      const close = html.toLowerCase().indexOf(`</${tag}`, tagPattern.lastIndex);
      const end = close === -1 ? html.length : close;

      if (tag === 'script' && attributes.type?.toLowerCase() === 'application/ld+json') {
        jsonLd.push(html.slice(tagPattern.lastIndex, end));
      }

      tagPattern.lastIndex = close === -1 ? html.length : html.indexOf('>', close) + 1;
      continue;
    }

    if (tag in texts && !(tag === 'title' && svgDepth > 0)) open.push({ tag, start: tagPattern.lastIndex });
  }

  const meta = (/** @type {string} */ key) =>
    elements.find((element) =>
      element.tag === 'meta' && (element.attributes.name === key || element.attributes.property === key),
    )?.attributes.content;

  return {
    elements,
    jsonLd,
    titles: texts.title,
    headings: texts.h1,
    description: meta('description'),
    robots: meta('robots'),
    socialImages: [meta('og:image'), meta('twitter:image')],
    canonicals: elements
      .filter((element) => element.tag === 'link' && element.attributes.rel?.split(/\s+/).includes('canonical'))
      .map((element) => element.attributes.href ?? ''),
    anchors: new Set(
      elements.flatMap((element) => [element.attributes.id, element.tag === 'a' ? element.attributes.name : undefined])
        .filter((value) => value !== undefined && value !== ''),
    ),
  };
}

/** @param {string | undefined} robots */
function isNoindex(robots) {
  return (robots ?? '').toLowerCase().split(/[\s,]+/).some((directive) => directive === 'noindex' || directive === 'none');
}

/**
 * The URLs a sitemap lists, in order.
 *
 * @param {string} xml
 */
export function parseSitemap(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((match) => decodeEntities(match[1]));
}

/** The URL path a generated HTML file is served at. @param {string} file */
export function pagePathFor(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file.slice(0, -'.html'.length)}`;
}

/**
 * Parses a `_redirects` file into exact and splat rules, the two forms the
 * asset server honours.
 *
 * @param {string | undefined} source
 */
export function parseRedirects(source) {
  return (source ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [from, to] = line.split(/\s+/);
      return { from, to };
    })
    .filter((rule) => rule.from && rule.to);
}

/**
 * Finds the file the deployment serves for a path, or `undefined`.
 *
 * This follows the asset server's `auto-trailing-slash` handling, which
 * wrangler.toml sets: `/a/` serves `a/index.html` or redirects to `a.html`,
 * and `/a` serves `a.html` or redirects to `a/index.html`. A `_redirects` rule
 * is followed once.
 *
 * @param {string} pathname
 * @param {BuiltSite} site
 * @param {readonly { from: string, to: string }[]} redirects
 * @returns {string | undefined}
 */
export function resolvePath(pathname, site, redirects = []) {
  let path;

  try {
    path = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return undefined;
  }

  const base = path.replace(/\/+$/, '');
  const candidates = path === '' || path.endsWith('/')
    ? [`${path}index.html`, `${base}.html`]
    : [path, `${path}.html`, `${path}/index.html`];
  const found = candidates.find((candidate) => site.files.has(candidate));

  if (found) return found;

  for (const rule of redirects) {
    const splat = rule.from.endsWith('*') ? rule.from.slice(0, -1) : undefined;
    const matches = splat === undefined ? rule.from === pathname : pathname.startsWith(splat);

    if (!matches) continue;

    const target = new URL(
      splat === undefined ? rule.to : rule.to.replace(':splat', pathname.slice(splat.length)),
      site.siteUrl,
    );

    if (target.origin !== new URL(site.siteUrl).origin) return rule.to;
    return resolvePath(target.pathname, site, []);
  }

  return undefined;
}

/**
 * Walks every object in a JSON-LD payload.
 *
 * @param {unknown} value
 * @param {(node: Record<string, unknown>) => void} visit
 */
function walkStructuredData(value, visit) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkStructuredData(item, visit));
  } else if (value && typeof value === 'object') {
    visit(/** @type {Record<string, unknown>} */ (value));
    Object.values(value).forEach((item) => walkStructuredData(item, visit));
  }
}

/** @param {unknown} type */
function typesOf(type) {
  return (Array.isArray(type) ? type : [type]).filter((item) => typeof item === 'string');
}

/**
 * Runs every rule over a built site and returns what fails, ordered by page.
 *
 * @param {BuiltSite} site
 * @returns {{ findings: Finding[], pages: number, sitemapUrls: number }}
 */
export function checkBuiltSite(site) {
  /** @type {Finding[]} */
  const findings = [];
  const report = (/** @type {string} */ page, /** @type {string} */ rule, /** @type {unknown} */ value, /** @type {string} */ message) =>
    findings.push({ page, rule, value: String(value), message });
  const origin = new URL(site.siteUrl).origin;
  const redirects = parseRedirects(site.files.has('_redirects') ? site.read('_redirects') : undefined);
  const htmlFiles = [...site.files].filter((file) => file.endsWith('.html')).sort();
  /** @type {Map<string, ReturnType<typeof parseHtml>>} */
  const parsed = new Map();
  const pageFor = (/** @type {string} */ file) => {
    if (!parsed.has(file)) parsed.set(file, parseHtml(site.read(file)));
    return /** @type {ReturnType<typeof parseHtml>} */ (parsed.get(file));
  };
  const routes = getRegistryRoutes(site.registry);
  const availablePaths = new Set(site.registry.available.map((tool) => tool.path));
  const plannedPaths = new Set(routes.planned);

  // The sitemap: present, on the site's own host, each address once.
  /** @type {string[]} */
  let sitemapUrls = [];

  if (!site.files.has('sitemap.xml')) {
    report('/sitemap.xml', 'sitemap-missing', 'sitemap.xml', 'The build wrote no sitemap.xml.');
  } else {
    sitemapUrls = parseSitemap(site.read('sitemap.xml'));

    if (sitemapUrls.length === 0) {
      report('/sitemap.xml', 'sitemap-empty', '', 'The sitemap lists no <loc> entries.');
    }
  }

  /** @type {Map<string, string>} */
  const listedFiles = new Map();
  const seen = new Set();

  for (const url of sitemapUrls) {
    if (seen.has(url)) report('/sitemap.xml', 'sitemap-duplicate', url, 'The sitemap lists this URL more than once.');
    seen.add(url);

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      report('/sitemap.xml', 'sitemap-url', url, 'A sitemap entry is not an absolute URL.');
      continue;
    }

    if (parsedUrl.origin !== origin) {
      report('/sitemap.xml', 'sitemap-host', url, `A sitemap entry must be on ${origin}.`);
      continue;
    }

    const file = resolvePath(parsedUrl.pathname, site);

    if (!file || !file.endsWith('.html')) {
      report(parsedUrl.pathname, 'sitemap-page-missing', url, 'The sitemap lists a page the build did not generate.');
      continue;
    }

    listedFiles.set(file, url);
  }

  // The registry decides the indexable Gizlet routes; the sitemap must agree.
  const listedPaths = new Set(
    sitemapUrls.flatMap((url) => {
      try {
        return [new URL(url).pathname];
      } catch {
        return [];
      }
    }),
  );

  for (const path of routes.listed) {
    if (!listedPaths.has(path)) {
      report(path, 'sitemap-registry-missing', path, 'The registry publishes this page, but the sitemap does not list it.');
    }
  }

  for (const path of routes.planned) {
    if (listedPaths.has(path)) {
      report(path, 'sitemap-planned', path, 'A planned Gizlet is listed in the sitemap.');
    }

    if (!resolvePath(path, site)) {
      report(path, 'planned-page-missing', path, 'The registry names this planned Gizlet, but the build wrote no page for it.');
    }
  }

  if (!site.files.has(notFoundFile)) {
    report('/404.html', 'not-found-missing', notFoundFile, 'The build wrote no 404 page for the deployment to serve.');
  }

  /** @param {string} page @param {string | undefined} value @param {string} rule */
  const checkSocialImage = (page, value, rule) => {
    if (!value?.trim()) {
      report(page, rule, value ?? '', 'The page advertises no social image.');
      return;
    }

    const image = new URL(value, site.siteUrl);

    if (image.origin !== origin) {
      report(page, rule, value, `The social image must be on ${origin}.`);
    } else if (!site.files.has(decodeURIComponent(image.pathname).replace(/^\//, ''))) {
      report(page, rule, value, 'The social image names a file the build did not write.');
    }
  };

  for (const file of htmlFiles) {
    const page = pagePathFor(file);
    const html = pageFor(file);
    const listedUrl = listedFiles.get(file);
    const noindex = isNoindex(html.robots);

    if (listedUrl) {
      // Indexable: everything a search result is built from has to be there.
      if (noindex) report(page, 'sitemap-noindex', html.robots, 'The sitemap lists a page whose robots policy is noindex.');

      if (html.canonicals.length !== 1 || html.canonicals[0] !== listedUrl) {
        report(page, 'canonical-mismatch', html.canonicals.join(', ') || '(none)', `The page needs exactly one canonical, equal to its sitemap URL ${listedUrl}.`);
      }

      if (html.titles.length !== 1 || !html.titles[0]) {
        report(page, 'title', html.titles.join(' | ') || '(none)', 'An indexable page needs exactly one nonempty <title>.');
      }

      if (html.headings.length !== 1 || !html.headings[0]) {
        report(page, 'h1', html.headings.join(' | ') || '(none)', 'An indexable page needs exactly one nonempty <h1>.');
      }

      if (!html.description?.trim()) {
        report(page, 'description', html.description ?? '(none)', 'An indexable page needs a nonempty meta description.');
      }

      checkSocialImage(page, html.socialImages[0], 'og-image');
      checkSocialImage(page, html.socialImages[1], 'twitter-image');
    } else if (!noindex) {
      // Anything the sitemap leaves out — a planned Gizlet, the 404 page, a
      // campaign landing page — must say so to a crawler that finds it anyway.
      report(page, 'unlisted-indexable', html.robots ?? '(none)', 'A page missing from the sitemap must carry a noindex robots policy.');
    }

    if (plannedPaths.has(page) && !html.robots?.toLowerCase().includes('nofollow')) {
      report(page, 'planned-robots', html.robots ?? '(none)', 'A planned Gizlet page must be noindex, nofollow.');
    }

    for (const canonical of html.canonicals) {
      try {
        if (new URL(canonical).origin !== origin) {
          report(page, 'canonical-host', canonical, `The canonical must be on ${origin}.`);
        }
      } catch {
        report(page, 'canonical-host', canonical, 'The canonical is not an absolute URL.');
      }
    }

    // Structured data: valid JSON, on the site's own host, and no app claimed
    // for a Gizlet the registry does not mark available.
    for (const source of html.jsonLd) {
      let data;

      try {
        data = JSON.parse(source);
      } catch (error) {
        report(page, 'jsonld-malformed', source.trim().slice(0, 80), `The JSON-LD does not parse: ${/** @type {Error} */ (error).message}`);
        continue;
      }

      walkStructuredData(data, (node) => {
        for (const [key, value] of Object.entries(node)) {
          if (!structuredDataUrlKeys.has(key) || typeof value !== 'string' || !/^[a-z][a-z0-9+.-]*:/i.test(value)) continue;

          if (!/^https?:/i.test(value) || new URL(value).origin !== origin) {
            report(page, 'jsonld-host', value, `JSON-LD "${key}" must be on ${origin}.`);
          }
        }

        const types = typesOf(node['@type']);

        if (types.some((type) => applicationTypes.has(type))) {
          const url = typeof node.url === 'string' ? node.url : '';
          let path = '';

          try {
            path = new URL(url, site.siteUrl).pathname;
          } catch {
            // Reported below as an app with no available Gizlet behind it.
          }

          if (plannedPaths.has(page) || !availablePaths.has(path)) {
            report(page, 'jsonld-unavailable-app', url || '(no url)', `JSON-LD presents ${types.join('/')} for a Gizlet the registry does not mark available.`);
          }
        }
      });
    }

    // Same-site links: the target exists, and so does its fragment.
    for (const element of html.elements) {
      for (const attribute of linkAttributes[/** @type {keyof typeof linkAttributes} */ (element.tag)] ?? []) {
        const raw = element.attributes[attribute];

        if (raw === undefined || raw.trim() === '') continue;

        const values = attribute === 'srcset'
          ? raw.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean)
          : [raw.trim()];

        for (const value of values) {
          let target;

          try {
            target = new URL(value, new URL(page, site.siteUrl));
          } catch {
            report(page, 'link-invalid', value, 'The link is not a valid URL.');
            continue;
          }

          // Mail, telephone, data and other origins are intentionally external.
          if (target.origin !== origin) continue;

          const resolved = resolvePath(target.pathname, site, redirects);

          if (!resolved) {
            report(page, 'link-broken', value, 'The link points at a page or asset the build did not write.');
            continue;
          }

          const fragment = target.hash.slice(1);

          // A fragment written as key=value is state a page's script reads —
          // a flow recipe, say — rather than an element to scroll to.
          if (fragment && !fragment.includes('=') && resolved.endsWith('.html') && site.files.has(resolved)) {
            if (!pageFor(resolved).anchors.has(decodeURIComponent(fragment))) {
              report(page, 'link-fragment', value, `The link's fragment names no id on ${pagePathFor(resolved)}.`);
            }
          }
        }
      }
    }
  }

  return { findings, pages: htmlFiles.length, sitemapUrls: sitemapUrls.length };
}

/**
 * One line per finding: the page, the rule, the value, and why it fails.
 *
 * @param {readonly Finding[]} findings
 */
export function formatFindings(findings) {
  return findings
    .map((finding) => `${finding.page}  [${finding.rule}]  ${JSON.stringify(finding.value)}\n  ${finding.message}`)
    .join('\n');
}
