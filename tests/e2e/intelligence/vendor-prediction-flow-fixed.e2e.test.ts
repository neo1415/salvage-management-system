/**
 * E2E Tests for Vendor Prediction Viewing Flow - FIXED VERSION
 * Task: 12.3.1
 * 
 * Tests the complete vendor journey for viewing auction price predictions
 * FIXED: Proper authentication handling with NextAuth CSRF
 */

import { test, expect, Page } from '@playwright/test';

// Test data
const TEST_VENDOR = {
  email: 'vendor-e2e@test.com',
  password: 'Test123!@#',
};

// Helper function to login as vendor with proper CSRF handling
async function loginAsVendor(page: Page) {
  // Navigate to login page
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  
  // Wait for NextAuth to be ready (it sets up CSRF token)
  await page.waitForTimeout(1000);
  
  // Fill credentials
  await page.fill('input[id="emailOrPhone"]', TEST_VENDOR.email);
  await page.fill('input[id="password"]', TEST_VENDOR.password);
  
  // Submit form and wait for navigation
  await Promise.all([
    page.waitForNavigation({ timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  
  // Verify we're on a vendor page
  await expect(page).toHaveURL(/\/vendor\//);
}

test.describe('Vendor Prediction Viewing Flow - Fixed', () => {
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
});
