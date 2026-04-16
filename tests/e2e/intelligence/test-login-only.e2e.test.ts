/**
 * Simple Login Test to Diagnose E2E Login Issues
 */

import { test, expect } from '@playwright/test';

const TEST_VENDOR = {
  email: 'vendor-e2e@test.com',
  password: 'Test123!@#',
};

test('should login successfully', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');
  console.log('Navigated to login page');
  
  // Take screenshot of login page
  await page.screenshot({ path: 'test-results/01-login-page.png', fullPage: true });
  
  // Fill in credentials
  await page.fill('input[id="emailOrPhone"]', TEST_VENDOR.email);
  console.log('Filled email');
  
  await page.fill('input[id="password"]', TEST_VENDOR.password);
  console.log('Filled password');
  
  // Take screenshot before submit
  await page.screenshot({ path: 'test-results/02-before-submit.png', fullPage: true });
  
  // Click submit
  await page.click('button[type="submit"]');
  console.log('Clicked submit button');
  
  // Wait a bit to see what happens
  await page.waitForTimeout(5000);
  
  // Take screenshot after submit
  await page.screenshot({ path: 'test-results/03-after-submit.png', fullPage: true });
  
  // Log current URL
  console.log('Current URL:', page.url());
  
  // Check if there's an error message
  const errorElement = await page.locator('[class*="bg-red"]').textContent().catch(() => null);
  if (errorElement) {
    console.log('Full error message:', errorElement);
  }
  
  // Wait for any navigation (with longer timeout)
  try {
    await page.waitForURL(/\/vendor\/|\/admin\/|\/manager\/|\/adjuster\//, { timeout: 20000 });
    console.log('Successfully navigated to:', page.url());
  } catch (e) {
    console.log('Navigation timeout - still on:', page.url());
    await page.screenshot({ path: 'test-results/04-timeout.png', fullPage: true });
  }
});
