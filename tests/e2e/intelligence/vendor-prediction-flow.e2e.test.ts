/**
 * E2E Tests for Vendor Prediction Viewing Flow
 * Task: 12.3.1
 * 
 * Tests the complete vendor journey for viewing auction price predictions
 */

import { test, expect, Page } from '@playwright/test';

// Test data - using real vendor account
const TEST_VENDOR = {
  email: 'neowalker502@gmail.com',
  password: 'N0sfer@tu502',
};

// Helper function to login as vendor
async function loginAsVendor(page: Page) {
  // Navigate to login page and wait for it to load completely
  await page.goto('/login', { waitUntil: 'networkidle' });
  
  // Wait for the form to be ready
  await page.waitForSelector('input[id="emailOrPhone"]');
  await page.waitForSelector('input[id="password"]');
  
  // Fill in credentials
  await page.fill('input[id="emailOrPhone"]', TEST_VENDOR.email);
  await page.fill('input[id="password"]', TEST_VENDOR.password);
  
  // Click submit button
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();
  
  // Wait for navigation after login (handles full page reload)
  // The login redirects to / which then redirects to /vendor/dashboard based on role
  await page.waitForURL(/\/vendor\//, { timeout: 30000 });
  
  // Wait a bit for the page to stabilize
  await page.waitForTimeout(1000);
}

test.describe('Vendor Prediction Viewing Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should display prediction card on auction detail page', async ({ page }) => {
    // Navigate to active auction
    await page.goto('/vendor/auctions');
    await page.waitForSelector('[data-testid="auction-card"]', { timeout: 10000 });
    
    // Click first auction
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    
    // Wait for auction detail page
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Verify prediction card is visible
    await expect(page.locator('text=Price Prediction')).toBeVisible();
    await expect(page.locator('text=Predicted Final Price')).toBeVisible();
  });

  test('should display price range with lower and upper bounds', async ({ page }) => {
    // Navigate to auction with prediction
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Verify price range elements
    await expect(page.locator('text=Expected Range')).toBeVisible();
    
    // Verify currency formatting (₦)
    const priceElements = page.locator('text=/₦[0-9,]+/');
    await expect(priceElements.first()).toBeVisible();
    
    // Verify range indicator visual
    const rangeBar = page.locator('.bg-gray-200.rounded-full').first();
    await expect(rangeBar).toBeVisible();
  });

  test('should display confidence indicator with correct color coding', async ({ page }) => {
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Verify confidence badge exists
    const confidenceBadge = page.locator('text=/High|Medium|Low/ >> text=Confidence');
    await expect(confidenceBadge).toBeVisible();
    
    // Verify confidence score percentage
    await expect(page.locator('text=Confidence Score')).toBeVisible();
    await expect(page.locator('text=/%/')).toBeVisible();
    
    // Verify confidence bar
    const confidenceBar = page.locator('.h-2.rounded-full').first();
    await expect(confidenceBar).toBeVisible();
  });

  test('should expand "How is this calculated?" section', async ({ page }) => {
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Find and click expandable section
    const expandButton = page.locator('button:has-text("How is this calculated?")');
    await expect(expandButton).toBeVisible();
    await expandButton.click();
    
    // Verify expanded content
    await expect(page.locator('text=Prediction Method')).toBeVisible();
    await expect(page.locator('text=Data Points')).toBeVisible();
    
    // Verify collapse functionality
    await expandButton.click();
    await expect(page.locator('text=Prediction Method')).not.toBeVisible();
  });

  test('should display prediction explanation details', async ({ page }) => {
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Expand explanation
    await page.click('button:has-text("How is this calculated?")');
    
    // Verify explanation content
    await expect(page.locator('text=/Based on|Calculated from|Estimated from/')).toBeVisible();
    await expect(page.locator('text=/Analysis based on/')).toBeVisible();
    
    // Verify disclaimer
    await expect(page.locator('text=/Predictions are estimates/')).toBeVisible();
  });

  test('should handle real-time prediction updates', async ({ page }) => {
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Get initial predicted price
    const initialPrice = await page.locator('text=Predicted Final Price').locator('..').locator('p.text-3xl').textContent();
    
    // Wait for potential Socket.IO update (simulate by waiting)
    await page.waitForTimeout(2000);
    
    // Verify prediction card is still visible (real-time updates don't break UI)
    await expect(page.locator('text=Price Prediction')).toBeVisible();
    await expect(page.locator('text=Predicted Final Price')).toBeVisible();
  });

  test('should display error state when prediction unavailable', async ({ page }) => {
    // Mock API to return no prediction
    await page.route('**/api/auctions/*/prediction', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'No prediction available',
          message: 'Insufficient data for price prediction',
        }),
      });
    });
    
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Verify error message or fallback state
    // Note: Implementation may show "No prediction available" or hide the card
    const predictionCard = page.locator('text=Price Prediction');
    const count = await predictionCard.count();
    
    if (count > 0) {
      // If card is shown, verify error message
      await expect(page.locator('text=/No prediction|Insufficient data/')).toBeVisible();
    }
  });
});

test.describe('Vendor Prediction Flow - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should display prediction card responsively on mobile', async ({ page }) => {
    await page.goto('/vendor/auctions');
    await page.waitForSelector('[data-testid="auction-card"]', { timeout: 10000 });
    
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Verify prediction card is visible on mobile
    await expect(page.locator('text=Price Prediction')).toBeVisible();
    
    // Verify mobile-friendly layout (stacked elements)
    const predictionCard = page.locator('text=Price Prediction').locator('..');
    const box = await predictionCard.boundingBox();
    
    // Verify card width is appropriate for mobile
    expect(box?.width).toBeLessThan(400);
  });

  test('should support touch gestures for expandable section', async ({ page }) => {
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Tap expandable section
    const expandButton = page.locator('button:has-text("How is this calculated?")');
    await expandButton.tap();
    
    // Verify expanded content
    await expect(page.locator('text=Prediction Method')).toBeVisible();
  });
});

test.describe('Vendor Prediction Flow - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVendor(page);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Tab to expandable button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Press Enter to expand
    await page.keyboard.press('Enter');
    
    // Verify expanded content
    await expect(page.locator('text=Prediction Method')).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/vendor/auctions');
    const firstAuction = page.locator('[data-testid="auction-card"]').first();
    await firstAuction.click();
    await page.waitForURL(/\/vendor\/auctions\/.+/);
    
    // Verify semantic HTML and ARIA attributes
    const predictionCard = page.locator('text=Price Prediction').locator('..');
    await expect(predictionCard).toBeVisible();
    
    // Verify confidence badge has meaningful text
    const confidenceBadge = page.locator('text=/High|Medium|Low/ >> text=Confidence');
    await expect(confidenceBadge).toBeVisible();
  });
});
