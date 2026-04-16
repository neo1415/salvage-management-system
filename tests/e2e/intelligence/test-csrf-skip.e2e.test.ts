/**
 * Simple test to verify CSRF skip is working
 */

import { test, expect } from '@playwright/test';

test('verify E2E_TESTING environment variable', async () => {
  console.log('E2E_TESTING env var:', process.env.E2E_TESTING);
  expect(process.env.E2E_TESTING).toBe('true');
});

test('test login with CSRF skip', async ({ page }) => {
  // Navigate to login
  await page.goto('http://localhost:3000/login');
  
  // Fill credentials
  await page.fill('input[id="emailOrPhone"]', 'vendor-e2e@test.com');
  await page.fill('input[id="password"]', 'Test123!@#');
  
  // Click submit
  await page.click('button[type="submit"]');
  
  // Wait a bit to see what happens
  await page.waitForTimeout(5000);
  
  // Check current URL
  const currentUrl = page.url();
  console.log('Current URL after login:', currentUrl);
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/csrf-skip-test.png', fullPage: true });
  
  // Check if we're redirected
  expect(currentUrl).toContain('/vendor/');
});
