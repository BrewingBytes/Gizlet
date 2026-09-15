import { expect, test } from '@playwright/test';

/** A glob does not match the scheme and host reliably here; a pattern does. */
const providerUrl = /googletagmanager\.com/;

const analyticsEnabled = process.env.PUBLIC_ANALYTICS_ENABLED === 'true'
  && Boolean(process.env.PUBLIC_GA4_MEASUREMENT_ID);

test.describe('analytics consent', () => {
  test('ships nothing at all when measurement is not configured', async ({ page }) => {
    test.skip(analyticsEnabled, 'requires the default, unconfigured build');

    let providerRequests = 0;
    await page.route(providerUrl, async (route) => {
      providerRequests += 1;
      await route.abort();
    });

    for (const pathname of ['/', '/tools/compress-image/', '/privacy/']) {
      await page.goto(pathname);
      await expect(page.locator('[data-consent-banner]')).toHaveCount(0);
      await expect(page.locator('body[data-ga-measurement-id]')).toHaveCount(0);
      await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
      expect(await page.evaluate(() => 'dataLayer' in window)).toBe(false);
    }

    expect(providerRequests).toBe(0);
  });

  test.describe('with measurement configured', () => {
    test.skip(!analyticsEnabled, 'requires the explicit, valid test analytics configuration');

    const stubProvider = async (page: import('@playwright/test').Page): Promise<() => number> => {
      let providerRequests = 0;
      await page.route(providerUrl, async (route) => {
        providerRequests += 1;
        await route.fulfill({ contentType: 'application/javascript', body: '' });
      });
      return () => providerRequests;
    };

    test('asks before it measures, and denies everything until it is answered', async ({ page }) => {
      const requests = await stubProvider(page);

      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Allow analytics' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'No thanks' })).toBeVisible();

      // The default is in the document before anything could have loaded. gtag
      // pushes an arguments object rather than an array, so read it as one.
      const consentDefault = await page.evaluate(() =>
        Array.from((window.dataLayer?.[0] ?? []) as ArrayLike<unknown>),
      );

      expect(consentDefault).toEqual([
        'consent',
        'default',
        {
          ad_storage: 'denied',
          ad_personalization: 'denied',
          ad_user_data: 'denied',
          analytics_storage: 'denied',
        },
      ]);
      expect(requests()).toBe(0);
    });

    test('never reaches the provider when the visitor refuses', async ({ page }) => {
      const requests = await stubProvider(page);

      await page.goto('/');
      await page.getByRole('button', { name: 'No thanks' }).click();
      await expect(page.locator('[data-consent-banner]')).toBeHidden();
      await page.waitForTimeout(500);

      // Basic Consent Mode: no cookieless ping either, because no request is made.
      expect(requests()).toBe(0);
      await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);

      await page.reload();
      await expect(page.locator('[data-consent-banner]')).toBeHidden();
      await page.waitForTimeout(500);
      expect(requests()).toBe(0);
    });

    test('loads the tag once the visitor allows it, and remembers the answer', async ({ page }) => {
      const requests = await stubProvider(page);

      await page.goto('/');

      // The element is appended before the request is issued, so wait for the
      // request itself rather than racing it.
      const tagRequest = page.waitForRequest(providerUrl);

      await page.getByRole('button', { name: 'Allow analytics' }).click();
      await tagRequest;
      await expect(page.locator('[data-consent-banner]')).toBeHidden();
      await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(1);
      expect(requests()).toBe(1);

      await page.reload();
      // Answered already, so it loads without asking again.
      await expect(page.locator('[data-consent-banner]')).toBeHidden();
      await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(1);
    });

    /** One real Gizlet run, end to end, so the reported events are real ones. */
    const compressAnImage = async (page: import('@playwright/test').Page): Promise<void> => {
      await page.getByLabel('Select an image to compress').setInputFiles({
        name: 'holiday-secret.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZywAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
      await page.getByLabel('Output format').selectOption('image/jpeg');
      await page.getByRole('button', { name: 'Compress it' }).click();
      await expect(page.getByText('Your image is ready.')).toBeVisible();
      await page.getByRole('link', { name: 'Download image' }).click();
    };

    const readEvents = (page: import('@playwright/test').Page) =>
      page.evaluate(() =>
        (window.dataLayer ?? [])
          .map((entry) => Array.from(entry as ArrayLike<unknown>))
          .filter((entry) => entry[0] === 'event')
          .map((entry) => ({ name: entry[1], parameters: entry[2] })),
      );

    test('reports no event at all when the visitor refused', async ({ page }) => {
      await stubProvider(page);

      await page.goto('/tools/compress-image/');
      await page.getByRole('button', { name: 'No thanks' }).click();
      await compressAnImage(page);

      expect(await readEvents(page)).toEqual([]);
    });

    test('reports the run without reporting anything about the file', async ({ page }) => {
      await stubProvider(page);

      await page.goto('/tools/compress-image/');
      await page.getByRole('button', { name: 'Allow analytics' }).click();
      await compressAnImage(page);

      const events = await readEvents(page);

      expect(events).toEqual([
        { name: 'tool_completed', parameters: { tool_slug: 'compress-image' } },
        { name: 'tool_download', parameters: { tool_slug: 'compress-image', output_format: 'image' } },
      ]);

      // The filename, its format, and its size reached the Gizlet and stopped there.
      expect(JSON.stringify(events)).not.toContain('holiday-secret');
      expect(JSON.stringify(events)).not.toContain('image/png');
    });

    test('discards a stored answer it did not write', async ({ page }) => {
      const requests = await stubProvider(page);

      await page.goto('/');
      await page.evaluate(() => window.localStorage.setItem('gizlet-consent', '{"analytics":"granted"}'));
      await page.reload();

      // A record missing keys is not a grant; the visitor is asked again.
      await expect(page.locator('[data-consent-banner]')).toBeVisible();
      expect(requests()).toBe(0);
    });
  });
});
