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
