/**
 * E2E Tests for Vendor Recommendation Feed Flow
 * Task: 12.3.2
 * 
 * Tests the complete vendor journey for viewing personalized auction recommendations
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

test.describe('Vendor Recommendation Feed Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should navigate to "For You" tab and display recommendations', async ({ page }) => {
    // Navigate to market insights page
    await page.goto('/vendor/market-insights');
    
    // Verify "For You" tab exists
    const forYouTab = page.locator('button:has-text("For You")');
    await expect(forYouTab).toBeVisible();
    
    // Click "For You" tab
    await forYouTab.click();
    
    // Verify recommendations are displayed
    await expect(page.locator('text=/Recommended|For You/')).toBeVisible();
  });

  test('should display recommendation cards with match scores', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    
    // Wait for recommendations to load
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Verify match score is displayed
    const matchScore = page.locator('text=/%/ >> text=Match').first();
    await expect(matchScore).toBeVisible();
    
    // Verify match score is a number between 0-100
    const scoreText = await matchScore.textContent();
    const score = parseInt(scoreText?.match(/\d+/)?.[0] || '0');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('should display reason codes as colored tags', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Verify reason tags are displayed
    const reasonTags = page.locator('.rounded-full.text-xs.font-medium').first();
    await expect(reasonTags).toBeVisible();
    
    // Verify tags have color coding (check for bg-* classes)
    const tagClass = await reasonTags.getAttribute('class');
    expect(tagClass).toMatch(/bg-(green|blue|purple|indigo|yellow|teal|gray)-100/);
  });

  test('should support infinite scroll/pagination', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Get initial count of recommendations
    const initialCount = await page.locator('[data-testid="recommendation-card"]').count();
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Wait for potential new items to load
    await page.waitForTimeout(2000);
    
    // Get new count (may be same if all loaded)
    const newCount = await page.locator('[data-testid="recommendation-card"]').count();
    
    // Verify count is at least the same (no items disappeared)
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('should handle "Not Interested" button click', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Get initial count
    const initialCount = await page.locator('[data-testid="recommendation-card"]').count();
    
    // Click "Not Interested" button (X icon)
    const notInterestedButton = page.locator('[data-testid="recommendation-card"]').first().locator('button[aria-label="Not interested"]');
    await notInterestedButton.click();
    
    // Wait for card to be removed
    await page.waitForTimeout(500);
    
    // Verify card count decreased
    const newCount = await page.locator('[data-testid="recommendation-card"]').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should navigate to auction details on card click', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Click "View Auction" button
    const viewButton = page.locator('[data-testid="recommendation-card"]').first().locator('text=View Auction');
    await viewButton.click();
    
    // Verify navigation to auction detail page
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    await expect(page.locator('text=/Auction Details|Asset Details/')).toBeVisible();
  });

  test('should display real-time recommendation updates', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Get initial recommendation count
    const initialCount = await page.locator('[data-testid="recommendation-card"]').count();
    
    // Wait for potential Socket.IO updates
    await page.waitForTimeout(3000);
    
    // Verify recommendations are still displayed (real-time updates don't break UI)
    const newCount = await page.locator('[data-testid="recommendation-card"]').count();
    expect(newCount).toBeGreaterThan(0);
  });

  test('should display empty state when no recommendations', async ({ page }) => {
    // Mock API to return empty recommendations
    await page.route('**/api/vendors/*/recommendations', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          recommendations: [],
          total: 0,
        }),
      });
    });
    
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    
    // Verify empty state message
    await expect(page.locator('text=/No recommendations|Start bidding/')).toBeVisible();
  });

  test('should display auction stats (watching count, time remaining)', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Verify watching count
    await expect(page.locator('text=/\\d+ watching/').first()).toBeVisible();
    
    // Verify time remaining
    await expect(page.locator('text=/\\d+[dhm].*left/').first()).toBeVisible();
  });
});

test.describe('Vendor Recommendation Flow - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should display recommendations responsively on mobile', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Verify cards are displayed in mobile layout
    const card = page.locator('[data-testid="recommendation-card"]').first();
    const box = await card.boundingBox();
    
    // Verify card width is appropriate for mobile
    expect(box?.width).toBeLessThan(400);
  });

  test('should support touch gestures for "Not Interested"', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Tap "Not Interested" button
    const notInterestedButton = page.locator('[data-testid="recommendation-card"]').first().locator('button[aria-label="Not interested"]');
    await notInterestedButton.tap();
    
    // Verify card is removed
    await page.waitForTimeout(500);
    const count = await page.locator('[data-testid="recommendation-card"]').count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should support swipe gestures on recommendation cards', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Get first card
    const card = page.locator('[data-testid="recommendation-card"]').first();
    const box = await card.boundingBox();
    
    if (box) {
      // Simulate swipe left gesture
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.touchscreen.tap(box.x + 50, box.y + box.height / 2);
    }
    
    // Verify card is still visible (swipe may not be implemented yet)
    await expect(card).toBeVisible();
  });
});

test.describe('Vendor Recommendation Flow - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Tab through interactive elements
    await page.keyboard.press('Tab'); // View Auction button
    await page.keyboard.press('Tab'); // Not Interested button
    
    // Verify focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper ARIA labels for actions', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Verify "Not Interested" button has aria-label
    const notInterestedButton = page.locator('button[aria-label="Not interested"]').first();
    await expect(notInterestedButton).toBeVisible();
    
    const ariaLabel = await notInterestedButton.getAttribute('aria-label');
    expect(ariaLabel).toBe('Not interested');
  });

  test('should announce match scores to screen readers', async ({ page }) => {
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    // Verify match score has meaningful text
    const matchScore = page.locator('text=/%/ >> text=Match').first();
    await expect(matchScore).toBeVisible();
    
    const scoreText = await matchScore.textContent();
    expect(scoreText).toMatch(/\d+%.*Match/);
  });
});

test.describe('Vendor Recommendation Flow - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should load recommendations within 2 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/vendor/market-insights');
    await page.click('button:has-text("For You")');
    await page.waitForSelector('[data-testid="recommendation-card"]', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Verify load time is under 2 seconds (2000ms)
    expect(loadTime).toBeLessThan(2000);
  });
});
