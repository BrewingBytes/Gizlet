import { expect, test } from "@playwright/test";

import {
  getAvailableTools,
  toolRegistry,
  type AvailableToolSlug,
} from "../../src/data/tools";

/**
 * A control that only that Gizlet's own workspace renders. Keyed by the
 * registry's available slugs, so a new Gizlet cannot join without one.
 */
const workspaceSignatures = {
  "compress-image": "Select an image to compress",
  "resize-image": "Select an image to resize",
  "convert-image": "Select an image to convert",
  "crop-image": "Select an image to crop",
  "collage-maker": "Select images for a collage",
  "rotate-flip-image": "Select an image to rotate or flip",
  "image-background": "Select an image to put on a background",
  "remove-image-metadata": "Select an image to inspect",
  "image-dimensions": "Select an image to measure",
  "json-ld-generator": "Schema type",
  "json-formatter": "JSON input",
  "jpg-to-pdf": "Select images to put in a PDF",
  "pdf-viewer": "Select a PDF to open",
  "merge-pdf": "Select PDFs to merge",
  "pdf-to-jpg": "Select a PDF to convert",
  "split-pdf": "Select a PDF to split",
} as const satisfies Record<AvailableToolSlug, string>;

for (const tool of getAvailableTools()) {
  test(`renders the ${tool.name} workspace on its own Gizlet page`, async ({
    page,
  }) => {
    await page.goto(tool.path);

    await expect(page.getByLabel(`${tool.name} workspace`)).toBeAttached();
    await expect(
      page.getByLabel(workspaceSignatures[tool.slug]),
    ).toBeAttached();
    await expect(
      page.getByRole("heading", { name: "This Gizlet is not built yet." }),
    ).toHaveCount(0);
  });
}

test("renders the reusable tool page layout without reserved ad space while ads are disabled", async ({
  page,
}) => {
  await page.goto("/tools/compress-image/");

  await expect(page).toHaveTitle("Compress Image | Gizlet");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Shrink image files while keeping them ready to share.",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gizlet.app/tools/compress-image/",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://gizlet.app/tools/compress-image/",
  );
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Compress Image");
  await expect(
    page.getByRole("heading", { level: 1, name: "Compress Image" }),
  ).toBeVisible();
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your file stays on this device.",
  );
  await expect(page.getByLabel("Compress Image workspace")).toBeVisible();
  await expect(page.locator('[data-ad-slot]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Related Gizlets" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Resize Image/ })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("lists every available Gizlet on a browsable index", async ({ page }) => {
  await page.goto("/tools/");

  await expect(page).toHaveTitle("All Gizlets | Gizlet");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gizlet.app/tools/",
  );
  await expect(
    page.getByRole("heading", { name: "All the Gizlets, by kind of job." }),
  ).toBeVisible();
  // The page describes two kinds of thing now, so it no longer claims to list
  // only what is available or that a category appears once a Gizlet exists.
  await expect(page.getByRole("main")).toContainText(
    "what we have not built yet is listed after them",
  );
  await expect(
    page.getByText("Categories appear here once a Gizlet exists for them"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Images" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "PDF" }),
  ).toBeVisible();
  const formatter = toolRegistry.find((tool) => tool.slug === "json-formatter")!;
  await expect(
    page.getByRole("main").getByRole("link", { name: /JSON Formatter/ }),
  ).toHaveAttribute("href", "/tools/json-formatter/");
  // A live row prints its registry number, which is what makes the em dash on a
  // not-built row mean something.
  await expect(
    page.getByRole("main").getByRole("link", { name: /JSON Formatter/ }),
  ).toContainText(String(formatter.id).padStart(3, "0"));
});

test("publishes structured data search engines can read", async ({ page }) => {
  await page.goto("/tools/compress-image/");

  const toolMarkup = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .textContent()) as string,
  );
  expect(toolMarkup[0]["@type"]).toBe("SoftwareApplication");
  expect(toolMarkup[0].name).toBe("Compress Image");
  expect(toolMarkup[0].url).toBe("https://gizlet.app/tools/compress-image/");
  expect(toolMarkup[1]["@type"]).toBe("BreadcrumbList");

  await page.goto("/");
  const siteMarkup = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .textContent()) as string,
  );
  expect(siteMarkup["@type"]).toBe("WebSite");
});

test("keeps the workspace above the supporting content at every width", async ({
  page,
}) => {
  await page.goto("/tools/compress-image/");

  const workspace = page.getByLabel("Compress Image workspace");
  const firstSection = page.getByRole("heading", {
    level: 2,
    name: "What Compress Image does",
  });
  const faqQuestion = page.getByRole("heading", {
    level: 3,
    name: "Why does the quality slider do nothing for PNG?",
  });

  const markup = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .textContent()) as string,
  );
  const faqMarkup = markup.find(
    (item: { "@type": string }) => item["@type"] === "FAQPage",
  );
  expect(faqMarkup.mainEntity).toHaveLength(5);

  for (const question of faqMarkup.mainEntity) {
    await expect(
      page.getByRole("heading", { level: 3, name: question.name }),
    ).toBeVisible();
    await expect(
      page.getByText(question.acceptedAnswer.text, { exact: true }),
    ).toBeVisible();
  }

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });

    const workspaceBox = (await workspace.boundingBox())!;
    const sectionBox = (await firstSection.boundingBox())!;
    const faqBox = (await faqQuestion.boundingBox())!;

    expect(sectionBox.y, `${width}px`).toBeGreaterThan(
      workspaceBox.y + workspaceBox.height,
    );
    expect(faqBox.y, `${width}px`).toBeGreaterThan(sectionBox.y);
  }
});
