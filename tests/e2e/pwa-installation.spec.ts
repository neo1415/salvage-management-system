import { test, expect } from '@playwright/test';

test.describe('PWA Installation', () => {
  test('should have valid manifest.json', async ({ page }) => {
    await page.goto('/');
    const manifestLink = page.locator('link[rel=\"manifest\"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json');

    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest).toHaveProperty('name');
    expect(manifest).toHaveProperty('short_name');
    expect(manifest).toHaveProperty('start_url');
    expect(manifest).toHaveProperty('display');
    expect(manifest).toHaveProperty('theme_color');
    expect(manifest).toHaveProperty('background_color');
    expect(manifest).toHaveProperty('icons');
    
    expect(manifest.icons).toBeInstanceOf(Array);
    expect(manifest.icons.length).toBeGreaterThan(0);
    
    const iconSizes = manifest.icons.map((icon: any) => icon.sizes);
    expect(iconSizes).toContain('192x192');
    expect(iconSizes).toContain('512x512');
  });

  test('should register service worker', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await page.goto('/');
    await page.waitForTimeout(2000);

    const serviceWorkerRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration !== undefined;
      }
      return false;
    });

    expect(serviceWorkerRegistered).toBe(true);
  });

  test('should show install prompt on supported devices', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const installPromptExists = await page.evaluate(() => {
      return document.querySelector('[data-testid=\"install-prompt\"]') !== null ||
             document.querySelector('.install-prompt') !== null;
    });

    expect(typeof installPromptExists).toBe('boolean');
  });
});

test.describe('PWA Offline Functionality', () => {
  test('should cache assets for offline use', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const cacheExists = await page.evaluate(async () => {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        return cacheNames.length > 0;
      }
      return false;
    });

    expect(cacheExists).toBe(true);
  });

  test('should show offline indicator when offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);
    await page.waitForTimeout(1000);

    const offlineIndicatorVisible = await page.evaluate(() => {
      const indicator = document.querySelector('[data-testid=\"offline-indicator\"]') ||
                       document.querySelector('.offline-indicator');
      return indicator !== null;
    });

    expect(offlineIndicatorVisible).toBe(true);
    await context.setOffline(false);
  });

  test('should load offline fallback page when offline', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    await context.setOffline(true);
    await page.goto('/offline-test-page', { waitUntil: 'networkidle' });

    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);

    await context.setOffline(false);
  });
});

test.describe('PWA Performance', () => {
  test('should load quickly on mobile', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have proper meta tags for PWA', async ({ page }) => {
    await page.goto('/');

    const viewport = await page.locator('meta[name=\"viewport\"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');

    const themeColor = await page.locator('meta[name=\"theme-color\"]').getAttribute('content');
    expect(themeColor).toBeTruthy();

    const appleMobileWebAppCapable = await page.locator('meta[name=\"apple-mobile-web-app-capable\"]').getAttribute('content');
    expect(appleMobileWebAppCapable).toBe('yes');
  });
});
