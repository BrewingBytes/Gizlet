import { describe, expect, it } from 'vitest';

import {
  getSiteStructuredData,
  getToolIndexStructuredData,
  getToolStructuredData,
  serialiseStructuredData,
} from '../../src/data/structured-data';
import { getToolPageContent } from '../../src/data/tool-page-content';
import { getAvailableTools, getPlannedTools, toolRegistry } from '../../src/data/tools';

const compressImage = toolRegistry.find((tool) => tool.slug === 'compress-image')!;

describe('getSiteStructuredData', () => {
  it('identifies the site and its publisher', () => {
    expect(getSiteStructuredData()).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Gizlet',
        url: 'https://gizlet.app/',
        description: 'Small, useful browser tools from Gizlet.',
        publisher: {
          '@type': 'Organization',
          name: 'BrewingBytes',
          url: 'https://gizlet.app/',
        },
      },
    ]);
  });
});

describe('getToolIndexStructuredData', () => {
  it('lists every available Gizlet, in registry order, at its canonical route', () => {
    const [collection] = getToolIndexStructuredData();
    const list = (collection.mainEntity as { itemListElement: Record<string, unknown>[] })
      .itemListElement;

    expect(collection.url).toBe('https://gizlet.app/tools/');
    expect(list).toHaveLength(getAvailableTools().length);
    expect(list.map((item) => item.url)).toEqual(
      getAvailableTools().map((tool) => `https://gizlet.app${tool.path}`),
    );
    expect(list.map((item) => item.position)).toEqual(
      getAvailableTools().map((_tool, index) => index + 1),
    );
  });
});

describe('getToolStructuredData', () => {
  it('describes the Gizlet from its registry entry', () => {
    const [application] = getToolStructuredData(compressImage);

    expect(application['@type']).toBe('SoftwareApplication');
    expect(application.name).toBe(compressImage.name);
    expect(application.description).toBe(compressImage.description);
    expect(application.url).toBe(`https://gizlet.app${compressImage.path}`);
    expect(application.isAccessibleForFree).toBe(true);
    expect(application.offers).toEqual({
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    });
  });

  it('leads back through the Gizlet index and stops on the current page', () => {
    const breadcrumbs = getToolStructuredData(compressImage)[1];

    expect(breadcrumbs['@type']).toBe('BreadcrumbList');
    expect(breadcrumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Gizlet', item: 'https://gizlet.app/' },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://gizlet.app/tools/' },
      { '@type': 'ListItem', position: 3, name: compressImage.name },
    ]);
  });

  it('covers every available Gizlet', () => {
    for (const tool of getAvailableTools()) {
      expect(getToolStructuredData(tool)[0].name).toBe(tool.name);
    }
  });

  it('publishes the FAQ the page renders, question for question', () => {
    for (const tool of getAvailableTools()) {
      const faq = getToolPageContent(tool)!.faq;
      const markup = getToolStructuredData(tool).find((item) => item['@type'] === 'FAQPage');

      expect(markup, tool.slug).toBeDefined();
      expect(markup!.url).toBe(`https://gizlet.app${tool.path}`);
      expect(markup!.mainEntity).toEqual(
        faq.map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: { '@type': 'Answer', text: entry.answer },
        })),
      );
    }
  });

  it('publishes no FAQ markup for a Gizlet without supporting content', () => {
    const undocumented = { ...compressImage, slug: 'undocumented-gizlet' } as const;

    expect(getToolStructuredData(undocumented).map((item) => item['@type'])).toEqual([
      'SoftwareApplication',
      'BreadcrumbList',
    ]);
  });

  it('describes a planned Gizlet as a page and never as an application', () => {
    for (const tool of getPlannedTools()) {
      const markup = getToolStructuredData(tool);

      // `noindex` does not suppress JSON-LD, so a crawler reading the markup
      // would still be told a free, working application lives at this address.
      // The trail is the only true thing there is to say about the page.
      expect(markup.map((item) => item['@type']), tool.slug).toEqual(['BreadcrumbList']);
      expect(markup[0].itemListElement).toEqual([
        { '@type': 'ListItem', position: 1, name: 'Gizlet', item: 'https://gizlet.app/' },
        { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://gizlet.app/tools/' },
        { '@type': 'ListItem', position: 3, name: tool.name },
      ]);
      expect(JSON.stringify(markup)).not.toContain('isAccessibleForFree');
      expect(JSON.stringify(markup)).not.toContain('Offer');
    }

    expect(getPlannedTools().length).toBeGreaterThan(0);
  });

  it('keeps a planned Gizlet out of the index listing search engines read', () => {
    const [collection] = getToolIndexStructuredData();
    const list = (collection.mainEntity as { itemListElement: Record<string, unknown>[] })
      .itemListElement;
    const plannedRoutes = getPlannedTools().map((tool) => `https://gizlet.app${tool.path}`);

    for (const route of plannedRoutes) {
      expect(list.map((item) => item.url)).not.toContain(route);
    }
  });
});

describe('serialiseStructuredData', () => {
  it('emits a single object on its own and several as a list', () => {
    expect(serialiseStructuredData([{ '@type': 'WebSite' }])).toBe('{"@type":"WebSite"}');
    expect(serialiseStructuredData([{ '@type': 'WebSite' }, { '@type': 'Organization' }])).toBe(
      '[{"@type":"WebSite"},{"@type":"Organization"}]',
    );
  });

  it('escapes a value that would otherwise close the script element', () => {
    const serialised = serialiseStructuredData([{ name: '</script><img src=x>' }]);

    expect(serialised).not.toContain('</script>');
    expect(JSON.parse(serialised)).toEqual({ name: '</script><img src=x>' });
  });
});
