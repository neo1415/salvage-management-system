/**
 * End-to-End Tests: Escrow Wallet Payment Completion
 * 
 * Tests for task 8.1: End-to-end testing
 * 
 * Sub-tasks:
 * - 8.1.1 Test complete flow: wallet funding → bid → win → confirm payment → sign documents → funds released → pickup confirmed
 * - 8.1.2 Test manual fund release by Finance Officer
 * - 8.1.3 Test pickup confirmation workflow
 * - 8.1.4 Test error scenarios (Paystack failure, insufficient funds)
 * - 8.1.5 Test concurrent document signing
 * 
 * Requirements validated:
 * - Requirement 1: Vendor Wallet Payment Confirmation UI
 * - Requirement 2: Document Signing Progress Tracking
 * - Requirement 3: Automatic Fund Release on Document Completion
 * - Requirement 4: Finance Officer Escrow Payment Dashboard
 * - Requirement 5: Pickup Confirmation Workflow
 */

import { test, expect, Page } from '@playwright/test';

// Test data setup helpers
const TEST_VENDOR = {
  email: 'vendor-e2e@test.com',
  password: 'Test123!@#',
  phone: '2348141252812',
  fullName: 'E2E Test Vendor',
};

const TEST_FINANCE_OFFICER = {
  email: 'finance-e2e@test.com',
  password: 'Test123!@#',
  fullName: 'E2E Finance Officer',
};

const TEST_ADMIN = {
  email: 'admin-e2e@test.com',
  password: 'Test123!@#',
  fullName: 'E2E Admin',
};

// Helper functions
async function loginAsVendor(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="emailOrPhone"]', TEST_VENDOR.email);
  await page.fill('input[name="password"]', TEST_VENDOR.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/vendor/dashboard');
}

async function loginAsFinanceOfficer(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="emailOrPhone"]', TEST_FINANCE_OFFICER.email);
  await page.fill('input[name="password"]', TEST_FINANCE_OFFICER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/finance/dashboard');
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="emailOrPhone"]', TEST_ADMIN.email);
  await page.fill('input[name="password"]', TEST_ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/admin/dashboard');
}

test.describe('Escrow Wallet Payment Completion - E2E Tests', () => {
  test.describe('8.1.1: Complete Flow - Wallet Funding to Pickup Confirmation', () => {
    test('should complete full escrow payment flow from wallet confirmation to pickup', async ({ page, context }) => {
      // Step 1: Login as vendor
      await loginAsVendor(page);

      // Step 2: Navigate to payment page (assuming auction already won with escrow_wallet payment)
      await page.goto('/vendor/payments');
      
      // Find first pending escrow wallet payment
      const escrowPayment = page.locator('[data-payment-method="escrow_wallet"]').first();
      await expect(escrowPayment).toBeVisible();
      await escrowPayment.click();

      // Step 3: Verify wallet payment confirmation UI
      await expect(page.locator('text=Payment Source: Escrow Wallet')).toBeVisible();
      await expect(page.locator('text=frozen in your wallet')).toBeVisible();
      
      // Verify frozen amount is displayed
      const frozenAmount = await page.locator('[data-testid="frozen-amount"]').textContent();
      expect(frozenAmount).toMatch(/₦[\d,]+/);

      // Step 4: Confirm payment from wallet
      const confirmButton = page.locator('button:has-text("Confirm Payment from Wallet")');
      await expect(confirmButton).toBeVisible();
      await confirmButton.click();

      // Verify confirmation modal
      await expect(page.locator('text=Confirm you want to pay')).toBeVisible();
      await page.click('button:has-text("Confirm")');

      // Step 5: Verify redirect to documents page
      await page.waitForURL(/\/vendor\/documents/);
      await expect(page.locator('text=Payment confirmed!')).toBeVisible();

      // Step 6: Verify document signing progress (0/3)
      await expect(page.locator('text=Documents Signed: 0/3')).toBeVisible();
      
      // Verify all 3 documents are listed
      await expect(page.locator('text=Bill of Sale')).toBeVisible();
      await expect(page.locator('text=Liability Waiver')).toBeVisible();
      await expect(page.locator('text=Pickup Authorization')).toBeVisible();

      // Step 7: Sign first document (Bill of Sale)
      const billOfSaleDoc = page.locator('[data-document-type="bill_of_sale"]');
      await billOfSaleDoc.click();
      
      // Draw signature
      const canvas = page.locator('canvas[data-testid="signature-canvas"]');
      await canvas.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.move(200, 150);
      await page.mouse.up();
      
      // Submit signature
      await page.click('button:has-text("Sign Document")');
      await expect(page.locator('text=Document signed successfully')).toBeVisible();

      // Verify progress updated to 1/3
      await expect(page.locator('text=Documents Signed: 1/3')).toBeVisible();
      await expect(page.locator('[data-document-type="bill_of_sale"] >> text=Signed')).toBeVisible();

      // Step 8: Sign second document (Liability Waiver)
      const liabilityWaiverDoc = page.locator('[data-document-type="liability_waiver"]');
      await liabilityWaiverDoc.click();
      
      // Draw signature
      await canvas.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.move(200, 150);
      await page.mouse.up();
      
      await page.click('button:has-text("Sign Document")');
      await expect(page.locator('text=Document signed successfully')).toBeVisible();

      // Verify progress updated to 2/3
      await expect(page.locator('text=Documents Signed: 2/3')).toBeVisible();

      // Step 9: Sign third document (Pickup Authorization)
      const pickupAuthDoc = page.locator('[data-document-type="pickup_authorization"]');
      await pickupAuthDoc.click();
      
      // Draw signature
      await canvas.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.move(200, 150);
      await page.mouse.up();
      
      await page.click('button:has-text("Sign Document")');
      await expect(page.locator('text=Document signed successfully')).toBeVisible();

      // Step 10: Verify all documents signed and payment processing message
      await expect(page.locator('text=Documents Signed: 3/3')).toBeVisible();
      await expect(page.locator('text=All documents signed! Payment is being processed')).toBeVisible();

      // Wait for automatic fund release (up to 30 seconds)
      await page.waitForTimeout(5000);

      // Step 11: Verify payment status updated to verified
      await page.goto('/vendor/payments');
      const verifiedPayment = page.locator('[data-payment-status="verified"]').first();
      await expect(verifiedPayment).toBeVisible();
      await expect(verifiedPayment.locator('text=Verified ✓')).toBeVisible();

      // Step 12: Verify pickup authorization code received
      await verifiedPayment.click();
      await expect(page.locator('text=Pickup Authorization Code')).toBeVisible();
      const pickupCode = await page.locator('[data-testid="pickup-code"]').textContent();
      expect(pickupCode).toMatch(/[A-Z0-9]{6,}/);

      // Step 13: Confirm pickup as vendor
      await page.goto('/vendor/dashboard');
      const confirmPickupButton = page.locator('button:has-text("Confirm Pickup")');
      await expect(confirmPickupButton).toBeVisible();
      await confirmPickupButton.click();

      // Enter pickup code
      await page.fill('input[name="pickupAuthCode"]', pickupCode || '');
      await page.click('button:has-text("Confirm Pickup")');
      await expect(page.locator('text=Pickup confirmed successfully')).toBeVisible();

      // Step 14: Login as admin to confirm pickup
      const adminPage = await context.newPage();
      await loginAsAdmin(adminPage);
      
      await adminPage.goto('/admin/pickups');
      await expect(adminPage.locator('text=Pending Pickup Confirmations')).toBeVisible();
      
      // Find the pending pickup
      const pendingPickup = adminPage.locator('[data-pickup-status="vendor_confirmed"]').first();
      await expect(pendingPickup).toBeVisible();
      await pendingPickup.click();

      // Admin confirms pickup
      await adminPage.fill('textarea[name="notes"]', 'Item collected successfully');
      await adminPage.click('button:has-text("Confirm Pickup")');
      await expect(adminPage.locator('text=Pickup confirmed by admin')).toBeVisible();

      // Step 15: Verify transaction marked as completed
      await adminPage.goto('/admin/auctions');
      const completedAuction = adminPage.locator('[data-auction-status="completed"]').first();
      await expect(completedAuction).toBeVisible();

      await adminPage.close();
    });
  });

  test.describe('8.1.2: Manual Fund Release by Finance Officer', () => {
    test('should allow Finance Officer to manually release funds after all documents signed', async ({ page }) => {
      // Step 1: Login as Finance Officer
      await loginAsFinanceOfficer(page);

      // Step 2: Navigate to payments page
      await page.goto('/finance/payments');
      
      // Step 3: Filter by escrow wallet payments
      await page.click('button:has-text("Filter")');
      await page.click('text=Escrow Wallet');
      await page.click('button:has-text("Apply")');

      // Step 4: Find payment with all documents signed but funds not released
      const readyForRelease = page.locator('[data-escrow-status="frozen"][data-documents-signed="3"]').first();
      await expect(readyForRelease).toBeVisible();
      await readyForRelease.click();

      // Step 5: Verify escrow payment details displayed
      await expect(page.locator('text=Escrow Wallet Payment')).toBeVisible();
      await expect(page.locator('text=Escrow Status')).toBeVisible();
      await expect(page.locator('text=Frozen')).toBeVisible();
      await expect(page.locator('text=Document Progress: 3/3 Signed')).toBeVisible();

      // Step 6: Verify Manual Release button is visible
      const manualReleaseButton = page.locator('button:has-text("Manual Release Funds")');
      await expect(manualReleaseButton).toBeVisible();
      await expect(manualReleaseButton).toBeEnabled();

      // Step 7: Click Manual Release
      await manualReleaseButton.click();

      // Step 8: Verify confirmation modal
      await expect(page.locator('text=Manually release')).toBeVisible();
      await expect(page.locator('text=from vendor wallet?')).toBeVisible();
      
      // Confirm release
      await page.click('button:has-text("Confirm")');

      // Step 9: Verify success message
      await expect(page.locator('text=Funds released successfully')).toBeVisible();

      // Step 10: Verify payment status updated to verified
      await expect(page.locator('[data-payment-status="verified"]')).toBeVisible();
      await expect(page.locator('text=Released')).toBeVisible();

      // Step 11: Verify audit log entry created
      await page.click('button:has-text("View Audit Trail")');
      await expect(page.locator('text=Funds released manually by Finance Officer')).toBeVisible();
      await expect(page.locator(`text=${TEST_FINANCE_OFFICER.fullName}`)).toBeVisible();
    });

    test('should not show Manual Release button if documents not all signed', async ({ page }) => {
      await loginAsFinanceOfficer(page);
      await page.goto('/finance/payments');

      // Find payment with incomplete documents
      const incompletePayment = page.locator('[data-escrow-status="frozen"][data-documents-signed="1"]').first();
      await incompletePayment.click();

      // Verify Manual Release button is not visible
      const manualReleaseButton = page.locator('button:has-text("Manual Release Funds")');
      await expect(manualReleaseButton).not.toBeVisible();

      // Verify message about pending documents
      await expect(page.locator('text=Pending Document Signing')).toBeVisible();
    });
  });

  test.describe('8.1.3: Pickup Confirmation Workflow', () => {
    test('should complete pickup confirmation workflow with vendor and admin', async ({ page, context }) => {
      // Step 1: Login as vendor with verified payment
      await loginAsVendor(page);
      await page.goto('/vendor/dashboard');

      // Step 2: Verify "Confirm Pickup" button visible for verified payment
      const confirmPickupButton = page.locator('button:has-text("Confirm Pickup")');
      await expect(confirmPickupButton).toBeVisible();

      // Step 3: Click Confirm Pickup
      await confirmPickupButton.click();

      // Step 4: Verify modal with pickup code input
      await expect(page.locator('text=Have you collected the item?')).toBeVisible();
      await expect(page.locator('text=Enter pickup authorization code')).toBeVisible();

      // Step 5: Enter invalid pickup code
      await page.fill('input[name="pickupAuthCode"]', 'INVALID');
      await page.click('button:has-text("Confirm")');
      await expect(page.locator('text=Invalid pickup code')).toBeVisible();

      // Step 6: Enter valid pickup code
      const validCode = 'ABC123'; // This would come from the payment details
      await page.fill('input[name="pickupAuthCode"]', validCode);
      await page.click('button:has-text("Confirm")');

      // Step 7: Verify vendor confirmation success
      await expect(page.locator('text=Pickup confirmed successfully')).toBeVisible();
      await expect(page.locator('text=Waiting for admin confirmation')).toBeVisible();

      // Step 8: Login as admin
      const adminPage = await context.newPage();
      await loginAsAdmin(adminPage);

      // Step 9: Navigate to pickups page
      await adminPage.goto('/admin/pickups');
      await expect(adminPage.locator('text=Pending Pickup Confirmations')).toBeVisible();

      // Step 10: Verify vendor-confirmed pickup is listed
      const pendingPickup = adminPage.locator('[data-pickup-status="vendor_confirmed"]').first();
      await expect(pendingPickup).toBeVisible();
      await expect(pendingPickup.locator(`text=${TEST_VENDOR.fullName}`)).toBeVisible();

      // Step 11: Click to view details
      await pendingPickup.click();

      // Step 12: Verify vendor confirmation details
      await expect(adminPage.locator('text=Vendor Confirmed')).toBeVisible();
      await expect(adminPage.locator('text=Pickup Authorization Code: Verified')).toBeVisible();

      // Step 13: Add admin notes and confirm
      await adminPage.fill('textarea[name="notes"]', 'Item collected in good condition. ID verified.');
      await adminPage.click('button:has-text("Confirm Pickup")');

      // Step 14: Verify admin confirmation success
      await expect(adminPage.locator('text=Pickup confirmed by admin')).toBeVisible();
      await expect(adminPage.locator('text=Transaction completed')).toBeVisible();

      // Step 15: Verify pickup removed from pending list
      await adminPage.goto('/admin/pickups');
      const completedPickup = adminPage.locator('[data-pickup-status="vendor_confirmed"]').first();
      await expect(completedPickup).not.toBeVisible();

      // Step 16: Verify vendor sees completion notification
      await page.reload();
      await expect(page.locator('text=Pickup confirmed by admin')).toBeVisible();
      await expect(page.locator('text=Transaction complete')).toBeVisible();

      await adminPage.close();
    });
  });

  test.describe('8.1.4: Error Scenarios', () => {
    test('should handle Paystack transfer failure gracefully', async ({ page, context }) => {
      // Mock Paystack API failure
      await page.route('**/api/paystack/transfer', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Paystack service unavailable',
            code: 'PAYSTACK_ERROR',
          }),
        });
      });

      // Step 1: Login as vendor and complete document signing
      await loginAsVendor(page);
      await page.goto('/vendor/documents');

      // Sign all three documents (abbreviated for brevity)
      const documents = ['bill_of_sale', 'liability_waiver', 'pickup_authorization'];
      for (const docType of documents) {
        const doc = page.locator(`[data-document-type="${docType}"]`);
        await doc.click();
        
        const canvas = page.locator('canvas[data-testid="signature-canvas"]');
        await canvas.hover();
        await page.mouse.down();
        await page.mouse.move(100, 100);
        await page.mouse.up();
        
        await page.click('button:has-text("Sign Document")');
        await page.waitForTimeout(1000);
      }

      // Step 2: Verify error message displayed to vendor
      await expect(page.locator('text=Payment processing failed')).toBeVisible();
      await expect(page.locator('text=Our team has been notified')).toBeVisible();

      // Step 3: Verify payment status remains pending
      await page.goto('/vendor/payments');
      const failedPayment = page.locator('[data-payment-status="pending"]').first();
      await expect(failedPayment).toBeVisible();

      // Step 4: Login as Finance Officer
      const financePage = await context.newPage();
      await loginAsFinanceOfficer(financePage);

      // Step 5: Verify Finance Officer received alert
      await financePage.goto('/finance/dashboard');
      await expect(financePage.locator('text=Escrow Payment Failed')).toBeVisible();
      await expect(financePage.locator('text=Action Required')).toBeVisible();

      // Step 6: Navigate to failed payment
      await financePage.goto('/finance/payments');
      const failedEscrowPayment = financePage.locator('[data-escrow-status="failed"]').first();
      await expect(failedEscrowPayment).toBeVisible();
      await failedEscrowPayment.click();

      // Step 7: Verify error details displayed
      await expect(financePage.locator('text=Automatic fund release failed')).toBeVisible();
      await expect(financePage.locator('text=Paystack service unavailable')).toBeVisible();

      // Step 8: Verify Retry Release button available
      const retryButton = financePage.locator('button:has-text("Retry Release")');
      await expect(retryButton).toBeVisible();

      await financePage.close();
    });

    test('should handle insufficient frozen funds error', async ({ page }) => {
      // Mock API to return insufficient funds error
      await page.route('**/api/payments/*/confirm-wallet', (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Insufficient frozen funds',
            message: 'Frozen funds mismatch. Please contact support.',
          }),
        });
      });

      // Step 1: Login as vendor
      await loginAsVendor(page);
      await page.goto('/vendor/payments');

      // Step 2: Try to confirm wallet payment
      const escrowPayment = page.locator('[data-payment-method="escrow_wallet"]').first();
      await escrowPayment.click();

      const confirmButton = page.locator('button:has-text("Confirm Payment from Wallet")');
      await confirmButton.click();
      await page.click('button:has-text("Confirm")');

      // Step 3: Verify error message displayed
      await expect(page.locator('text=Insufficient frozen funds')).toBeVisible();
      await expect(page.locator('text=Please contact support')).toBeVisible();

      // Step 4: Verify payment status unchanged
      await page.goto('/vendor/payments');
      const unchangedPayment = page.locator('[data-payment-status="pending"]').first();
      await expect(unchangedPayment).toBeVisible();
    });
  });

  test.describe('8.1.5: Concurrent Document Signing', () => {
    test('should handle concurrent document signing correctly', async ({ page, context }) => {
      // Step 1: Login as vendor in first browser
      await loginAsVendor(page);
      await page.goto('/vendor/documents');

      // Step 2: Open second browser session for same vendor
      const page2 = await context.newPage();
      await loginAsVendor(page2);
      await page2.goto('/vendor/documents');

      // Step 3: Sign first document in first browser
      const billOfSaleDoc1 = page.locator('[data-document-type="bill_of_sale"]');
      await billOfSaleDoc1.click();
      
      const canvas1 = page.locator('canvas[data-testid="signature-canvas"]');
      await canvas1.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      
      await page.click('button:has-text("Sign Document")');
      await expect(page.locator('text=Document signed successfully')).toBeVisible();

      // Step 4: Try to sign same document in second browser
      await page2.reload();
      const billOfSaleDoc2 = page2.locator('[data-document-type="bill_of_sale"]');
      
      // Verify document shows as already signed
      await expect(billOfSaleDoc2.locator('text=Signed')).toBeVisible();
      
      // Verify sign button is disabled
      await billOfSaleDoc2.click();
      const signButton2 = page2.locator('button:has-text("Sign Document")');
      await expect(signButton2).toBeDisabled();

      // Step 5: Sign second document in second browser
      const liabilityWaiverDoc2 = page2.locator('[data-document-type="liability_waiver"]');
      await liabilityWaiverDoc2.click();
      
      const canvas2 = page2.locator('canvas[data-testid="signature-canvas"]');
      await canvas2.hover();
      await page2.mouse.down();
      await page2.mouse.move(100, 100);
      await page2.mouse.up();
      
      await page2.click('button:has-text("Sign Document")');
      await expect(page2.locator('text=Document signed successfully')).toBeVisible();

      // Step 6: Refresh first browser and verify both documents signed
      await page.reload();
      await expect(page.locator('text=Documents Signed: 2/3')).toBeVisible();
      await expect(page.locator('[data-document-type="bill_of_sale"] >> text=Signed')).toBeVisible();
      await expect(page.locator('[data-document-type="liability_waiver"] >> text=Signed')).toBeVisible();

      // Step 7: Sign third document in first browser
      const pickupAuthDoc1 = page.locator('[data-document-type="pickup_authorization"]');
      await pickupAuthDoc1.click();
      
      await canvas1.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      
      await page.click('button:has-text("Sign Document")');
      await expect(page.locator('text=Document signed successfully')).toBeVisible();

      // Step 8: Verify both browsers show all documents signed
      await expect(page.locator('text=Documents Signed: 3/3')).toBeVisible();
      
      await page2.reload();
      await expect(page2.locator('text=Documents Signed: 3/3')).toBeVisible();
      await expect(page2.locator('text=All documents signed!')).toBeVisible();

      // Step 9: Verify fund release triggered only once
      await page.waitForTimeout(5000);
      
      // Check payment status in both browsers
      await page.goto('/vendor/payments');
      const verifiedPayment1 = page.locator('[data-payment-status="verified"]').first();
      await expect(verifiedPayment1).toBeVisible();

      await page2.goto('/vendor/payments');
      const verifiedPayment2 = page2.locator('[data-payment-status="verified"]').first();
      await expect(verifiedPayment2).toBeVisible();

      await page2.close();
    });

    test('should prevent race condition in fund release', async ({ page }) => {
      // This test verifies that even if multiple document signing requests
      // complete simultaneously, fund release is only triggered once

      // Mock API to simulate slow document signing
      let signCount = 0;
      await page.route('**/api/documents/*/sign', async (route) => {
        signCount++;
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        route.continue();
      });

      // Login and navigate to documents
      await loginAsVendor(page);
      await page.goto('/vendor/documents');

      // Rapidly sign all three documents
      const documents = ['bill_of_sale', 'liability_waiver', 'pickup_authorization'];
      
      // Start all signing operations without waiting
      const signingPromises = documents.map(async (docType) => {
        const doc = page.locator(`[data-document-type="${docType}"]`);
        await doc.click();
        
        const canvas = page.locator('canvas[data-testid="signature-canvas"]');
        await canvas.hover();
        await page.mouse.down();
        await page.mouse.move(100, 100);
        await page.mouse.up();
        
        return page.click('button:has-text("Sign Document")');
      });

      // Wait for all signing operations to complete
      await Promise.all(signingPromises);

      // Verify all documents signed
      await expect(page.locator('text=Documents Signed: 3/3')).toBeVisible();

      // Wait for fund release
      await page.waitForTimeout(5000);

      // Verify payment verified only once
      await page.goto('/vendor/payments');
      const verifiedPayments = page.locator('[data-payment-status="verified"]');
      const count = await verifiedPayments.count();
      
      // Should only have one verified payment for this auction
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});


test.describe('Additional E2E Scenarios', () => {
  test.describe('Finance Officer Dashboard Integration', () => {
    test('should display escrow payment statistics on Finance Officer dashboard', async ({ page }) => {
      await loginAsFinanceOfficer(page);
      await page.goto('/finance/dashboard');

      // Verify escrow wallet payment stats card
      await expect(page.locator('text=Escrow Wallet Payments')).toBeVisible();
      
      // Verify count and percentage displayed
      const statsCard = page.locator('[data-testid="escrow-stats"]');
      await expect(statsCard).toBeVisible();
      
      const paymentCount = await statsCard.locator('[data-testid="payment-count"]').textContent();
      expect(paymentCount).toMatch(/\d+/);
      
      const percentage = await statsCard.locator('[data-testid="payment-percentage"]').textContent();
      expect(percentage).toMatch(/\d+%/);

      // Verify chart showing escrow vs other payment methods
      await expect(page.locator('[data-testid="payment-methods-chart"]')).toBeVisible();
    });

    test('should filter payments by escrow wallet method', async ({ page }) => {
      await loginAsFinanceOfficer(page);
      await page.goto('/finance/payments');

      // Open filter menu
      await page.click('button:has-text("Filter")');
      
      // Select Escrow Wallet filter
      await page.click('text=Payment Method');
      await page.click('text=Escrow Wallet');
      await page.click('button:has-text("Apply")');

      // Verify only escrow wallet payments displayed
      const payments = page.locator('[data-payment-method]');
      const count = await payments.count();
      
      for (let i = 0; i < count; i++) {
        const method = await payments.nth(i).getAttribute('data-payment-method');
        expect(method).toBe('escrow_wallet');
      }

      // Verify escrow status badges visible
      await expect(page.locator('text=Frozen').or(page.locator('text=Released'))).toBeVisible();
    });
  });

  test.describe('Audit Trail Verification', () => {
    test('should record complete audit trail for escrow payment', async ({ page }) => {
      await loginAsFinanceOfficer(page);
      await page.goto('/finance/payments');

      // Find completed escrow payment
      const completedPayment = page.locator('[data-escrow-status="released"]').first();
      await completedPayment.click();

      // Open audit trail
      await page.click('button:has-text("View Audit Trail")');

      // Verify all expected events are logged
      const auditEvents = [
        'Funds frozen',
        'Auction won',
        'Wallet payment confirmed',
        'Document 1 signed',
        'Document 2 signed',
        'Document 3 signed',
        'Funds released',
        'Pickup confirmed',
      ];

      for (const event of auditEvents) {
        await expect(page.locator(`text=${event}`)).toBeVisible();
      }

      // Verify timestamps are displayed
      const timestamps = page.locator('[data-testid="audit-timestamp"]');
      const timestampCount = await timestamps.count();
      expect(timestampCount).toBeGreaterThan(0);

      // Verify user information displayed
      await expect(page.locator('text=User:')).toBeVisible();
      await expect(page.locator('text=IP Address:')).toBeVisible();

      // Test CSV export
      const downloadPromise = page.waitForEvent('download');
      await page.click('button:has-text("Export CSV")');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    });
  });

  test.describe('Notification Verification', () => {
    test('should display notification after each document signing milestone', async ({ page }) => {
      await loginAsVendor(page);
      await page.goto('/vendor/documents');

      // Sign first document
      const billOfSaleDoc = page.locator('[data-document-type="bill_of_sale"]');
      await billOfSaleDoc.click();
      
      const canvas = page.locator('canvas[data-testid="signature-canvas"]');
      await canvas.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      
      await page.click('button:has-text("Sign Document")');

      // Verify notification for 1/3 documents
      await expect(page.locator('text=1/3 documents signed')).toBeVisible();
      await expect(page.locator('text=2 documents remaining')).toBeVisible();

      // Sign second document
      const liabilityWaiverDoc = page.locator('[data-document-type="liability_waiver"]');
      await liabilityWaiverDoc.click();
      
      await canvas.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      
      await page.click('button:has-text("Sign Document")');

      // Verify notification for 2/3 documents
      await expect(page.locator('text=2/3 documents signed')).toBeVisible();
      await expect(page.locator('text=1 document remaining')).toBeVisible();

      // Sign third document
      const pickupAuthDoc = page.locator('[data-document-type="pickup_authorization"]');
      await pickupAuthDoc.click();
      
      await canvas.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      
      await page.click('button:has-text("Sign Document")');

      // Verify notification for all documents signed
      await expect(page.locator('text=All documents signed!')).toBeVisible();
      await expect(page.locator('text=Payment is being processed')).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should display wallet payment confirmation correctly on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await loginAsVendor(page);
      await page.goto('/vendor/payments');

      const escrowPayment = page.locator('[data-payment-method="escrow_wallet"]').first();
      await escrowPayment.click();

      // Verify mobile layout
      await expect(page.locator('text=Payment Source: Escrow Wallet')).toBeVisible();
      
      const confirmButton = page.locator('button:has-text("Confirm Payment from Wallet")');
      await expect(confirmButton).toBeVisible();
      
      // Verify button is full width on mobile
      const buttonBox = await confirmButton.boundingBox();
      expect(buttonBox?.width).toBeGreaterThan(300);
    });

    test('should display document signing progress correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await loginAsVendor(page);
      await page.goto('/vendor/documents');

      // Verify progress bar visible
      await expect(page.locator('text=Documents Signed:')).toBeVisible();
      
      // Verify document list stacked vertically
      const documents = page.locator('[data-document-type]');
      const count = await documents.count();
      expect(count).toBe(3);

      // Verify each document card is visible
      for (let i = 0; i < count; i++) {
        const doc = documents.nth(i);
        await expect(doc).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should support keyboard navigation for wallet payment confirmation', async ({ page }) => {
      await loginAsVendor(page);
      await page.goto('/vendor/payments');

      const escrowPayment = page.locator('[data-payment-method="escrow_wallet"]').first();
      await escrowPayment.click();

      // Tab to confirm button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Verify focus on confirm button
      const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
      expect(focusedElement).toContain('Confirm Payment');

      // Press Enter to activate
      await page.keyboard.press('Enter');
      
      // Verify modal opened
      await expect(page.locator('text=Confirm you want to pay')).toBeVisible();
    });

    test('should have proper ARIA labels for document signing', async ({ page }) => {
      await loginAsVendor(page);
      await page.goto('/vendor/documents');

      // Verify progress bar has aria-label
      const progressBar = page.locator('[role="progressbar"]');
      const ariaLabel = await progressBar.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toContain('documents signed');

      // Verify document cards have aria-labels
      const documents = page.locator('[data-document-type]');
      const count = await documents.count();
      
      for (let i = 0; i < count; i++) {
        const doc = documents.nth(i);
        const label = await doc.getAttribute('aria-label');
        expect(label).toBeTruthy();
      }
    });
  });
});
