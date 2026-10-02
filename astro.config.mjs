// @ts-check
import { defineConfig } from 'astro/config';

import { clientModuleMap } from './scripts/lib/client-modules.mjs';

export default defineConfig({
  output: 'static',
  site: 'https://gizlet.app',
  trailingSlash: 'always',
  vite: {
    // Writes which source modules each browser file carries to
    // node_modules/.cache/, for tests/e2e/script-loading.spec.ts. It changes
    // nothing in dist/.
    plugins: [clientModuleMap()],
  },
});
