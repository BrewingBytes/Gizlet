/**
 * The canonical catalog of Gizlets.
 *
 * UI features should derive their navigation, search, category, and related-tool
 * data from this module instead of maintaining their own tool lists.
 */
export type ToolCategory = "images" | "pdf" | "seo" | "developer" | "archive" | "video";

export type ToolLaunchStatus = "planned" | "available";

/**
 * Concise, stable guidance for people and software discovering a Gizlet
 * outside its visual interface. Only an available Gizlet carries these: a
 * planned one has no implementation, so it has nothing truthful to say about
 * what it reads or writes.
 */
export interface ToolAgentDetails {
  readonly input: string;
  readonly output: string;
}

/** What every entry carries, whether it is built or only planned. */
export interface ToolRegistryEntryBase {
  /** A stable numeric identifier, used for ordering and cross-tool references. */
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  /** Canonical static route. Astro requires the trailing slash for these pages. */
  readonly path: `/tools/${string}/`;
  readonly category: ToolCategory;
  readonly description: string;
  readonly keywords: readonly string[];
}

/** A Gizlet with an implementation behind it, so its claims can be true. */
export interface AvailableToolEntry extends ToolRegistryEntryBase {
  readonly launchStatus: "available";
  readonly processesLocally: boolean;
  readonly agent: ToolAgentDetails;
}

/**
 * A Gizlet the roadmap commits to and no code implements yet.
 *
 * `processesLocally` is the literal `false` rather than a `boolean`, because
 * locality is a claim about an implementation and a planned Gizlet has none.
 * The compiler keeps that decision rather than a convention doing it. What the
 * catalogue publishes is a separate question: `agent-catalog.ts` omits the
 * locality field for a planned Gizlet instead of publishing `false`, so
 * nothing claims locality and nothing denies it.
 */
export interface PlannedToolEntry extends ToolRegistryEntryBase {
  readonly launchStatus: "planned";
  readonly processesLocally: false;
}

export type ToolRegistryEntry = AvailableToolEntry | PlannedToolEntry;

export const toolRegistry = [
  {
    id: 1,
    name: "Compress Image",
    slug: "compress-image",
    path: "/tools/compress-image/",
    category: "images",
    description: "Shrink image files while keeping them ready to share.",
    keywords: [
      "compress",
      "image compression",
      "reduce image size",
      "photo compressor",
      "jpg",
      "jpeg",
      "png",
      "webp",
      "avif",
      "bmp",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One JPEG, PNG, WebP, AVIF, or BMP image; choose JPEG, PNG, or WebP output and an optional quality level.",
      output: "A compressed image ready to download in the selected format.",
    },
  },
  {
    id: 2,
    name: "Resize Image",
    slug: "resize-image",
    path: "/tools/resize-image/",
    category: "images",
    description: "Change image dimensions without leaving your browser.",
    keywords: [
      "resize",
      "image resizer",
      "change image size",
      "scale photo",
      "jpg",
      "jpeg",
      "png",
      "webp",
      "avif",
      "bmp",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One JPEG, PNG, WebP, AVIF, or BMP image; set dimensions or a percentage, output format, and optional aspect-ratio lock.",
      output: "A resized image ready to download in the selected JPEG, PNG, or WebP format.",
    },
  },
  {
    id: 3,
    name: "Convert Image",
    slug: "convert-image",
    path: "/tools/convert-image/",
    category: "images",
    description: "Convert JPG, PNG, WebP, AVIF, and BMP images to another format in your browser.",
    keywords: [
      "convert",
      "image converter",
      "change image format",
      "jpg",
      "jpeg",
      "png",
      "webp",
      "avif",
      "bmp",
      "jpg to png",
      "png to jpg",
      "jpg to webp",
      "png to webp",
      "webp to jpg",
      "webp to png",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One JPEG, PNG, WebP, AVIF, or BMP image and a target JPEG, PNG, or WebP format.",
      output: "A converted image ready to download in the selected format.",
    },
  },
  {
    id: 4,
    name: "JSON-LD Generator",
    slug: "json-ld-generator",
    path: "/tools/json-ld-generator/",
    category: "seo",
    description: "Create structured data markup for your website.",
    keywords: ["json-ld", "structured data", "schema markup", "seo"],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "Structured details for a supported schema type, such as an organization, product, article, event, or FAQ.",
      output: "JSON-LD markup or a script block ready to copy into a website.",
    },
  },
  {
    id: 5,
    name: "JSON Formatter",
    slug: "json-formatter",
    path: "/tools/json-formatter/",
    category: "developer",
    description: "Format, validate, and read JSON with a clearer structure.",
    keywords: ["json", "format json", "json beautifier", "json validator"],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "Valid JSON text pasted into the workspace.",
      output: "Formatted or minified JSON text ready to copy.",
    },
  },
  {
    id: 6,
    name: "Image to PDF",
    slug: "jpg-to-pdf",
    path: "/tools/jpg-to-pdf/",
    category: "pdf",
    description: "Put images into one PDF, in the order you choose.",
    keywords: [
      "jpg to pdf",
      "image to pdf",
      "images to pdf",
      "png to pdf",
      "webp to pdf",
      "avif to pdf",
      "bmp to pdf",
      "photo to pdf",
      "combine images into a pdf",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One or more JPEG, PNG, WebP, AVIF, or BMP images, in the page order you set; choose A4, US Letter, US Legal, or a page fitted to each image, plus an orientation.",
      output: "A single PDF, one image per page, ready to download.",
    },
  },
  {
    id: 7,
    name: "PDF Viewer",
    slug: "pdf-viewer",
    path: "/tools/pdf-viewer/",
    category: "pdf",
    description: "Read a PDF page by page without uploading it.",
    keywords: [
      "pdf viewer",
      "open pdf",
      "read pdf",
      "view pdf online",
      "pdf reader",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One PDF file.",
      output: "The document rendered page by page on screen, with page thumbnails and zoom. Nothing is written to a file.",
    },
  },
  {
    id: 8,
    name: "Merge PDF",
    slug: "merge-pdf",
    path: "/tools/merge-pdf/",
    category: "pdf",
    description: "Join several PDFs into one, in the order you choose.",
    keywords: [
      "merge pdf",
      "combine pdf",
      "join pdf",
      "merge pdf files",
      "combine pdfs into one",
      "append pdf",
      "pdf merger",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "Two or more PDF files, in the order you set. A password-protected PDF is refused rather than merged.",
      output: "A single PDF holding every page of every document, in that order, ready to download.",
    },
  },
  {
    id: 9,
    name: "PDF to Image",
    slug: "pdf-to-jpg",
    path: "/tools/pdf-to-jpg/",
    category: "pdf",
    description: "Turn the pages of a PDF into images you can use anywhere.",
    keywords: [
      "pdf to jpg",
      "pdf to image",
      "pdf to png",
      "pdf to webp",
      "convert pdf to image",
      "pdf pages to images",
      "extract pages from pdf",
      "pdf page to picture",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One PDF file; choose which pages to convert, JPEG, PNG, or WebP output, and a resolution of 72, 144, or 216 dpi.",
      output: "One image per chosen page, downloadable individually or together as a ZIP archive.",
    },
  },
  {
    id: 10,
    name: "Split PDF",
    slug: "split-pdf",
    path: "/tools/split-pdf/",
    category: "pdf",
    description: "Take a PDF apart into the pages and ranges you name.",
    keywords: [
      "split pdf",
      "extract pdf pages",
      "separate pdf pages",
      "pdf page splitter",
      "split pdf by page range",
      "delete pages from pdf",
      "pull a page out of a pdf",
      "one pdf per page",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One PDF file; either page ranges such as 1-3, 5 or a request for every page as its own document. A password-protected PDF is refused rather than split.",
      output: "One PDF per range or page, holding copies of those pages, downloadable individually or together as a ZIP archive.",
    },
  },
  {
    id: 11,
    name: "Crop Image",
    slug: "crop-image",
    path: "/tools/crop-image/",
    category: "images",
    description: "Cut an image down to the part you actually want.",
    keywords: [
      "crop",
      "crop image",
      "crop photo",
      "cut image",
      "trim image",
      "aspect ratio crop",
      "square crop",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One JPEG, PNG, WebP, AVIF, or BMP image; drag a selection or type its position and size, optionally locked to an aspect ratio, and choose JPEG, PNG, or WebP output.",
      output: "The selected area as an image ready to download in the selected format.",
    },
  },
  {
    id: 12,
    name: "Collage Maker",
    slug: "collage-maker",
    path: "/tools/collage-maker/",
    category: "images",
    description: "Arrange several images into one picture.",
    keywords: [
      "collage",
      "collage maker",
      "photo grid",
      "combine images",
      "photo collage",
      "picture layout",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One to twelve JPEG, PNG, WebP, AVIF, or BMP images, in the order you set; choose a grid, row, column, or feature layout, the gap between them, the background colour, the output width, and JPEG, PNG, or WebP output.",
      output: "One image holding every picture in the chosen arrangement, ready to download.",
    },
  },
  {
    id: 13,
    name: "Rotate & Flip Image",
    slug: "rotate-flip-image",
    path: "/tools/rotate-flip-image/",
    category: "images",
    description: "Turn an image upright, or mirror it.",
    keywords: [
      "rotate image",
      "flip image",
      "mirror image",
      "turn photo",
      "rotate 90 degrees",
      "straighten photo",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One JPEG, PNG, WebP, AVIF, or BMP image; rotate it in quarter turns, mirror it left to right or top to bottom, and choose JPEG, PNG, or WebP output.",
      output: "The image in its new orientation, ready to download, with its sides swapped after a quarter turn.",
    },
  },
  {
    id: 14,
    name: "Image Background",
    slug: "image-background",
    path: "/tools/image-background/",
    category: "images",
    description: "Set an image on a canvas size and background colour you choose.",
    keywords: [
      "image background",
      "add background to png",
      "canvas size",
      "pad image",
      "white background",
      "square an image",
      "product photo background",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One JPEG, PNG, WebP, AVIF, or BMP image; set a canvas size, a background colour or transparency, how the image is fitted into it, where it sits, and JPEG, PNG, or WebP output.",
      output: "The image drawn onto the chosen canvas, ready to download, keeping transparency in PNG and WebP.",
    },
  },
  {
    id: 15,
    name: "Remove Image Metadata",
    slug: "remove-image-metadata",
    path: "/tools/remove-image-metadata/",
    category: "images",
    description: "See what a photo says about you, then strip it out.",
    keywords: [
      "remove exif",
      "strip metadata",
      "exif viewer",
      "remove gps from photo",
      "photo location data",
      "clean image metadata",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One JPEG, PNG, WebP, AVIF, or BMP image, read on-device; the page lists the EXIF, XMP and text metadata it finds, including GPS coordinates.",
      output: "The same picture re-encoded as JPEG, PNG, or WebP with no metadata, checked by reading the result back.",
    },
  },
  {
    id: 16,
    name: "Image Dimensions",
    slug: "image-dimensions",
    path: "/tools/image-dimensions/",
    category: "images",
    description: "Read an image's size, ratio, and type without changing it.",
    keywords: [
      "image size",
      "image dimensions",
      "pixel dimensions",
      "aspect ratio checker",
      "megapixels",
      "check image resolution",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One JPEG, PNG, WebP, AVIF, or BMP image, read on-device and left unchanged.",
      output: "Its pixel dimensions, aspect ratio, megapixels, shape, format and file size on screen, with the numbers copyable. No file is written.",
    },
  },
  {
    id: 17,
    name: "Image Color Picker",
    slug: "image-color-picker",
    path: "/tools/image-color-picker/",
    category: "images",
    description: "Lift a colour out of a picture as HEX, RGB, or HSL.",
    keywords: [
      "color picker",
      "colour picker",
      "eyedropper",
      "pick color from image",
      "hex from image",
      "get color code",
    ],
    processesLocally: true,
    launchStatus: "available",
    agent: {
      input: "One JPEG, PNG, WebP, AVIF, or BMP image, read on-device and left unchanged; pick a pixel with a pointer or the arrow keys.",
      output: "That pixel as HEX, RGB and HSL on screen, copyable, with the colours picked this visit kept until the tab closes. No file is written.",
    },
  },
  {
    id: 18,
    name: "Favicon Generator",
    slug: "favicon-generator",
    path: "/tools/favicon-generator/",
    category: "images",
    description: "Make a site's icon set from one square picture.",
    keywords: [
      "favicon",
      "favicon generator",
      "site icon",
      "apple touch icon",
      "ico file",
      "app icon sizes",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 19,
    name: "Organize PDF",
    slug: "organize-pdf",
    path: "/tools/organize-pdf/",
    category: "pdf",
    description: "Reorder, rotate, duplicate, and drop pages in one pass.",
    keywords: [
      "organize pdf",
      "reorder pdf pages",
      "rotate pdf",
      "delete pdf pages",
      "rearrange pdf",
      "move pdf pages",
      "duplicate pdf page",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 20,
    name: "Watermark PDF",
    slug: "watermark-pdf",
    path: "/tools/watermark-pdf/",
    category: "pdf",
    description: "Stamp text or a picture across the pages you name.",
    keywords: [
      "watermark pdf",
      "stamp pdf",
      "add watermark",
      "draft watermark",
      "confidential stamp",
      "overlay text on pdf",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 21,
    name: "PDF Page Numbers",
    slug: "pdf-page-numbers",
    path: "/tools/pdf-page-numbers/",
    category: "pdf",
    description: "Number the pages of a document that arrived without them.",
    keywords: [
      "pdf page numbers",
      "number pdf pages",
      "add page numbers",
      "paginate pdf",
      "bates numbering",
      "footer page number",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 22,
    name: "Sign PDF",
    slug: "sign-pdf",
    path: "/tools/sign-pdf/",
    category: "pdf",
    description: "Place a signature you drew onto the page it belongs on.",
    keywords: [
      "sign pdf",
      "pdf signature",
      "draw signature",
      "add signature to pdf",
      "fill and sign",
      "stamp a signature",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 23,
    name: "Clean PDF Metadata",
    slug: "clean-pdf-metadata",
    path: "/tools/clean-pdf-metadata/",
    category: "pdf",
    description: "Read a document's hidden fields, then clear them.",
    keywords: [
      "pdf metadata",
      "remove pdf author",
      "clean pdf properties",
      "pdf document info",
      "strip pdf metadata",
      "pdf producer field",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 24,
    name: "QR Code Generator",
    slug: "qr-code-generator",
    path: "/tools/qr-code-generator/",
    category: "developer",
    description: "Turn a link or a line of text into a scannable square.",
    keywords: [
      "qr code",
      "qr code generator",
      "make a qr code",
      "url to qr",
      "wifi qr code",
      "qr png",
      "qr svg",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 25,
    name: "URL Encode & Decode",
    slug: "url-encode-decode",
    path: "/tools/url-encode-decode/",
    category: "developer",
    description: "Percent-encode a string, or read one back.",
    keywords: [
      "url encode",
      "url decode",
      "percent encoding",
      "uri encode",
      "escape url",
      "query string encoding",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 26,
    name: "Base64 Encode & Decode",
    slug: "base64-encode-decode",
    path: "/tools/base64-encode-decode/",
    category: "developer",
    description: "Move between plain text, a small file, and Base64.",
    keywords: [
      "base64",
      "base64 encode",
      "base64 decode",
      "file to base64",
      "data uri",
      "url safe base64",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 27,
    name: "JWT Decoder",
    slug: "jwt-decoder",
    path: "/tools/jwt-decoder/",
    category: "developer",
    description: "Read a token's header and claims without verifying it.",
    keywords: [
      "jwt",
      "jwt decoder",
      "decode jwt",
      "json web token",
      "read jwt claims",
      "token expiry",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 28,
    name: "File Hash Generator",
    slug: "file-hash-generator",
    path: "/tools/file-hash-generator/",
    category: "developer",
    description: "Check a download is the file it claims to be.",
    keywords: [
      "file hash",
      "sha256",
      "sha512",
      "checksum",
      "verify download",
      "hash generator",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 29,
    name: "JSON and CSV Converter",
    slug: "json-csv-converter",
    path: "/tools/json-csv-converter/",
    category: "developer",
    description: "Move flat records between JSON and CSV in either direction.",
    keywords: [
      "json to csv",
      "csv to json",
      "convert json csv",
      "tabular json",
      "spreadsheet to json",
      "export json as csv",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 30,
    name: "CSV Viewer",
    slug: "csv-viewer",
    path: "/tools/csv-viewer/",
    category: "developer",
    description: "Read a delimited file as a table, and tidy its quoting.",
    keywords: [
      "csv viewer",
      "open csv",
      "read csv online",
      "csv formatter",
      "tsv viewer",
      "csv table",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 31,
    name: "Timestamp Converter",
    slug: "timestamp-converter",
    path: "/tools/timestamp-converter/",
    category: "developer",
    description: "Read a Unix timestamp as a date, and the other way round.",
    keywords: [
      "timestamp converter",
      "unix time",
      "epoch converter",
      "iso 8601",
      "epoch to date",
      "date to epoch",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 32,
    name: "UUID Generator",
    slug: "uuid-generator",
    path: "/tools/uuid-generator/",
    category: "developer",
    description: "Produce identifiers from your browser's own randomness.",
    keywords: [
      "uuid",
      "uuid generator",
      "guid",
      "uuid v4",
      "random id",
      "generate uuid",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 33,
    name: "Create ZIP",
    slug: "create-zip",
    path: "/tools/create-zip/",
    category: "archive",
    description: "Bundle a pile of files into one archive.",
    keywords: [
      "create zip",
      "zip files",
      "make a zip",
      "compress files",
      "zip folder",
      "archive files",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 34,
    name: "Extract Archive",
    slug: "extract-archive",
    path: "/tools/extract-archive/",
    category: "archive",
    description: "Look inside a ZIP or RAR and pull out what you need.",
    keywords: [
      "unzip",
      "extract zip",
      "open rar",
      "extract archive",
      "unrar",
      "view archive contents",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 35,
    name: "Trim Video",
    slug: "trim-video",
    path: "/tools/trim-video/",
    category: "video",
    description: "Keep the part of a clip that matters and drop the rest.",
    keywords: [
      "trim video",
      "cut video",
      "shorten video",
      "clip video",
      "crop video length",
      "video trimmer",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 36,
    name: "Video to Frames",
    slug: "video-to-frames",
    path: "/tools/video-to-frames/",
    category: "video",
    description: "Pull still pictures out of a moving one.",
    keywords: [
      "video to frames",
      "extract frames",
      "video to images",
      "screenshot video",
      "frame grab",
      "video stills",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
  {
    id: 37,
    name: "Video to GIF",
    slug: "video-to-gif",
    path: "/tools/video-to-gif/",
    category: "video",
    description: "Make a short loop out of a short clip.",
    keywords: [
      "video to gif",
      "mp4 to gif",
      "make a gif",
      "gif converter",
      "animated gif",
      "clip to gif",
    ],
    processesLocally: false,
    launchStatus: "planned",
  },
] as const satisfies readonly ToolRegistryEntry[];

/**
 * The registry's own entries, with their literal values preserved. `satisfies`
 * checks the shape without widening it, so slug-keyed maps can be derived from
 * here instead of repeating a hand-maintained slug list.
 */
export type RegisteredTool = (typeof toolRegistry)[number];

/** Every slug in the registry. */
export type ToolSlug = RegisteredTool['slug'];

/** A registry entry known to be published. */
export type AvailableTool = Extract<RegisteredTool, { readonly launchStatus: 'available' }>;

/** A registry entry the roadmap commits to and no code implements yet. */
export type PlannedTool = Extract<RegisteredTool, { readonly launchStatus: 'planned' }>;

/**
 * The slugs of published Gizlets. A workspace map keyed by this covers exactly
 * the Gizlets that have a workspace, so promoting a planned Gizlet without
 * wiring one is a type error rather than a blank page.
 */
export type AvailableToolSlug = AvailableTool['slug'];

/** The slugs of planned Gizlets, for maps that describe the roadmap. */
export type PlannedToolSlug = PlannedTool['slug'];

export const toolsIndexPath = '/tools/';

/** Display names for the registry's categories. */
export const toolCategoryLabels = {
  images: 'Images',
  pdf: 'PDF',
  seo: 'SEO',
  developer: 'Developer',
  archive: 'Archive',
  video: 'Video',
} as const satisfies Record<ToolCategory, string>;

export interface ToolCategoryGroup {
  readonly category: ToolCategory;
  readonly label: string;
  /** Anchor on the Gizlet index, so a category link always lands on real Gizlets. */
  readonly path: `${typeof toolsIndexPath}#${ToolCategory}`;
  readonly tools: readonly ToolRegistryEntry[];
}

/**
 * Narrows a registry entry to a published Gizlet. Tool pages branch on this
 * before choosing a workspace, so a planned Gizlet reaches the placeholder
 * because of its launch status rather than by falling off a list of slugs.
 *
 * It is generic so the caller keeps whatever it started with: passing a
 * `RegisteredTool` narrows to its available members, which is what makes a
 * slug-keyed workspace map type-check on the other side of the branch.
 */
export function isAvailableTool<Tool extends ToolRegistryEntry>(
  tool: Tool,
): tool is Tool & { readonly launchStatus: 'available' } {
  return tool.launchStatus === 'available';
}

/** Narrows a registry entry to a Gizlet that is planned and not built. */
export function isPlannedTool<Tool extends ToolRegistryEntry>(
  tool: Tool,
): tool is Tool & { readonly launchStatus: 'planned' } {
  return tool.launchStatus === 'planned';
}

/** Every Gizlet that is published, in registry order. */
export function getAvailableTools(): readonly AvailableTool[] {
  return toolRegistry.filter(isAvailableTool);
}

/** Every Gizlet the roadmap commits to and no code implements yet. */
export function getPlannedTools(): readonly PlannedTool[] {
  return toolRegistry.filter(isPlannedTool);
}

/** The planned Gizlet a slug names, when the slug is one the roadmap carries. */
export function getPlannedToolBySlug(slug: string): PlannedTool | undefined {
  return getPlannedTools().find((tool) => tool.slug === slug);
}

function groupByCategory(tools: readonly ToolRegistryEntry[]): readonly ToolCategoryGroup[] {
  const groups = new Map<ToolCategory, ToolRegistryEntry[]>();

  for (const tool of tools) {
    const group = groups.get(tool.category);

    if (group) {
      group.push(tool);
    } else {
      groups.set(tool.category, [tool]);
    }
  }

  return [...groups].map(([category, categoryTools]) => ({
    category,
    label: toolCategoryLabels[category],
    path: `${toolsIndexPath}#${category}`,
    tools: categoryTools,
  }));
}

/**
 * Groups published Gizlets by category. Navigation derives its categories from
 * this, so a category with no available Gizlet is never advertised.
 */
export function getToolCategoryGroups(): readonly ToolCategoryGroup[] {
  return groupByCategory(getAvailableTools());
}

/**
 * Groups planned Gizlets by category, for the not-built block. A category
 * appears here on the strength of its planned entries alone, which is why this
 * is a separate list rather than a flag on the one above: `/tools`’ navigation
 * and its live groups must keep describing only Gizlets that exist.
 */
export function getPlannedToolCategoryGroups(): readonly ToolCategoryGroup[] {
  return groupByCategory(getPlannedTools());
}
