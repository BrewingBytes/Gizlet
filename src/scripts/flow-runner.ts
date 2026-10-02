import {
  defaultCollageBackground,
  defaultCollageLayout,
  defaultCollageSpacing,
  defaultCollageWidth,
  describeCollageImageCount,
  getCollageOutputFilename,
  planCollage,
  validateCollage,
  type CollageLayoutName,
  type CollagePlan,
} from '../data/image-collage';
import type { ImageOutputFormat } from '../data/image-compression';
import { getBatchArchiveName } from '../data/image-batches';
import { describeCsvTable, detectCsvDelimiter, getFormattedCsvName, readCsvTable } from '../data/csv-viewer';
import {
  convertCsvToJson,
  convertJsonToCsv,
  defaultCsvDelimiter,
  defaultCsvValueReading,
  describeConversion,
  getConvertedRecordsName,
} from '../data/json-csv';
import { formatJsonParseError, transformJson } from '../data/json-formatter';
import { describePdfImageCount, getPdfImageArchiveName } from '../data/pdf-to-jpg';
import { describeSplitPdfCount, getSplitPdfArchiveName } from '../data/split-pdf';
import type { AvailableFlowToolSlug } from '../data/tool-flows';
import { toolRegistry } from '../data/tools';
import { createZipArchive, zipMimeType } from '../data/zip-archive';
import { runFlowImageStep, type FlowImageStep, type FlowPayload } from './flow-image-runner';
import {
  isFlowPdfStep,
  runFlowPdfStep,
  type FlowPdf,
  type FlowPdfHands,
  type FlowPdfRunContext,
  type FlowPdfStep,
  type FlowPdfStepResult,
} from './flow-pdf-runner';
import { drawCollage, encodeBrowserImage, loadBrowserImage } from './image-processing';

/**
 * Resource ownership across a run.
 *
 * - Intermediate `File`s and `Blob`s are this module's while a run is going
 *   and are plain memory: none of them ever gets an object URL, so a run that
 *   fails or is cancelled leaves nothing to revoke and the collector takes
 *   them once the run's locals go.
 * - Object URLs for results, the download link and the preview are the
 *   component's. It makes them only from a `success` outcome, and revokes them
 *   when the result panel is reset.
 * - A pdf.js document opened to draw pages is the PDF runner's, closed in a
 *   `finally` there, so an error or a cancellation raised between pages still
 *   closes it. The preview's renderer is the component's page view.
 * - A decoded image revokes its own object URL as it loads, and a canvas an
 *   adapter draws on is dropped with the step that drew it.
 */

/** The settings a block carries into a run; a flow block carries these and its id. */
export interface FlowRunStep extends Omit<FlowImageStep, 'toolSlug'>, Omit<FlowPdfStep, 'toolSlug'> {
  readonly toolSlug: AvailableFlowToolSlug;
  readonly layout?: CollageLayoutName;
}

/** A starting file, as much of it as a run reads. */
export type FlowRunSource =
  | { readonly kind: 'image'; readonly file: File; readonly width: number; readonly height: number }
  | { readonly kind: 'pdf'; readonly file: File; readonly pages: number }
  | {
      readonly kind: 'text';
      readonly file: File;
      readonly payload: 'csv-file' | 'json-text';
      readonly summary: string;
    };

/**
 * A text document travelling between steps.
 *
 * It carries which kind it is, because that is what decides what the next
 * block does with it: the converter reads a table and writes JSON, or reads
 * JSON and writes a table, and the payload in hand is the whole of the
 * difference.
 */
export interface FlowText {
  readonly file: File;
  readonly kind: 'csv-file' | 'json-text';
  /** What the block that made it wants said about it. */
  readonly summary: string;
}

/** A picture a step could not do, kept rather than thrown. */
export interface FlowRunFailure {
  readonly name: string;
  readonly reason: string;
}

/** Everything a run reads, fixed at the moment it starts. */
export interface FlowRunInput {
  readonly steps: readonly FlowRunStep[];
  readonly sources: readonly FlowRunSource[];
  readonly outputFormat: ImageOutputFormat;
}

/**
 * What a finished run hands the page, already named and packed: the page only
 * has to make the links. A set carries its archive, written from the same
 * files the individual links point at.
 */
export type FlowRunResult =
  | { readonly kind: 'text'; readonly text: FlowText; readonly shown: string }
  | { readonly kind: 'pdf'; readonly pdf: FlowPdf }
  | { readonly kind: 'pdf-set'; readonly pdfs: readonly FlowPdf[]; readonly archive: Blob; readonly archiveName: string }
  | {
      readonly kind: 'image-set';
      readonly payloads: readonly FlowPayload[];
      readonly failed: readonly FlowRunFailure[];
      /** Whether the set came out of a document, which is what it is named for. */
      readonly fromDocument: boolean;
      readonly archive: Blob;
      readonly archiveName: string;
    }
  | { readonly kind: 'image'; readonly payload: FlowPayload };

/** How a run ended. Only a `success` carries anything the page may show. */
export type FlowRunOutcome =
  | { readonly status: 'success'; readonly result: FlowRunResult }
  | { readonly status: 'failure'; readonly message: string }
  | { readonly status: 'cancelled' };

/**
 * Where a run is: `pending` from the moment it is asked for, `running` once
 * its first block starts, then one of the three ways an outcome ends.
 */
export type FlowRunPhase = 'pending' | 'running' | FlowRunOutcome['status'];

/**
 * The work a run hands to other modules, passed in so the order, the hand-offs
 * and the stale-run rules can be checked without a canvas or a document.
 */
export interface FlowRunAdapters {
  readonly runImageStep: (step: FlowRunStep, payload: FlowPayload, outputFormat: ImageOutputFormat) => Promise<FlowPayload>;
  readonly runPdfStep: (
    step: FlowRunStep & FlowPdfStep,
    hands: FlowPdfHands,
    context: FlowPdfRunContext,
  ) => Promise<FlowPdfStepResult>;
  readonly drawCollage: (files: readonly File[], plan: CollagePlan, outputFormat: ImageOutputFormat) => Promise<Blob>;
}

/** The on-device implementations every flow runs with. */
export const browserFlowRunAdapters: FlowRunAdapters = {
  runImageStep: (step, payload, outputFormat) => runFlowImageStep(step, payload, outputFormat),
  runPdfStep: (step, hands, context) => runFlowPdfStep(step, hands, context),
  drawCollage: async (files, plan, outputFormat) => {
    const images = [];

    for (const file of files) {
      images.push(await loadBrowserImage(file));
    }

    const canvas = drawCollage(document.createElement('canvas'), plan, images, defaultCollageBackground);
    return encodeBrowserImage(canvas, plan, outputFormat);
  },
};

export interface FlowRunOptions {
  /**
   * Aborted when the page no longer wants this run's result: the panel was
   * reset, or a setting changed under it. The run then stops at its next
   * asynchronous boundary and ends `cancelled`, never `success`.
   */
  readonly signal: AbortSignal;
  /** Called before each unit of work, so the page can say so and repaint. */
  readonly onProgress: (message: string) => Promise<void> | void;
  /** Called as the run moves from one phase to the next, terminal ones included. */
  readonly onPhase?: (phase: FlowRunPhase) => void;
  readonly adapters?: FlowRunAdapters;
}

const toolName = (toolSlug: AvailableFlowToolSlug) => {
  const tool = toolRegistry.find((candidate) => candidate.slug === toolSlug);
  if (!tool) throw new Error(`Missing Gizlet: ${toolSlug}`);
  return tool.name;
};

const copySource = (source: FlowRunSource): FlowRunSource => {
  if (source.kind === 'image') return Object.freeze({ kind: 'image', file: source.file, width: source.width, height: source.height });
  if (source.kind === 'pdf') return Object.freeze({ kind: 'pdf', file: source.file, pages: source.pages });
  return Object.freeze({ kind: 'text', file: source.file, payload: source.payload, summary: source.summary });
};

/**
 * Copies what a run reads, so a setting edited, a block moved or a file
 * removed while it runs cannot change the run already under way. The files
 * themselves are immutable, so they are shared rather than copied.
 */
export function snapshotFlowRun(input: FlowRunInput): FlowRunInput {
  return Object.freeze({
    steps: Object.freeze(input.steps.map((step) => Object.freeze({ ...step }))),
    sources: Object.freeze(input.sources.map(copySource)),
    outputFormat: input.outputFormat,
  });
}

const zip = async (files: readonly { readonly name: string; readonly blob: Blob }[]) => {
  const entries = await Promise.all(
    files.map(async (file) => ({ name: file.name, data: new Uint8Array(await file.blob.arrayBuffer()) })),
  );

  return new Blob([createZipArchive(entries)], { type: zipMimeType });
};

/**
 * Runs a snapshot's blocks in order, one at a time, and packs what the last
 * one hands on.
 *
 * Cancelling stops the run between asynchronous boundaries — before a block,
 * around each progress line, after each picture — and nowhere else. An encode
 * or a page copy already handed to the browser runs to its end; its output is
 * then dropped rather than shown. Whatever happens, once the signal is aborted
 * the outcome is `cancelled`, so a superseded run can never put a result back.
 */
export async function runFlowSteps(input: FlowRunInput, options: FlowRunOptions): Promise<FlowRunOutcome> {
  const { signal, onPhase, adapters = browserFlowRunAdapters } = options;
  const { steps, sources, outputFormat } = input;

  const end = (outcome: FlowRunOutcome): FlowRunOutcome => {
    onPhase?.(outcome.status);
    return outcome;
  };
  const progress = async (message: string) => {
    signal.throwIfAborted();
    await options.onProgress(message);
    signal.throwIfAborted();
  };

  onPhase?.('pending');
  if (signal.aborted) return end({ status: 'cancelled' });

  // A flow starts in whichever hand the category filled: images travel as
  // payloads and documents as results, which is the same pair of hands every
  // block after the first one uses.
  let payloads: readonly FlowPayload[] = sources
    .filter((source) => source.kind === 'image')
    .map((source) => ({ file: source.file, width: source.width, height: source.height }));
  let pdfResults: readonly FlowPdf[] = sources
    .filter((source) => source.kind === 'pdf')
    .map((source) => ({
      blob: source.file,
      pages: source.pages,
      // A chosen document lays its own pages out; nothing here re-sizes them,
      // and `fit` is the page size that says exactly that.
      pageSize: 'fit',
      name: source.file.name,
    }));
  // A text chain carries one document, already read: the third hand a
  // category can fill, and the only one whose payload is characters rather
  // than bytes this page has never looked at.
  let textResult: FlowText | undefined = sources
    .filter((source) => source.kind === 'text')
    .map((source) => ({ file: source.file, kind: source.payload, summary: source.summary }))
    .at(0);
  // The document the visitor chose, which is what a converted result is
  // named after. Naming it after the file the previous block made would
  // stack one block's suffix under the next block's extension, and a chain
  // of three would hand back a name describing the chain rather than the
  // document.
  const textSourceName = textResult?.file.name;
  // The document a set came out of, which names its archive. It is the
  // earliest such document rather than the latest: a split followed by a
  // conversion has taken the same original apart twice over.
  let setSourceName: string | undefined;
  /**
   * The pictures a step could not do, kept rather than thrown.
   *
   * A batch of twenty photographs with one broken file in it should finish
   * nineteen and say which one it did not, instead of discarding the work
   * and reporting the single failure as the outcome of the run.
   */
  const failed: FlowRunFailure[] = [];

  onPhase?.('running');

  try {
    for (const [index, step] of steps.entries()) {
      signal.throwIfAborted();

      const name = toolName(step.toolSlug);
      const position = `${index + 1} of ${steps.length}`;

      if (step.toolSlug === 'csv-viewer' || step.toolSlug === 'json-csv-converter' || step.toolSlug === 'json-formatter') {
        if (!textResult) throw new Error(`${name} needs the document this flow started from.`);

        await progress(`Running ${position}: ${name} locally…`);

        const text = await textResult.file.text();
        const fileName = textResult.file.name;

        if (step.toolSlug === 'csv-viewer') {
          // Tidying, which is what this block hands on. The separator is
          // read off the document rather than carried by the chain: a link
          // that named one would be asserting something about a file it has
          // never seen.
          const table = readCsvTable(text, detectCsvDelimiter(text).delimiter, true);

          if (!table) throw new Error(`${name} found nothing in this document to read as a table.`);

          textResult = {
            file: new File([table.formatted], getFormattedCsvName(fileName), { type: 'text/csv' }),
            kind: 'csv-file',
            summary: describeCsvTable(table),
          };
          continue;
        }

        if (step.toolSlug === 'json-formatter') {
          const formatted = transformJson(text, 'format');

          if (!formatted.valid) throw new Error(`${name}: ${formatJsonParseError(formatted.error)}`);

          textResult = {
            file: new File([formatted.output], fileName, { type: 'application/json' }),
            kind: 'json-text',
            summary: 'indented',
          };
          continue;
        }

        // The converter, in whichever direction the payload in hand asks
        // for. Nothing chose it: a table arriving is read, and JSON
        // arriving is written out as a table.
        const reading = textResult.kind === 'csv-file'
          ? convertCsvToJson(text, detectCsvDelimiter(text).delimiter, defaultCsvValueReading)
          : convertJsonToCsv(text, defaultCsvDelimiter);

        if (!reading) throw new Error(`${name} was handed an empty document, so there was nothing to convert.`);
        if (!reading.ok) throw new Error(`${name}: ${reading.message}`);

        const becomes = textResult.kind === 'csv-file' ? 'json' : 'csv';

        textResult = {
          file: new File([reading.conversion.output], getConvertedRecordsName(textSourceName ?? fileName, becomes), {
            type: becomes === 'json' ? 'application/json' : 'text/csv',
          }),
          kind: becomes === 'json' ? 'json-text' : 'csv-file',
          summary: describeConversion(reading.conversion),
        };
        continue;
      }

      if (step.toolSlug === 'collage-maker') {
        if (payloads.length === 0) throw new Error(`${name} needs the images this flow started from.`);

        await progress(`Running ${position}: ${name}, arranging ${describeCollageImageCount(payloads.length)} locally…`);

        // A flow has no canvas to arrange by hand, so the collage uses its
        // own defaults for everything but the arrangement: the gap, the
        // background and the width are taste rather than the shape of the
        // chain, and a link cannot carry taste it did not ask for.
        const collageItems = payloads.map((payload) => ({ width: payload.width, height: payload.height }));
        const plan = planCollage(collageItems, {
          layout: step.layout ?? defaultCollageLayout,
          spacing: defaultCollageSpacing,
          width: defaultCollageWidth,
        });
        const invalid = validateCollage(collageItems, plan);

        if (invalid) throw new Error(`${name}: ${invalid}`);

        const blob = await adapters.drawCollage(payloads.map((payload) => payload.file), plan, outputFormat);

        payloads = [{
          file: new File([blob], getCollageOutputFilename(payloads[0].file.name, outputFormat), { type: blob.type }),
          width: plan.width,
          height: plan.height,
        }];
        continue;
      }

      if (isFlowPdfStep(step)) {
        // The PDF runner reports between pages, so a cancellation raised in
        // that report stops it there, and its own `finally` closes whatever
        // renderer it had open.
        const next = await adapters.runPdfStep(step, { payloads, pdfs: pdfResults }, {
          position,
          outputFormat,
          onProgress: progress,
        });

        payloads = next.payloads;
        pdfResults = next.pdfs;
        setSourceName ??= next.setSourceName;
        continue;
      }

      const processed: FlowPayload[] = [];
      for (const [payloadIndex, payload] of payloads.entries()) {
        await progress(payloads.length === 1
          ? `Running ${position}: ${name} locally…`
          : `Running ${position}: ${name} on image ${payloadIndex + 1} of ${payloads.length} locally…`);

        // A batch is a set of independent jobs: a picture this step cannot
        // do is dropped, named, and the rest go on. A flow over one picture
        // has nothing to go on with, so its failure is still the run's.
        if (payloads.length === 1 && failed.length === 0) {
          processed.push(await adapters.runImageStep(step, payload, outputFormat));
          continue;
        }

        try {
          processed.push(await adapters.runImageStep(step, payload, outputFormat));
        } catch (caughtError) {
          failed.push({
            name: payload.file.name,
            reason: caughtError instanceof Error ? caughtError.message : `${name} could not process this image.`,
          });
        }
      }

      if (processed.length === 0) {
        throw new Error(failed[0]?.reason ?? `${name} could not process these images.`);
      }

      payloads = processed;
    }

    signal.throwIfAborted();

    const result = await pack();

    // The last boundary: packing is asynchronous too, and a result the page
    // stopped waiting for must not reach it.
    signal.throwIfAborted();
    return end({ status: 'success', result });
  } catch (caughtError) {
    if (signal.aborted) return end({ status: 'cancelled' });

    return end({
      status: 'failure',
      message: caughtError instanceof Error ? caughtError.message : 'This flow could not be processed. Try another image or adjust the step settings.',
    });
  }

  async function pack(): Promise<FlowRunResult> {
    if (textResult) return { kind: 'text', text: textResult, shown: await textResult.file.text() };

    if (pdfResults.length === 1) return { kind: 'pdf', pdf: pdfResults[0] };

    if (pdfResults.length > 1) {
      // A set of documents is one download too, packed here from the same
      // files the individual links point at.
      await progress(`Packing ${describeSplitPdfCount(pdfResults.length)} into one archive locally…`);

      return {
        kind: 'pdf-set',
        pdfs: pdfResults,
        archive: await zip(pdfResults),
        archiveName: getSplitPdfArchiveName(setSourceName ?? 'document.pdf'),
      };
    }

    if (payloads.length > 1 || (payloads.length === 1 && failed.length > 0)) {
      await progress(`Packing ${describePdfImageCount(payloads.length)} into one archive locally…`);

      // A set that came out of a document is named for that document; a
      // batch that started as a folder of pictures has no such name, and is
      // named for what it is instead.
      const fromDocument = setSourceName !== undefined;

      return {
        kind: 'image-set',
        payloads,
        failed,
        fromDocument,
        archive: await zip(payloads.map((payload) => ({ name: payload.file.name, blob: payload.file }))),
        archiveName: fromDocument ? getPdfImageArchiveName(setSourceName ?? 'document.pdf') : getBatchArchiveName('flow'),
      };
    }

    return { kind: 'image', payload: payloads[0] };
  }
}
