import { describe, expect, it } from "vitest";

import astroConfig from "../../astro.config.mjs";
import {
  categoryPagesPath,
  checkBuiltSite,
  formatFindings,
  getRegistryRoutes,
  parseHtml,
  resolvePath,
} from "../../scripts/lib/built-site.mjs";
import { siteUrl } from "../../src/data/metadata";
import { getSitemapEntries } from "../../src/data/sitemap";
import { getToolCategoryPages, toolCategoryPagesPath } from "../../src/data/tool-categories";
import { getAvailableTools, getPlannedTools } from "../../src/data/tools";

const origin = "https://gizlet.app";

interface PageOptions {
  readonly path: string;
  readonly title?: string;
  readonly h1?: readonly string[];
  readonly description?: string;
  readonly robots?: string;
  readonly canonical?: string;
  readonly image?: string;
  readonly jsonLd?: readonly string[];
  readonly body?: string;
}

/** A small page shaped like the ones BaseLayout writes. */
function page(options: PageOptions): string {
  const {
    path,
    title = "A page | Gizlet",
    h1 = ["A page"],
    description = "What the page is for.",
    robots = "index, follow",
    canonical = `${origin}${path}`,
    image = `${origin}/brand/brand-board.png`,
    jsonLd = [],
    body = "",
  } = options;

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="description" content="${description}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
<meta property="og:image" content="${image}">
<meta name="twitter:image" content="${image}">
<title>${title}</title>
${jsonLd.map((source) => `<script type="application/ld+json">${source}</script>`).join("\n")}
<script>const markup = '<a href="/nowhere/">not a link</a>';</script>
</head><body><a href="#main">Skip</a><main id="main">
${h1.map((heading) => `<h1>${heading}</h1>`).join("")}
${body}
</main></body></html>`;
}

const registry = {
  available: [{ slug: "compress-image", path: "/tools/compress-image/", category: "images" }],
  planned: [{ slug: "trim-video", path: "/tools/trim-video/", category: "video" }],
};

const listedPaths = ["/", "/categories/images/", "/tools/compress-image/"];

function sitemap(paths: readonly string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((path) => `  <url><loc>${path.startsWith("http") ? path : `${origin}${path}`}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
}

const app = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Compress Image",
  url: `${origin}/tools/compress-image/`,
});

/** A valid built site; each test breaks one thing in it. */
function goodFiles(): Record<string, string> {
  return {
    "index.html": page({
      path: "/",
      body: [
        '<a href="/tools/compress-image/#faq">FAQ</a>',
        '<a href="/about">Moved with a trailing slash</a>',
        '<a href="/old-tools/">Redirected</a>',
        '<a href="/flows/#r=v1;c=pdf;merge-pdf">A recipe</a>',
        '<a href="mailto:hello@example.com">Mail</a>',
        '<a href="https://github.com/BrewingBytes/Gizlet">Source</a>',
        '<img src="/brand/brand-board.png" srcset="/brand/brand-board.png 1x, /brand/social/compress-image.png 2x" alt="">',
      ].join(""),
    }),
    "about/index.html": page({ path: "/about/", robots: "noindex, follow" }),
    "flows/index.html": page({ path: "/flows/", robots: "noindex, follow" }),
    "categories/images/index.html": page({ path: "/categories/images/" }),
    "tools/compress-image/index.html": page({
      path: "/tools/compress-image/",
      image: `${origin}/brand/social/compress-image.png`,
      jsonLd: [app],
      body: '<section id="faq"></section>',
    }),
    "tools/trim-video/index.html": page({
      path: "/tools/trim-video/",
      robots: "noindex, nofollow",
      jsonLd: [JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList" })],
    }),
    "404.html": page({ path: "/404/", robots: "noindex, follow" }),
    "sitemap.xml": sitemap(listedPaths),
    "_redirects": "# Moved routes\n/old-tools/ /tools/ 301\n",
    "tools/index.html": page({ path: "/tools/", robots: "noindex, follow" }),
    "brand/brand-board.png": "",
    "brand/social/compress-image.png": "",
  };
}

function check(files: Record<string, string>) {
  return checkBuiltSite({
    siteUrl: origin,
    registry,
    files: new Set(Object.keys(files)),
    read: (file) => files[file] ?? "",
  });
}

function rulesFor(files: Record<string, string>) {
  return check(files).findings.map((finding) => ({ page: finding.page, rule: finding.rule }));
}

describe("the built-site check", () => {
  it("accepts a valid site", () => {
    const result = check(goodFiles());

    expect(result.findings).toEqual([]);
    expect(result.pages).toBe(8);
    expect(result.sitemapUrls).toBe(3);
  });

  it("fails a sitemap URL that resolves to no generated page", () => {
    const files = goodFiles();
    files["sitemap.xml"] = sitemap([...listedPaths, "/guides/missing/"]);

    expect(rulesFor(files)).toEqual([{ page: "/guides/missing/", rule: "sitemap-page-missing" }]);
  });

  it("fails a sitemap URL on another host, and one listed twice", () => {
    const files = goodFiles();
    files["sitemap.xml"] = sitemap([...listedPaths, "/", "https://staging.gizlet.app/about/"]);

    expect(rulesFor(files)).toEqual([
      { page: "/sitemap.xml", rule: "sitemap-duplicate" },
      { page: "/sitemap.xml", rule: "sitemap-host" },
    ]);
  });

  it("fails a listed page whose canonical is not its sitemap URL", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({ path: "/categories/images/", canonical: `${origin}/tools/` });

    const [finding] = check(files).findings;
    expect(finding).toMatchObject({ page: "/categories/images/", rule: "canonical-mismatch", value: `${origin}/tools/` });
  });

  it("fails a canonical on another host even on an unlisted page", () => {
    const files = goodFiles();
    files["404.html"] = page({ path: "/404/", robots: "noindex", canonical: "https://example.com/404/" });

    expect(rulesFor(files)).toEqual([{ page: "/404", rule: "canonical-host" }]);
  });

  it("fails a listed page without exactly one nonempty title and H1", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({ path: "/categories/images/", title: " ", h1: ["One", "Two"] });

    expect(rulesFor(files)).toEqual([
      { page: "/categories/images/", rule: "title" },
      { page: "/categories/images/", rule: "h1" },
    ]);
  });

  it("does not count an inline icon's title as the document's", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({
      path: "/categories/images/",
      body: '<svg viewBox="0 0 1 1"><title>Search</title></svg>',
    });

    expect(rulesFor(files)).toEqual([]);
  });

  it("fails a listed page with an empty description", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({ path: "/categories/images/", description: "  " });

    expect(rulesFor(files)).toEqual([{ page: "/categories/images/", rule: "description" }]);
  });

  it("fails a social image the build did not write", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({
      path: "/categories/images/",
      image: `${origin}/brand/social/images.png`,
    });

    const findings = check(files).findings;
    expect(findings.map((finding) => finding.rule)).toEqual(["og-image", "twitter-image"]);
    expect(findings[0].value).toBe(`${origin}/brand/social/images.png`);
  });

  it("fails a listed page marked noindex", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({ path: "/categories/images/", robots: "noindex, follow" });

    expect(rulesFor(files)).toEqual([{ page: "/categories/images/", rule: "sitemap-noindex" }]);
  });

  it("fails a planned Gizlet in the sitemap or without its noindex, nofollow policy", () => {
    const files = goodFiles();
    files["sitemap.xml"] = sitemap([...listedPaths, "/tools/trim-video/"]);
    files["tools/trim-video/index.html"] = page({ path: "/tools/trim-video/", robots: "noindex, follow" });

    expect(rulesFor(files)).toEqual([
      { page: "/tools/trim-video/", rule: "sitemap-planned" },
      { page: "/tools/trim-video/", rule: "sitemap-noindex" },
      { page: "/tools/trim-video/", rule: "planned-robots" },
    ]);
  });

  it("fails an available Gizlet or its category missing from the sitemap", () => {
    const files = goodFiles();
    files["sitemap.xml"] = sitemap(["/"]);
    files["categories/images/index.html"] = page({ path: "/categories/images/", robots: "noindex" });
    files["tools/compress-image/index.html"] = page({
      path: "/tools/compress-image/",
      robots: "noindex",
      body: '<section id="faq"></section>',
    });

    expect(rulesFor(files)).toEqual([
      { page: "/categories/images/", rule: "sitemap-registry-missing" },
      { page: "/tools/compress-image/", rule: "sitemap-registry-missing" },
    ]);
  });

  it("fails an unlisted page — a campaign entry, or the 404 — that is not noindex", () => {
    const files = goodFiles();
    files["campaigns/spring/index.html"] = page({ path: "/campaigns/spring/" });
    files["404.html"] = page({ path: "/404/", robots: "index, follow" });

    expect(rulesFor(files)).toEqual([
      { page: "/404", rule: "unlisted-indexable" },
      { page: "/campaigns/spring/", rule: "unlisted-indexable" },
    ]);
  });

  it("fails a build with no 404 page or no sitemap", () => {
    const files = goodFiles();
    delete files["404.html"];
    delete files["sitemap.xml"];

    const rules = rulesFor(files).map((finding) => finding.rule);
    expect(rules).toContain("sitemap-missing");
    expect(rules).toContain("not-found-missing");
  });

  it("fails JSON-LD that does not parse", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({
      path: "/categories/images/",
      jsonLd: ['{"@type": "CollectionPage",}'],
    });

    const [finding] = check(files).findings;
    expect(finding).toMatchObject({ page: "/categories/images/", rule: "jsonld-malformed" });
    expect(finding.value).toContain("CollectionPage");
  });

  it("fails JSON-LD addresses on another host, but not the schema context", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({
      path: "/categories/images/",
      jsonLd: [
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [{ "@type": "ListItem", item: "http://localhost:4321/tools/" }],
        }),
      ],
    });

    const [finding] = check(files).findings;
    expect(finding).toMatchObject({ rule: "jsonld-host", value: "http://localhost:4321/tools/" });
  });

  it("fails a planned Gizlet presented as a working app", () => {
    const files = goodFiles();
    const plannedApp = app.replace("/tools/compress-image/", "/tools/trim-video/");
    files["tools/trim-video/index.html"] = page({
      path: "/tools/trim-video/",
      robots: "noindex, nofollow",
      jsonLd: [plannedApp],
    });

    const [finding] = check(files).findings;
    expect(finding).toMatchObject({
      page: "/tools/trim-video/",
      rule: "jsonld-unavailable-app",
      value: `${origin}/tools/trim-video/`,
    });
  });

  it("fails a same-site link to a page or asset that was not built", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({
      path: "/categories/images/",
      body: '<a href="/tools/missing/">Missing</a><img src="../../brand/missing.png" alt="">',
    });

    expect(check(files).findings.map(({ rule, value }) => ({ rule, value }))).toEqual([
      { rule: "link-broken", value: "/tools/missing/" },
      { rule: "link-broken", value: "../../brand/missing.png" },
    ]);
  });

  it("fails a link whose fragment names no element on its target", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({
      path: "/categories/images/",
      body: '<a href="/tools/compress-image/#questions">FAQ</a><a href="#nowhere">Here</a>',
    });

    expect(check(files).findings.map(({ rule, value }) => ({ rule, value }))).toEqual([
      { rule: "link-fragment", value: "/tools/compress-image/#questions" },
      { rule: "link-fragment", value: "#nowhere" },
    ]);
  });

  it("reports the page, the offending value, and the rule", () => {
    const files = goodFiles();
    files["categories/images/index.html"] = page({ path: "/categories/images/", description: "" });

    expect(formatFindings(check(files).findings)).toBe(
      '/categories/images/  [description]  ""\n  An indexable page needs a nonempty meta description.',
    );
  });
});

describe("built-site parsing", () => {
  it("decodes attribute entities and ignores markup inside scripts", () => {
    const html = parseHtml(
      '<head><title>A &amp; B</title><meta name="description" content="Q&#39;s &quot;A&quot;"></head><script>"<h1>x</h1>"</script><h1>Real <em>one</em></h1>',
    );

    expect(html.titles).toEqual(["A & B"]);
    expect(html.description).toBe('Q\'s "A"');
    expect(html.headings).toEqual(["Real one"]);
  });

  it("resolves paths the way the asset server's trailing-slash handling does", () => {
    const site = {
      siteUrl: origin,
      registry,
      files: new Set(["index.html", "about/index.html", "404.html", "brand/logo.svg"]),
      read: () => "",
    };

    expect(resolvePath("/", site)).toBe("index.html");
    expect(resolvePath("/about/", site)).toBe("about/index.html");
    expect(resolvePath("/about", site)).toBe("about/index.html");
    expect(resolvePath("/404/", site)).toBe("404.html");
    expect(resolvePath("/brand/logo.svg", site)).toBe("brand/logo.svg");
    expect(resolvePath("/brand/logo.png", site)).toBeUndefined();
  });
});

describe("the built-site check and the registry", () => {
  it("expects the same Gizlet and category routes as the sitemap module", () => {
    const routes = getRegistryRoutes({ available: getAvailableTools(), planned: getPlannedTools() });
    const sitemapPaths = getSitemapEntries().map((entry) => entry.pathname);
    const categoryPaths = getToolCategoryPages().map((categoryPage) => categoryPage.path);

    expect(categoryPagesPath).toBe(toolCategoryPagesPath);
    expect(routes.listed.filter((path) => path.startsWith(categoryPagesPath)).sort()).toEqual([...categoryPaths].sort());
    expect(sitemapPaths).toEqual(expect.arrayContaining(routes.listed));
    expect(sitemapPaths.filter((path) => routes.planned.includes(path))).toEqual([]);
    expect(routes.planned.length).toBeGreaterThan(0);
  });

  it("checks against the host the build and the metadata both use", () => {
    expect(astroConfig.site).toBe(siteUrl);
  });
});
