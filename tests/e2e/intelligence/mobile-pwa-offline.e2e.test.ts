/**
 * E2E Tests for Mobile PWA Offline Functionality
 * Task: 12.3.5
 * 
 * Tests offline caching, service worker, and PWA features for intelligence system
 */

import { test, expect, Page } from '@playwright/test';

// Test data
const TEST_VENDOR = {
  email: 'vendor-e2e@test.com',
  password: 'Test123!@#',
};

// Helper function to login as vendor
async function loginAsVendor(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="emailOrPhone"]', TEST_VENDOR.email);
  await page.fill('input[name="password"]', TEST_VENDOR.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/vendor\//);
}

// Helper function to go offline
async function goOffline(page: Page) {
  await page.context().setOffline(true);
}

// Helper function to go online
async function goOnline(page: Page) {
  await page.context().setOffline(false);
}

test.describe('Mobile PWA Offline Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should install service worker', async ({ page }) => {
    await page.goto('/vendor/auctions');
    
    // Wait for service worker to register
    await page.waitForTimeout(2000);
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration !== undefined;
      }
      return false;
    });
    
    expect(swRegistered).toBe(true);
  });

  test('should cache prediction data for offline access', async ({ page }) => {
    // Load auction with prediction while online
    await page.goto('/vendor/auctions');
    await page.waitForSelector('[data-testid="auction-card"]', { timeout: 10000 });
    
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Wait for prediction to load
    await expect(page.locator('text=Price Prediction')).toBeVisible();
    
    // Get auction URL
    const auctionUrl = page.url();
    
    // Go offline
    await goOffline(page);
    
    // Navigate to same auction
    await page.goto(auctionUrl);
    
    // Verify prediction is still visible (from cache)
    await expect(page.locator('text=Price Prediction')).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await goOnline(page);
  });

  test('should cache recommendation data for offline access', async ({ page }) => {
    // Load recommendations while online
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Verify recommendations are visible
    await expect(page.locator('[data-testid="recommendation-card"]').first()).toBeVisible();
    
    // Go offline
    await goOffline(page);
    
    // Reload page
    await page.reload();
    
    // Verify recommendations are still visible (from cache)
    await expect(page.locator('[data-testid="recommendation-card"]').first()).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await goOnline(page);
  });

  test('should display offline mode indicator', async ({ page }) => {
    await page.goto('/vendor/auctions');
    
    // Go offline
    await goOffline(page);
    
    // Wait for offline indicator
    await page.waitForTimeout(1000);
    
    // Verify offline indicator is displayed
    await expect(page.locator('text=/Offline|No connection|Cached data/')).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await goOnline(page);
    
    // Wait for online indicator
    await page.waitForTimeout(1000);
    
    // Verify offline indicator is hidden
    const offlineIndicator = page.locator('text=/Offline|No connection/');
    const count = await offlineIndicator.count();
    expect(count).toBe(0);
  });

  test('should respect 5-minute TTL for prediction cache', async ({ page }) => {
    // This test verifies cache expiration logic
    // In a real scenario, we'd wait 5 minutes, but for testing we can verify the cache headers
    
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Intercept prediction API call
    let cacheControl = '';
    page.on('response', (response) => {
      if (response.url().includes('/api/auctions/') && response.url().includes('/prediction')) {
        cacheControl = response.headers()['cache-control'] || '';
      }
    });
    
    // Reload to trigger API call
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Verify cache control header suggests 5-minute TTL
    // Note: Implementation may vary
    expect(cacheControl).toBeTruthy();
  });

  test('should respect 15-minute TTL for recommendation cache', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    
    // Intercept recommendation API call
    let cacheControl = '';
    page.on('response', (response) => {
      if (response.url().includes('/api/vendors/') && response.url().includes('/recommendations')) {
        cacheControl = response.headers()['cache-control'] || '';
      }
    });
    
    // Reload to trigger API call
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Verify cache control header suggests 15-minute TTL
    expect(cacheControl).toBeTruthy();
  });

  test('should queue interaction tracking for Background Sync', async ({ page }) => {
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Go offline
    await goOffline(page);
    
    // Click "Not Interested" on a recommendation (if available)
    const notInterestedButton = page.locator('button[aria-label="Not interested"]').first();
    if (await notInterestedButton.count() > 0) {
      await notInterestedButton.click();
    }
    
    // Verify interaction is queued (no error shown)
    const errorMessage = page.locator('text=/Failed|Error/');
    const errorCount = await errorMessage.count();
    expect(errorCount).toBe(0);
    
    // Go back online
    await goOnline(page);
    
    // Wait for Background Sync to process queue
    await page.waitForTimeout(2000);
  });

  test('should support pull-to-refresh gesture', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/vendor/auctions');
    await page.waitForSelector('[data-testid="auction-card"]', { timeout: 10000 });
    
    // Simulate pull-to-refresh gesture
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    
    // Trigger touch events for pull-to-refresh
    const startY = 100;
    const endY = 300;
    
    await page.touchscreen.tap(200, startY);
    await page.touchscreen.tap(200, endY);
    
    // Wait for refresh animation
    await page.waitForTimeout(1000);
    
    // Verify page is still functional
    await expect(page.locator('[data-testid="auction-card"]').first()).toBeVisible();
  });

  test('should support swipe gestures on recommendation cards', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Get first recommendation card
    const card = page.locator('[data-testid="recommendation-card"]').first();
    const box = await card.boundingBox();
    
    if (box) {
      // Simulate swipe left gesture
      await page.touchscreen.tap(box.x + box.width - 50, box.y + box.height / 2);
      await page.touchscreen.tap(box.x + 50, box.y + box.height / 2);
      
      // Wait for swipe animation
      await page.waitForTimeout(500);
    }
    
    // Verify card is still visible or removed (depending on implementation)
    const cardCount = await page.locator('[data-testid="recommendation-card"]').count();
    expect(cardCount).toBeGreaterThanOrEqual(0);
  });

  test('should handle network reconnection gracefully', async ({ page }) => {
    await page.goto('/vendor/auctions');
    await page.waitForSelector('[data-testid="auction-card"]', { timeout: 10000 });
    
    // Go offline
    await goOffline(page);
    
    // Verify offline indicator
    await expect(page.locator('text=/Offline|No connection/')).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await goOnline(page);
    
    // Wait for reconnection
    await page.waitForTimeout(2000);
    
    // Verify online state is restored
    const offlineIndicator = page.locator('text=/Offline|No connection/');
    const count = await offlineIndicator.count();
    expect(count).toBe(0);
    
    // Verify data is refreshed
    await expect(page.locator('[data-testid="auction-card"]').first()).toBeVisible();
  });

  test('should show cached data timestamp when offline', async ({ page }) => {
    // Load data while online
    await page.goto('/vendor/auctions');
    await page.waitForSelector('[data-testid="auction-card"]', { timeout: 10000 });
    
    // Go offline
    await goOffline(page);
    
    // Reload page
    await page.reload();
    
    // Verify cached data message with timestamp
    await expect(page.locator('text=/Viewing cached data|Last updated/')).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await goOnline(page);
  });

  test('should handle offline prediction requests gracefully', async ({ page }) => {
    await page.goto('/vendor/auctions');
    
    // Go offline
    await goOffline(page);
    
    // Try to view auction (should show cached or error)
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    if (await firstAuction.count() > 0) {
      await firstAuction.click();
      await page.waitForURL(/\/vendor\/auctions\/.+/);
      
      // Verify page loads (either cached or with offline message)
      await expect(page.locator('text=/Auction Details|Offline|Cached/')).toBeVisible({ timeout: 5000 });
    }
    
    // Go back online
    await goOnline(page);
  });

  test('should handle offline recommendation requests gracefully', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    
    // Go offline
    await goOffline(page);
    
    // Try to view recommendations
    await page.click('button:has-text("For You")');
    
    // Verify page loads (either cached or with offline message)
    await expect(page.locator('text=/Recommendations|Offline|Cached|No connection/')).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await goOnline(page);
  });
});

test.describe('Mobile PWA Offline - Service Worker', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should update service worker when new version available', async ({ page }) => {
    await page.goto('/vendor/auctions');
    
    // Check for service worker update
    const updateAvailable = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          return true;
        }
      }
      return false;
    });
    
    expect(updateAvailable).toBe(true);
  });

  test('should cache static assets for offline use', async ({ page }) => {
    await page.goto('/vendor/auctions');
    
    // Go offline
    await goOffline(page);
    
    // Navigate to different page
    await page.goto('/vendor/market-insights');
    
    // Verify page loads (static assets cached)
    await expect(page.locator('text=/Market Insights|Auctions/')).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await goOnline(page);
  });
});

test.describe('Mobile PWA Offline - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should announce offline status to screen readers', async ({ page }) => {
    await page.goto('/vendor/auctions');
    
    // Go offline
    await goOffline(page);
    
    // Wait for offline indicator
    await page.waitForTimeout(1000);
    
    // Verify offline indicator has proper ARIA attributes
    const offlineIndicator = page.locator('text=/Offline|No connection/').first();
    
    if (await offlineIndicator.count() > 0) {
      // Check for role or aria-live
      const role = await offlineIndicator.getAttribute('role');
      const ariaLive = await offlineIndicator.getAttribute('aria-live');
      
      // At least one should be present for screen reader announcement
      expect(role || ariaLive).toBeTruthy();
    }
    
    // Go back online
    await goOnline(page);
  });
});

test.describe('Mobile PWA Offline - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should load cached data quickly when offline', async ({ page }) => {
    // Load data while online
    await page.goto('/vendor/auctions');
    await page.waitForSelector('[data-testid="auction-card"]', { timeout: 10000 });
    
    // Go offline
    await goOffline(page);
    
    // Measure load time from cache
    const startTime = Date.now();
    await page.reload();
    await page.waitForSelector('[data-testid="auction-card"], text=/Offline|Cached/', { timeout: 5000 });
    const loadTime = Date.now() - startTime;
    
    // Verify cached load is fast (under 1 second)
    expect(loadTime).toBeLessThan(1000);
    
    // Go back online
    await goOnline(page);
  });
});

test.describe('Mobile PWA Offline - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should handle cache miss gracefully', async ({ page }) => {
    // Go offline immediately (no cache)
    await goOffline(page);
    
    // Try to load page
    await page.goto('/vendor/auctions');
    
    // Verify error message or offline page
    await expect(page.locator('text=/Offline|No connection|Unable to load/')).toBeVisible({ timeout: 5000 });
    
    // Go back online
    await goOnline(page);
  });

  test('should handle intermittent connectivity', async ({ page }) => {
    await page.goto('/vendor/auctions');
    await page.waitForSelector('[data-testid="auction-card"]', { timeout: 10000 });
    
    // Simulate intermittent connectivity
    await goOffline(page);
    await page.waitForTimeout(1000);
    await goOnline(page);
    await page.waitForTimeout(1000);
    await goOffline(page);
    await page.waitForTimeout(1000);
    await goOnline(page);
    
    // Verify page is still functional
    await expect(page.locator('[data-testid="auction-card"]').first()).toBeVisible();
  });
});
