import { expect, test } from '@playwright/test';

test('renders the Gizlet homepage', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Gizlet');
  await expect(page.getByRole('heading', { name: 'Gizlet' })).toBeVisible();
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
  await expect(header.getByRole('button', { name: 'Choose color theme' })).toBeVisible();

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
