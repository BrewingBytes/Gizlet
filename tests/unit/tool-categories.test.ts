import { describe, expect, it } from 'vitest';

import { getPageMetadata, getToolCategoryMetadata } from '../../src/data/metadata';
import { getToolCategoryStructuredData } from '../../src/data/structured-data';
import {
  getToolCategoryLocality,
  getToolCategoryPage,
  getToolCategoryPagePath,
  getToolCategoryPages,
  toolCategoryEditorial,
} from '../../src/data/tool-categories';
import {
  getAvailableTools,
  getPlannedTools,
  getToolCategoryGroups,
  toolCategoryLabels,
  type AvailableTool,
} from '../../src/data/tools';

/**
 * Every category's membership, written out. The registry decides it, so this
 * list is the test's own statement of what each page should show: a Gizlet
 * moving category, launching, or being withdrawn has to change it on purpose.
 */
const expectedMembership = {
  images: [
    'compress-image',
    'resize-image',
    'convert-image',
    'crop-image',
    'collage-maker',
    'rotate-flip-image',
    'image-background',
    'remove-image-metadata',
    'image-dimensions',
    'image-color-picker',
    'favicon-generator',
  ],
  seo: ['json-ld-generator', 'utm-builder'],
  developer: [
    'json-formatter',
    'url-encode-decode',
    'base64-encode-decode',
    'jwt-decoder',
    'file-hash-generator',
    'json-csv-converter',
    'csv-viewer',
    'timestamp-converter',
    'uuid-generator',
  ],
  pdf: [
    'jpg-to-pdf',
    'pdf-viewer',
    'merge-pdf',
    'pdf-to-jpg',
    'split-pdf',
    'organize-pdf',
    'watermark-pdf',
    'pdf-page-numbers',
    'sign-pdf',
    'clean-pdf-metadata',
  ],
  archive: ['create-zip', 'extract-archive'],
};

const pages = getToolCategoryPages();

describe('getToolCategoryPages', () => {
  it('gives a page to exactly the categories that hold an available Gizlet', () => {
    expect(pages.map((page) => page.category)).toEqual(Object.keys(expectedMembership));
    expect(pages.map((page) => page.category)).toEqual(
      getToolCategoryGroups().map((group) => group.category),
    );
  });

  it.each(Object.entries(expectedMembership))('lists the %s Gizlets in registry order', (category, slugs) => {
    const page = getToolCategoryPage(category);

    expect(page?.tools.map((tool) => tool.slug)).toEqual(slugs);
    expect(page?.tools).toEqual(getAvailableTools().filter((tool) => tool.category === category));
  });

  it('lists only available Gizlets, and every one of them exactly once', () => {
    const listed = pages.flatMap((page) => page.tools);

    expect(listed.every((tool) => tool.launchStatus === 'available')).toBe(true);
    expect(listed.map((tool) => tool.slug).sort()).toEqual(
      getAvailableTools()
        .map((tool) => tool.slug)
        .sort(),
    );
  });

  it('gives a planned-only category no page', () => {
    const plannedOnly = [...new Set(getPlannedTools().map((tool) => tool.category))].filter(
      (category) => !getAvailableTools().some((tool) => tool.category === category),
    );

    expect(plannedOnly).toContain('video');

    for (const category of plannedOnly) {
      expect(getToolCategoryPage(category)).toBeUndefined();
    }
  });

  it('keeps a planned Gizlet off the page of a category that has one', () => {
    const developer = getToolCategoryPage('developer');
    const planned: readonly string[] = getPlannedTools()
      .filter((tool) => tool.category === 'developer')
      .map((tool) => tool.slug);

    expect(planned).toContain('qr-code-generator');
    expect(developer?.tools.filter((tool) => planned.includes(tool.slug))).toEqual([]);
    expect(developer?.guidance.filter((choice) => planned.includes(choice.tool.slug))).toEqual([]);
  });

  it('routes each page to /categories/<category>/ and keeps its jump anchor on the index', () => {
    for (const page of pages) {
      expect(page.path).toBe(`/categories/${page.category}/`);
      expect(page.path).toBe(getToolCategoryPagePath(page.category));
      expect(page.indexAnchorPath).toBe(`/tools/#${page.category}`);
      expect(page.label).toBe(toolCategoryLabels[page.category]);
    }
  });

  it('gives every page its own title, heading, description, and path', () => {
    for (const field of ['title', 'heading', 'description', 'path'] as const) {
      const values = pages.map((page) => page[field]);

      expect(new Set(values).size, field).toBe(values.length);
    }

    expect(pages.map((page) => page.title)).not.toContain('All Gizlets | Gizlet');
    expect(pages.every((page) => page.title === `${page.heading} | Gizlet`)).toBe(true);
  });
});

describe('category selection guidance', () => {
  it.each(pages.map((page) => [page.category, page] as const))(
    'names every %s Gizlet, and no other',
    (_category, page) => {
      const guided = new Set(page.guidance.map((choice) => choice.tool.slug));

      expect([...guided].sort()).toEqual(page.tools.map((tool) => tool.slug).sort());
      expect(page.guidance.every((choice) => choice.tool.category === page.category)).toBe(true);
    },
  );

  it('writes one distinct need per line, and an introduction for every page', () => {
    for (const page of pages) {
      const needs = page.guidance.map((choice) => choice.need);

      expect(new Set(needs).size, page.category).toBe(needs.length);
      expect(needs.every((need) => need.trim().length > 0)).toBe(true);
      expect(page.introduction.length, page.category).toBeGreaterThan(0);
    }
  });

  it('leaves locality to the registry rather than claiming it in editorial copy', () => {
    const copy = JSON.stringify(toolCategoryEditorial).toLowerCase();

    // "Local business" is a Schema.org type the JSON-LD generator writes, not a claim.
    for (const claim of [/\blocal(?! business)/, /on-device/, /on this device/, /stays on/, /never leaves/]) {
      expect(copy, String(claim)).not.toMatch(claim);
    }
  });

  it('promises nothing about rankings', () => {
    const copy = JSON.stringify(toolCategoryEditorial).toLowerCase();

    expect(copy).not.toMatch(/\b(guarantee|boost|rank higher|top of google)\b/);
  });
});

describe('getToolCategoryLocality', () => {
  const [first, second] = getAvailableTools();

  it('describes a category as on-device only when every Gizlet in it is', () => {
    expect(getToolCategoryLocality([first, second])).toBe(
      'All 2 Gizlets here work in your browser: what you give them stays on this device.',
    );
    expect(getToolCategoryLocality([first])).toBe(
      'This Gizlet works in your browser: what you give it stays on this device.',
    );
  });

  it('counts rather than generalises when a category is mixed', () => {
    const remote = { ...second, processesLocally: false } as unknown as AvailableTool;

    expect(getToolCategoryLocality([first, remote])).toBe(
      "1 of these 2 Gizlets work in your browser. Each one's page says where its input goes.",
    );
  });

  it('matches the registry for every page', () => {
    for (const page of pages) {
      expect(page.isEntirelyLocal).toBe(page.tools.every((tool) => tool.processesLocally));
      expect(page.locality).toBe(getToolCategoryLocality(page.tools));
    }
  });
});

describe('getToolCategoryMetadata', () => {
  it('makes each page canonical to itself, with its own title and description', () => {
    for (const page of pages) {
      expect(getToolCategoryMetadata(page)).toEqual(
        getPageMetadata({ title: page.title, description: page.description, pathname: page.path }),
      );
      expect(getToolCategoryMetadata(page).canonicalUrl).toBe(`https://gizlet.app/categories/${page.category}/`);
      expect(getToolCategoryMetadata(page).robots).toBe('index, follow');
    }
  });
});

describe('getToolCategoryStructuredData', () => {
  it.each(pages.map((page) => [page.category, page] as const))(
    'describes the %s page as the list it shows',
    (category, page) => {
      const [collection, breadcrumbs] = getToolCategoryStructuredData(page);
      const list = collection.mainEntity as {
        numberOfItems: number;
        itemListElement: Record<string, unknown>[];
      };

      expect(collection).toMatchObject({
        '@type': 'CollectionPage',
        name: page.heading,
        url: `https://gizlet.app/categories/${category}/`,
        description: page.description,
      });
      expect(list.numberOfItems).toBe(page.tools.length);
      expect(list.itemListElement).toEqual(
        page.tools.map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.name,
          url: `https://gizlet.app${tool.path}`,
        })),
      );
      expect(breadcrumbs).toEqual({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Gizlet', item: 'https://gizlet.app/' },
          { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://gizlet.app/tools/' },
          { '@type': 'ListItem', position: 3, name: page.label },
        ],
      });
    },
  );

  it('claims nothing about price or locality', () => {
    const markup = JSON.stringify(pages.map(getToolCategoryStructuredData));

    expect(markup).not.toContain('isAccessibleForFree');
    expect(markup).not.toContain('offers');
    expect(markup).not.toContain('SoftwareApplication');
  });
});
