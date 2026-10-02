import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Page, TestInfo } from "@playwright/test";

import { clientModuleMapFile, type ClientModuleMap } from "../../../scripts/lib/client-modules.mjs";

/**
 * Which JavaScript a built page actually fetches, and what is inside it
 * (BRE-41).
 *
 * `initial-scripts.ts` asks whether pdf.js is in a page by looking for its
 * worker's filename in the bodies. That works for one library; it cannot say
 * whose code a chunk is, and a chunk is named after whichever module the
 * bundler chose. This reads the map the build wrote (scripts/lib/client-modules.mjs)
 * instead, so every request comes back as the source modules it carries.
 */

export interface ScriptRequest {
  /** The served path, `/_astro/<name>.<hash>.js`. */
  readonly path: string;
  /** The decoded body, as the page received it. */
  readonly bytes: number;
  /** Repo-relative modules for our code, `package/path` for dependencies. */
  readonly sources: readonly string[];
}

const readClientModuleMap = (): ClientModuleMap =>
  JSON.parse(readFileSync(join(process.cwd(), clientModuleMapFile), "utf8"));

/**
 * Starts recording every same-site script and worker the page fetches, and
 * aborts anything bound for another origin. Advertising and analytics are off
 * unless their `PUBLIC_*` variables are set, so nothing should be aborted;
 * `blocked` says whether that held rather than letting a provider's script
 * into the measurement.
 *
 * `take()` returns what arrived since the previous call, which is how a test
 * separates what a page loads on arrival from what one interaction fetches.
 */
export const recordScriptRequests = async (page: Page, baseURL: string) => {
  const map = readClientModuleMap();
  const origin = new URL(baseURL).origin;
  const pending: Promise<ScriptRequest>[] = [];
  const blocked: string[] = [];
  const unmapped: string[] = [];
  let taken = 0;

  await page.route(
    (url) => url.origin !== origin,
    (route) => {
      blocked.push(route.request().url());
      return route.abort();
    },
  );

  page.on("response", (response) => {
    const { origin: from, pathname: path } = new URL(response.url());
    if (from !== origin || !path.startsWith("/_astro/") || !/\.m?js$/.test(path)) return;

    const sources = map.chunks[path]?.modules.map((module) => module.source) ?? map.assets[path]?.sources;
    if (!sources) {
      unmapped.push(path);
      return;
    }

    pending.push(
      response
        .body()
        .then((body) => body.length)
        // A worker's script is fetched by the worker, and Chromium does not
        // always hand its body back to the page. The header is the same bytes.
        .catch(() => Number(response.headers()["content-length"] ?? Number.NaN))
        .then((bytes) => ({ path, bytes, sources })),
    );
  });

  return {
    blocked,
    /**
     * Files the map has never heard of. The map is rewritten by every build,
     * so anything here means it came from a different build than `dist/`.
     */
    unmapped,
    async take(): Promise<readonly ScriptRequest[]> {
      const settled = await Promise.all(pending);
      const fresh = settled.slice(taken);
      taken = settled.length;
      return fresh;
    },
  };
};

/** Every source module a set of requests delivered. */
export const sourcesIn = (requests: readonly ScriptRequest[]) =>
  new Set(requests.flatMap((request) => request.sources));

/**
 * The heavyweight code each lazy-loading contract keeps out of a page until
 * it is needed. pdf.js and its worker reach a page only once there is a PDF
 * to draw; pdf-lib only once there is one to write; the archive reader and
 * writer only once Extract Archive or Create ZIP is used; the canvas image
 * pipeline only on the image Gizlets.
 *
 * `src/data/zip-archive.ts` is not on the list: it is the small shared ZIP
 * layout every batch download uses, Compress Image's included.
 */
export const heavyweightCode = {
  "pdf.js": (source: string) => source.startsWith("pdfjs-dist/"),
  "pdf-lib": (source: string) => source.startsWith("pdf-lib/") || source.startsWith("@pdf-lib/"),
  archive: (source: string) =>
    ["src/scripts/archive-reading.ts", "src/scripts/zip-writing.ts"].includes(source),
  "image processing": (source: string) => source === "src/scripts/image-processing.ts",
} as const;

export type HeavyweightCode = keyof typeof heavyweightCode;

/** Which of the heavyweight families a set of requests delivered. */
export const heavyweightIn = (requests: readonly ScriptRequest[]) => {
  const sources = [...sourcesIn(requests)];
  return (Object.keys(heavyweightCode) as HeavyweightCode[]).filter((family) =>
    sources.some(heavyweightCode[family]),
  );
};

/**
 * Every workspace component the tool route can dispatch to, read from the
 * route's own imports so a new Gizlet is covered without editing this file.
 */
export const workspaceComponents = () => {
  const route = readFileSync(join(process.cwd(), "src/pages/tools/[slug].astro"), "utf8");
  return new Set(
    [...route.matchAll(/^import \w+ from '\.\.\/\.\.\/components\/(\w+)\.astro';$/gm)]
      .map(([, component]) => `src/components/${component}.astro`)
      .filter((component) => component !== "src/components/ToolPageLayout.astro"),
  );
};

/** The workspace components among the sources a set of requests delivered. */
export const workspacesIn = (requests: readonly ScriptRequest[]) => {
  const workspaces = workspaceComponents();
  return [...sourcesIn(requests)].filter((source) => workspaces.has(source)).sort();
};

const kilobytes = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

/**
 * Writes one stage's measurement where the HTML report and CI's log both show
 * it: the requests, their decoded size, and the modules in each. It is a
 * record of what the build did, not a budget; nothing here fails on a size.
 */
export const reportStage = async (
  testInfo: TestInfo,
  stage: string,
  requests: readonly ScriptRequest[],
) => {
  const total = requests.reduce((sum, request) => sum + request.bytes, 0);
  const lines = [
    `${stage}: ${requests.length} script request(s), ${kilobytes(total)} decoded`,
    ...requests.map(
      (request) => `  ${request.path}  ${kilobytes(request.bytes)}  ${summariseSources(request.sources)}`,
    ),
  ];

  console.log(lines.join("\n"));
  await testInfo.attach(`scripts: ${stage}`, {
    body: JSON.stringify({ stage, totalBytes: total, requests }, null, 2),
    contentType: "application/json",
  });
};

/** Our own modules by name; a dependency by package, with its module count. */
const summariseSources = (sources: readonly string[]) => {
  const ours = sources.filter((source) => source.startsWith("src/"));
  const packages = new Map<string, number>();
  for (const source of sources) {
    if (source.startsWith("src/")) continue;
    const parts = source.split("/");
    const name = source.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    packages.set(name, (packages.get(name) ?? 0) + 1);
  }
  return [...ours, ...[...packages].map(([name, count]) => `${name} (${count})`)].join(", ");
};
