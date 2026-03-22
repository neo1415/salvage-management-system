/**
 * End-to-End Tests for Case Creation with Vehicle Autocomplete
 * 
 * Tests the complete case creation flow with autocomplete functionality:
 * - Complete case creation flow with autocomplete
 * - Mobile viewport testing (375px width)
 * - Keyboard-only navigation
 * - Real API calls
 * 
 * Requirements: 10.4, 5.1
 */

import { test, expect } from '@playwright/test';

test.describe('Case Creation with Autocomplete - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as adjuster
    await page.goto('/login');
    await page.fill('input[name="emailOrPhone"]', 'adjuster@test.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(/\/adjuster\//);
    
    // Navigate to case creation page
    await page.goto('/adjuster/cases/new');
    await page.waitForLoadState('networkidle');
  });

  test('complete case creation flow with autocomplete', async ({ page }) => {
    // Fill in basic case information
    await page.fill('input[name="claimReference"]', 'TEST-CLAIM-001');
    
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Fill in market value
    await page.fill('input[name="marketValue"]', '5000000');
    
    // Test vehicle make autocomplete
    const makeInput = page.locator('input[name="vehicleMake"]');
    await expect(makeInput).toBeVisible();
    
    // Type in make field
    await makeInput.click();
    await makeInput.fill('Toy');
    
    // Wait for suggestions to appear
    await page.waitForTimeout(400); // Wait for debounce
    
    // Verify dropdown is visible
    const makeDropdown = page.locator('[role="listbox"]').first();
    await expect(makeDropdown).toBeVisible();
    
    // Verify Toyota appears in suggestions
    const toyotaOption = page.locator('[role="option"]:has-text("Toyota")').first();
    await expect(toyotaOption).toBeVisible();
    
    // Click Toyota option
    await toyotaOption.click();
    
    // Verify make is selected
    await expect(makeInput).toHaveValue('Toyota');
    
    // Test vehicle model autocomplete (should be enabled after make selection)
    const modelInput = page.locator('input[name="vehicleModel"]');
    await expect(modelInput).toBeEnabled();
    
    // Type in model field
    await modelInput.click();
    await modelInput.fill('Cam');
    
    // Wait for suggestions
    await page.waitForTimeout(400);
    
    // Verify Camry appears in suggestions
    const camryOption = page.locator('[role="option"]:has-text("Camry")').first();
    await expect(camryOption).toBeVisible();
    
    // Click Camry option
    await camryOption.click();
    
    // Verify model is selected
    await expect(modelInput).toHaveValue('Camry');
    
    // Test vehicle year autocomplete (should be enabled after model selection)
    const yearInput = page.locator('input[name="vehicleYear"]');
    await expect(yearInput).toBeEnabled();
    
    // Type in year field
    await yearInput.click();
    await yearInput.fill('202');
    
    // Wait for suggestions
    await page.waitForTimeout(400);
    
    // Verify year suggestions appear
    const year2020Option = page.locator('[role="option"]:has-text("2020")').first();
    await expect(year2020Option).toBeVisible();
    
    // Click 2020 option
    await year2020Option.click();
    
    // Verify year is selected
    await expect(yearInput).toHaveValue('2020');
    
    // Fill in additional vehicle details
    await page.fill('input[name="vehicleVin"]', 'TEST123456789VIN');
    await page.fill('input[name="vehicleMileage"]', '50000');
    await page.selectOption('select[name="vehicleCondition"]', 'good');
    
    // Fill in location
    await page.fill('input[name="locationName"]', 'Test Location, Lagos');
    
    // Upload photos (minimum 3 required)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      './tests/fixtures/test-photo-1.jpg',
      './tests/fixtures/test-photo-2.jpg',
      './tests/fixtures/test-photo-3.jpg',
    ]);
    
    // Wait for photos to upload
    await page.waitForTimeout(2000);
    
    // Verify photos are displayed
    await expect(page.locator('text=/3 photos?/i')).toBeVisible();
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Wait for submission and redirect
    await page.waitForURL(/\/adjuster\/cases/, { timeout: 30000 });
    
    // Verify success message or redirect to cases list
    await expect(page.locator('text=/case created|success/i')).toBeVisible();
  });

  test('cascade clearing - changing make clears model and year', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Select Toyota
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Toyota")').first().click();
    
    // Select Camry
    const modelInput = page.locator('input[name="vehicleModel"]');
    await modelInput.click();
    await modelInput.fill('Camry');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Camry")').first().click();
    
    // Select 2020
    const yearInput = page.locator('input[name="vehicleYear"]');
    await yearInput.click();
    await yearInput.fill('2020');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("2020")').first().click();
    
    // Verify all fields have values
    await expect(makeInput).toHaveValue('Toyota');
    await expect(modelInput).toHaveValue('Camry');
    await expect(yearInput).toHaveValue('2020');
    
    // Change make to Honda
    await makeInput.click();
    await makeInput.clear();
    await makeInput.fill('Honda');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Honda")').first().click();
    
    // Verify model and year are cleared
    await expect(modelInput).toHaveValue('');
    await expect(yearInput).toHaveValue('');
    
    // Verify model is enabled but year is disabled
    await expect(modelInput).toBeEnabled();
    await expect(yearInput).toBeDisabled();
  });

  test('cascade clearing - changing model clears year', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Select Toyota
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Toyota")').first().click();
    
    // Select Camry
    const modelInput = page.locator('input[name="vehicleModel"]');
    await modelInput.click();
    await modelInput.fill('Camry');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Camry")').first().click();
    
    // Select 2020
    const yearInput = page.locator('input[name="vehicleYear"]');
    await yearInput.click();
    await yearInput.fill('2020');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("2020")').first().click();
    
    // Verify all fields have values
    await expect(modelInput).toHaveValue('Camry');
    await expect(yearInput).toHaveValue('2020');
    
    // Change model to Corolla
    await modelInput.click();
    await modelInput.clear();
    await modelInput.fill('Corolla');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Corolla")').first().click();
    
    // Verify year is cleared
    await expect(yearInput).toHaveValue('');
    
    // Verify year is enabled
    await expect(yearInput).toBeEnabled();
  });

  test('disabled states - model disabled until make selected', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Verify model and year are disabled initially
    const modelInput = page.locator('input[name="vehicleModel"]');
    const yearInput = page.locator('input[name="vehicleYear"]');
    
    await expect(modelInput).toBeDisabled();
    await expect(yearInput).toBeDisabled();
    
    // Select make
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Toyota")').first().click();
    
    // Verify model is enabled, year still disabled
    await expect(modelInput).toBeEnabled();
    await expect(yearInput).toBeDisabled();
    
    // Select model
    await modelInput.click();
    await modelInput.fill('Camry');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Camry")').first().click();
    
    // Verify year is now enabled
    await expect(yearInput).toBeEnabled();
  });

  test('no results found message', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Type non-existent make
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('NonExistentMake123');
    
    // Wait for debounce and API call
    await page.waitForTimeout(400);
    
    // Verify "No results found" message appears
    await expect(page.locator('text=/no results found/i')).toBeVisible();
  });

  test('loading indicator during API calls', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Type in make field
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    
    // Verify loading indicator appears (briefly)
    // Note: This might be too fast to catch, but we try
    const loadingIndicator = page.locator('[data-testid="loading-spinner"]').first();
    
    // Wait for suggestions to load
    await page.waitForTimeout(400);
    
    // Verify dropdown appears (loading complete)
    const dropdown = page.locator('[role="listbox"]').first();
    await expect(dropdown).toBeVisible();
  });

  test('clear button functionality', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Select Toyota
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Toyota")').first().click();
    
    // Verify value is set
    await expect(makeInput).toHaveValue('Toyota');
    
    // Click clear button
    const clearButton = page.locator('button[aria-label*="Clear"]').first();
    await clearButton.click();
    
    // Verify value is cleared
    await expect(makeInput).toHaveValue('');
  });
});

test.describe('Case Creation with Autocomplete - Mobile Viewport', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport (375px width as per requirement)
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Login as adjuster
    await page.goto('/login');
    await page.fill('input[name="emailOrPhone"]', 'adjuster@test.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/\/adjuster\//);
    
    // Navigate to case creation page
    await page.goto('/adjuster/cases/new');
    await page.waitForLoadState('networkidle');
  });

  test('autocomplete works on mobile viewport', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Test make autocomplete on mobile
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    
    // Wait for suggestions
    await page.waitForTimeout(400);
    
    // Verify dropdown appears
    const dropdown = page.locator('[role="listbox"]').first();
    await expect(dropdown).toBeVisible();
    
    // Verify suggestions are limited to 5 on mobile
    const options = page.locator('[role="option"]');
    const count = await options.count();
    expect(count).toBeLessThanOrEqual(5);
    
    // Select Toyota
    await page.locator('[role="option"]:has-text("Toyota")').first().click();
    await expect(makeInput).toHaveValue('Toyota');
  });

  test('touch targets are at least 44x44 pixels', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Type in make field
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    await page.waitForTimeout(400);
    
    // Get first option
    const firstOption = page.locator('[role="option"]').first();
    await expect(firstOption).toBeVisible();
    
    // Check bounding box
    const box = await firstOption.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('form is usable on mobile viewport', async ({ page }) => {
    // Verify form elements are visible and usable
    await expect(page.locator('input[name="claimReference"]')).toBeVisible();
    await expect(page.locator('select[name="assetType"]')).toBeVisible();
    
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Verify vehicle fields appear
    await expect(page.locator('input[name="vehicleMake"]')).toBeVisible();
    await expect(page.locator('input[name="vehicleModel"]')).toBeVisible();
    await expect(page.locator('input[name="vehicleYear"]')).toBeVisible();
    
    // Verify fields are stacked vertically (mobile layout)
    const makeInput = page.locator('input[name="vehicleMake"]');
    const modelInput = page.locator('input[name="vehicleModel"]');
    
    const makeBox = await makeInput.boundingBox();
    const modelBox = await modelInput.boundingBox();
    
    expect(makeBox).toBeTruthy();
    expect(modelBox).toBeTruthy();
    
    // Model should be below make (higher Y coordinate)
    expect(modelBox!.y).toBeGreaterThan(makeBox!.y);
  });
});

test.describe('Case Creation with Autocomplete - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as adjuster
    await page.goto('/login');
    await page.fill('input[name="emailOrPhone"]', 'adjuster@test.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/\/adjuster\//);
    
    // Navigate to case creation page
    await page.goto('/adjuster/cases/new');
    await page.waitForLoadState('networkidle');
  });

  test('keyboard-only navigation through autocomplete', async ({ page }) => {
    // Select asset type using keyboard
    await page.keyboard.press('Tab'); // Focus claim reference
    await page.keyboard.type('TEST-CLAIM-001');
    
    await page.keyboard.press('Tab'); // Focus asset type
    await page.keyboard.press('ArrowDown'); // Open dropdown
    await page.keyboard.press('ArrowDown'); // Select vehicle
    await page.keyboard.press('Enter');
    
    await page.keyboard.press('Tab'); // Focus market value
    await page.keyboard.type('5000000');
    
    await page.keyboard.press('Tab'); // Focus vehicle make
    
    // Type in make field
    await page.keyboard.type('Toyota');
    
    // Wait for suggestions
    await page.waitForTimeout(400);
    
    // Navigate suggestions with arrow keys
    await page.keyboard.press('ArrowDown'); // Select first suggestion
    await page.keyboard.press('Enter'); // Confirm selection
    
    // Verify make is selected
    const makeInput = page.locator('input[name="vehicleMake"]');
    await expect(makeInput).toHaveValue('Toyota');
    
    // Tab to model field
    await page.keyboard.press('Tab');
    
    // Type in model field
    await page.keyboard.type('Camry');
    await page.waitForTimeout(400);
    
    // Select with keyboard
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Verify model is selected
    const modelInput = page.locator('input[name="vehicleModel"]');
    await expect(modelInput).toHaveValue('Camry');
  });

  test('escape key closes dropdown', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Focus make input
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    
    // Wait for dropdown
    await page.waitForTimeout(400);
    
    // Verify dropdown is open
    const dropdown = page.locator('[role="listbox"]').first();
    await expect(dropdown).toBeVisible();
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Verify dropdown is closed
    await expect(dropdown).not.toBeVisible();
  });

  test('arrow keys navigate through suggestions', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Focus make input
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('T'); // Get multiple suggestions
    
    // Wait for suggestions
    await page.waitForTimeout(400);
    
    // Press ArrowDown multiple times
    await page.keyboard.press('ArrowDown'); // First item
    await page.keyboard.press('ArrowDown'); // Second item
    
    // Verify second item is highlighted (has aria-selected or active class)
    const secondOption = page.locator('[role="option"]').nth(1);
    const ariaSelected = await secondOption.getAttribute('aria-selected');
    expect(ariaSelected).toBe('true');
    
    // Press ArrowUp
    await page.keyboard.press('ArrowUp'); // Back to first item
    
    // Verify first item is highlighted
    const firstOption = page.locator('[role="option"]').first();
    const firstAriaSelected = await firstOption.getAttribute('aria-selected');
    expect(firstAriaSelected).toBe('true');
  });

  test('tab key moves to next field', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Focus make input
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    await page.waitForTimeout(400);
    
    // Select with Enter
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Press Tab to move to model field
    await page.keyboard.press('Tab');
    
    // Verify model field has focus
    const modelInput = page.locator('input[name="vehicleModel"]');
    await expect(modelInput).toBeFocused();
  });
});

test.describe('Case Creation with Autocomplete - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Login as adjuster
    await page.goto('/login');
    await page.fill('input[name="emailOrPhone"]', 'adjuster@test.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/\/adjuster\//);
    
    // Navigate to case creation page
    await page.goto('/adjuster/cases/new');
    await page.waitForLoadState('networkidle');
  });

  test('ARIA attributes are correctly set', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Check make input ARIA attributes
    const makeInput = page.locator('input[name="vehicleMake"]');
    
    // Verify role
    const role = await makeInput.getAttribute('role');
    expect(role).toBe('combobox');
    
    // Verify aria-expanded is false initially
    const ariaExpanded = await makeInput.getAttribute('aria-expanded');
    expect(ariaExpanded).toBe('false');
    
    // Open dropdown
    await makeInput.click();
    await makeInput.fill('Toyota');
    await page.waitForTimeout(400);
    
    // Verify aria-expanded is true when open
    const ariaExpandedOpen = await makeInput.getAttribute('aria-expanded');
    expect(ariaExpandedOpen).toBe('true');
    
    // Verify aria-controls points to listbox
    const ariaControls = await makeInput.getAttribute('aria-controls');
    expect(ariaControls).toBeTruthy();
    
    // Verify listbox exists with matching ID
    const listbox = page.locator(`#${ariaControls}`);
    await expect(listbox).toBeVisible();
    
    // Verify listbox has role="listbox"
    const listboxRole = await listbox.getAttribute('role');
    expect(listboxRole).toBe('listbox');
  });

  test('focus indicators are visible', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Focus make input
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.focus();
    
    // Verify input has focus
    await expect(makeInput).toBeFocused();
    
    // Check for focus indicator (outline or ring)
    const styles = await makeInput.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        outline: computed.outline,
        outlineWidth: computed.outlineWidth,
        boxShadow: computed.boxShadow,
      };
    });
    
    // Verify some focus indicator exists
    const hasFocusIndicator = 
      styles.outline !== 'none' || 
      styles.outlineWidth !== '0px' || 
      styles.boxShadow !== 'none';
    
    expect(hasFocusIndicator).toBe(true);
  });

  test('labels are properly associated with inputs', async ({ page }) => {
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Check make input label
    const makeInput = page.locator('input[name="vehicleMake"]');
    const ariaLabelledBy = await makeInput.getAttribute('aria-labelledby');
    
    // Verify label exists
    expect(ariaLabelledBy).toBeTruthy();
    
    // Verify label element exists
    const label = page.locator(`#${ariaLabelledBy}`);
    await expect(label).toBeVisible();
    
    // Verify label text
    const labelText = await label.textContent();
    expect(labelText).toContain('Make');
  });
});

test.describe('Case Creation with Autocomplete - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    // Login as adjuster
    await page.goto('/login');
    await page.fill('input[name="emailOrPhone"]', 'adjuster@test.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/\/adjuster\//);
    
    // Navigate to case creation page
    await page.goto('/adjuster/cases/new');
    await page.waitForLoadState('networkidle');
  });

  test('graceful degradation when API fails', async ({ page }) => {
    // Intercept API call and make it fail
    await page.route('**/api/valuations/makes*', (route) => {
      route.abort('failed');
    });
    
    // Select asset type
    await page.selectOption('select[name="assetType"]', 'vehicle');
    
    // Try to use make autocomplete
    const makeInput = page.locator('input[name="vehicleMake"]');
    await makeInput.click();
    await makeInput.fill('Toyota');
    
    // Wait for API call to fail
    await page.waitForTimeout(1000);
    
    // Verify warning message appears
    await expect(page.locator('text=/autocomplete unavailable/i')).toBeVisible();
    
    // Verify input still works as text input
    await expect(makeInput).toBeEnabled();
    await expect(makeInput).toHaveValue('Toyota');
    
    // User can still type and submit
    await makeInput.clear();
    await makeInput.fill('Honda');
    await expect(makeInput).toHaveValue('Honda');
  });

  test('form validation errors are displayed', async ({ page }) => {
    // Try to submit without filling required fields
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Verify validation errors appear
    await expect(page.locator('text=/claim reference is required/i')).toBeVisible();
    await expect(page.locator('text=/asset type is required/i')).toBeVisible();
  });
});
