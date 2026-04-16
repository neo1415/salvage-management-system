/**
 * Playwright Authentication Setup
 * Creates authenticated browser contexts for E2E tests
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../.auth/vendor.json');

setup('authenticate as vendor', async ({ page, context }) => {
  // Navigate to login page
  await page.goto('/login');
  
  // Fill in credentials
  await page.fill('input[id="emailOrPhone"]', 'vendor-e2e@test.com');
  await page.fill('input[id="password"]', 'Test123!@#');
  
  // Click submit and wait for navigation
  await page.click('button[type="submit"]');
  
  // Wait for successful login (redirect to vendor dashboard)
  await page.waitForURL(/\/vendor\//, { timeout: 30000 });
  
  // Verify we're logged in
  await expect(page).toHaveURL(/\/vendor\//);
  
  // Save authentication state
  await context.storageState({ path: authFile });
});
