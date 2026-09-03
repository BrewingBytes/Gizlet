/**
 * The canonical catalog of Gizlets.
 *
 * UI features should derive their navigation, search, category, and related-tool
 * data from this module instead of maintaining their own tool lists.
 */
export type ToolCategory = "images" | "pdf" | "seo" | "developer";

export type ToolLaunchStatus = "planned" | "available";

/**
 * Concise, stable guidance for people and software discovering a Gizlet
 * outside its visual interface. These fields are published in /tools.json and
 * llms.txt only for tools that are available.
 */
export interface ToolAgentDetails {
  readonly input: string;
  readonly output: string;
}

export interface ToolRegistryEntry {
  /** A stable numeric identifier, used for ordering and cross-tool references. */
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  /** Canonical static route. Astro requires the trailing slash for these pages. */
  readonly path: `/tools/${string}/`;
  readonly category: ToolCategory;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly processesLocally: boolean;
  readonly launchStatus: ToolLaunchStatus;
  readonly agent: ToolAgentDetails;
}

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
    keywords: ["resize", "image resizer", "change image size", "scale photo"],
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
    description: "Convert images between common file formats in your browser.",
    keywords: [
      "convert",
      "image converter",
      "change image format",
      "jpg to png",
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
    name: "JPG to PDF",
    slug: "jpg-to-pdf",
    path: "/tools/jpg-to-pdf/",
    category: "pdf",
    description: "Put images into one PDF, in the order you choose.",
    keywords: [
      "jpg to pdf",
      "image to pdf",
      "images to pdf",
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

/**
 * The slugs of published Gizlets. A workspace map keyed by this covers exactly
 * the Gizlets that have a workspace, so promoting a planned Gizlet without
 * wiring one is a type error rather than a blank page.
 */
export type AvailableToolSlug = AvailableTool['slug'];

export const toolsIndexPath = '/tools/';

/** Display names for the registry's categories. */
export const toolCategoryLabels = {
  images: 'Images',
  pdf: 'PDF',
  seo: 'SEO',
  developer: 'Developer',
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
 */
export function isAvailableTool(
  tool: ToolRegistryEntry,
): tool is ToolRegistryEntry & { readonly launchStatus: 'available' } {
  return tool.launchStatus === 'available';
}

/** Every Gizlet that is published, in registry order. */
export function getAvailableTools(): readonly AvailableTool[] {
  return toolRegistry.filter(isAvailableTool);
}

/**
 * Groups published Gizlets by category. Navigation derives its categories from
 * this, so a category with no available Gizlet is never advertised.
 */
export function getToolCategoryGroups(): readonly ToolCategoryGroup[] {
  const groups = new Map<ToolCategory, ToolRegistryEntry[]>();

  for (const tool of getAvailableTools()) {
    const group = groups.get(tool.category);

    if (group) {
      group.push(tool);
    } else {
      groups.set(tool.category, [tool]);
    }
  }

  return [...groups].map(([category, tools]) => ({
    category,
    label: toolCategoryLabels[category],
    path: `${toolsIndexPath}#${category}`,
    tools,
  }));
}
