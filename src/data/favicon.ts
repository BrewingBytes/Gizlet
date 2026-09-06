import { maximumImagePixels } from './image-resize';
import { zipExtension } from './zip-archive';

/**
 * The icon set a site actually needs, and what to call every part of it.
 *
 * A favicon generator is mostly a list of sizes and a snippet of HTML, which is
 * exactly the kind of thing that goes wrong quietly: a file named one thing and
 * referenced as another, a size nobody uses, a snippet that mentions a file the
 * download does not contain. All of it is here, as pure functions over that one
 * list, so the archive and the snippet cannot disagree — they are built from
 * the same array.
 *
 * The list is short on purpose. Every generator on the internet offers thirty
 * files for devices that stopped existing a decade ago; a site needs an ICO for
 * old browsers, two PNGs for current ones, an Apple touch icon, and the two
 * sizes a web app manifest asks for. Anything past that is weight in somebody's
 * repository forever.
 */

export interface FaviconAsset {
  readonly size: number;
  readonly filename: string;
  /** What it is for, shown beside the preview so the list is not a mystery. */
  readonly purpose: string;
}

export const faviconAssets = [
  { size: 16, filename: 'favicon-16x16.png', purpose: 'Browser tab' },
  { size: 32, filename: 'favicon-32x32.png', purpose: 'Browser tab, sharper screens' },
  { size: 180, filename: 'apple-touch-icon.png', purpose: 'Saved to an iPhone home screen' },
  { size: 192, filename: 'icon-192.png', purpose: 'Android home screen, web app manifest' },
  { size: 512, filename: 'icon-512.png', purpose: 'Splash screens, app listings' },
] as const satisfies readonly FaviconAsset[];

/**
 * The sizes packed into `favicon.ico`.
 *
 * An ICO holds several images, and these are the two a browser that still asks
 * for one will use. It is written as PNGs inside the container rather than as
 * bitmaps, which every browser and operating system in use has understood since
 * Windows Vista, and which keeps the file a few kilobytes rather than tens.
 */
export const faviconIcoSizes = [16, 32, 48] as const;

export const faviconIcoFilename = 'favicon.ico';

/** The whole set, for a list that has to name every file in the download. */
export function getFaviconFilenames(): readonly string[] {
  return [faviconIcoFilename, ...faviconAssets.map((asset) => asset.filename)];
}

export const faviconArchiveName = `favicon.${zipExtension}`;

/** What to do with a picture that is not square. */
export const faviconFits = ['cover', 'contain'] as const;

export type FaviconFit = (typeof faviconFits)[number];

export const defaultFaviconFit: FaviconFit = 'cover';

const faviconFitLabels = {
  cover: 'Fill the square (crops the edges)',
  contain: 'Fit the whole picture (adds a background)',
} as const satisfies Record<FaviconFit, string>;

export function isFaviconFit(value: string): value is FaviconFit {
  return (faviconFits as readonly string[]).includes(value);
}

export function getFaviconFitOptions(): readonly { readonly value: FaviconFit; readonly label: string }[] {
  return faviconFits.map((fit) => ({ value: fit, label: faviconFitLabels[fit] }));
}

export const faviconBackgrounds = ['#ffffff', '#000000', '#f3efe6', 'transparent'] as const;

export type FaviconBackground = (typeof faviconBackgrounds)[number];

export const defaultFaviconBackground: FaviconBackground = '#ffffff';

export function isFaviconBackground(value: string): value is FaviconBackground {
  return (faviconBackgrounds as readonly string[]).includes(value);
}

/** Where a square is taken from a picture that is not one. */
export interface FaviconCrop {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/**
 * The largest centred square in a picture.
 *
 * Cover crops to it; contain draws the whole picture inside a square of the
 * longer side. Both are the same arithmetic seen from opposite ends, and doing
 * it here means the preview and the written files cannot disagree about it.
 */
export function getFaviconCrop(
  source: { readonly width: number; readonly height: number },
  fit: FaviconFit,
): FaviconCrop {
  const width = Math.max(1, Math.round(source.width));
  const height = Math.max(1, Math.round(source.height));

  if (fit === 'contain') {
    const size = Math.max(width, height);

    return { x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), size };
  }

  const size = Math.min(width, height);

  return { x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), size };
}

/** Whether a picture is square enough that the choice does not matter. */
export function isSquareEnough(source: { readonly width: number; readonly height: number }): boolean {
  if (source.width < 1 || source.height < 1) return false;

  const ratio = source.width / source.height;

  // Within a couple of percent: a screenshot cropped by hand is never exact.
  return ratio >= 0.98 && ratio <= 1.02;
}

/**
 * The markup that points a page at these files.
 *
 * It is generated from the same list the archive is written from, so a file in
 * one is a file in the other. The paths are root-relative because that is where
 * these files nearly always end up, and a comment says so rather than leaving
 * somebody to work out why their icon does not appear.
 */
export function getFaviconSnippet(): string {
  const png = (size: number) => {
    const asset = faviconAssets.find((candidate) => candidate.size === size);

    return asset ? asset.filename : '';
  };

  return [
    `<link rel="icon" href="/${faviconIcoFilename}" sizes="any" />`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/${png(32)}" />`,
    `<link rel="icon" type="image/png" sizes="16x16" href="/${png(16)}" />`,
    `<link rel="apple-touch-icon" href="/${png(180)}" />`,
  ].join('\n');
}

/** The manifest entries the two large icons are for, as a copyable fragment. */
export function getFaviconManifestSnippet(): string {
  const icons = faviconAssets
    .filter((asset) => asset.size === 192 || asset.size === 512)
    .map(
      (asset) =>
        `    { "src": "/${asset.filename}", "sizes": "${asset.size}x${asset.size}", "type": "image/png" }`,
    )
    .join(',\n');

  return `"icons": [\n${icons}\n]`;
}

interface FileDetails {
  readonly name: string;
  readonly type: string;
}

const supportedSourceTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/bmp'];
const supportedSourceExtensions = /\.(jpe?g|png|webp|avif|bmp)$/i;

export function validateFaviconSource(files: readonly FileDetails[]): string | undefined {
  if (files.length === 0) return 'Choose the picture to make icons from.';
  if (files.length > 1) return 'This Gizlet makes one icon set at a time. Choose a single picture.';

  const [file] = files;
  const supported =
    supportedSourceTypes.includes(file.type) || supportedSourceExtensions.test(file.name);

  return supported ? undefined : `${file.name} is not a JPEG, PNG, WebP, AVIF, or BMP image.`;
}

/**
 * Whether a picture is worth making icons from.
 *
 * A source smaller than the largest icon is not refused — plenty of logos are
 * 256 pixels and the result is fine — but it is worth saying, because a 512
 * pixel icon drawn from a 64 pixel picture looks like exactly what it is.
 */
export function getFaviconSourceWarning(source: {
  readonly width: number;
  readonly height: number;
}): string | undefined {
  const largest = Math.max(...faviconAssets.map((asset) => asset.size));
  const shortest = Math.min(source.width, source.height);

  if (shortest >= largest) return undefined;

  return `This picture is ${shortest.toLocaleString()} pixels on its shortest side, so the ${largest}px icon is drawn larger than the original. It will look soft.`;
}

export function validateFaviconDimensions(source: {
  readonly width: number;
  readonly height: number;
}): string | undefined {
  if (source.width < 1 || source.height < 1) return 'This image could not be read.';

  if (source.width * source.height > maximumImagePixels) {
    return `Keep the picture below ${maximumImagePixels.toLocaleString()} pixels.`;
  }

  return undefined;
}

/** What the result panel says it made. */
export function describeFaviconSet(fileCount: number, formatSize: (bytes: number) => string, bytes: number): string {
  return `${fileCount} files · ${formatSize(bytes)} · ready to drop into a site's root`;
}
