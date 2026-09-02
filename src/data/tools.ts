/**
 * The canonical catalog of Gizlets.
 *
 * UI features should derive their navigation, search, category, and related-tool
 * data from this module instead of maintaining their own tool lists.
 */
export type ToolCategory = "images" | "seo" | "developer";

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
] as const satisfies readonly ToolRegistryEntry[];
