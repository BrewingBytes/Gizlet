import { deflateRawSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getArchiveFiles, readArchiveEntries } from '../../src/data/extract-archive';
import { createZipArchive } from '../../src/data/zip-archive';
import { extractEntries, readBoundedOutput, unpackEntry } from '../../src/scripts/archive-reading';

const encoder = new TextEncoder();
const fixture = (deflated = false) => {
  const data = encoder.encode('hello');
  const archive = createZipArchive([
    { name: 'a.txt', data, deflated: deflated ? deflateRawSync(data) : undefined },
    { name: 'b.txt', data },
  ]);
  return { archive, files: getArchiveFiles(readArchiveEntries(archive)) };
};

afterEach(() => vi.unstubAllGlobals());

const enableFrames = () => vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  callback(0);
  return 1;
});

describe('bounded archive output', () => {
  it('cancels before retaining an oversized chunk or reading the remaining output', async () => {
    let pulls = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(3));
      },
      cancel,
    }, { highWaterMark: 0 });
    await expect(readBoundedOutput(stream, 5)).rejects.toThrow('extraction size limit');
    expect(pulls).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });

  it('accepts exact-boundary output and empty output', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });
    expect(await readBoundedOutput(stream, 3)).toEqual(new Uint8Array([1, 2, 3]));
    expect(await readBoundedOutput(new ReadableStream({ start: (c) => c.close() }), 0))
      .toEqual(new Uint8Array());
  });

  it('preserves stream failures and releases its reader', async () => {
    const stream = new ReadableStream<Uint8Array>({ pull: (c) => c.error(new Error('broken stream')) });
    await expect(readBoundedOutput(stream, 5)).rejects.toThrow('broken stream');
    expect(stream.locked).toBe(false);
  });

  it.each([false, true])('refuses understated output for deflated=%s', async (deflated) => {
    const { archive, files } = fixture(deflated);
    await expect(unpackEntry(archive, { ...files[0], size: 2 })).rejects.toThrow('declared size');
    await expect(unpackEntry(archive, files[0], 4)).rejects.toThrow('extraction size limit');
    expect(await unpackEntry(archive, files[0], 5)).toEqual(encoder.encode('hello'));
  });

  it('preflights the total before reading any file', async () => {
    const { archive, files } = fixture();
    const onFile = vi.fn();
    await expect(extractEntries(archive, 'test.zip', files, [0, 1], { maximumBytes: 9, onFile }))
      .rejects.toThrow('extraction size limit');
    expect(onFile).not.toHaveBeenCalled();
  });

  it('allows a total exactly at the limit, then a smaller selection after refusal', async () => {
    enableFrames();
    const { archive, files } = fixture(true);
    const result = await extractEntries(archive, 'test.zip', files, [0, 1], { maximumBytes: 10 });
    expect(result.bytes).toBe(10);
    await expect(extractEntries(archive, 'test.zip', files, [0, 1], { maximumBytes: 5 })).rejects.toThrow();
    const single = await extractEntries(archive, 'test.zip', files, [1], { maximumBytes: 5 });
    expect(await single.blob.text()).toBe('hello');
  });

  it('rejects partial multi-file results when a later entry understates its size', async () => {
    enableFrames();
    const { archive, files } = fixture();
    await expect(extractEntries(archive, 'test.zip', [files[0], { ...files[1], size: 1 }], [0, 1], { maximumBytes: 6 }))
      .rejects.toThrow('declared size');
  });
});
