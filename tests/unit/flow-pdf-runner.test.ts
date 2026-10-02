import { describe, expect, test } from 'vitest';

import { getMergedPdfFilename } from '../../src/data/merge-pdf';
import { defaultPdfOrientation, defaultPdfPageSize, getPdfOutputFilename } from '../../src/data/jpg-to-pdf';
import { defaultPdfImageResolution } from '../../src/data/pdf-to-jpg';
import {
  getAvailableFlowToolSlugs,
  getFlowOutputKinds,
  getFlowTool,
  getFlowToolsForInput,
} from '../../src/data/tool-flows';
import { toolRegistry } from '../../src/data/tools';
import type { FlowPayload } from '../../src/scripts/flow-image-runner';
import {
  isFlowPdfStep,
  runFlowPdfStep,
  type FlowPdf,
  type FlowPdfAdapters,
  type FlowPdfHands,
  type FlowPdfStep,
} from '../../src/scripts/flow-pdf-runner';

const nameOf = (slug: string) => {
  const name = toolRegistry.find((tool) => tool.slug === slug)?.name;
  if (!name) throw new Error(`Missing Gizlet: ${slug}`);
  return name;
};

const pdf = (name: string, pages: number, pageSize: FlowPdf['pageSize'] = 'fit'): FlowPdf => ({
  blob: new Blob([new Uint8Array(pages)], { type: 'application/pdf' }),
  pages,
  pageSize,
  name,
});

const image = (name: string, width = 40, height = 20): FlowPayload => ({
  file: new File([new Uint8Array(1)], name, { type: 'image/jpeg' }),
  width,
  height,
});

/**
 * Adapters that record what the runner asked for instead of reading a
 * document. A blob's size stands in for its page count, so each fake can
 * answer how many pages it was handed.
 */
const createAdapters = (overrides: Partial<FlowPdfAdapters> = {}) => {
  const calls: { readonly name: string; readonly args: readonly unknown[] }[] = [];
  const record = (name: string, args: readonly unknown[]) => calls.push({ name, args });
  const written = (label: string) => new Blob([label], { type: 'application/pdf' });
  const opened = (blob: Blob) => ({ pageCount: blob.size, document: {} as never });
  let closed = 0;

  const adapters: FlowPdfAdapters = {
    createImagePdf: async (...args) => {
      record('createImagePdf', args);
      for (const [index] of args[0].entries()) await args[1].onPage?.(index + 1, args[0].length);
      return written('images');
    },
    openForMerge: async (...args) => {
      record('openForMerge', args);
      return { file: args[0], ...opened(args[0]) };
    },
    merge: async (...args) => {
      record('merge', args);
      for (const [index] of args[0].entries()) await args[1]?.onDocument?.(index + 1, args[0].length);
      return written('merged');
    },
    openForRendering: async (...args) => {
      record('openForRendering', args);
      return {
        pageCount: args[0].size,
        getPageSize: async () => ({ width: 1, height: 1 }),
        renderPage: async () => undefined,
        renderPageToWidth: async () => undefined,
        close: async () => {
          closed += 1;
        },
      };
    },
    renderPages: async (...args) => {
      record('renderPages', args);
      const { documentName, pageNumbers, format } = args[1];
      for (const [index] of pageNumbers.entries()) await args[1].onPage?.(index + 1, pageNumbers.length);
      return pageNumbers.map((pageNumber) => ({
        pageNumber,
        file: new File([new Uint8Array(1)], `${documentName}-${pageNumber}`, { type: format }),
        width: 10 * pageNumber,
        height: 20,
      }));
    },
    openForWatermark: async (...args) => {
      record('openForWatermark', args);
      return opened(args[0]) as never;
    },
    watermark: async (...args) => {
      record('watermark', args);
      return written('stamped');
    },
    openForPageNumbers: async (...args) => {
      record('openForPageNumbers', args);
      return opened(args[0]) as never;
    },
    addPageNumbers: async (...args) => {
      record('addPageNumbers', args);
      return written('numbered');
    },
    openForOrganize: async (...args) => {
      record('openForOrganize', args);
      return opened(args[0]) as never;
    },
    organize: async (...args) => {
      record('organize', args);
      return written('organized');
    },
    openForMetadata: async (...args) => {
      record('openForMetadata', args);
      return opened(args[0]) as never;
    },
    cleanMetadata: async (...args) => {
      record('cleanMetadata', args);
      return written('cleaned');
    },
    openForSplit: async (...args) => {
      record('openForSplit', args);
      return opened(args[0]);
    },
    split: async (...args) => {
      record('split', args);
      const [, ranges, options] = args;
      for (const [index] of ranges.entries()) await options.onPart?.(index + 1, ranges.length);
      return ranges.map((range) => ({
        range,
        file: new File([new Uint8Array(1)], `${options.documentName}-part-${range.first}`, { type: 'application/pdf' }),
      }));
    },
    ...overrides,
  };

  return { adapters, calls, closed: () => closed };
};

const run = (step: FlowPdfStep, hands: FlowPdfHands, adapters: FlowPdfAdapters) => {
  const progress: string[] = [];
  const result = runFlowPdfStep(step, hands, {
    position: '2 of 3',
    outputFormat: 'image/png',
    onProgress: (message) => {
      progress.push(message);
    },
  }, adapters);

  return { result, progress };
};

const documentSteps = ['watermark-pdf', 'pdf-page-numbers', 'organize-pdf', 'clean-pdf-metadata'] as const;

describe('isFlowPdfStep', () => {
  test('claims every available block that reads or makes a PDF, and nothing else', () => {
    const touchesPdf = new Set([
      ...getFlowToolsForInput('pdf-file').map((tool) => tool.toolSlug),
      ...getAvailableFlowToolSlugs().filter((slug) => getFlowOutputKinds(getFlowTool(slug)).includes('pdf-file')),
    ]);

    for (const toolSlug of getAvailableFlowToolSlugs()) {
      expect(isFlowPdfStep({ toolSlug }), toolSlug).toBe(touchesPdf.has(toolSlug));
    }
  });

  test('covers the eight PDF branches a flow runs', () => {
    for (const toolSlug of ['jpg-to-pdf', 'merge-pdf', 'pdf-to-jpg', 'split-pdf', ...documentSteps] as const) {
      expect(isFlowPdfStep({ toolSlug }), toolSlug).toBe(true);
    }
  });
});

describe('runFlowPdfStep', () => {
  test('puts the images in hand into one PDF, named after the first, and empties the image hand', async () => {
    const { adapters, calls } = createAdapters();
    const images = [image('one.jpg'), image('two.jpg')];
    const { result, progress } = run({ toolSlug: 'jpg-to-pdf' }, { payloads: images, pdfs: [] }, adapters);
    const output = await result;

    expect(calls.map((call) => call.name)).toEqual(['createImagePdf']);
    expect(calls[0].args[0]).toBe(images);
    expect(calls[0].args[1]).toMatchObject({ pageSize: defaultPdfPageSize, orientation: defaultPdfOrientation });
    expect(output.payloads).toEqual([]);
    expect(output.pdfs).toEqual([{ blob: expect.any(Blob), pages: 2, pageSize: defaultPdfPageSize, name: getPdfOutputFilename('one.jpg', 2) }]);
    expect(output.setSourceName).toBeUndefined();
    expect(progress).toEqual([
      `Running 2 of 3: ${nameOf('jpg-to-pdf')}, page 1 of 2 locally…`,
      `Running 2 of 3: ${nameOf('jpg-to-pdf')}, page 2 of 2 locally…`,
    ]);
  });

  test('passes a chosen page size and orientation through', async () => {
    const { adapters, calls } = createAdapters();
    const { result } = run(
      { toolSlug: 'jpg-to-pdf', pageSize: 'letter', orientation: 'landscape' },
      { payloads: [image('one.jpg')], pdfs: [] },
      adapters,
    );
    const output = await result;

    expect(calls[0].args[1]).toMatchObject({ pageSize: 'letter', orientation: 'landscape' });
    expect(output.pdfs[0].pageSize).toBe('letter');
  });

  test('merges every document in hand, in order, into one fitted PDF', async () => {
    const { adapters, calls } = createAdapters();
    const first = pdf('first.pdf', 2);
    const second = pdf('second.pdf', 3);
    const { result, progress } = run({ toolSlug: 'merge-pdf' }, { payloads: [], pdfs: [first, second] }, adapters);
    const output = await result;
    const name = nameOf('merge-pdf');

    expect(calls.map((call) => call.name)).toEqual(['openForMerge', 'openForMerge', 'merge']);
    // A document the flow made is a blob; a merge reads files, named as the flow knows them.
    expect((calls[0].args[0] as File).name).toBe('first.pdf');
    expect((calls[1].args[0] as File).name).toBe('second.pdf');
    expect(output.pdfs).toEqual([{ blob: expect.any(Blob), pages: 5, pageSize: 'fit', name: getMergedPdfFilename('first.pdf') }]);
    expect(progress).toEqual([
      `Running 2 of 3: ${name}, reading the documents locally…`,
      `Running 2 of 3: ${name}, 2 PDFs, joining 1 of 2 locally…`,
      `Running 2 of 3: ${name}, 2 PDFs, joining 2 of 2 locally…`,
    ]);
  });

  test('hands a chosen file to a merge as it is', async () => {
    const { adapters, calls } = createAdapters();
    const chosen = new File([new Uint8Array(2)], 'chosen.pdf', { type: 'application/pdf' });

    await run({ toolSlug: 'merge-pdf' }, { payloads: [], pdfs: [{ blob: chosen, pages: 2, pageSize: 'fit', name: 'chosen.pdf' }, pdf('b.pdf', 1)] }, adapters).result;

    expect(calls[0].args[0]).toBe(chosen);
  });

  test('draws every page of every document in hand, and closes each renderer', async () => {
    const { adapters, calls, closed } = createAdapters();
    const { result, progress } = run(
      { toolSlug: 'pdf-to-jpg' },
      { payloads: [], pdfs: [pdf('a.pdf', 2), pdf('b.pdf', 1)] },
      adapters,
    );
    const output = await result;
    const name = nameOf('pdf-to-jpg');

    expect(calls.map((call) => call.name)).toEqual(['openForRendering', 'renderPages', 'openForRendering', 'renderPages']);
    expect(calls[1].args[1]).toMatchObject({ documentName: 'a.pdf', pageNumbers: [1, 2], pageCount: 2, format: 'image/png', resolution: defaultPdfImageResolution });
    expect(output.pdfs).toEqual([]);
    expect(output.payloads.map((payload) => [payload.file.name, payload.width, payload.height])).toEqual([
      ['a.pdf-1', 10, 20],
      ['a.pdf-2', 20, 20],
      ['b.pdf-1', 10, 20],
    ]);
    expect(output.setSourceName).toBe('a.pdf');
    expect(closed()).toBe(2);
    expect(progress).toEqual([
      `Running 2 of 3: ${name}, reading the document locally…`,
      `Running 2 of 3: ${name}, page 1 of 2 locally…`,
      `Running 2 of 3: ${name}, page 2 of 2 locally…`,
      `Running 2 of 3: ${name}, page 1 of 1 locally…`,
    ]);
  });

  test('closes the renderer when drawing fails, and when the document is too long to draw', async () => {
    const failing = createAdapters({
      renderPages: async () => {
        throw new Error('Your browser cannot draw this page.');
      },
    });

    await expect(run({ toolSlug: 'pdf-to-jpg' }, { payloads: [], pdfs: [pdf('a.pdf', 2)] }, failing.adapters).result)
      .rejects.toThrow('Your browser cannot draw this page.');
    expect(failing.closed()).toBe(1);

    const long = createAdapters();
    await expect(run({ toolSlug: 'pdf-to-jpg' }, { payloads: [], pdfs: [pdf('long.pdf', 101)] }, long.adapters).result)
      .rejects.toThrow(/100/);
    expect(long.calls.map((call) => call.name)).toEqual(['openForRendering']);
    expect(long.closed()).toBe(1);
  });

  test('splits every document in hand into its pages, keeping the page size', async () => {
    const { adapters, calls } = createAdapters();
    const { result, progress } = run(
      { toolSlug: 'split-pdf' },
      { payloads: [], pdfs: [pdf('a.pdf', 2, 'a4'), pdf('b.pdf', 3, 'a4')] },
      adapters,
    );
    const output = await result;
    const name = nameOf('split-pdf');

    expect(calls.map((call) => call.name)).toEqual(['openForSplit', 'split', 'openForSplit', 'split']);
    expect(output.pdfs.map((part) => [part.name, part.pages, part.pageSize])).toEqual([
      ['a.pdf-part-1', 1, 'a4'],
      ['a.pdf-part-2', 1, 'a4'],
      ['b.pdf-part-1', 1, 'a4'],
      ['b.pdf-part-2', 1, 'a4'],
      ['b.pdf-part-3', 1, 'a4'],
    ]);
    expect(output.setSourceName).toBe('a.pdf');
    expect(progress.slice(0, 3)).toEqual([
      `Running 2 of 3: ${name}, reading the document locally…`,
      `Running 2 of 3: ${name}, document 1 of 2 locally…`,
      `Running 2 of 3: ${name}, document 2 of 2 locally…`,
    ]);
  });

  test('refuses a one-page document before splitting it', async () => {
    const { adapters, calls } = createAdapters();

    await expect(run({ toolSlug: 'split-pdf' }, { payloads: [], pdfs: [pdf('one.pdf', 1)] }, adapters).result)
      .rejects.toThrow('This PDF has one page, so there is nothing to split it into.');
    expect(calls.map((call) => call.name)).toEqual(['openForSplit']);
  });

  test.each(documentSteps)('%s rewrites each document in hand, keeping its name, pages and page size', async (toolSlug) => {
    const { adapters, calls } = createAdapters();
    const images = [image('kept.jpg')];
    const { result, progress } = run(
      { toolSlug },
      { payloads: images, pdfs: [pdf('a.pdf', 2, 'letter'), pdf('b.pdf', 3)] },
      adapters,
    );
    const output = await result;

    expect(calls).toHaveLength(4);
    expect(output.payloads).toBe(images);
    expect(output.pdfs.map((document) => [document.name, document.pages, document.pageSize])).toEqual([
      ['a.pdf', 2, 'letter'],
      ['b.pdf', 3, 'fit'],
    ]);
    expect(output.setSourceName).toBe('a.pdf');
    expect(progress.filter((message) => message.endsWith('reading the document locally…'))).toEqual([
      `Running 2 of 3: ${nameOf(toolSlug)}, reading the document locally…`,
      `Running 2 of 3: ${nameOf(toolSlug)}, reading the document locally…`,
    ]);
  });

  test.each(documentSteps)('%s refuses a document with no pages before writing it', async (toolSlug) => {
    const { adapters, calls } = createAdapters();

    await expect(run({ toolSlug }, { payloads: [], pdfs: [pdf('empty.pdf', 0)] }, adapters).result).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  test('stamps every page with the chosen word, position and strength', async () => {
    const { adapters, calls } = createAdapters();

    await run(
      { toolSlug: 'watermark-pdf', word: 'draft', markPosition: 'top', strength: 40 },
      { payloads: [], pdfs: [pdf('a.pdf', 3)] },
      adapters,
    ).result;

    expect(calls[1].args[1]).toEqual({ kind: 'text', text: 'DRAFT', fontSize: 64 });
    expect(calls[1].args[2]).toMatchObject({ pages: [1, 2, 3], position: 'top', rotation: 45, opacity: 40 });
  });

  test('numbers every page from one, and turns every page the same way', async () => {
    const numbered = createAdapters();
    await run(
      { toolSlug: 'pdf-page-numbers', numberFormat: 'page-number-of', numberPosition: 'top-right' },
      { payloads: [], pdfs: [pdf('a.pdf', 3)] },
      numbered.adapters,
    ).result;
    expect(numbered.calls[1].args[1]).toMatchObject({ format: 'page-number-of', position: 'top-right' });

    const turned = createAdapters();
    await run({ toolSlug: 'organize-pdf', pageTurn: 'right' }, { payloads: [], pdfs: [pdf('a.pdf', 2)] }, turned.adapters).result;
    expect(turned.calls[1].args[1]).toHaveLength(2);
  });

  test('says which block needed a document it was not handed', async () => {
    for (const toolSlug of ['pdf-to-jpg', 'split-pdf', ...documentSteps] as const) {
      const { adapters, calls } = createAdapters();

      await expect(run({ toolSlug }, { payloads: [], pdfs: [] }, adapters).result)
        .rejects.toThrow(`${nameOf(toolSlug)} needs a PDF from the block before it.`);
      expect(calls).toEqual([]);
    }

    const { adapters } = createAdapters();
    await expect(run({ toolSlug: 'merge-pdf' }, { payloads: [], pdfs: [] }, adapters).result)
      .rejects.toThrow(`${nameOf('merge-pdf')} needs the PDFs this flow started from.`);
  });
});
