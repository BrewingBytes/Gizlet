import { defineConfig } from '@playwright/test';

const previewPort = process.env.PLAYWRIGHT_PORT ?? '4321';
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
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
