import { expect, test } from '@playwright/test';

const adsEnabled = process.env.PUBLIC_ADS_ENABLED === 'true';
const hasConfiguredSlots = [
  process.env.PUBLIC_ADSENSE_BANNER_SLOT,
  process.env.PUBLIC_ADSENSE_INLINE_SLOT,
  process.env.PUBLIC_ADSENSE_RAIL_SLOT,
].some(Boolean);

test.describe('page advertising policy', () => {
  test.skip(!adsEnabled, 'requires the explicit, valid test advertising configuration');

  test('never loads the provider or units on excluded pages', async ({ page }) => {
    let providerRequests = 0;
    await page.route('**/pagead2.googlesyndication.com/**', async (route) => {
      providerRequests += 1;
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'window.adsbygoogle = window.adsbygoogle || [];',
      });
    });

    for (const pathname of [
      '/privacy/',
      '/terms/',
      '/about/',
      '/roadmap/',
      '/404.html',
      '/request-a-gizlet/',
      '/tools/qr-code-generator/',
    ]) {
      await page.goto(pathname);
      await expect(page.locator('script[src*="pagead2.googlesyndication.com"]')).toHaveCount(0);
      await expect(page.locator('[data-ad-slot], .adsbygoogle')).toHaveCount(0);
      await expect(page.locator('script').filter({ hasText: 'adsbygoogle' })).toHaveCount(0);
    }

    expect(providerRequests).toBe(0);
  });

  test('loads one provider script when an eligible page has an applicable slot', async ({ page }) => {
    test.skip(!hasConfiguredSlots, 'requires at least one configured test slot');

    let providerRequests = 0;
    await page.route('**/pagead2.googlesyndication.com/**', async (route) => {
      providerRequests += 1;
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'window.adsbygoogle = window.adsbygoogle || [];',
      });
    });

    await page.goto('/');
    await expect(page.locator('script[src*="pagead2.googlesyndication.com"]')).toHaveCount(
      process.env.PUBLIC_ADSENSE_BANNER_SLOT ? 1 : 0,
    );
    await expect(page.locator('[data-ad-slot-variant="banner"]')).toHaveCount(
      process.env.PUBLIC_ADSENSE_BANNER_SLOT ? 1 : 0,
    );
    expect(providerRequests).toBe(process.env.PUBLIC_ADSENSE_BANNER_SLOT ? 1 : 0);

    providerRequests = 0;
    await page.goto('/tools/compress-image/');
    const toolSlotCount = [
      process.env.PUBLIC_ADSENSE_INLINE_SLOT,
      process.env.PUBLIC_ADSENSE_RAIL_SLOT,
    ].filter(Boolean).length;
    await expect(page.locator('script[src*="pagead2.googlesyndication.com"]')).toHaveCount(
      toolSlotCount > 0 ? 1 : 0,
    );
    await expect(page.locator('[data-ad-slot-variant]')).toHaveCount(toolSlotCount);
    expect(providerRequests).toBe(toolSlotCount > 0 ? 1 : 0);
  });

  test('does not load the provider for a valid publisher without applicable slots', async ({ page }) => {
    test.skip(hasConfiguredSlots, 'requires a valid publisher with no configured test slots');

    let providerRequests = 0;
    await page.route('**/pagead2.googlesyndication.com/**', async (route) => {
      providerRequests += 1;
      await route.abort();
    });

    for (const pathname of ['/', '/tools/compress-image/']) {
      await page.goto(pathname);
      await expect(page.locator('script[src*="pagead2.googlesyndication.com"]')).toHaveCount(0);
      await expect(page.locator('[data-ad-slot], .adsbygoogle')).toHaveCount(0);
    }

    expect(providerRequests).toBe(0);
  });
});
