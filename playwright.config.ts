import { defineConfig } from '@playwright/test';

/**
 * Deliberately not 4321, which is what `astro dev` and `astro preview` use.
 * Sharing that port is what let a dev server stand in for the build under
 * test, and a suite that passes against yesterday's `dist/` is worse than one
 * that will not start.
 */
const previewPort = process.env.PLAYWRIGHT_PORT ?? '4331';
const previewUrl = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: previewUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm run build && pnpm exec vite preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
    url: previewUrl,
    // Never reuse whatever happens to be listening. Reuse skips the build in
    // the command above, so the suite silently tests a stale `dist/` — which
    // shows up as failures that look like test bugs, or, worse, as passes.
    // With this off, a port already in use fails the run instead.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
