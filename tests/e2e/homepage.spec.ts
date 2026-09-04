import { expect, test } from "@playwright/test";

test("renders the Gizlet homepage", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(
    "Gizlet | Useful internet things, without the nonsense.",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gizlet.app/",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://gizlet.app/brand/social/home.png",
  );
  // The description has to say what the Gizlets do, or a search engine writes
  // its own snippet out of whatever text the page happens to show.
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Compress an image, resize a photo/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  await expect(
    page.getByRole("heading", {
      name: "Useful internet things, without the nonsense.",
    }),
  ).toBeVisible();
  await expect(page.locator('script[src*="plausible.io"]')).toHaveCount(0);
  await expect(
    page.locator('script[src*="static.cloudflareinsights.com"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('script[src*="pagead2.googlesyndication.com"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-ad-slot]')).toHaveCount(0);
});

test("renders the editorial homepage content from the tool registry", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("search").getByLabel("I need to…"),
  ).toHaveAttribute(
    "placeholder",
    "compress a photo, resize an image, format JSON…",
  );
  await expect(page.locator('[data-ad-slot-variant="banner"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Popular Gizlets" }),
  ).toBeVisible();

  for (const toolName of [
    "Compress Image",
    "Resize Image",
    "Convert Image",
    "JSON-LD Generator",
    "JSON Formatter",
    "Image to PDF",
    "PDF Viewer",
  ]) {
    await expect(
      page.getByRole("link", { name: new RegExp(toolName) }),
    ).toBeVisible();
  }

  await expect(
    page.getByRole("navigation", { name: "Browse tool categories" }),
  ).toContainText("Images");
  await expect(page.getByText("Gizlet Pro")).toHaveCount(0);
});

test("links Gizlet cards to canonical trailing-slash routes", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: /Compress Image/ }).first(),
  ).toHaveAttribute("href", "/tools/compress-image/");
  await expect(
    page.getByRole("link", { name: /Resize Image/ }).first(),
  ).toHaveAttribute("href", "/tools/resize-image/");
  await expect(
    page.getByRole("link", { name: /Convert Image/ }).first(),
  ).toHaveAttribute("href", "/tools/convert-image/");
});

test("finds Gizlets from the homepage search by intent", async ({ page }) => {
  await page.goto("/");

  const searchForm = page.getByRole("search");
  const search = searchForm.getByLabel("I need to…");
  await search.fill("compress photo");
  await expect(
    searchForm.getByRole("link", { name: /Compress Image/ }),
  ).toBeVisible();
  await expect(
    searchForm.getByRole("link", { name: /Compress Image/ }),
  ).toHaveAttribute("href", "/tools/compress-image/");
  await expect(searchForm.getByText("1 Gizlet found.")).toBeVisible();

  await search.fill("spreadsheet");
  await expect(
    searchForm.getByText("No Gizlets found for “spreadsheet”."),
  ).toBeVisible();
});

test("opens, navigates, and closes the global search overlay with the keyboard", async ({
  page,
}) => {
  await page.goto("/");

  const overlay = page.getByRole("dialog", { name: "What do you need?" });
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Search Gizlet" })
    .click();
  await expect(overlay).toBeVisible();
  await expect(
    overlay.getByText("Start typing to find a Gizlet."),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(overlay).not.toBeVisible();

  await page.keyboard.press("ControlOrMeta+K");
  await expect(overlay).toBeVisible();

  const search = overlay.getByLabel("Search Gizlets");
  await expect(search).toBeFocused();
  await search.fill("schema");
  await expect(
    overlay.getByRole("link", { name: /JSON-LD Generator/ }),
  ).toBeVisible();

  await search.press("ArrowDown");
  await expect(
    overlay.getByRole("link", { name: /JSON-LD Generator/ }),
  ).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(overlay).not.toBeVisible();
});

test("does not steal the search shortcut from a text field", async ({
  page,
}) => {
  await page.goto("/");

  const search = page.getByRole("search").getByLabel("I need to…");
  await search.focus();
  await page.keyboard.press("ControlOrMeta+K");

  await expect(search).toBeFocused();
  await expect(
    page.getByRole("dialog", { name: "What do you need?" }),
  ).not.toBeVisible();
});

test("provides accessible shared navigation", async ({ page }) => {
  await page.goto("/");

  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Gizlet home" })).toBeVisible();
  await expect(
    header.getByRole("navigation", { name: "Primary navigation" }),
  ).toContainText("Tools");
  await expect(header.getByRole("link", { name: "Flows" })).toBeVisible();
  await expect(
    header.getByRole("button", { name: "Search Gizlet" }),
  ).toBeVisible();
  await expect(
    header.getByRole("button", { name: "Search Gizlet" }),
  ).toContainText("⌘K / Ctrl K");
  await expect(
    header.getByRole("button", { name: /Switch to (light|dark) theme/ }),
  ).toBeVisible();

  await header.getByRole("link", { name: "Gizlet home" }).focus();
  await expect(header.getByRole("link", { name: "Gizlet home" })).toBeFocused();

  await expect(page.getByRole("contentinfo")).toContainText(
    "A little tool for everything.",
  );

  // Gizlet Pro does not exist, so neither the shell nor any page may link to it.
  await expect(page.locator('a[href*="#pro"]')).toHaveCount(0);
});

test("keeps the shared shell usable on mobile widths", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("banner").getByRole("button", { name: "Search Gizlet" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("banner")
      .getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("allows keyboard users to skip shared navigation", async ({ page }) => {
  await page.goto("/");

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("uses the system theme on a first visit", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".site-logo__dark")).toBeVisible();
  await expect(page.locator(".site-logo__light")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to light theme" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("persists an explicitly selected theme across reloads", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".site-logo__light")).toBeVisible();
  await expect(page.locator(".site-logo__dark")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to dark theme" }),
  ).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("labels the theme toggle without shifting the page after load", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    (window as unknown as { __layoutShift: number }).__layoutShift = 0;
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) {
          (window as unknown as { __layoutShift: number }).__layoutShift +=
            entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Switch to dark theme" });
  await expect(toggle).toHaveText("Dark", { useInnerText: true });

  const shift = await page.evaluate(
    () => (window as unknown as { __layoutShift: number }).__layoutShift,
  );
  expect(shift).toBeLessThan(0.05);
});

test("offers only categories that have a Gizlet behind them", async ({
  page,
}) => {
  await page.goto("/");

  const categories = page.getByRole("navigation", {
    name: "Browse tool categories",
  });
  await expect(categories.getByRole("link", { name: /Images/ })).toHaveAttribute(
    "href",
    "/tools/#images",
  );
  await expect(
    categories.getByRole("link", { name: "All Gizlets" }),
  ).toHaveAttribute("href", "/tools/");
  await expect(categories.getByRole("link", { name: /PDF/ })).toHaveAttribute(
    "href",
    "/tools/#pdf",
  );
  await expect(categories.getByRole("link", { name: /Video/ })).toHaveCount(0);
  await expect(categories.getByRole("link", { name: /Audio/ })).toHaveCount(0);
});

test("applies a stored theme before the first paint", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    window.localStorage.setItem("gizlet-theme", "light");
    (window as unknown as { __themeAtParse: (string | null)[] }).__themeAtParse =
      [];
    document.addEventListener("readystatechange", () => {
      (
        window as unknown as { __themeAtParse: (string | null)[] }
      ).__themeAtParse.push(document.documentElement.dataset.theme ?? null);
    });
  });
  await page.goto("/");

  const themeAtParse = await page.evaluate(
    () =>
      (window as unknown as { __themeAtParse: (string | null)[] })
        .__themeAtParse,
  );
  expect(themeAtParse[0]).toBe("light");
});
