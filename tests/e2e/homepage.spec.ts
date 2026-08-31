import { expect, test } from '@playwright/test';

test('renders the Gizlet homepage', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Gizlet');
  await expect(page.getByRole('heading', { name: 'Gizlet' })).toBeVisible();
});
