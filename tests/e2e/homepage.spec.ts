import { expect, test } from '@playwright/test';

test('renders the Gizlet homepage', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Gizlet');
  await expect(
    page.getByRole('heading', { name: 'Useful internet things, without the nonsense.' }),
  ).toBeVisible();
});

test('renders the reusable tool page layout with truthful status and responsive ads', async ({ page }) => {
  await page.goto('/tools/compress-image/');

  await expect(page).toHaveTitle('Compress Image | Gizlet');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Compress Image');
  await expect(page.getByRole('heading', { name: 'Compress Image' })).toBeVisible();
  await expect(page.getByLabel('Local processing')).toContainText('Your file stays on this device.');
  await expect(page.getByLabel('Compress Image workspace')).toBeVisible();
  await expect(page.locator('[data-ad-slot-variant="rail"]')).toHaveCSS('min-height', '250px');
  await expect(page.locator('[data-ad-slot-variant="inline"]')).toHaveCSS('min-height', '90px');
  await expect(page.getByRole('heading', { name: 'Related Gizlets' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Resize Image/ })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-ad-slot-variant="rail"]')).toHaveCSS('min-height', '90px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('compresses a selected image locally and offers it for download', async ({ page }) => {
  await page.goto('/tools/compress-image/');

  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.getByLabel('Select an image to compress').setInputFiles({
    name: 'tiny.png',
    mimeType: 'image/png',
    buffer: image,
  });

  await expect(page.getByAltText('Selected image preview')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Drop an image here' })).not.toBeVisible();
  await page.getByLabel('Output format').selectOption('image/jpeg');
  await page.getByRole('button', { name: 'Compress it' }).click();

  const result = page.getByText('Your image is ready.');
  await expect(result).toBeVisible();
  await expect(page.getByLabel('Output format')).not.toBeVisible();
  await expect(page.getByText('Before')).toBeVisible();
  await expect(page.getByText('After')).toBeVisible();
  await expect(page.getByText(/(smaller|larger)/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Original / compressed' })).toBeVisible();
  await expect(page.getByAltText('Original image')).toBeVisible();
  const comparison = page.getByLabel('Compare original and compressed image');
  await comparison.focus();
  await page.keyboard.press('ArrowRight');
  await expect(comparison).toHaveValue('51');
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveAttribute(
    'download',
    'tiny-compressed.jpg',
  );

  await page.getByRole('button', { name: 'Choose another image' }).click();
  await expect(page.getByRole('heading', { name: 'Drop an image here' })).toBeVisible();
});

test('explains unsupported and corrupt image files', async ({ page }) => {
  await page.goto('/tools/compress-image/');

  const fileInput = page.getByLabel('Select an image to compress');
  await fileInput.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toHaveText('Choose a JPEG, PNG, or WebP image.');

  await fileInput.setInputFiles({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await page.getByRole('button', { name: 'Compress it' }).click();
  await expect(page.getByRole('alert')).toHaveText('This image could not be read.');
});

test('renders the editorial homepage content from the tool registry', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('search').getByLabel('I need to…')).toHaveAttribute(
    'placeholder',
    'compress a photo, merge a PDF, make JSON-LD…',
  );
  await expect(page.getByLabel('Advertisement')).toBeVisible();
  await expect(page.locator('[data-ad-slot-variant="banner"]')).toHaveCSS('min-height', '90px');
  await expect(page.getByRole('heading', { name: 'Popular Gizlets' })).toBeVisible();

  for (const toolName of [
    'Compress Image',
    'Resize Image',
    'Convert Image',
    'JSON-LD Generator',
    'JSON Formatter',
  ]) {
    await expect(page.getByRole('link', { name: new RegExp(toolName) })).toBeVisible();
  }

  await expect(page.getByRole('navigation', { name: 'Browse tool categories' })).toContainText(
    'Images',
  );
  await expect(page.getByRole('heading', { name: 'Same Gizlets. No ads.' })).toBeVisible();
});

test('finds Gizlets from the homepage search by intent', async ({ page }) => {
  await page.goto('/');

  const searchForm = page.getByRole('search');
  const search = searchForm.getByLabel('I need to…');
  await search.fill('compress photo');
  await expect(searchForm.getByRole('link', { name: /Compress Image/ })).toBeVisible();
  await expect(searchForm.getByText('1 Gizlet found.')).toBeVisible();

  await search.fill('spreadsheet');
  await expect(searchForm.getByText('No Gizlets found for “spreadsheet”.')).toBeVisible();
});

test('opens, navigates, and closes the global search overlay with the keyboard', async ({ page }) => {
  await page.goto('/');

  const overlay = page.getByRole('dialog', { name: 'What do you need?' });
  await page.getByRole('banner').getByRole('button', { name: 'Search Gizlet' }).click();
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText('Start typing to find a Gizlet.')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(overlay).not.toBeVisible();

  await page.keyboard.press('ControlOrMeta+K');
  await expect(overlay).toBeVisible();

  const search = overlay.getByLabel('Search Gizlets');
  await expect(search).toBeFocused();
  await search.fill('schema');
  await expect(overlay.getByRole('link', { name: /JSON-LD Generator/ })).toBeVisible();

  await search.press('ArrowDown');
  await expect(overlay.getByRole('link', { name: /JSON-LD Generator/ })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(overlay).not.toBeVisible();
});

test('does not steal the search shortcut from a text field', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('search').getByLabel('I need to…');
  await search.focus();
  await page.keyboard.press('ControlOrMeta+K');

  await expect(search).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'What do you need?' })).not.toBeVisible();
});

test('provides accessible shared navigation', async ({ page }) => {
  await page.goto('/');

  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Gizlet home' })).toBeVisible();
  await expect(header.getByRole('navigation', { name: 'Primary navigation' })).toContainText(
    'Tools',
  );
  await expect(header.getByRole('link', { name: 'Pro' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Search Gizlet' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Search Gizlet' })).toContainText('⌘K / Ctrl K');
  await expect(
    header.getByRole('button', { name: /Switch to (light|dark) theme/ }),
  ).toBeVisible();

  await header.getByRole('link', { name: 'Gizlet home' }).focus();
  await expect(header.getByRole('link', { name: 'Gizlet home' })).toBeFocused();

  await expect(page.getByRole('contentinfo')).toContainText('A little tool for everything.');
});

test('keeps the shared shell usable on mobile widths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('banner').getByRole('button', { name: 'Search Gizlet' })).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('allows keyboard users to skip shared navigation', async ({ page }) => {
  await page.goto('/');

  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('uses the system theme on a first visit', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.site-logo__dark')).toBeVisible();
  await expect(page.locator('.site-logo__light')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('persists an explicitly selected theme across reloads', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.site-logo__light')).toBeVisible();
  await expect(page.locator('.site-logo__dark')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
