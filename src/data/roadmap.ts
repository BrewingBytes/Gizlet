import {
  getPlannedTools,
  toolRegistry,
  type PlannedTool,
  type PlannedToolEntry,
  type PlannedToolSlug,
  type ToolRegistryEntry,
  type ToolSlug,
} from './tools';

/**
 * Gizlet's phases, as data rather than as prose.
 *
 * The roadmap cannot drift from the registry because it does not repeat it:
 * every phase names slugs, and both `/roadmap` and the not-built block on
 * `/tools` read their names, routes and categories back out of `tools.ts`.
 * `docs/roadmap.md` is the narrative and deliberately holds no list at all.
 *
 * Every signal and kill criterion here is restricted to what `docs/signals.md`
 * says this architecture can actually observe: pageviews, referrers, browser
 * share, and issues filed through the request form. Nothing else is countable,
 * and a criterion that needs a number Gizlet cannot produce is worse than no
 * criterion at all, because it is only discovered to be unevaluable at the
 * moment someone tries to evaluate it.
 */

export const roadmapPath = '/roadmap/';

/**
 * Where a phase stands. There is no fourth state and no percentage: a phase is
 * behind us, next, or later, and anything finer would be a date in disguise.
 */
export type RoadmapPhaseStatus = 'shipped' | 'next' | 'later';

export const roadmapStatusLabels = {
  shipped: 'SHIPPED',
  next: 'NEXT',
  later: 'LATER',
} as const satisfies Record<RoadmapPhaseStatus, string>;

export interface RoadmapPhase {
  /** Stable phase number. It is the anchor, so it does not get renumbered. */
  readonly number: number;
  readonly title: string;
  readonly status: RoadmapPhaseStatus;
  /** Stated as a dependency, never as a quarter. A date here would be a liability. */
  readonly when: string;
  readonly what: string;
  /** The Gizlets this phase is about, available or planned, in build order. */
  readonly toolSlugs: readonly ToolSlug[];
  /**
   * Gizlets this phase considered and deliberately left out of the registry,
   * with the reason. A phase may name more candidates than it commits to; an
   * entry the registry does not carry is not on the bench.
   */
  readonly unregistered?: readonly { readonly name: string; readonly reason: string }[];
  /** The pieces the phase's Gizlets share, so the order reads as reuse rather than as a wishlist. */
  readonly sharedMachinery: readonly string[];
  /** What Gizlet can actually watch, per docs/signals.md. */
  readonly signal: string;
  readonly killCriterion: string;
  /** Where a phase that has shipped currently stands, judged in the past tense. */
  readonly standing?: string;
}

/**
 * Annotated rather than `as const satisfies`: the phases differ in which
 * optional fields they carry, and a literal tuple type would make `standing`
 * and `unregistered` unreachable on the union a renderer iterates. The array
 * literal is still checked against `RoadmapPhase`, so `toolSlugs` still only
 * accepts slugs the registry defines, which is the guarantee that matters.
 */
export const roadmapPhases: readonly RoadmapPhase[] = [
  {
    number: 0,
    title: 'Flows and recipes',
    status: 'shipped',
    when: 'Done. It came first because it tested composition with Gizlets that already existed.',
    what: 'No new Gizlets. The three image Gizlets became one visible, reorderable session with a single download at the end, and a Flow became a link that carries its settings and nothing else.',
    toolSlugs: ['compress-image', 'resize-image', 'convert-image'],
    sharedMachinery: ['one flow graph derived from payload kinds', 'settings in the URL fragment, never the query string'],
    signal: 'Pageviews on the Flows page, which is the one number that says whether chaining Gizlets is a thing anyone wants.',
    killCriterion: 'If the Flows page draws fewer visits than the least-visited single Gizlet across a full 30-day window, composition is not the thesis, and the Flow work stops rather than growing.',
    standing: 'Shipped and measurable, and not yet judged: the number exists in Cloudflare Web Analytics and nobody has read it. Recipe-link shares are uncountable by construction, because a fragment is never sent to a server — that is the correct trade, and it is why filed issues carry the weight instead.',
  },
  {
    number: 1,
    title: 'PDF, the four that matter',
    status: 'shipped',
    when: 'Done. It ran before this page existed, which is the order the argument required: ship a capability, then publish the plan.',
    what: 'Four PDF Gizlets chosen for the edges they add to the flow graph rather than for search volume — the two that turn documents into images and back, and the two that take documents apart and put them together. A viewer arrived with them, because reading a PDF without uploading it is the precondition for everything else.',
    toolSlugs: ['jpg-to-pdf', 'pdf-to-jpg', 'merge-pdf', 'split-pdf'],
    unregistered: [
      {
        name: 'Compress PDF',
        reason: 'The most-wanted PDF job and the hardest: real compression means re-encoding the image streams inside the document, which the current PDF library does not do. It stays off the bench until a spike proves it can be done on-device, because promising it first would be the whole problem with roadmaps.',
      },
    ],
    sharedMachinery: ['one PDF page tree', 'one PDF renderer', 'no WASM', 'the ZIP writer that hands back many files at once'],
    signal: 'Pageviews on the four PDF routes, against the image Gizlets that were already there.',
    killCriterion: 'If the four PDF routes together draw fewer visits than the single most-used image Gizlet over a 30-day window, PDF is not the demand this assumed, and the next PDF phase does not start.',
    standing: 'Shipped. The graph now runs in both directions — a document can become images and images can become a document — which is the property the phases after this one are built on.',
  },
  {
    number: 2,
    title: 'The image gaps, on Canvas',
    status: 'next',
    when: 'Next. It needs no new dependency at all, which is why it goes ahead of work that does.',
    what: 'The obvious holes next to the image Gizlets that were already there: cutting a picture down, arranging several into one, turning one upright, setting one on a background, reading what a photo says about you and stripping it out, and reading a colour or a size back off an image without changing it.',
    toolSlugs: [
      'crop-image',
      'collage-maker',
      'rotate-flip-image',
      'image-background',
      'remove-image-metadata',
      'image-dimensions',
      'image-color-picker',
    ],
    sharedMachinery: ['Canvas', 'the existing browser image decode and encode helpers', 'the existing pixel limits', 'no new dependency'],
    signal: 'Issues filed through the request form that name one of these by name.',
    killCriterion: 'If 30 days after this page publishes no filed issue names an image Gizlet, none of these gets built, and the order gets rewritten around whatever visitors did ask for.',
  },
  {
    number: 3,
    title: 'The PDF page tree',
    status: 'later',
    when: 'After the PDF viewer becomes a surface the other PDF Gizlets can reuse. Every Gizlet here needs to show a visitor a page before it can ask them where to put something on it.',
    what: 'The page-level document jobs, all of which are the same two pieces wearing different hats: pick pages, then write something onto them. Reordering and rotating, a watermark, page numbers, a signature you drew yourself, and clearing the fields a document carries about whoever made it.',
    toolSlugs: ['organize-pdf', 'watermark-pdf', 'pdf-page-numbers', 'sign-pdf', 'clean-pdf-metadata'],
    sharedMachinery: ['one PDF page tree', 'the shared PDF viewer and its thumbnails', 'one page-range parser', 'no second PDF dependency'],
    signal: 'Issues naming a PDF page job, and pageviews on the PDF routes that already exist.',
    killCriterion: 'If the PDF routes that shipped in the phase above stop growing and no filed issue names a page job, the page tree work does not start: five Gizlets sharing machinery nobody has asked for is still five Gizlets nobody asked for.',
  },
  {
    number: 4,
    title: 'Text in, text out',
    status: 'later',
    when: 'Whenever a phase ahead of it is blocked. These need no file handling, no new dependency worth arguing about, and no shared surface, so they are the work that fits in the gaps.',
    what: 'The small conversions and inspections that are a single pure function each: percent-encoding, Base64, a token read without being verified, a file digest, records moved between JSON and CSV, a delimited file read as a table, a timestamp read as a date, identifiers, and a link turned into a scannable square.',
    toolSlugs: [
      'qr-code-generator',
      'url-encode-decode',
      'base64-encode-decode',
      'jwt-decoder',
      'file-hash-generator',
      'json-csv-converter',
      'csv-viewer',
      'timestamp-converter',
      'uuid-generator',
    ],
    sharedMachinery: ['pure functions in one place, unit-tested with no browser', 'Web Crypto', 'no file leaves the text box'],
    signal: 'Pageviews on the two text Gizlets that already exist, which are the only evidence that the text half of this site is read at all.',
    killCriterion: 'If the existing text Gizlets stay the least-visited routes on the site across two consecutive 30-day windows, none of these nine ships, however cheap it is. Cheap is not a reason.',
  },
  {
    number: 5,
    title: 'One archive, three uses',
    status: 'later',
    when: 'After a Gizlet needs to hand back a folder rather than a file. The ZIP writer that already bundles many images from one document is the seed; this phase generalises it.',
    what: 'Bundling files into an archive, reading one apart again, and the icon set that only makes sense as a folder of files with a snippet beside it.',
    toolSlugs: ['create-zip', 'extract-archive', 'favicon-generator'],
    sharedMachinery: ['one browser archive layer', 'path-safety and size guards shared by every format', 'the existing image encoder'],
    signal: 'Issues naming an archive job, and pageviews on the Gizlets that already hand back a bundle.',
    killCriterion: 'If reading a RAR needs a decoder that cannot be lazily loaded and audited, or if no filed issue names an archive job, this phase ships the ZIP half only and the rest is dropped rather than carried.',
  },
  {
    number: 6,
    title: 'Video as steps, not a studio',
    status: 'later',
    when: 'After the image and document phases ship, and after the browser share of visitors who cannot run the required video APIs is actually looked up rather than guessed at.',
    what: 'Three video Gizlets, each a step rather than an editor: keeping the part of a clip that matters, pulling stills out of it, and turning a short clip into a short loop. The stills are the point — they are the edge that joins video to every image Gizlet on the site.',
    toolSlugs: ['trim-video', 'video-to-frames', 'video-to-gif'],
    unregistered: [
      {
        name: 'Convert Video and Compress Video',
        reason: 'Both sit downstream of trimming and add no new edge to the graph on their own, so registering them would be counting the same capability twice.',
      },
      {
        name: 'Extract Audio',
        reason: 'Trivial to build and deliberately absent: it would need an audio category, and a category that exists to hold one unbuilt Gizlet is padding.',
      },
    ],
    sharedMachinery: ['one pure-TypeScript media library', 'the browser codec APIs', 'no WASM and no ffmpeg', 'the existing image encoder for the frames'],
    signal: 'Browser and device share, which Cloudflare Web Analytics does report, plus issues naming a video Gizlet.',
    killCriterion: 'If the required browser codec APIs are missing for a material share of visitors — they are unavailable in every version of one mobile browser — or if no filed issue names a video Gizlet, video does not start. A Gizlet page that fails silently on a visitor’s browser is worse than a Gizlet that does not exist.',
  },
];

/**
 * A flow chain a planned Gizlet completes, in execution order.
 *
 * This is the composition argument shown rather than asserted: the reader sees
 * a chain that is mostly already working, with one step missing. It is written
 * by hand because a planned Gizlet declares no flow contract — it has no
 * implementation to have a contract about — so `tool-flows.ts` cannot derive
 * these. What it can do is check them, and `tests/unit/roadmap.test.ts` asserts
 * that every pair of available steps in a chain is a hand-off the flow graph
 * really permits, and that a chain names exactly one planned Gizlet: its own.
 */
export interface PlannedToolChain {
  readonly slug: PlannedToolSlug;
  readonly chain: readonly ToolSlug[];
}

export const plannedToolChains = [
  { slug: 'rotate-flip-image', chain: ['pdf-to-jpg', 'rotate-flip-image', 'jpg-to-pdf'] },
  { slug: 'image-background', chain: ['resize-image', 'image-background', 'compress-image'] },
  { slug: 'remove-image-metadata', chain: ['resize-image', 'remove-image-metadata', 'jpg-to-pdf'] },
  { slug: 'favicon-generator', chain: ['resize-image', 'favicon-generator'] },
  { slug: 'organize-pdf', chain: ['merge-pdf', 'organize-pdf', 'split-pdf'] },
  { slug: 'watermark-pdf', chain: ['jpg-to-pdf', 'watermark-pdf', 'merge-pdf'] },
  { slug: 'pdf-page-numbers', chain: ['merge-pdf', 'pdf-page-numbers', 'pdf-to-jpg'] },
  { slug: 'sign-pdf', chain: ['jpg-to-pdf', 'sign-pdf', 'merge-pdf'] },
  { slug: 'clean-pdf-metadata', chain: ['merge-pdf', 'clean-pdf-metadata', 'pdf-to-jpg'] },
  { slug: 'create-zip', chain: ['pdf-to-jpg', 'create-zip'] },
  { slug: 'extract-archive', chain: ['extract-archive', 'compress-image'] },
  { slug: 'video-to-frames', chain: ['video-to-frames', 'compress-image'] },
] as const satisfies readonly PlannedToolChain[];

/**
 * What Gizlet will not build, and the honest reason.
 *
 * Every refusal carries a destination. That is the whole point: it is traffic
 * that could never convert, because Gizlet cannot do the job, and giving it
 * away is what makes the refusal read as technical rather than commercial. Two
 * of the four point at software that runs on the visitor's own machine, which
 * is the same argument this site makes about itself.
 */
export interface RoadmapRefusal {
  readonly subject: string;
  readonly reason: string;
  readonly useInstead: string;
  readonly useInsteadUrl: string;
}

export const roadmapRefusals = [
  {
    subject: 'Word or Excel to PDF',
    reason: 'A faithful conversion needs the layout engine the document was written in — fonts, pagination, table breaking, the lot — and that engine is an office suite, not something anyone can send to a browser tab. Every free converter that offers this uploads your document to a server and renders it there, which is exactly the thing this site exists not to do.',
    useInstead: 'The application’s own export, or LibreOffice',
    useInsteadUrl: 'https://www.libreoffice.org/',
  },
  {
    subject: 'Remove image background',
    reason: 'Cutting a subject out of a photograph needs a segmentation model, and the model has to reach the visitor before it can run: tens of megabytes downloaded to do one job. It may become reasonable, and if it does it arrives behind an explicit opt-in with the download stated in megabytes. What it will never be is switched on by default and called local.',
    useInstead: 'remove.bg',
    useInsteadUrl: 'https://www.remove.bg/',
  },
  {
    subject: 'Scanned PDF to text',
    reason: 'Optical character recognition has the same model-download problem, and a worse one behind it: on a real scan — skewed, speckled, photographed at an angle — on-device accuracy is not yet good enough to be worth the visitor’s time. A tool that quietly returns the wrong text is more expensive than no tool.',
    useInstead: 'Tesseract, which runs on your own machine',
    useInsteadUrl: 'https://tesseract-ocr.github.io/',
  },
  {
    subject: 'Certificate-based e-signatures',
    reason: 'A signature that means something legally needs a certificate authority, an audit trail, timestamping and identity verification — infrastructure, and infrastructure Gizlet deliberately does not have. Placing a signature you drew onto a page is a different job and an honest one, and it is on the list above under its own name; it is a stamp, and it is never described as more.',
    useInstead: 'DocuSign, or another e-sign provider',
    useInsteadUrl: 'https://www.docusign.com/',
  },
] as const satisfies readonly RoadmapRefusal[];

/** The fragment identifier a phase is linked by. */
export function getRoadmapPhaseAnchor(phase: RoadmapPhase): string {
  return `phase-${phase.number}`;
}

/** The route that explains why a Gizlet is not built, for a row that says so. */
export function getRoadmapPhasePath(phase: RoadmapPhase): string {
  return `${roadmapPath}#${getRoadmapPhaseAnchor(phase)}`;
}

/** The phase a Gizlet belongs to, or `undefined` when no phase names it. */
export function getPhaseForTool(slug: string): RoadmapPhase | undefined {
  return roadmapPhases.find((phase) => (phase.toolSlugs as readonly string[]).includes(slug));
}

/**
 * The phase a planned Gizlet belongs to, for a row that has to show one.
 *
 * A planned Gizlet outside every phase is a data error rather than a rendering
 * case to handle quietly: the phase link is the row's only account of why the
 * Gizlet is not built, so a row without one would say a Gizlet is missing and
 * decline to say why. `tests/unit/roadmap.test.ts` catches it first; this
 * catches it at build time if the test is ever loosened.
 */
export function getPhaseForPlannedTool(tool: PlannedToolEntry): RoadmapPhase {
  const phase = getPhaseForTool(tool.slug);

  if (!phase) {
    throw new Error(`Planned Gizlet belongs to no roadmap phase: ${tool.slug}`);
  }

  return phase;
}

/** How a phase is named in a row's mono metadata: `PHASE 2`. */
export function getRoadmapPhaseLabel(phase: RoadmapPhase): string {
  return `PHASE ${phase.number}`;
}

/** The chain a planned Gizlet completes, for the Gizlets that complete one. */
export function getPlannedToolChain(slug: string): readonly ToolSlug[] {
  return plannedToolChains.find((entry) => entry.slug === slug)?.chain ?? [];
}

/**
 * A slug resolved to its registry entry.
 *
 * Everything this module hands a renderer goes through here, which is what
 * keeps the roadmap from repeating the registry: a phase and a chain hold
 * slugs, and the name, route and category a page prints are read back out of
 * `tools.ts` every time. A slug the registry does not carry fails the build
 * rather than rendering an empty row.
 */
function resolveToolSlug(slug: string): ToolRegistryEntry {
  const tool = toolRegistry.find((candidate) => candidate.slug === slug);

  if (!tool) {
    throw new Error(`Missing registry entry for a roadmap slug: ${slug}`);
  }

  return tool;
}

/**
 * A chain resolved to registry entries, so a renderer never has to look a slug
 * up itself and cannot print a name the registry does not hold.
 */
export function getPlannedToolChainEntries(slug: string): readonly ToolRegistryEntry[] {
  return getPlannedToolChain(slug).map(resolveToolSlug);
}

/** A phase's Gizlets as registry entries, in the order the phase lists them. */
export function getToolsForPhase(phase: RoadmapPhase): readonly ToolRegistryEntry[] {
  return phase.toolSlugs.map(resolveToolSlug);
}

/** The planned Gizlets a phase commits to, in the order the phase lists them. */
export function getPlannedToolsForPhase(phase: RoadmapPhase): readonly PlannedTool[] {
  const planned = getPlannedTools();

  return phase.toolSlugs
    .map((slug) => planned.find((tool) => tool.slug === slug))
    .filter((tool): tool is PlannedTool => tool !== undefined);
}
