import { expect, test, type TestInfo } from '@playwright/test';
import { build } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
async function bundleBrowserEntry(testInfo: TestInfo): Promise<string> {
  const outputDirectory = testInfo.outputPath('image-target-size-browser');
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      emptyOutDir: true,
      lib: {
        entry: resolve(testDirectory, 'support/image-target-size-browser.ts'),
        formats: ['iife'],
        name: 'ImageTargetSizeBrowserCheck',
        fileName: 'target-size-engine',
      },
      outDir: outputDirectory,
    },
  });
  return resolve(outputDirectory, 'target-size-engine.iife.js');
}

for (const format of ['image/jpeg', 'image/webp'] as const) {
  test(`keeps real-browser ${format} target candidates within the requested bytes`, async ({ page }, testInfo) => {
    await page.goto('/');
    await page.addScriptTag({ path: await bundleBrowserEntry(testInfo) });
    const targetBytes = 2_000;
    const result = await page.evaluate(
      ({ requestedFormat, target }) => window.runImageTargetSizeBrowserCheck!(requestedFormat, target),
      { requestedFormat: format, target: targetBytes },
    );

    expect(result.kind).toBe('met');
    expect(result.actualBytes).toBeLessThanOrEqual(targetBytes);
    expect(result.actualBytes).toBe(result.blobBytes);
    expect(result.type).toBe(format);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.width).toBe(128);
    expect(result.height).toBe(96);
  });

  test(`returns a bounded real-browser ${format} candidate when no target can be met`, async ({ page }, testInfo) => {
    await page.goto('/');
    await page.addScriptTag({ path: await bundleBrowserEntry(testInfo) });
    const result = await page.evaluate(
      (requestedFormat) => window.runImageTargetSizeBrowserCheck!(requestedFormat, 1),
      format,
    );

    expect(result.kind).toBe('unmet');
    expect(result.actualBytes).toBe(result.blobBytes);
    expect(result.actualBytes).toBeGreaterThan(1);
    expect(result.attempts).toBeGreaterThan(1);
    expect(result.attempts).toBeLessThanOrEqual(10);
    expect(result.width).toBe(128);
    expect(result.height).toBe(96);
  });
}
