import { expect, test } from "@playwright/test";

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
  });

  expect(llms.headers()["content-type"]).toContain("text/plain");
  await expect(llms).toBeOK();
  await expect(llms.text()).resolves.toContain(
    "[Machine-readable tool catalogue](https://gizlet.app/tools.json)",
  );
  await expect(llms.text()).resolves.toContain(
    "[Compress Image](https://gizlet.app/tools/compress-image/)",
  );
});
