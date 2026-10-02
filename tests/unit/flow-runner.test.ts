import { describe, expect, test } from 'vitest';

import { getFormattedCsvName } from '../../src/data/csv-viewer';
import { getBatchArchiveName } from '../../src/data/image-batches';
import { getPdfImageArchiveName } from '../../src/data/pdf-to-jpg';
import { getSplitPdfArchiveName } from '../../src/data/split-pdf';
import { toolRegistry } from '../../src/data/tools';
import type { FlowPayload } from '../../src/scripts/flow-image-runner';
import { runFlowPdfStep, type FlowPdf, type FlowPdfAdapters } from '../../src/scripts/flow-pdf-runner';
import {
  runFlowSteps,
  snapshotFlowRun,
  type FlowRunAdapters,
  type FlowRunInput,
  type FlowRunOutcome,
  type FlowRunPhase,
  type FlowRunStep,
} from '../../src/scripts/flow-runner';

const nameOf = (slug: string) => {
  const name = toolRegistry.find((tool) => tool.slug === slug)?.name;
  if (!name) throw new Error(`Missing Gizlet: ${slug}`);
  return name;
};

/** A promise the test settles by hand, standing in for work still going. */
const deferred = <Value>() => {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });

  return { promise, resolve, reject };
};

/** Lets every pending continuation run, so a test can see where a run stopped. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const imageFile = (name: string) => new File([new Uint8Array(4)], name, { type: 'image/png' });
const imageSource = (name: string) => ({ kind: 'image', file: imageFile(name), width: 40, height: 20 }) as const;
const pdfSource = (name: string, pages: number) =>
  ({ kind: 'pdf', file: new File([new Uint8Array(pages)], name, { type: 'application/pdf' }), pages }) as const;

/** An image step that names what it did, so the order can be read off the result. */
const stamped = (step: FlowRunStep, payload: FlowPayload): FlowPayload => ({
  file: new File([new Uint8Array(2)], `${payload.file.name.replace(/\.png$/, '')}+${step.toolSlug}${step.width ? `@${step.width}` : ''}.png`, { type: 'image/png' }),
  width: step.width ?? payload.width,
  height: payload.height,
});

const createAdapters = (overrides: Partial<FlowRunAdapters> = {}) => {
  const calls: { readonly name: string; readonly step: FlowRunStep }[] = [];
  const adapters: FlowRunAdapters = {
    runImageStep: async (step, payload) => {
      calls.push({ name: 'image', step });
      return stamped(step, payload);
    },
    runPdfStep: async (step) => {
      calls.push({ name: 'pdf', step });
      throw new Error('No PDF step expected.');
    },
    drawCollage: async () => new Blob([new Uint8Array(1)], { type: 'image/png' }),
    ...overrides,
  };

  return { adapters, calls };
};

const start = (input: FlowRunInput, adapters: FlowRunAdapters, controller = new AbortController()) => {
  const phases: FlowRunPhase[] = [];
  const progress: string[] = [];
  let settled: FlowRunOutcome | undefined;
  const outcome = runFlowSteps(snapshotFlowRun(input), {
    signal: controller.signal,
    onProgress: (message) => {
      progress.push(message);
    },
    onPhase: (phase) => phases.push(phase),
    adapters,
  }).then((value) => {
    settled = value;
    return value;
  });

  return { outcome, phases, progress, controller, settled: () => settled };
};

describe('snapshotFlowRun', () => {
  test('copies and freezes the steps and sources, sharing the files', () => {
    const step = { toolSlug: 'resize-image' as const, width: 100, height: 100 };
    const source = { ...imageSource('a.png'), id: 7, previewUrl: 'blob:preview' };
    const snapshot = snapshotFlowRun({ steps: [step], sources: [source], outputFormat: 'image/png' });

    step.width = 900;

    expect(snapshot.steps).toEqual([{ toolSlug: 'resize-image', width: 100, height: 100 }]);
    expect(Object.isFrozen(snapshot.steps)).toBe(true);
    expect(Object.isFrozen(snapshot.steps[0])).toBe(true);
    // Only what a run reads: the preview URL stays the component's.
    expect(snapshot.sources).toEqual([{ kind: 'image', file: source.file, width: 40, height: 20 }]);
    expect(snapshot.sources[0].file).toBe(source.file);
  });
});

describe('runFlowSteps', () => {
  test('runs the blocks in order and goes pending → running → success', async () => {
    const { adapters, calls } = createAdapters();
    const run = start({
      steps: [{ toolSlug: 'resize-image', width: 10, height: 10 }, { toolSlug: 'compress-image', quality: 70 }],
      sources: [imageSource('a.png')],
      outputFormat: 'image/png',
    }, adapters);
    const outcome = await run.outcome;

    expect(run.phases).toEqual(['pending', 'running', 'success']);
    expect(calls.map((call) => call.step.toolSlug)).toEqual(['resize-image', 'compress-image']);
    expect(outcome).toEqual({ status: 'success', result: { kind: 'image', payload: expect.anything() } });
    expect(outcome.status === 'success' && outcome.result.kind === 'image' && outcome.result.payload.file.name)
      .toBe('a+resize-image@10+compress-image.png');
    expect(run.progress).toEqual([
      `Running 1 of 2: ${nameOf('resize-image')} locally…`,
      `Running 2 of 2: ${nameOf('compress-image')} locally…`,
    ]);
  });

  test('reads the settings it started with, whatever is edited while it runs', async () => {
    const first = deferred<FlowPayload>();
    const { adapters, calls } = createAdapters();
    const steps = [{ toolSlug: 'resize-image' as const, width: 10, height: 10 }, { toolSlug: 'resize-image' as const, width: 20, height: 20 }];
    const run = start({ steps, sources: [imageSource('a.png')], outputFormat: 'image/png' }, {
      ...adapters,
      runImageStep: async (step, payload) => {
        calls.push({ name: 'image', step });
        return calls.length === 1 ? first.promise : stamped(step, payload);
      },
    });

    await settle();
    steps[1].width = 999;
    steps.push({ toolSlug: 'resize-image', width: 5, height: 5 });
    first.resolve(stamped(steps[0], { file: imageFile('a.png'), width: 40, height: 20 }));

    const outcome = await run.outcome;

    expect(calls.map((call) => call.step.width)).toEqual([10, 20]);
    expect(outcome.status).toBe('success');
  });

  test('a reset while a block is pending ends cancelled, starts nothing further, and waits for the block rather than claiming to stop it', async () => {
    const pending = deferred<FlowPayload>();
    const { adapters, calls } = createAdapters({
      runImageStep: async (step) => {
        calls.push({ name: 'image', step });
        return pending.promise;
      },
    });
    const run = start({
      steps: [{ toolSlug: 'compress-image', quality: 80 }, { toolSlug: 'convert-image' }],
      sources: [imageSource('a.png')],
      outputFormat: 'image/png',
    }, adapters);

    await settle();
    run.controller.abort();
    await settle();

    // The encode already handed off is not interrupted: the run is still
    // waiting on it, and settles only when it does.
    expect(run.settled()).toBeUndefined();

    pending.resolve(stamped({ toolSlug: 'compress-image' }, { file: imageFile('a.png'), width: 40, height: 20 }));

    expect(await run.outcome).toEqual({ status: 'cancelled' });
    expect(run.phases).toEqual(['pending', 'running', 'cancelled']);
    expect(calls).toHaveLength(1);
    expect(run.progress).toEqual([`Running 1 of 2: ${nameOf('compress-image')} locally…`]);
  });

  test('a replaced run never succeeds, even when it finishes after its replacement', async () => {
    const stale = deferred<FlowPayload>();
    const first = start({
      steps: [{ toolSlug: 'resize-image', width: 10, height: 10 }],
      sources: [imageSource('old.png')],
      outputFormat: 'image/png',
    }, createAdapters({ runImageStep: () => stale.promise }).adapters);

    await settle();
    first.controller.abort();

    const second = start({
      steps: [{ toolSlug: 'resize-image', width: 20, height: 20 }],
      sources: [imageSource('new.png')],
      outputFormat: 'image/png',
    }, createAdapters().adapters);
    const replacement = await second.outcome;

    stale.resolve(stamped({ toolSlug: 'resize-image', width: 10 }, { file: imageFile('old.png'), width: 40, height: 20 }));

    expect(await first.outcome).toEqual({ status: 'cancelled' });
    expect(replacement.status === 'success' && replacement.result.kind === 'image' && replacement.result.payload.file.name)
      .toBe('new+resize-image@20.png');
  });

  test('a block that rejects after the run was cancelled is a cancellation, not an error', async () => {
    const pending = deferred<FlowPayload>();
    const run = start({
      steps: [{ toolSlug: 'compress-image' }],
      sources: [imageSource('a.png')],
      outputFormat: 'image/png',
    }, createAdapters({ runImageStep: () => pending.promise }).adapters);

    await settle();
    run.controller.abort();
    pending.reject(new Error('This image could not be read.'));

    expect(await run.outcome).toEqual({ status: 'cancelled' });
  });

  test('a rejected step fails the run with its message, and a rerun succeeds', async () => {
    let attempt = 0;
    const { adapters } = createAdapters({
      runImageStep: async (step, payload) => {
        attempt += 1;
        if (attempt === 1) throw new Error('Resize Image: Enter a width.');
        return stamped(step, payload);
      },
    });
    const input: FlowRunInput = {
      steps: [{ toolSlug: 'resize-image', width: 10, height: 10 }],
      sources: [imageSource('a.png')],
      outputFormat: 'image/png',
    };
    const failed = start(input, adapters);

    expect(await failed.outcome).toEqual({ status: 'failure', message: 'Resize Image: Enter a width.' });
    expect(failed.phases).toEqual(['pending', 'running', 'failure']);

    const rerun = start(input, adapters);

    expect((await rerun.outcome).status).toBe('success');
    expect(rerun.phases).toEqual(['pending', 'running', 'success']);
  });

  test('a run asked for after it was already cancelled never starts', async () => {
    const controller = new AbortController();
    const { adapters, calls } = createAdapters();

    controller.abort();
    const run = start({ steps: [{ toolSlug: 'compress-image' }], sources: [imageSource('a.png')], outputFormat: 'image/png' }, adapters, controller);

    expect(await run.outcome).toEqual({ status: 'cancelled' });
    expect(run.phases).toEqual(['pending', 'cancelled']);
    expect(calls).toEqual([]);
  });

  test('a batch keeps the pictures that worked, names the one that did not, and packs the rest', async () => {
    const { adapters } = createAdapters({
      runImageStep: async (step, payload) => {
        if (payload.file.name === 'b.png') throw new Error('This image could not be read.');
        return stamped(step, payload);
      },
    });
    const run = start({
      steps: [{ toolSlug: 'compress-image' }],
      sources: [imageSource('a.png'), imageSource('b.png'), imageSource('c.png')],
      outputFormat: 'image/png',
    }, adapters);
    const outcome = await run.outcome;

    if (outcome.status !== 'success' || outcome.result.kind !== 'image-set') throw new Error('Expected a set of images.');

    expect(outcome.result.payloads.map((payload) => payload.file.name)).toEqual(['a+compress-image.png', 'c+compress-image.png']);
    expect(outcome.result.failed).toEqual([{ name: 'b.png', reason: 'This image could not be read.' }]);
    expect(outcome.result.fromDocument).toBe(false);
    expect(outcome.result.archiveName).toBe(getBatchArchiveName('flow'));
    expect(run.progress.at(-1)).toBe('Packing 2 images into one archive locally…');
  });

  test('a single picture that fails fails the run', async () => {
    const { adapters } = createAdapters({
      runImageStep: async () => {
        throw new Error('This image could not be read.');
      },
    });
    const run = start({ steps: [{ toolSlug: 'compress-image' }], sources: [imageSource('a.png')], outputFormat: 'image/png' }, adapters);

    expect(await run.outcome).toEqual({ status: 'failure', message: 'This image could not be read.' });
  });

  test('a cancellation during packing never hands back the archive', async () => {
    const controller = new AbortController();
    const run = runFlowSteps(snapshotFlowRun({
      steps: [{ toolSlug: 'compress-image' }],
      sources: [imageSource('a.png'), imageSource('b.png')],
      outputFormat: 'image/png',
    }), {
      signal: controller.signal,
      onProgress: (message) => {
        if (message.startsWith('Packing')) controller.abort();
      },
      adapters: createAdapters().adapters,
    });

    expect(await run).toEqual({ status: 'cancelled' });
  });

  test('a split set is named after the document it came from', async () => {
    const parts: FlowPdf[] = [1, 2].map((page) => ({
      blob: new Blob([new Uint8Array(1)], { type: 'application/pdf' }),
      pages: 1,
      pageSize: 'fit',
      name: `report-page-${page}.pdf`,
    }));
    const { adapters } = createAdapters({
      runPdfStep: async () => ({ payloads: [], pdfs: parts, setSourceName: 'report.pdf' }),
    });
    const outcome = await start({ steps: [{ toolSlug: 'split-pdf' }], sources: [pdfSource('report.pdf', 2)], outputFormat: 'image/png' }, adapters).outcome;

    if (outcome.status !== 'success' || outcome.result.kind !== 'pdf-set') throw new Error('Expected a set of PDFs.');

    expect(outcome.result.pdfs).toBe(parts);
    expect(outcome.result.archiveName).toBe(getSplitPdfArchiveName('report.pdf'));
    expect(outcome.result.archive.type).toBe('application/zip');
  });

  test('pages drawn out of a document are named after it', async () => {
    const { adapters } = createAdapters({
      runPdfStep: async () => ({
        payloads: [1, 2].map((page) => ({ file: imageFile(`report-${page}.png`), width: 10, height: 10 })),
        pdfs: [],
        setSourceName: 'report.pdf',
      }),
    });
    const outcome = await start({ steps: [{ toolSlug: 'pdf-to-jpg' }], sources: [pdfSource('report.pdf', 2)], outputFormat: 'image/png' }, adapters).outcome;

    if (outcome.status !== 'success' || outcome.result.kind !== 'image-set') throw new Error('Expected a set of images.');

    expect(outcome.result.fromDocument).toBe(true);
    expect(outcome.result.archiveName).toBe(getPdfImageArchiveName('report.pdf'));
  });

  test('a cancellation between drawn pages stops the PDF block and still closes its renderer', async () => {
    let closed = 0;
    let drawn = 0;
    const pdfAdapters = {
      openForRendering: async (blob: Blob) => ({
        pageCount: blob.size,
        getPageSize: async () => ({ width: 1, height: 1 }),
        renderPage: async () => undefined,
        renderPageToWidth: async () => undefined,
        close: async () => {
          closed += 1;
        },
      }),
      renderPages: async (_document, options) => {
        for (const [index] of options.pageNumbers.entries()) {
          await options.onPage?.(index + 1, options.pageNumbers.length);
          drawn += 1;
        }
        return [];
      },
    } as Partial<FlowPdfAdapters> as FlowPdfAdapters;
    const controller = new AbortController();
    const outcome = await runFlowSteps(snapshotFlowRun({
      steps: [{ toolSlug: 'pdf-to-jpg' }],
      sources: [pdfSource('report.pdf', 3)],
      outputFormat: 'image/png',
    }), {
      signal: controller.signal,
      onProgress: (message) => {
        if (message.includes('page 2 of 3')) controller.abort();
      },
      adapters: { ...createAdapters().adapters, runPdfStep: (step, hands, context) => runFlowPdfStep(step, hands, context, pdfAdapters) },
    });

    expect(outcome).toEqual({ status: 'cancelled' });
    expect(drawn).toBe(1);
    expect(closed).toBe(1);
  });

  test('a text chain tidies the document it was handed', async () => {
    const file = new File(['name;age\nAda;36\n'], 'people.csv', { type: 'text/csv' });
    const outcome = await start({
      steps: [{ toolSlug: 'csv-viewer' }],
      sources: [{ kind: 'text', file, payload: 'csv-file', summary: '2 rows' }],
      outputFormat: 'image/png',
    }, createAdapters().adapters).outcome;

    if (outcome.status !== 'success' || outcome.result.kind !== 'text') throw new Error('Expected a text result.');

    expect(outcome.result.text.file.name).toBe(getFormattedCsvName('people.csv'));
    expect(outcome.result.shown).toBe(await outcome.result.text.file.text());
  });
});
