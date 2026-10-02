/**
 * Which source modules each emitted browser file carries (BRE-41).
 *
 * `src/pages/tools/[slug].astro` imports every workspace component into one
 * dispatch map, and the built pages are what say whether that drags other
 * Gizlets' code along. A request for `/_astro/<name>.<hash>.js` says nothing
 * about what is inside it, and a chunk is named after whichever module the
 * bundler picked, so the browser tests read this map instead: emitted file to
 * the repo-relative modules rolled into it, as the bundler reported them.
 *
 * The map is written to `node_modules/.cache/gizlet/`, outside `dist/`, so it
 * is never deployed and never changes what a visitor receives. Every build
 * rewrites it, which is what lets a test tell a stale map from a real one:
 * a requested file the map has never heard of is a map from another build.
 *
 * `describeClientBundle` is pure so tests/unit/client-modules.test.ts can
 * cover it with small bundle fixtures; `clientModuleMap` is the plugin that
 * feeds it the client build's real bundle.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/**
 * @typedef {{ source: string, bytes: number }} ModuleShare
 * @typedef {{ modules: ModuleShare[], imports: string[], dynamicImports: string[] }} EmittedChunk
 * @typedef {{ sources: string[] }} EmittedAsset
 * @typedef {{ chunks: Record<string, EmittedChunk>, assets: Record<string, EmittedAsset> }} ClientModuleMap
 * @typedef {{
 *   type: 'chunk',
 *   fileName: string,
 *   moduleIds: readonly string[],
 *   modules: Record<string, { renderedLength: number }>,
 *   imports: readonly string[],
 *   dynamicImports: readonly string[],
 * }} BundleChunk
 * @typedef {{ type: 'asset', fileName: string, originalFileNames?: readonly string[] }} BundleAsset
 */

/** Where the map lands, relative to the project root. */
export const clientModuleMapFile = 'node_modules/.cache/gizlet/client-modules.json';

/**
 * A module id as a contributor would name it: repo-relative for our own
 * files, `package/path` for a dependency however pnpm nests it, with Vite's
 * query suffixes (`?astro&type=script…`, `?url`) dropped.
 *
 * @param {string} id
 * @param {string} root absolute project root
 */
export function sourceName(id, root) {
  const path = id.replace(/^\0/, '').split('?')[0];
  const dependency = path.split(`${sep}node_modules${sep}`).at(-1);
  if (dependency !== path && path.startsWith(root)) {
    return dependency.split(sep).join('/');
  }
  if (path.startsWith(root)) return relative(root, path).split(sep).join('/');
  return path;
}

/** @param {string} fileName */
const servedPath = (fileName) => `/${fileName.split(sep).join('/')}`;

/**
 * @param {Record<string, BundleChunk | BundleAsset>} bundle
 * @param {string} root absolute project root
 * @returns {ClientModuleMap}
 */
export function describeClientBundle(bundle, root) {
  /** @type {ClientModuleMap} */
  const map = { chunks: {}, assets: {} };

  for (const output of Object.values(bundle)) {
    if (output.type === 'chunk') {
      map.chunks[servedPath(output.fileName)] = {
        modules: output.moduleIds.map((id) => ({
          source: sourceName(id, root),
          bytes: output.modules[id]?.renderedLength ?? 0,
        })),
        imports: output.imports.map(servedPath),
        dynamicImports: output.dynamicImports.map(servedPath),
      };
    } else {
      map.assets[servedPath(output.fileName)] = {
        sources: (output.originalFileNames ?? []).map((name) => sourceName(join(root, name), root)),
      };
    }
  }

  return map;
}

/**
 * Records the client build's bundle. It only reads the bundle, so the files
 * in `dist/` are byte-for-byte what they would be without it.
 *
 * @returns {import('vite').Plugin}
 */
export function clientModuleMap() {
  /** @type {string} */
  let root = '';

  return {
    name: 'gizlet:client-module-map',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    configResolved(config) {
      root = config.root;
    },
    generateBundle(_options, bundle) {
      const file = join(root, clientModuleMapFile);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(
        file,
        `${JSON.stringify(describeClientBundle(/** @type {any} */ (bundle), root), null, 2)}\n`,
      );
    },
  };
}

