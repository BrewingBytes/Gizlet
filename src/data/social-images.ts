import type { ToolRegistryEntry } from './tools';

/**
 * Selects the social preview image a page advertises.
 *
 * The bespoke images are 1200x630 PNGs committed under `public/brand/social/`.
 * They are only ever fetched by a social or search crawler unfurling a link,
 * never by the page itself. A page without one of its own keeps the brand
 * board, so a link always previews as something rather than nothing.
 */

/** Where the bespoke Open Graph images live, relative to the site root. */
export const socialImageDirectory = '/brand/social/';

/** The shared brand board, used by every page without a bespoke image. */
export const fallbackSocialImagePath = '/brand/brand-board.png';

/** The Gizlet index has its own card rather than a per-tool one. */
export const toolIndexSocialImagePath = `${socialImageDirectory}gizlets.png`;

/**
 * The home page's own card. It is the site's most-shared link, so it does not
 * fall back to the brand board: a collage of screenshots reads as noise at the
 * size a search result or a chat unfurl actually renders it.
 */
export const homeSocialImagePath = `${socialImageDirectory}home.png`;

/**
 * Registry slugs with a committed image. This list is deliberately explicit:
 * a new registry entry falls back to the brand board until its image exists,
 * instead of advertising a file that was never drawn. The Vitest coverage
 * checks the list against the registry and against the files on disk.
 */
const bespokeSocialImageSlugs: readonly string[] = [
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
  'json-ld-generator',
  'json-formatter',
  'jpg-to-pdf',
  'pdf-viewer',
  'merge-pdf',
  'pdf-to-jpg',
  'split-pdf',
];

/** The image file name a slug's bespoke card is committed under. */
export function getSocialImageFileName(slug: string): string {
  return `${slug}.png`;
}

/** The social image for a Gizlet page, derived from its registry entry. */
export function getToolSocialImagePath(tool: ToolRegistryEntry): string {
  return bespokeSocialImageSlugs.includes(tool.slug)
    ? `${socialImageDirectory}${getSocialImageFileName(tool.slug)}`
    : fallbackSocialImagePath;
}

/** Every slug that has a bespoke image, for tooling and tests. */
export function getBespokeSocialImageSlugs(): readonly string[] {
  return bespokeSocialImageSlugs;
}
