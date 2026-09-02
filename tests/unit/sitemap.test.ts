import { describe, expect, it } from "vitest";

import {
  assertUniqueSitemapUrls,
  getRobotsTxt,
  getSitemapUrls,
  getSitemapXml,
} from "../../src/data/sitemap";
import { siteUrl } from "../../src/data/metadata";
import { toolRegistry } from "../../src/data/tools";

describe("sitemap generation", () => {
  it("contains the homepage, public information pages, and available registry tools", () => {
    const expectedUrls = [
      new URL("/", siteUrl).toString(),
      new URL("/privacy/", siteUrl).toString(),
      new URL("/terms/", siteUrl).toString(),
      new URL("/about/", siteUrl).toString(),
      new URL("/request-a-gizlet/", siteUrl).toString(),
      ...toolRegistry
        .filter((tool) => tool.launchStatus === "available")
        .map((tool) => new URL(tool.path, siteUrl).toString()),
    ];

    expect(getSitemapUrls()).toEqual(expectedUrls);
    expect(getSitemapXml()).toContain("<loc>https://gizlet.app/</loc>");
    expect(getSitemapXml()).toContain("<loc>https://gizlet.app/privacy/</loc>");
    expect(getSitemapXml()).toContain("<loc>https://gizlet.app/request-a-gizlet/</loc>");
    expect(getSitemapXml()).toContain("json-ld-generator");
    expect(getSitemapXml()).toContain("json-formatter");
  });

  it("rejects duplicate URLs so they cannot be emitted during a build", () => {
    expect(() =>
      assertUniqueSitemapUrls(["https://gizlet.app/", "https://gizlet.app/"]),
    ).toThrow("Duplicate sitemap URLs generated");
  });
});

describe("robots.txt generation", () => {
  it("allows crawling and points crawlers to the production sitemap", () => {
    expect(getRobotsTxt()).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://gizlet.app/sitemap.xml\n",
    );
  });
});
