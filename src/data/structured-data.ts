import { siteUrl } from './metadata';
import { getToolPageContent, type ToolFaqEntry } from './tool-page-content';
import { getAvailableTools, isAvailableTool, toolsIndexPath, type ToolRegistryEntry } from './tools';

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
 * Describes the questions a Gizlet page answers, from the same copy the page
 * renders. A Gizlet without supporting content publishes no FAQ markup.
 */
function getToolFaqStructuredData(
  tool: ToolRegistryEntry,
  faq: readonly ToolFaqEntry[],
): StructuredDataItem {
  return {
    '@context': schemaContext,
    '@type': 'FAQPage',
    url: absoluteUrl(tool.path),
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

/** The trail that leads to a Gizlet page. The trailing crumb intentionally has
 * no `item`: it is the page being described. */
function getToolBreadcrumbStructuredData(tool: ToolRegistryEntry): StructuredDataItem {
  return {
    '@context': schemaContext,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Gizlet', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: absoluteUrl(toolsIndexPath) },
      { '@type': 'ListItem', position: 3, name: tool.name },
    ],
  };
}

/**
 * Describes a Gizlet as the free browser application it is, with the trail that
 * leads to it. The FAQ is appended only when the page renders one.
 *
 * A planned Gizlet gets the trail and nothing else. `SoftwareApplication` with
 * `isAccessibleForFree` and a zero-price offer would be this module claiming a
 * working, free application exists at that address, and `noindex` does not
 * suppress JSON-LD: a crawler reading the markup would still see one. This is
 * the machine-readable half of the site, and it is held to the same rule as the
 * visible half — nothing is described as free, local, or available unless the
 * registry says so.
 */
export function getToolStructuredData(tool: ToolRegistryEntry): readonly StructuredDataItem[] {
  if (!isAvailableTool(tool)) {
    return [getToolBreadcrumbStructuredData(tool)];
  }

  const faq = getToolPageContent(tool)?.faq;

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
    getToolBreadcrumbStructuredData(tool),
    ...(faq && faq.length > 0 ? [getToolFaqStructuredData(tool, faq)] : []),
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
