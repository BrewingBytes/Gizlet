import { siteUrl } from './metadata';
import { getAvailableTools, toolsIndexPath, type ToolRegistryEntry } from './tools';

/**
 * Schema.org descriptions of the pages Gizlet publishes.
 *
 * Every claim here has to match the page it describes: the tool entries come
 * from the canonical registry, and nothing is described as free, local, or
 * available unless the registry says so.
 */
export type StructuredDataItem = Record<string, unknown>;

const schemaContext = 'https://schema.org';
const publisherName = 'BrewingBytes';

function absoluteUrl(pathname: string): string {
  return new URL(pathname, siteUrl).toString();
}

const publisher = {
  '@type': 'Organization',
  name: publisherName,
  url: absoluteUrl('/'),
} as const;

/** Identifies the site itself, for the homepage only. */
export function getSiteStructuredData(): readonly StructuredDataItem[] {
  return [
    {
      '@context': schemaContext,
      '@type': 'WebSite',
      name: 'Gizlet',
      url: absoluteUrl('/'),
      description: 'Small, useful browser tools from Gizlet.',
      publisher,
    },
  ];
}

/** Describes the Gizlet index as an ordered list of the published tools. */
export function getToolIndexStructuredData(): readonly StructuredDataItem[] {
  return [
    {
      '@context': schemaContext,
      '@type': 'CollectionPage',
      name: 'All Gizlets',
      url: absoluteUrl(toolsIndexPath),
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: getAvailableTools().map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.name,
          url: absoluteUrl(tool.path),
        })),
      },
    },
  ];
}

/**
 * Describes a Gizlet as the free browser application it is, with the trail that
 * leads to it. The trailing crumb intentionally has no `item`: it is the page
 * being described.
 */
export function getToolStructuredData(tool: ToolRegistryEntry): readonly StructuredDataItem[] {
  return [
    {
      '@context': schemaContext,
      '@type': 'SoftwareApplication',
      name: tool.name,
      url: absoluteUrl(tool.path),
      description: tool.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any device with a modern web browser',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      publisher,
    },
    {
      '@context': schemaContext,
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Gizlet', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Tools', item: absoluteUrl(toolsIndexPath) },
        { '@type': 'ListItem', position: 3, name: tool.name },
      ],
    },
  ];
}

/**
 * Serialises items for a JSON-LD script tag. `<` is escaped so a value can
 * never close the script element that carries it.
 */
export function serialiseStructuredData(items: readonly StructuredDataItem[]): string {
  const payload = items.length === 1 ? items[0] : items;

  return JSON.stringify(payload).replace(/</g, '\\u003c');
}
