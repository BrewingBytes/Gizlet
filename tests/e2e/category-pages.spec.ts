import { existsSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { getToolCategoryPage } from "../../src/data/tool-categories";

const pdf = getToolCategoryPage("pdf")!;

test("renders a multi-Gizlet category as a page of its own", async ({ page }) => {
  await page.goto("/categories/pdf/");

  await expect(page).toHaveTitle("PDF tools | Gizlet");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gizlet.app/categories/pdf/",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", pdf.description);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PDF tools");

  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.getByRole("link", { name: "Gizlet" })).toHaveAttribute("href", "/");
  await expect(breadcrumb.getByRole("link", { name: "Tools" })).toHaveAttribute("href", "/tools/");
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("PDF");

  await expect(page.getByText("All 10 Gizlets here work in your browser")).toBeVisible();

  // The guidance links every Gizlet in the category to its own page.
  const choices = page.locator(".category-page__choices");
  await expect(choices.locator("dt")).toHaveCount(pdf.guidance.length);
  await expect(choices.getByRole("link", { name: "Merge PDF" })).toHaveAttribute("href", "/tools/merge-pdf/");
  await expect(choices.getByRole("link", { name: "Sign PDF" })).toHaveAttribute("href", "/tools/sign-pdf/");

  // The visible list and the structured data name the same Gizlets, in order.
  const rows = page.getByRole("region", { name: "Every PDF Gizlet" }).getByRole("listitem");
  await expect(rows).toHaveCount(10);
  const visible = await rows.locator("strong").allTextContents();
  const hrefs = await rows.getByRole("link").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );

  const [collection, breadcrumbs] = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) as string,
  );
  expect(collection["@type"]).toBe("CollectionPage");
  expect(collection.url).toBe("https://gizlet.app/categories/pdf/");
  expect(collection.mainEntity.numberOfItems).toBe(visible.length);
  expect(collection.mainEntity.itemListElement.map((item: { name: string }) => item.name)).toEqual(visible);
  expect(collection.mainEntity.itemListElement.map((item: { url: string }) => new URL(item.url).pathname)).toEqual(
    hrefs,
  );
  expect(breadcrumbs["@type"]).toBe("BreadcrumbList");
  expect(breadcrumbs.itemListElement[2].name).toBe("PDF");

  // Nothing planned is listed, and no planned-only category is offered.
  const elsewhere = page.getByRole("navigation", { name: "Other categories" });
  await expect(elsewhere.getByRole("link", { name: "Image tools" })).toHaveAttribute("href", "/categories/images/");
  await expect(elsewhere.getByRole("link", { name: /Video/ })).toHaveCount(0);
});

test("generates no page for a category whose Gizlets are all planned", async ({ page, request }) => {
  // The build writes nothing for it. The preview server answers an unknown path
  // with its fallback document rather than a 404, so the page it serves is
  // checked for being anything but a category page.
  expect(existsSync("dist/categories/video")).toBe(false);
  expect(existsSync("dist/categories/pdf/index.html")).toBe(true);

  await page.goto("/categories/video/");
  await expect(page.locator(".category-page")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Video tools/ })).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).not.toHaveAttribute(
    "href",
    "https://gizlet.app/categories/video/",
  );

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://gizlet.app/categories/pdf/</loc>");
  expect(sitemap).not.toContain("/categories/video/");

  // A planned Gizlet in that category keeps a plain category label.
  await page.goto("/tools/trim-video/");
  await expect(page.locator(".tool-page__header > .metadata")).toHaveText("video");
  await expect(page.locator(".tool-page__header > .metadata").getByRole("link")).toHaveCount(0);
});

test("keeps the index's jump navigation and links each group to its page", async ({ page }) => {
  await page.goto("/tools/");

  const jump = page.getByRole("navigation", { name: "Jump to a category" });
  await expect(jump.getByRole("link", { name: "PDF" })).toHaveAttribute("href", "/tools/#pdf");
  await jump.getByRole("link", { name: "PDF" }).click();
  await expect(page).toHaveURL(/\/tools\/#pdf$/);
  await expect(page.locator("#pdf")).toBeInViewport();

  await page.locator("#pdf").getByRole("link", { name: "PDF tools guide" }).click();
  await expect(page).toHaveURL(/\/categories\/pdf\/$/);

  await page.goto("/tools/merge-pdf/");
  await expect(page.locator(".tool-page__header > .metadata").getByRole("link", { name: "pdf" })).toHaveAttribute(
    "href",
    "/categories/pdf/",
  );
});
