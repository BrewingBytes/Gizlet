import { expect, test } from "@playwright/test";

import { getPlannedTools } from "../../src/data/tools";

const [planned] = getPlannedTools();

test("serves public sitemap and crawler-discovery files", async ({
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  const robots = await request.get("/robots.txt");
  const catalogue = await request.get("/tools.json");
  const llms = await request.get("/llms.txt");

  expect(sitemap.headers()["content-type"]).toContain("xml");
  await expect(sitemap).toBeOK();
  await expect(sitemap.text()).resolves.toContain(
    "https://gizlet.app/tools/compress-image/",
  );
  await expect(sitemap.text()).resolves.toContain(
    "https://gizlet.app/tools/json-ld-generator/",
  );
  await expect(sitemap.text()).resolves.toContain("https://gizlet.app/flows/");
  await expect(sitemap.text()).resolves.toContain("https://gizlet.app/privacy/");

  expect(robots.headers()["content-type"]).toContain("text/plain");
  await expect(robots).toBeOK();
  await expect(robots.text()).resolves.toContain(
    "Sitemap: https://gizlet.app/sitemap.xml",
  );

  expect(catalogue.headers()["content-type"]).toContain("application/json");
  await expect(catalogue).toBeOK();
  await expect(catalogue.json()).resolves.toMatchObject({
    catalogueUrl: "https://gizlet.app/tools.json",
    tools: expect.arrayContaining([
      expect.objectContaining({
        slug: "compress-image",
        route: "https://gizlet.app/tools/compress-image/",
        availability: "available",
        localProcessing: true,
      }),
    ]),
    // A separate key, a separate shape: nothing under `planned` says what to
    // send it or what it hands back, because it does neither.
    planned: expect.arrayContaining([
      expect.objectContaining({
        slug: planned.slug,
        route: `https://gizlet.app${planned.path}`,
        availability: "planned",
        roadmapUrl: expect.stringContaining("https://gizlet.app/roadmap/#phase-"),
      }),
    ]),
  });

  const catalogueBody = await catalogue.json();
  expect(catalogueBody.plannedNotice).toContain("are not built");
  expect(catalogueBody.tools.map((tool: { slug: string }) => tool.slug)).not.toContain(
    planned.slug,
  );
  for (const entry of catalogueBody.planned) {
    expect(entry).not.toHaveProperty("localProcessing");
    expect(entry).not.toHaveProperty("input");
    expect(entry).not.toHaveProperty("output");
  }

  expect(llms.headers()["content-type"]).toContain("text/plain");
  await expect(llms).toBeOK();
  await expect(llms.text()).resolves.toContain(
    "[Machine-readable tool catalogue](https://gizlet.app/tools.json)",
  );
  await expect(llms.text()).resolves.toContain(
    "[Compress Image](https://gizlet.app/tools/compress-image/)",
  );
  // Plaintext has no keys, so the planned half needs a heading that carries the
  // whole claim, and its lines are deliberately not Markdown links.
  await expect(llms.text()).resolves.toContain("## Planned Gizlets — not available");
  await expect(llms.text()).resolves.toContain(
    `- ${planned.name} (https://gizlet.app${planned.path}):`,
  );
  await expect(llms.text()).resolves.not.toContain(`[${planned.name}](`);

  // A planned route is noindex and absent from the sitemap.
  await expect(sitemap.text()).resolves.not.toContain(
    `https://gizlet.app${planned.path}`,
  );
});
