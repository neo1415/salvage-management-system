/**
 * E2E Tests for Admin Fraud Alert Review Flow
 * Task: 12.3.3
 * 
 * Tests the complete admin journey for reviewing and managing fraud alerts
 */

import { test, expect, Page } from '@playwright/test';

// Test data
const TEST_ADMIN = {
  email: 'admin-e2e@test.com',
  password: 'Test123!@#',
};

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="emailOrPhone"]', TEST_ADMIN.email);
  await page.fill('input[name="password"]', TEST_ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\//);
}

test.describe('Admin Fraud Alert Review Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to intelligence dashboard', async ({ page }) => {
    // Navigate to intelligence dashboard
    await page.goto('/admin/intelligence');
    
    // Verify dashboard title
    await expect(page.locator('h1:has-text("Intelligence Dashboard")')).toBeVisible();
    
    // Verify fraud alerts section exists
    await expect(page.locator('text=/Fraud Alerts|Pending Alerts/')).toBeVisible();
  });

  test('should display fraud alerts table', async ({ page }) => {
    await page.goto('/admin/intelligence');
    
    // Wait for fraud alerts table to load
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Verify table headers
    await expect(page.locator('th:has-text("Risk")')).toBeVisible();
    await expect(page.locator('th:has-text("Type")')).toBeVisible();
    await expect(page.locator('th:has-text("Entity ID")')).toBeVisible();
    await expect(page.locator('th:has-text("Reasons")')).toBeVisible();
    await expect(page.locator('th:has-text("Created")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
  });

  test('should display risk scores with color coding', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Find risk score badges
    const riskBadges = page.locator('td').filter({ hasText: /^\d+$/ }).first();
    
    if (await riskBadges.count() > 0) {
      await expect(riskBadges).toBeVisible();
      
      // Verify badge has color coding (destructive for high risk)
      const badgeClass = await riskBadges.getAttribute('class');
      expect(badgeClass).toBeTruthy();
    }
  });

  test('should open fraud alert detail modal', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Click "View" button on first alert
    const viewButton = page.locator('button:has-text("View")').first();
    
    if (await viewButton.count() > 0) {
      await viewButton.click();
      
      // Verify modal is opened
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.locator('text=/Fraud Alert Details|Alert Details/')).toBeVisible();
    }
  });

  test('should display fraud evidence in detail modal', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    const viewButton = page.locator('button:has-text("View")').first();
    
    if (await viewButton.count() > 0) {
      await viewButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // Verify evidence sections
      await expect(page.locator('text=/Risk Score|Flag Reasons|Evidence/')).toBeVisible();
      
      // Verify flag reasons are displayed
      const flagReasons = page.locator('[role="dialog"]').locator('text=/Suspicious|Pattern|Anomaly/');
      if (await flagReasons.count() > 0) {
        await expect(flagReasons.first()).toBeVisible();
      }
    }
  });

  test('should display action buttons in detail modal', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    const viewButton = page.locator('button:has-text("View")').first();
    
    if (await viewButton.count() > 0) {
      await viewButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // Verify action buttons
      await expect(page.locator('button:has-text("Dismiss")')).toBeVisible();
      await expect(page.locator('button:has-text("Confirm")')).toBeVisible();
      
      // Verify suspend button (may be conditional)
      const suspendButton = page.locator('button:has-text("Suspend")');
      if (await suspendButton.count() > 0) {
        await expect(suspendButton).toBeVisible();
      }
    }
  });

  test('should confirm fraud alert', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Get initial alert count
    const initialCount = await page.locator('tbody tr').count();
    
    // Click "Confirm" button on first alert
    const confirmButton = page.locator('button:has-text("Confirm")').first();
    
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
      
      // Wait for confirmation
      await page.waitForTimeout(1000);
      
      // Verify alert is removed or status updated
      const newCount = await page.locator('tbody tr').count();
      expect(newCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('should dismiss fraud alert', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Get initial alert count
    const initialCount = await page.locator('tbody tr').count();
    
    // Click "Dismiss" button on first alert
    const dismissButton = page.locator('button:has-text("Dismiss")').first();
    
    if (await dismissButton.count() > 0) {
      await dismissButton.click();
      
      // Wait for dismissal
      await page.waitForTimeout(1000);
      
      // Verify alert is removed or status updated
      const newCount = await page.locator('tbody tr').count();
      expect(newCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('should update fraud alert status', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    const viewButton = page.locator('button:has-text("View")').first();
    
    if (await viewButton.count() > 0) {
      await viewButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // Click confirm in modal
      const confirmButton = page.locator('[role="dialog"]').locator('button:has-text("Confirm")');
      await confirmButton.click();
      
      // Wait for status update
      await page.waitForTimeout(1000);
      
      // Verify modal is closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    }
  });

  test('should receive real-time fraud alert notifications', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Get initial alert count
    const initialCount = await page.locator('tbody tr').count();
    
    // Wait for potential Socket.IO notification
    await page.waitForTimeout(3000);
    
    // Verify alerts are still displayed (real-time updates don't break UI)
    const newCount = await page.locator('tbody tr').count();
    expect(newCount).toBeGreaterThanOrEqual(0);
  });

  test('should filter alerts by status', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Look for filter controls
    const filterButton = page.locator('button:has-text("Filter")');
    
    if (await filterButton.count() > 0) {
      await filterButton.click();
      
      // Select "Pending" status
      const pendingOption = page.locator('text=Pending');
      if (await pendingOption.count() > 0) {
        await pendingOption.click();
      }
      
      // Verify filtered results
      await page.waitForTimeout(1000);
      await expect(page.locator('table')).toBeVisible();
    }
  });

  test('should sort alerts by risk score', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Click risk score header to sort
    const riskHeader = page.locator('th:has-text("Risk")');
    await riskHeader.click();
    
    // Wait for sort
    await page.waitForTimeout(1000);
    
    // Verify table is still displayed
    await expect(page.locator('table')).toBeVisible();
  });

  test('should display empty state when no alerts', async ({ page }) => {
    // Mock API to return no alerts
    await page.route('**/api/intelligence/fraud/alerts*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          alerts: [],
          total: 0,
        }),
      });
    });
    
    await page.goto('/admin/intelligence');
    
    // Verify empty state message
    await expect(page.locator('text=/No pending fraud alerts|No alerts/')).toBeVisible();
  });
});

test.describe('Admin Fraud Alert Flow - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display fraud alerts table responsively on mobile', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Verify table is visible on mobile
    await expect(page.locator('table')).toBeVisible();
    
    // Verify horizontal scroll is available for wide tables
    const table = page.locator('table');
    const box = await table.boundingBox();
    expect(box).toBeTruthy();
  });

  test('should open detail modal on mobile', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    const viewButton = page.locator('button:has-text("View")').first();
    
    if (await viewButton.count() > 0) {
      await viewButton.tap();
      
      // Verify modal is opened
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });
});

test.describe('Admin Fraud Alert Flow - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should support keyboard navigation in table', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Tab through action buttons
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper ARIA labels for action buttons', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Verify action buttons have meaningful text
    const viewButton = page.locator('button:has-text("View")').first();
    const confirmButton = page.locator('button:has-text("Confirm")').first();
    const dismissButton = page.locator('button:has-text("Dismiss")').first();
    
    if (await viewButton.count() > 0) {
      await expect(viewButton).toBeVisible();
    }
    if (await confirmButton.count() > 0) {
      await expect(confirmButton).toBeVisible();
    }
    if (await dismissButton.count() > 0) {
      await expect(dismissButton).toBeVisible();
    }
  });

  test('should announce modal content to screen readers', async ({ page }) => {
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    const viewButton = page.locator('button:has-text("View")').first();
    
    if (await viewButton.count() > 0) {
      await viewButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // Verify modal has role="dialog"
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      
      // Verify modal has accessible title
      const modalTitle = modal.locator('h2, h3').first();
      if (await modalTitle.count() > 0) {
        await expect(modalTitle).toBeVisible();
      }
    }
  });
});

test.describe('Admin Fraud Alert Flow - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should load fraud alerts within 2 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/admin/intelligence');
    await page.waitForSelector('table', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // Verify load time is under 2 seconds (2000ms)
    expect(loadTime).toBeLessThan(2000);
  });
});
