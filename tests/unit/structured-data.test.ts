import { describe, expect, it } from 'vitest';

import {
  getSiteStructuredData,
  getToolIndexStructuredData,
  getToolStructuredData,
  serialiseStructuredData,
} from '../../src/data/structured-data';
import { getAvailableTools, toolRegistry } from '../../src/data/tools';

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
