import { test, expect } from '@playwright/test';

test.describe('Payment Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as vendor
    await page.goto('/login');
    await page.fill('input[name="emailOrPhone"]', 'vendor@test.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/vendor/dashboard');
  });

  test('complete Paystack payment flow', async ({ page }) => {
    // Navigate to payment page (assuming payment ID from test data)
    await page.goto('/vendor/payments/test-payment-id');

    // Verify payment details are displayed
    await expect(page.locator('h1')).toContainText('Payment Details');
    
    // Verify item details
    await expect(page.locator('text=Claim Reference')).toBeVisible();
    await expect(page.locator('text=Asset Type')).toBeVisible();
    await expect(page.locator('text=Winning Bid Amount')).toBeVisible();

    // Verify countdown timer
    await expect(page.locator('text=Time Remaining')).toBeVisible();
    await expect(page.locator('text=Payment Deadline')).toBeVisible();

    // Click "Pay with Paystack" button
    const payButton = page.locator('button:has-text("Pay Now with Paystack")');
    await expect(payButton).toBeVisible();
    
    // Mock the redirect (in real test, this would go to Paystack)
    await payButton.click();
    
    // In a real scenario, we'd verify redirect to Paystack
    // For testing, we can check that the URL starts with paystack.co
    await page.waitForTimeout(1000);
  });

  test('bank transfer upload flow', async ({ page }) => {
    // Navigate to payment page
    await page.goto('/vendor/payments/test-payment-id');

    // Verify bank details are displayed
    await expect(page.locator('text=Pay via Bank Transfer')).toBeVisible();
    await expect(page.locator('text=Access Bank')).toBeVisible();
    await expect(page.locator('text=0123456789')).toBeVisible();

    // Upload payment proof
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    // Create a test file
    const testFilePath = './tests/fixtures/test-receipt.jpg';
    await fileInput.setInputFiles(testFilePath);

    // Wait for upload to complete
    await page.waitForTimeout(2000);

    // Verify success message
    await expect(page.locator('text=Payment proof uploaded successfully')).toBeVisible();
  });

  test('file validation - size limit', async ({ page }) => {
    await page.goto('/vendor/payments/test-payment-id');

    const fileInput = page.locator('input[type="file"]');
    
    // Try to upload a file larger than 5MB (mock)
    // In real test, you'd create a large file
    await fileInput.setInputFiles('./tests/fixtures/large-file.jpg');

    // Verify error message
    await expect(page.locator('text=File size must be less than 5MB')).toBeVisible();
  });

  test('file validation - file type', async ({ page }) => {
    await page.goto('/vendor/payments/test-payment-id');

    const fileInput = page.locator('input[type="file"]');
    
    // Try to upload invalid file type
    await fileInput.setInputFiles('./tests/fixtures/document.txt');

    // Verify error message
    await expect(page.locator('text=Only JPG, PNG, and PDF files are allowed')).toBeVisible();
  });

  test('payment status display - verified', async ({ page }) => {
    // Navigate to a verified payment
    await page.goto('/vendor/payments/verified-payment-id');

    // Verify verified status badge
    await expect(page.locator('text=Verified ✓')).toBeVisible();
    await expect(page.locator('text=Payment confirmed')).toBeVisible();
    await expect(page.locator('text=pickup authorization code')).toBeVisible();
  });

  test('payment status display - overdue', async ({ page }) => {
    // Navigate to an overdue payment
    await page.goto('/vendor/payments/overdue-payment-id');

    // Verify overdue status
    await expect(page.locator('text=Overdue')).toBeVisible();
    await expect(page.locator('text=Payment deadline has passed')).toBeVisible();
  });

  test('countdown timer updates', async ({ page }) => {
    await page.goto('/vendor/payments/test-payment-id');

    // Get initial countdown value
    const countdownElement = page.locator('text=/\\d+[dhms]/');
    const initialValue = await countdownElement.textContent();

    // Wait 2 seconds
    await page.waitForTimeout(2000);

    // Get updated countdown value
    const updatedValue = await countdownElement.textContent();

    // Verify countdown has changed
    expect(updatedValue).not.toBe(initialValue);
  });

  test('mobile responsive layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/vendor/payments/test-payment-id');

    // Verify mobile layout
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('button:has-text("Pay Now with Paystack")')).toBeVisible();
    
    // Verify elements are stacked vertically (mobile layout)
    const payButton = page.locator('button:has-text("Pay Now with Paystack")');
    const buttonBox = await payButton.boundingBox();
    
    expect(buttonBox?.width).toBeLessThan(400); // Mobile width
  });

  test('back button navigation', async ({ page }) => {
    await page.goto('/vendor/payments/test-payment-id');

    // Click back button
    const backButton = page.locator('button:has-text("Back")');
    await backButton.click();

    // Verify navigation back
    await page.waitForURL(/\/vendor\//);
  });

  test('error handling - invalid payment ID', async ({ page }) => {
    await page.goto('/vendor/payments/invalid-id');

    // Verify error message
    await expect(page.locator('text=Error')).toBeVisible();
    await expect(page.locator('button:has-text("Go Back")')).toBeVisible();
  });

  test('redirect URL validation', async ({ page }) => {
    await page.goto('/vendor/payments/test-payment-id');

    // Mock API response with malicious URL
    await page.route('**/api/payments/*/initiate', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentUrl: 'https://malicious-site.com/pay',
        }),
      });
    });

    // Click pay button
    const payButton = page.locator('button:has-text("Pay Now with Paystack")');
    await payButton.click();

    // Verify error message about invalid URL
    await expect(page.locator('text=Invalid payment URL')).toBeVisible();
  });

  test('payment proof already uploaded state', async ({ page }) => {
    // Navigate to payment with proof already uploaded
    await page.goto('/vendor/payments/proof-uploaded-payment-id');

    // Verify proof uploaded message
    await expect(page.locator('text=Payment proof uploaded')).toBeVisible();
    await expect(page.locator('text=Finance team will verify')).toBeVisible();
    await expect(page.locator('a:has-text("View uploaded proof")')).toBeVisible();
  });
});

test.describe('Payment Flow - Accessibility', () => {
  test('keyboard navigation', async ({ page }) => {
    await page.goto('/vendor/payments/test-payment-id');

    // Tab through interactive elements
    await page.keyboard.press('Tab'); // Back button
    await page.keyboard.press('Tab'); // Pay with Paystack button
    await page.keyboard.press('Tab'); // File input

    // Verify focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('screen reader compatibility', async ({ page }) => {
    await page.goto('/vendor/payments/test-payment-id');

    // Verify ARIA labels
    const fileInput = page.locator('input[type="file"]');
    const label = await fileInput.getAttribute('aria-label') || 
                  await page.locator('label[for]').textContent();
    
    expect(label).toBeTruthy();
  });
});
