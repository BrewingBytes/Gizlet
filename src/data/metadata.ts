import { fallbackSocialImagePath, getToolSocialImagePath } from './social-images';
import type { ToolRegistryEntry } from './tools';

export const siteUrl = 'https://gizlet.app';

const defaultDescription = 'Small, useful browser tools from Gizlet.';
const defaultSocialImage = fallbackSocialImagePath;
const defaultRobots = 'index, follow';

export interface MetadataOptions {
  readonly title?: string;
  readonly description?: string;
  readonly pathname?: string;
  readonly image?: string;
  readonly robots?: string;
}

export interface PageMetadata {
  readonly title: string;
  readonly description: string;
  readonly canonicalUrl: string;
  readonly socialImageUrl: string;
  readonly robots: string;
}

export type ToolMetadataOverrides = Omit<MetadataOptions, 'pathname'>;

function valueOrFallback(value: string | undefined, fallback: string): string {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : fallback;
}

function normalisePathname(pathname: string | undefined): string {
  const parsedUrl = new URL(valueOrFallback(pathname, '/'), siteUrl);
  const path = parsedUrl.pathname.replace(/\/+$/, '') || '/';

  return path === '/' ? path : `${path}/`;
}

/** Builds complete, static page metadata with safe defaults for omitted values. */
export function getPageMetadata(options: MetadataOptions = {}): PageMetadata {
  const pathname = normalisePathname(options.pathname);

  return {
    title: valueOrFallback(options.title, 'Gizlet'),
    description: valueOrFallback(options.description, defaultDescription),
    canonicalUrl: new URL(pathname, siteUrl).toString(),
    socialImageUrl: new URL(valueOrFallback(options.image, defaultSocialImage), siteUrl).toString(),
    robots: valueOrFallback(options.robots, defaultRobots),
  };
}

/**
 * Keeps tool-page defaults tied to the canonical tool registry while permitting
 * a page to supply tailored metadata when its content needs it.
 */
export function getToolMetadata(
  tool: ToolRegistryEntry,
  overrides: ToolMetadataOverrides = {},
): PageMetadata {
  return getPageMetadata({
    ...overrides,
    title: valueOrFallback(overrides.title, `${tool.name} | Gizlet`),
    description: valueOrFallback(overrides.description, tool.description),
    image: valueOrFallback(overrides.image, getToolSocialImagePath(tool)),
    pathname: tool.path,
  });
}
