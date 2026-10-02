import { describe, expect, it } from "vitest";

import astroConfig from "../../astro.config.mjs";
import {
  clientModuleMapFile,
  describeClientBundle,
  sourceName,
} from "../../scripts/lib/client-modules.mjs";

const root = "/work/gizlet";

describe("sourceName", () => {
  it("names our own modules relative to the project, without Vite's query", () => {
    expect(sourceName(`${root}/src/scripts/pdf-rendering.ts`, root)).toBe("src/scripts/pdf-rendering.ts");
    expect(
      sourceName(`${root}/src/components/PdfViewerTool.astro?astro&type=script&index=0&lang.ts`, root),
    ).toBe("src/components/PdfViewerTool.astro");
  });

  it("names a dependency by package path, however pnpm nests it", () => {
    expect(
      sourceName(
        `${root}/node_modules/.pnpm/pdfjs-dist@6.3.289/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url`,
        root,
      ),
    ).toBe("pdfjs-dist/build/pdf.worker.min.mjs");
    expect(
      sourceName(
        `${root}/node_modules/.pnpm/@pdf-lib+upng@1.0.1/node_modules/@pdf-lib/upng/UPNG.js`,
        root,
      ),
    ).toBe("@pdf-lib/upng/UPNG.js");
  });

  it("leaves a virtual module's id as the bundler gave it", () => {
    expect(sourceName("\0vite/preload-helper.js", root)).toBe("vite/preload-helper.js");
  });
});

describe("describeClientBundle", () => {
  const bundle = {
    "_astro/PdfViewerTool.abc.js": {
      type: "chunk" as const,
      fileName: "_astro/PdfViewerTool.abc.js",
      moduleIds: [`${root}/src/components/PdfViewerTool.astro?astro&type=script&index=0&lang.ts`],
      modules: {
        [`${root}/src/components/PdfViewerTool.astro?astro&type=script&index=0&lang.ts`]: {
          renderedLength: 3366,
        },
      },
      imports: ["_astro/pdf-viewer.def.js"],
      dynamicImports: ["_astro/pdf-rendering.ghi.js"],
    },
    "_astro/pdf.worker.min.jkl.mjs": {
      type: "asset" as const,
      fileName: "_astro/pdf.worker.min.jkl.mjs",
      originalFileNames: ["node_modules/.pnpm/pdfjs-dist@6.3.289/node_modules/pdfjs-dist/build/pdf.worker.min.mjs"],
    },
    "_astro/BaseLayout.mno.css": {
      type: "asset" as const,
      fileName: "_astro/BaseLayout.mno.css",
    },
  };

  it("maps each served chunk to the modules in it, their size, and what it loads", () => {
    expect(describeClientBundle(bundle, root).chunks).toEqual({
      "/_astro/PdfViewerTool.abc.js": {
        modules: [{ source: "src/components/PdfViewerTool.astro", bytes: 3366 }],
        imports: ["/_astro/pdf-viewer.def.js"],
        dynamicImports: ["/_astro/pdf-rendering.ghi.js"],
      },
    });
  });

  it("maps an emitted asset, such as pdf.js's worker, back to its source", () => {
    expect(describeClientBundle(bundle, root).assets).toEqual({
      "/_astro/pdf.worker.min.jkl.mjs": { sources: ["pdfjs-dist/build/pdf.worker.min.mjs"] },
      "/_astro/BaseLayout.mno.css": { sources: [] },
    });
  });
});

describe("the client module map", () => {
  it("is written outside dist/, so it is never deployed", () => {
    expect(clientModuleMapFile.startsWith("node_modules/")).toBe(true);
    expect(clientModuleMapFile.startsWith(astroConfig.outDir ?? "dist")).toBe(false);
  });

  it("is recorded by every production build", () => {
    const plugins = (astroConfig.vite?.plugins ?? []).flat();
    expect(plugins.map((plugin) => plugin && "name" in plugin && plugin.name)).toContain(
      "gizlet:client-module-map",
    );
  });
});
