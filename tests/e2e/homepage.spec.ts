import { expect, test } from "@playwright/test";

test("renders the Gizlet homepage", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(
    "Gizlet | Useful internet things, without the nonsense.",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gizlet.com/",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://gizlet.com/brand/brand-board.png",
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
  await expect(
    page.locator('script[src="https://plausible.io/js/script.js"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('script[src*="pagead2.googlesyndication.com"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-ad-slot]')).toHaveCount(0);
});

test("serves public sitemap and crawler-discovery files", async ({
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  const robots = await request.get("/robots.txt");

  expect(sitemap.headers()["content-type"]).toContain("xml");
  await expect(sitemap).toBeOK();
  await expect(sitemap.text()).resolves.toContain(
    "https://gizlet.com/tools/compress-image/",
  );
  await expect(sitemap.text()).resolves.toContain(
    "https://gizlet.com/tools/json-ld-generator/",
  );
  await expect(sitemap.text()).resolves.toContain("https://gizlet.com/privacy/");

  expect(robots.headers()["content-type"]).toContain("text/plain");
  await expect(robots).toBeOK();
  await expect(robots.text()).resolves.toContain(
    "Sitemap: https://gizlet.com/sitemap.xml",
  );
});

test("links to and renders public information pages with page metadata", async ({ page }) => {
  await page.goto("/");

  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy/");
  await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms/");
  await expect(footer.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about/");

  await page.goto("/privacy/");
  await expect(page).toHaveTitle("Privacy | Gizlet");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://gizlet.com/privacy/");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "How Gizlet handles local tool processing, analytics, and advertising.",
  );
  await expect(page.getByRole("heading", { name: "Local Gizlets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plausible Analytics" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Google AdSense" })).toBeVisible();

  await page.goto("/terms/");
  await expect(page).toHaveTitle("Terms | Gizlet");
  await expect(page.getByRole("heading", { name: "Using Gizlet" })).toBeVisible();

  await page.goto("/about/");
  await expect(page).toHaveTitle("About | Gizlet");
  await expect(page.getByText("Gizlet is a BrewingBytes product")).toBeVisible();
});

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
    "https://gizlet.com/tools/compress-image/",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://gizlet.com/tools/compress-image/",
  );
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Compress Image");
  await expect(
    page.getByRole("heading", { name: "Compress Image" }),
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

test("creates, previews, and copies JSON-LD locally", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/json-ld-generator/");

  await expect(
    page.getByRole("heading", { name: "JSON-LD Generator" }),
  ).toBeVisible();
  await expect(page.getByLabel("Local processing")).toContainText(
    "Your file stays on this device.",
  );
  await expect(page.getByText("Schema.org errors")).toBeVisible();

  await page.getByLabel("Schema type").selectOption("Organization");
  await expect(
    page.getByRole("heading", { name: "Organization details" }),
  ).toBeVisible();
  await page.getByLabel("Organization name").fill("Gizlet");
  await expect(page.locator("[data-preview]")).toContainText(
    '"@type": "Organization"',
  );
  await expect(page.locator("[data-preview]")).toContainText(
    '"name": "Gizlet"',
  );

  await page.getByLabel("Schema type").selectOption("Product");
  const productForm = page.locator('[data-schema-form="Product"]');
  await productForm.getByLabel("Product name").fill("Trail Mug");
  await productForm.getByText("Advanced: offer details").click();
  await productForm.getByLabel("Price").fill("24.00");
  await expect(page.locator("[data-preview]")).toContainText('"offers"');
  await page.getByRole("button", { name: "Copy JSON-LD" }).click();
  await expect(page.getByRole("status")).toContainText(
    "JSON-LD copied to your clipboard.",
  );
});

test("formats, minifies, validates, and copies JSON locally", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/json-formatter/");

  const input = page.getByLabel("JSON input");
  await input.fill('{"name":"Gizlet","enabled":true}');
  await expect(page.getByRole("status").first()).toContainText(
    "Valid JSON. Ready to format or minify.",
  );
  await page.getByRole("button", { name: "Format JSON" }).click();
  await expect(page.locator("[data-output]")).toHaveText(
    '{\n  "name": "Gizlet",\n  "enabled": true\n}',
  );
  await page.getByRole("button", { name: "Copy result" }).click();
  await expect(page.getByRole("status").last()).toContainText(
    "Result copied to your clipboard.",
  );

  await page.getByRole("button", { name: "Minify JSON" }).click();
  await expect(page.locator("[data-output]")).toHaveText(
    '{"name":"Gizlet","enabled":true}',
  );

  const invalidInput = '{\n  "name":\n}';
  await input.fill(invalidInput);
  await page.getByRole("button", { name: "Format JSON" }).click();
  await expect(page.getByRole("status").first()).toContainText("Invalid JSON:");
  await expect(input).toHaveValue(invalidInput);

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Copy result" })).toBeDisabled();
});

test("compresses a selected image locally and offers it for download", async ({
  page,
}) => {
  await page.goto("/tools/compress-image/");

  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Select an image to compress").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: image,
  });

  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Output format")).toHaveValue("image/png");
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Compress it" }).click();

  const result = page.getByText("Your image is ready.");
  await expect(result).toBeVisible();
  await expect(page.getByLabel("Output format")).not.toBeVisible();
  await expect(page.getByText("Before")).toBeVisible();
  await expect(page.getByText("After")).toBeVisible();
  await expect(page.getByText(/(smaller|larger)/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Original / compressed" }),
  ).toBeVisible();
  await expect(page.getByAltText("Original image")).toBeVisible();
  const comparison = page.getByLabel("Compare original and compressed image");
  await comparison.focus();
  await page.keyboard.press("ArrowRight");
  await expect(comparison).toHaveValue("51");
  await expect(
    page.getByRole("link", { name: "Download image" }),
  ).toHaveAttribute("download", "tiny-compressed.jpg");

  await page.getByRole("button", { name: "Choose another image" }).click();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).toBeVisible();
});

test("explains unsupported and corrupt image files", async ({ page }) => {
  await page.goto("/tools/compress-image/");

  const fileInput = page.getByLabel("Select an image to compress");
  await fileInput.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Choose a JPEG, PNG, WebP, AVIF, or BMP image.",
  );

  await fileInput.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await page.getByRole("button", { name: "Compress it" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "This image could not be read.",
  );
});

test("resizes an image by dimensions or percentage and offers a local download", async ({
  page,
}) => {
  await page.goto("/tools/resize-image/");

  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Select an image to resize").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: image,
  });

  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await expect(page.getByLabel("Width")).toHaveValue("1");
  await expect(page.getByLabel("Height")).toHaveValue("1");
  await expect(page.getByLabel("Scale %")).not.toBeVisible();
  await page.getByLabel("Width").fill("2");
  await expect(page.getByLabel("Height")).toHaveValue("2");
  await expect(page.getByText("2 × 2 px")).toBeVisible();

  await page.getByLabel("Percentage").check();
  await expect(page.getByLabel("Width")).not.toBeVisible();
  await expect(page.getByLabel("Height")).not.toBeVisible();
  await expect(page.getByLabel("Scale %")).toBeVisible();
  await page.getByLabel("Scale %").fill("200");
  await expect(page.getByText("2 × 2 px")).toBeVisible();
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Resize it" }).click();

  await expect(page.getByText("Right size. Ready to go.")).toBeVisible();
  await expect(page.getByAltText("Resized image preview")).toBeVisible();
  await expect(page.getByText("Original", { exact: true })).toBeVisible();
  await expect(page.getByText("Resized", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download image" }),
  ).toHaveAttribute("download", "tiny-resized.jpg");

  await page.getByRole("button", { name: "Choose another image" }).click();
  await expect(
    page.getByRole("heading", { name: "Drop an image here" }),
  ).toBeVisible();
});

test("converts an image locally with an accurate download type and filename", async ({
  page,
}) => {
  await page.goto("/tools/convert-image/");

  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Select an image to convert").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: image,
  });

  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await expect(page.getByText("Detected format")).toBeVisible();
  await expect(page.getByLabel("Output format")).toHaveValue("image/png");
  await page.getByLabel("Output format").selectOption("image/jpeg");
  await page.getByRole("button", { name: "Convert it" }).click();

  await expect(page.getByText("Your image is ready.")).toBeVisible();
  await expect(page.getByAltText("Converted image preview")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download image" }),
  ).toHaveAttribute("download", "tiny-converted.jpg");
});

test("renders the editorial homepage content from the tool registry", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("search").getByLabel("I need to…"),
  ).toHaveAttribute(
    "placeholder",
    "compress a photo, merge a PDF, make JSON-LD…",
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
  ]) {
    await expect(
      page.getByRole("link", { name: new RegExp(toolName) }),
    ).toBeVisible();
  }

  await expect(
    page.getByRole("navigation", { name: "Browse tool categories" }),
  ).toContainText("Images");
  await expect(
    page.getByRole("heading", { name: "Same Gizlets. No ads." }),
  ).toBeVisible();
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
  await expect(header.getByRole("link", { name: "Pro" })).toBeVisible();
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
