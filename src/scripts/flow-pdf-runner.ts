import type { ImageOutputFormat } from '../data/image-compression';
import {
  defaultPdfOrientation,
  defaultPdfPageSize,
  getPdfOutputFilename,
  isLargePdfWorkload,
  type PdfOrientation,
  type PdfPageSizeName,
} from '../data/jpg-to-pdf';
import { describeMergeDocumentCount, getMergedPdfFilename, isLargeMergeWorkload } from '../data/merge-pdf';
import {
  createOrganizePdfPlan,
  defaultPdfPageTurn,
  turnEveryPdfPlanPage,
  validateOrganizePdfPageCount,
  type PdfPageTurn,
} from '../data/organize-pdf';
import { validateCleanPdfPageCount } from '../data/pdf-metadata';
import {
  defaultPageNumberFontSize,
  defaultPageNumberFormat,
  defaultPageNumberMargin,
  defaultPageNumberPosition,
  planPageNumbers,
  validatePageNumbersPageCount,
  type PageNumberFormat,
  type PageNumberPosition,
} from '../data/pdf-page-numbers';
import {
  defaultPdfImageResolution,
  getPdfToImageErrorMessage,
  validatePdfToImagePageCount,
  type PdfImageResolution,
} from '../data/pdf-to-jpg';
import { getSinglePageRanges, validateSplitPdfPageCount } from '../data/split-pdf';
import type { AvailableFlowToolSlug } from '../data/tool-flows';
import { toolRegistry } from '../data/tools';
import {
  defaultWatermarkOpacity,
  defaultWatermarkPosition,
  defaultWatermarkWord,
  getWatermarkWordText,
  validateWatermarkPdfPageCount,
  type WatermarkPosition,
  type WatermarkWord,
} from '../data/watermark-pdf';
import type { FlowPayload } from './flow-image-runner';
import {
  addPageNumbersToLocalPdf,
  cleanLocalPdfMetadata,
  createImagePdf,
  mergeLocalPdfs,
  openLocalPdfForMerge,
  openLocalPdfForMetadata,
  openLocalPdfForOrganize,
  openLocalPdfForPageNumbers,
  openLocalPdfForSplit,
  openLocalPdfForWatermark,
  organizeLocalPdf,
  splitLocalPdf,
  watermarkLocalPdf,
} from './pdf-generation';
// Types only, which the compiler erases: pdf.js and its worker stay out of
// this module, and out of every page that imports it, until a PDF is drawn.
import type { openLocalPdf } from './pdf-rendering';
import type { renderPdfPagesToImages } from './pdf-to-image';

/**
 * A PDF a flow is holding between blocks. A flow carries a set of these
 * rather than one, because a splitting block turns the one document into
 * several and everything after it then runs over each.
 */
export interface FlowPdf {
  readonly blob: Blob;
  readonly pages: number;
  readonly pageSize: PdfPageSizeName;
  readonly name: string;
}

/** Both hands a flow carries between blocks: pictures, and documents. */
export interface FlowPdfHands {
  readonly payloads: readonly FlowPayload[];
  readonly pdfs: readonly FlowPdf[];
}

/** What a PDF block hands on, and the document a set it made is named after. */
export interface FlowPdfStepResult extends FlowPdfHands {
  readonly setSourceName?: string;
}

/** The settings a PDF step reads; a flow block carries these and more. */
export interface FlowPdfStep {
  readonly toolSlug: FlowPdfToolSlug;
  readonly pageSize?: PdfPageSizeName;
  readonly orientation?: PdfOrientation;
  readonly resolution?: PdfImageResolution;
  readonly pageTurn?: PdfPageTurn;
  readonly word?: WatermarkWord;
  readonly markPosition?: WatermarkPosition;
  readonly strength?: number;
  readonly numberFormat?: PageNumberFormat;
  readonly numberPosition?: PageNumberPosition;
}

/** Where in the run a step is, and how it tells the page what it is doing. */
export interface FlowPdfRunContext {
  /** The step's place in the chain, as the status line says it: `2 of 3`. */
  readonly position: string;
  /** The image format a block that draws pages hands them on in. */
  readonly outputFormat: ImageOutputFormat;
  /** Called before each unit of work, so the page can say so and repaint. */
  readonly onProgress: (message: string) => Promise<void> | void;
}

/**
 * The document work a PDF step does, handed in so the decisions around it —
 * which pages, which guard, which name, which progress line — can be checked
 * without a document.
 */
export interface FlowPdfAdapters {
  readonly createImagePdf: typeof createImagePdf;
  readonly openForMerge: typeof openLocalPdfForMerge;
  readonly merge: typeof mergeLocalPdfs;
  readonly openForRendering: typeof openLocalPdf;
  readonly renderPages: typeof renderPdfPagesToImages;
  readonly openForWatermark: typeof openLocalPdfForWatermark;
  readonly watermark: typeof watermarkLocalPdf;
  readonly openForPageNumbers: typeof openLocalPdfForPageNumbers;
  readonly addPageNumbers: typeof addPageNumbersToLocalPdf;
  readonly openForOrganize: typeof openLocalPdfForOrganize;
  readonly organize: typeof organizeLocalPdf;
  readonly openForMetadata: typeof openLocalPdfForMetadata;
  readonly cleanMetadata: typeof cleanLocalPdfMetadata;
  readonly openForSplit: typeof openLocalPdfForSplit;
  readonly split: typeof splitLocalPdf;
}

/**
 * The on-device implementations every flow runs with.
 *
 * pdf.js is imported only when a flow actually reaches a block that draws
 * pages, so the page carries neither the library nor its worker until then.
 */
export const browserFlowPdfAdapters: FlowPdfAdapters = {
  createImagePdf,
  openForMerge: openLocalPdfForMerge,
  merge: mergeLocalPdfs,
  openForRendering: async (...args) => (await import('./pdf-rendering')).openLocalPdf(...args),
  renderPages: async (...args) => (await import('./pdf-to-image')).renderPdfPagesToImages(...args),
  openForWatermark: openLocalPdfForWatermark,
  watermark: watermarkLocalPdf,
  openForPageNumbers: openLocalPdfForPageNumbers,
  addPageNumbers: addPageNumbersToLocalPdf,
  openForOrganize: openLocalPdfForOrganize,
  organize: organizeLocalPdf,
  openForMetadata: openLocalPdfForMetadata,
  cleanMetadata: cleanLocalPdfMetadata,
  openForSplit: openLocalPdfForSplit,
  split: splitLocalPdf,
};

const toolName = (toolSlug: AvailableFlowToolSlug) => {
  const tool = toolRegistry.find((candidate) => candidate.slug === toolSlug);
  if (!tool) throw new Error(`Missing Gizlet: ${toolSlug}`);
  return tool.name;
};

const everyPage = (pageCount: number) => Array.from({ length: pageCount }, (_, page) => page + 1);

type FlowPdfHandler = (
  step: FlowPdfStep,
  hands: FlowPdfHands,
  context: FlowPdfRunContext & { readonly name: string },
  adapters: FlowPdfAdapters,
) => Promise<FlowPdfStepResult>;

/** A block that takes the documents in hand one at a time, and hands each on. */
const eachDocument = (
  run: (
    pdf: FlowPdf,
    step: FlowPdfStep,
    context: FlowPdfRunContext & { readonly name: string },
    adapters: FlowPdfAdapters,
  ) => Promise<readonly FlowPdf[]>,
): FlowPdfHandler => async (step, hands, context, adapters) => {
  if (hands.pdfs.length === 0) throw new Error(`${context.name} needs a PDF from the block before it.`);

  const written: FlowPdf[] = [];

  for (const pdf of hands.pdfs) {
    await context.onProgress(`Running ${context.position}: ${context.name}, reading the document locally…`);
    written.push(...await run(pdf, step, context, adapters));
  }

  return { payloads: hands.payloads, pdfs: written, setSourceName: hands.pdfs[0].name };
};

const pageProgress = (context: FlowPdfRunContext & { readonly name: string }) =>
  (pagePosition: number, total: number) =>
    context.onProgress(`Running ${context.position}: ${context.name}, page ${pagePosition} of ${total} locally…`);

const handlers = {
  'jpg-to-pdf': async (step, hands, context, adapters) => {
    const { payloads } = hands;
    const pageSize = step.pageSize ?? defaultPdfPageSize;
    const isLarge = isLargePdfWorkload(payloads);
    const pages = payloads.length;
    const name = getPdfOutputFilename(payloads[0].file.name, pages);
    const blob = await adapters.createImagePdf(payloads, {
      pageSize,
      orientation: step.orientation ?? defaultPdfOrientation,
      onPage: (pageNumber, pageCount) =>
        context.onProgress(`Running ${context.position}: ${context.name}${isLarge ? ', large document' : ''}, page ${pageNumber} of ${pageCount} locally…`),
    });

    return { payloads: [], pdfs: [{ blob, pages, pageSize, name }] };
  },

  'merge-pdf': async (_step, hands, context, adapters) => {
    if (hands.pdfs.length === 0) throw new Error(`${context.name} needs the PDFs this flow started from.`);

    await context.onProgress(`Running ${context.position}: ${context.name}, reading the documents locally…`);

    // Opened again here rather than held since they were chosen: a
    // merge copies page trees out of live documents, and re-reading
    // them is cheaper than keeping parsed ones alive across every edit.
    const merging = [];

    for (const pdf of hands.pdfs) {
      merging.push(await adapters.openForMerge(
        pdf.blob instanceof File ? pdf.blob : new File([pdf.blob], pdf.name, { type: 'application/pdf' }),
      ));
    }

    const isLarge = isLargeMergeWorkload(merging);
    const pages = merging.reduce((total, document) => total + document.pageCount, 0);
    const blob = await adapters.merge(merging, {
      onDocument: (documentNumber, documentCount) =>
        context.onProgress(`Running ${context.position}: ${context.name}${isLarge ? ', large document' : ''}, ${describeMergeDocumentCount(documentCount)}, joining ${documentNumber} of ${documentCount} locally…`),
    });

    return { payloads: hands.payloads, pdfs: [{ blob, pages, pageSize: 'fit', name: getMergedPdfFilename(merging[0].file.name) }] };
  },

  'pdf-to-jpg': async (step, hands, context, adapters) => {
    // Only a PDF block can precede this one, so the graph guarantees a
    // document is waiting; the check is here because a chain that
    // reached this state some other way must say so rather than throw.
    if (hands.pdfs.length === 0) throw new Error(`${context.name} needs a PDF from the block before it.`);

    await context.onProgress(`Running ${context.position}: ${context.name}, reading the document locally…`);

    const converted: FlowPayload[] = [];

    // A splitting block before this one leaves several documents, so
    // every one of them is drawn and their pages join one set.
    for (const pdf of hands.pdfs) {
      const opened = await adapters.openForRendering(pdf.blob, {
        getErrorMessage: getPdfToImageErrorMessage,
      });

      try {
        const countProblem = validatePdfToImagePageCount(opened.pageCount);
        if (countProblem) throw new Error(countProblem);

        const images = await adapters.renderPages(opened, {
          documentName: pdf.name,
          pageNumbers: everyPage(opened.pageCount),
          pageCount: opened.pageCount,
          format: context.outputFormat,
          resolution: step.resolution ?? defaultPdfImageResolution,
          onPage: pageProgress(context),
        });

        for (const image of images) {
          converted.push({ file: image.file, width: image.width, height: image.height });
        }
      } finally {
        await opened.close().catch(() => undefined);
      }
    }

    return { payloads: converted, pdfs: [], setSourceName: hands.pdfs[0].name };
  },

  'watermark-pdf': eachDocument(async (pdf, step, context, adapters) => {
    const source = await adapters.openForWatermark(pdf.blob);
    const countProblem = validateWatermarkPdfPageCount(source.pageCount);
    if (countProblem) throw new Error(countProblem);

    const written = await adapters.watermark(
      source,
      { kind: 'text', text: getWatermarkWordText(step.word ?? defaultWatermarkWord), fontSize: 64 },
      {
        // A flow stamps the whole document: naming pages needs a field
        // holding free text, which this format deliberately has none of.
        pages: everyPage(source.pageCount),
        position: step.markPosition ?? defaultWatermarkPosition,
        rotation: 45,
        opacity: step.strength ?? defaultWatermarkOpacity,
        onPage: pageProgress(context),
      },
    );

    return [{ blob: written, pages: source.pageCount, pageSize: pdf.pageSize, name: pdf.name }];
  }),

  'pdf-page-numbers': eachDocument(async (pdf, step, context, adapters) => {
    const source = await adapters.openForPageNumbers(pdf.blob);
    const countProblem = validatePageNumbersPageCount(source.pageCount);

    if (countProblem) throw new Error(countProblem);

    // A flow numbers the whole document from one: a skip or a range
    // is about a particular document, and a chain does not know which
    // document will reach it.
    const plan = planPageNumbers(source.pageCount, {
      format: step.numberFormat ?? defaultPageNumberFormat,
      startAt: 1,
      skip: 0,
      pages: '',
    });
    const written = await adapters.addPageNumbers(source, {
      plan,
      format: step.numberFormat ?? defaultPageNumberFormat,
      position: step.numberPosition ?? defaultPageNumberPosition,
      fontSize: defaultPageNumberFontSize,
      margin: defaultPageNumberMargin,
      onPage: pageProgress(context),
    });

    return [{ blob: written, pages: source.pageCount, pageSize: pdf.pageSize, name: pdf.name }];
  }),

  'organize-pdf': eachDocument(async (pdf, step, context, adapters) => {
    const source = await adapters.openForOrganize(pdf.blob);
    const countProblem = validateOrganizePdfPageCount(source.pageCount);
    if (countProblem) throw new Error(countProblem);

    // A flow has no page to drag, so it applies the one page job that
    // needs no field: every page turned the same way. The order and
    // the page count are the document's own.
    const plan = turnEveryPdfPlanPage(
      createOrganizePdfPlan(source.pageCount),
      step.pageTurn ?? defaultPdfPageTurn,
    );
    const written = await adapters.organize(source, plan.pages, {
      onPage: pageProgress(context),
    });

    return [{ blob: written, pages: source.pageCount, pageSize: pdf.pageSize, name: pdf.name }];
  }),

  'clean-pdf-metadata': eachDocument(async (pdf, _step, _context, adapters) => {
    // Clearing a document's own fields takes no settings, so the block
    // does here exactly what the workspace does. It is also the step
    // that undoes what the blocks before it wrote: every document this
    // flow produced carries the library's name until this runs.
    const source = await adapters.openForMetadata(pdf.blob);
    const countProblem = validateCleanPdfPageCount(source.pageCount);
    if (countProblem) throw new Error(countProblem);

    return [{ blob: await adapters.cleanMetadata(source), pages: source.pageCount, pageSize: pdf.pageSize, name: pdf.name }];
  }),

  'split-pdf': eachDocument(async (pdf, _step, context, adapters) => {
    const source = await adapters.openForSplit(pdf.blob);
    const countProblem = validateSplitPdfPageCount(source.pageCount);
    if (countProblem) throw new Error(countProblem);

    // A flow has no field to name ranges in, so it splits the
    // document into its pages: one page per document is the piece
    // every block after this one can use.
    const parts = await adapters.split(source, getSinglePageRanges(source.pageCount), {
      documentName: pdf.name,
      pageCount: source.pageCount,
      onPart: (partPosition, total) =>
        context.onProgress(`Running ${context.position}: ${context.name}, document ${partPosition} of ${total} locally…`),
    });

    return parts.map((part) => ({ blob: part.file, pages: 1, pageSize: pdf.pageSize, name: part.file.name }));
  }),
} satisfies Record<Extract<AvailableFlowToolSlug, 'jpg-to-pdf' | 'merge-pdf' | 'pdf-to-jpg' | 'watermark-pdf' | 'pdf-page-numbers' | 'organize-pdf' | 'clean-pdf-metadata' | 'split-pdf'>, FlowPdfHandler>;

/** A block this module runs: one that makes, changes, or draws a PDF. */
export type FlowPdfToolSlug = keyof typeof handlers;

/** Whether a block is one this module runs, rather than an image or text one. */
export function isFlowPdfStep<Step extends { readonly toolSlug: AvailableFlowToolSlug }>(
  step: Step,
): step is Step & { readonly toolSlug: FlowPdfToolSlug } {
  return Object.hasOwn(handlers, step.toolSlug);
}

/**
 * One PDF block over what the flow is holding. Its pictures and documents go
 * in and come back out explicitly; a block that turns one into the other
 * empties the hand it read from.
 */
export async function runFlowPdfStep(
  step: FlowPdfStep,
  hands: FlowPdfHands,
  context: FlowPdfRunContext,
  adapters: FlowPdfAdapters = browserFlowPdfAdapters,
): Promise<FlowPdfStepResult> {
  return handlers[step.toolSlug](step, hands, { ...context, name: toolName(step.toolSlug) }, adapters);
}
