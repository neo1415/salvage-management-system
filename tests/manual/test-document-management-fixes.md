# Manual Testing Guide: Document Management Fixes

## Overview
This guide provides step-by-step instructions to manually test all 8 document management fixes.

---

## Prerequisites

1. **Test Accounts:**
   - Vendor account with verified KYC
   - Finance Officer account (for payment verification)
   - Admin account (for auction management)

2. **Test Data:**
   - At least 2 active auctions
   - Vendor has sufficient escrow wallet balance
   - Email/SMS services configured

3. **Tools:**
   - Email client (to check auction win emails)
   - SMS receiver (to check SMS notifications)
   - Browser DevTools (to check console logs)

---

## Test Suite

### TEST 1: Auction Win Email & Notifications

**Objective:** Verify vendor receives email, SMS, and push notification with correct links after winning auction.

**Steps:**
1. Log in as vendor
2. Place winning bid on an auction
3. Wait for auction to close (or manually close via admin)
4. Check vendor's email inbox

**Expected Results:**
- ✅ Email received within 1 minute
- ✅ Subject: "🎉 You Won! Sign Documents to Complete Payment - {Asset Name}"
- ✅ Email body mentions signing 3 documents
- ✅ Email lists: Bill of Sale, Liability Waiver, Pickup Authorization
- ✅ CTA button: "Sign Documents Now"
- ✅ Button links to `/vendor/auctions/{auctionId}`
- ✅ SMS received: "🎉 Congratulations! You won {Asset} for ₦{Amount}. Sign 3 documents: {link}"
- ✅ Push notification appears in notification bell
- ✅ Notification shows unread count badge

**Pass Criteria:** All notifications received with correct content and links.

---

### TEST 2: Notification Click Routing

**Objective:** Verify clicking auction win notification routes to auction details page.

**Steps:**
1. After winning auction, click notification bell icon
2. Verify notification dropdown opens
3. Find "You won!" notification
4. Click the notification

**Expected Results:**
- ✅ Notification dropdown opens
- ✅ "You won!" notification visible at top
- ✅ Notification shows: "You won '{Asset}' with a bid of ₦{Amount}. Sign 3 documents to complete payment."
- ✅ Clicking notification routes to `/vendor/auctions/{auctionId}`
- ✅ Notification marked as read (badge count decreases)
- ✅ Dropdown closes after click

**Pass Criteria:** Notification routes to correct auction details page and is marked as read.

---

### TEST 3: Auction Details Page - Document Section

**Objective:** Verify auction details page shows ONLY 3 documents for current auction.

**Steps:**
1. Navigate to auction details page after winning
2. Scroll to document signing section
3. Count the number of documents displayed
4. Check progress indicator

**Expected Results:**
- ✅ Yellow bordered section at top: "🎉 Congratulations! You Won This Auction"
- ✅ Progress shows: "Documents Signed: 0/3"
- ✅ Exactly 3 documents listed:
  - Bill of Sale
  - Release & Waiver of Liability
  - Pickup Authorization
- ✅ Each document has yellow background (pending status)
- ✅ Each document has "Sign Now" button
- ✅ Progress bar shows 0%

**Pass Criteria:** Exactly 3 documents shown with correct status and buttons.

---

### TEST 4: Document Signing Flow

**Objective:** Verify document signing works correctly and updates UI.

**Steps:**
1. On auction details page, click "Sign Now" on first document (Bill of Sale)
2. Review document content in modal
3. Draw signature on canvas
4. Click "Sign Document" button
5. Wait for success message
6. Check document card status

**Expected Results:**
- ✅ Modal opens with document preview
- ✅ Document shows correct auction details
- ✅ Signature canvas is functional
- ✅ "Sign Document" button enabled after drawing signature
- ✅ Success toast: "Document Signed Successfully"
- ✅ Modal closes automatically
- ✅ Document card background changes to green
- ✅ "Sign Now" button replaced with "Download" button
- ✅ Progress updates to "Documents Signed: 1/3"
- ✅ Progress bar shows 33%
- ✅ Push notification: "1/3 documents signed. 2 documents remaining."

**Pass Criteria:** Document signed successfully, UI updates correctly, progress increments.

---

### TEST 5: Download Signed Document

**Objective:** Verify download button works for signed documents.

**Steps:**
1. After signing a document, locate the "Download" button
2. Click "Download" button
3. Wait for download to complete
4. Open downloaded PDF

**Expected Results:**
- ✅ "Download" button visible (green background)
- ✅ Button has download icon
- ✅ Clicking button starts download immediately
- ✅ Toast notification: "Download Started - Your document is downloading"
- ✅ PDF file downloads with correct filename: "{Document Title}.pdf"
- ✅ Opening PDF shows document with signature
- ✅ Signature is visible and correctly positioned
- ✅ Document contains all auction details

**Pass Criteria:** PDF downloads successfully and contains signature.

---

### TEST 6: Sign All 3 Documents

**Objective:** Verify signing all documents triggers automatic payment processing.

**Steps:**
1. Sign second document (Liability Waiver)
2. Check progress: Should show "2/3"
3. Sign third document (Pickup Authorization)
4. Check progress: Should show "3/3"
5. Wait 5 seconds for automatic processing

**Expected Results:**

**After 2nd Document:**
- ✅ Progress: "Documents Signed: 2/3"
- ✅ Progress bar: 67%
- ✅ Push notification: "2/3 documents signed. 1 document remaining."

**After 3rd Document:**
- ✅ Progress: "Documents Signed: 3/3"
- ✅ Progress bar: 100%
- ✅ Green success banner appears: "✅ All documents signed! Payment is being processed automatically. You will receive your pickup code shortly."
- ✅ SMS received: "All documents signed! Payment is being processed..."
- ✅ Email received: "All Documents Signed - Payment Processing"

**After Automatic Processing (5-10 seconds):**
- ✅ SMS received: "✅ Payment complete! Pickup code: AUTH-12345678. Location: {Location}. Deadline: {Date}. Bring valid ID."
- ✅ Email received: "Payment Complete - Pickup Authorization"
- ✅ Push notification: "Payment Complete! Your pickup code is ready"
- ✅ Payment status in database: 'verified'
- ✅ Case status in database: 'sold'

**Pass Criteria:** All 3 documents signed, automatic payment processing completes, pickup code sent.

---

### TEST 7: Documents Page - Asset Names

**Objective:** Verify documents page shows asset names on each document card.

**Steps:**
1. Navigate to `/vendor/documents`
2. Locate a signed document card
3. Check document title format

**Expected Results:**
- ✅ Documents grouped by auction
- ✅ Each auction group has header with:
  - Asset name (e.g., "2018 Macbook Pro")
  - Winning bid amount
  - Auction close date
- ✅ Each document card shows: "{Asset Name} - {Document Type}"
  - Example: "2018 Macbook Pro - Release & Waiver of Liability"
- ✅ Signed documents have green background
- ✅ Signed documents show: "Signed: {Date}"
- ✅ Signed documents have "Download PDF" button
- ✅ Pending documents have yellow background
- ✅ Pending documents have "Sign Document" button

**Pass Criteria:** Asset names visible on all document cards in correct format.

---

### TEST 8: Multiple Auctions - No Duplicate Documents

**Objective:** Verify each auction has exactly 3 documents, no duplicates.

**Steps:**
1. Win 2 different auctions
2. Navigate to first auction details page
3. Count documents (should be 3)
4. Navigate to second auction details page
5. Count documents (should be 3)
6. Check database for duplicates

**Expected Results:**
- ✅ First auction shows exactly 3 documents
- ✅ Second auction shows exactly 3 documents
- ✅ Documents are different for each auction (different IDs)
- ✅ No duplicate documents in database
- ✅ Each auction has unique set of 3 documents
- ✅ Progress for each auction is independent (0/3, 1/3, 2/3, or 3/3)

**Database Query:**
```sql
-- Check for duplicates
SELECT 
  auction_id,
  vendor_id,
  document_type,
  COUNT(*) as count
FROM release_forms
GROUP BY auction_id, vendor_id, document_type
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

**Pass Criteria:** Each auction has exactly 3 unique documents, no duplicates found.

---

### TEST 9: Wrong Auction Document Prevention

**Objective:** Verify clicking "Sign Now" opens correct document for current auction.

**Steps:**
1. Win 2 different auctions (Auction A and Auction B)
2. Navigate to Auction A details page
3. Click "Sign Now" on Bill of Sale
4. Check document content in modal
5. Close modal without signing
6. Navigate to Auction B details page
7. Click "Sign Now" on Bill of Sale
8. Check document content in modal

**Expected Results:**
- ✅ Auction A modal shows Auction A details (asset name, bid amount, auction ID)
- ✅ Auction B modal shows Auction B details (different asset, different bid)
- ✅ Signing document in Auction A only updates Auction A progress
- ✅ Signing document in Auction B only updates Auction B progress
- ✅ Documents are not mixed between auctions
- ✅ Each auction maintains its own document state

**Pass Criteria:** Each auction's documents are correctly scoped and don't interfere with each other.

---

### TEST 10: Download from Documents Page

**Objective:** Verify download functionality works from documents page.

**Steps:**
1. Sign at least one document
2. Navigate to `/vendor/documents`
3. Find the signed document card
4. Click "Download PDF" button
5. Wait for download

**Expected Results:**
- ✅ "Download PDF" button visible on signed documents
- ✅ Button has download icon
- ✅ Clicking button downloads PDF
- ✅ PDF filename: "{Asset Name} - {Document Type}.pdf"
- ✅ PDF contains signature
- ✅ PDF contains correct auction details

**Pass Criteria:** PDF downloads successfully from documents page.

---

## Edge Cases to Test

### EDGE CASE 1: Rapid Document Signing
**Scenario:** Sign all 3 documents very quickly (within 5 seconds)

**Expected:**
- ✅ All 3 documents sign successfully
- ✅ Progress updates correctly for each
- ✅ Automatic payment processing still triggers
- ✅ No race conditions or errors

---

### EDGE CASE 2: Refresh Page During Signing
**Scenario:** Sign 1 document, refresh page, sign another

**Expected:**
- ✅ Progress persists after refresh (shows 1/3)
- ✅ First document still shows "Download" button
- ✅ Remaining documents show "Sign Now" button
- ✅ Can continue signing remaining documents

---

### EDGE CASE 3: Multiple Browser Tabs
**Scenario:** Open auction details in 2 tabs, sign document in one tab

**Expected:**
- ✅ Signing in Tab 1 updates document status
- ✅ Tab 2 needs refresh to see updated status
- ✅ Attempting to sign same document in Tab 2 shows "already signed" message
- ✅ No duplicate signatures created

---

### EDGE CASE 4: Network Failure During Signing
**Scenario:** Disconnect network, attempt to sign document

**Expected:**
- ✅ Error toast: "Failed to sign document. Please check your connection."
- ✅ Document remains in "pending" state
- ✅ "Sign Now" button still available
- ✅ Can retry after reconnecting

---

### EDGE CASE 5: Payment Processing Failure
**Scenario:** All documents signed but payment processing fails

**Expected:**
- ✅ Error logged to audit trail
- ✅ Finance Officer receives email alert
- ✅ Email subject: "🚨 Escrow Payment Failed - Action Required"
- ✅ Email contains error details and auction ID
- ✅ Finance Officer can manually release funds from dashboard
- ✅ Vendor sees "Payment processing..." message (not error)

---

## Regression Tests

### REGRESSION 1: Existing Auctions
**Objective:** Verify old auctions still work correctly

**Steps:**
1. Find an auction that was won before these fixes
2. Navigate to auction details page
3. Check if documents are visible

**Expected:**
- ✅ Old auctions show documents correctly
- ✅ If documents were already signed, they show "Download" button
- ✅ If documents were pending, they show "Sign Now" button
- ✅ No errors or broken functionality

---

### REGRESSION 2: Payment Page
**Objective:** Verify payment page still works

**Steps:**
1. Navigate to `/vendor/payments/{paymentId}`
2. Check payment details

**Expected:**
- ✅ Payment page loads correctly
- ✅ Shows payment status
- ✅ Shows pickup code (if payment verified)
- ✅ No errors or broken links

---

### REGRESSION 3: Auction Browsing
**Objective:** Verify auction browsing still works

**Steps:**
1. Navigate to `/vendor/auctions`
2. Browse active auctions
3. Place a bid

**Expected:**
- ✅ Auction list loads correctly
- ✅ Can view auction details
- ✅ Can place bids
- ✅ Real-time updates work
- ✅ No errors or broken functionality

---

## Performance Tests

### PERFORMANCE 1: Email Delivery Time
**Metric:** Time from auction closure to email received

**Target:** < 60 seconds

**Steps:**
1. Note auction close time
2. Check email inbox
3. Note email received time
4. Calculate difference

**Pass Criteria:** Email received within 60 seconds of auction closure.

---

### PERFORMANCE 2: Document Generation Time
**Metric:** Time from auction closure to documents available

**Target:** < 30 seconds

**Steps:**
1. Note auction close time
2. Navigate to auction details page
3. Check if documents are visible
4. Note time when documents appear

**Pass Criteria:** Documents visible within 30 seconds of auction closure.

---

### PERFORMANCE 3: Automatic Payment Processing Time
**Metric:** Time from signing 3rd document to payment verified

**Target:** < 10 seconds

**Steps:**
1. Sign 3rd document
2. Note time
3. Wait for pickup code SMS
4. Note time when SMS received
5. Calculate difference

**Pass Criteria:** Pickup code received within 10 seconds of signing 3rd document.

---

## Bug Report Template

If you find any issues during testing, use this template:

```markdown
## Bug Report

**Test Case:** [Test number and name]

**Severity:** [Critical / High / Medium / Low]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots:**
[Attach screenshots if applicable]

**Console Errors:**
[Paste any console errors]

**Environment:**
- Browser: [Chrome / Firefox / Safari]
- OS: [Windows / Mac / Linux]
- User Role: [Vendor / Finance Officer / Admin]

**Additional Notes:**
[Any other relevant information]
```

---

## Test Results Summary

After completing all tests, fill out this summary:

```markdown
## Test Results Summary

**Date:** [Date]
**Tester:** [Name]
**Environment:** [Production / Staging / Development]

### Test Results

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Auction Win Email & Notifications | ⬜ Pass / ⬜ Fail | |
| 2 | Notification Click Routing | ⬜ Pass / ⬜ Fail | |
| 3 | Auction Details - Document Section | ⬜ Pass / ⬜ Fail | |
| 4 | Document Signing Flow | ⬜ Pass / ⬜ Fail | |
| 5 | Download Signed Document | ⬜ Pass / ⬜ Fail | |
| 6 | Sign All 3 Documents | ⬜ Pass / ⬜ Fail | |
| 7 | Documents Page - Asset Names | ⬜ Pass / ⬜ Fail | |
| 8 | Multiple Auctions - No Duplicates | ⬜ Pass / ⬜ Fail | |
| 9 | Wrong Auction Document Prevention | ⬜ Pass / ⬜ Fail | |
| 10 | Download from Documents Page | ⬜ Pass / ⬜ Fail | |

### Edge Cases

| Test | Status | Notes |
|------|--------|-------|
| Rapid Document Signing | ⬜ Pass / ⬜ Fail | |
| Refresh Page During Signing | ⬜ Pass / ⬜ Fail | |
| Multiple Browser Tabs | ⬜ Pass / ⬜ Fail | |
| Network Failure During Signing | ⬜ Pass / ⬜ Fail | |
| Payment Processing Failure | ⬜ Pass / ⬜ Fail | |

### Regression Tests

| Test | Status | Notes |
|------|--------|-------|
| Existing Auctions | ⬜ Pass / ⬜ Fail | |
| Payment Page | ⬜ Pass / ⬜ Fail | |
| Auction Browsing | ⬜ Pass / ⬜ Fail | |

### Performance Tests

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Email Delivery Time | < 60s | | ⬜ Pass / ⬜ Fail |
| Document Generation Time | < 30s | | ⬜ Pass / ⬜ Fail |
| Payment Processing Time | < 10s | | ⬜ Pass / ⬜ Fail |

### Overall Assessment

**Total Tests:** 18
**Passed:** [Number]
**Failed:** [Number]
**Pass Rate:** [Percentage]%

**Critical Issues Found:** [Number]
**High Priority Issues:** [Number]
**Medium Priority Issues:** [Number]
**Low Priority Issues:** [Number]

**Recommendation:** ⬜ Ready for Production / ⬜ Needs Fixes

**Notes:**
[Any additional observations or recommendations]
```

---

## Quick Smoke Test (5 minutes)

If you need a quick verification, run this abbreviated test:

1. **Win an auction** (1 min)
   - Place winning bid
   - Wait for closure

2. **Check email** (30 sec)
   - Verify email received
   - Click "Sign Documents Now" link

3. **Sign documents** (2 min)
   - Sign all 3 documents
   - Verify progress updates

4. **Check payment** (1 min)
   - Wait for SMS with pickup code
   - Verify payment status

5. **Check documents page** (30 sec)
   - Navigate to `/vendor/documents`
   - Verify asset names visible
   - Download a document

**Pass Criteria:** All 5 steps complete without errors.

---

## Automated Test Script (Optional)

For developers, here's a Playwright test script:

```typescript
// tests/e2e/document-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Document Management Flow', () => {
  test('should complete full document signing flow', async ({ page }) => {
    // 1. Login as vendor
    await page.goto('/login');
    await page.fill('[name="email"]', 'vendor@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // 2. Navigate to won auction
    await page.goto('/vendor/auctions/[test-auction-id]');
    
    // 3. Verify 3 documents shown
    const documents = await page.locator('[data-testid="document-card"]').count();
    expect(documents).toBe(3);
    
    // 4. Verify progress shows 0/3
    const progress = await page.locator('[data-testid="document-progress"]').textContent();
    expect(progress).toContain('0/3');
    
    // 5. Sign first document
    await page.click('[data-testid="sign-button-0"]');
    await page.waitForSelector('[data-testid="signature-canvas"]');
    // Draw signature (simulate)
    await page.click('[data-testid="sign-document-button"]');
    await page.waitForSelector('[data-testid="download-button-0"]');
    
    // 6. Verify progress updates to 1/3
    const progress1 = await page.locator('[data-testid="document-progress"]').textContent();
    expect(progress1).toContain('1/3');
    
    // 7. Sign remaining documents
    await page.click('[data-testid="sign-button-1"]');
    await page.click('[data-testid="sign-document-button"]');
    await page.click('[data-testid="sign-button-2"]');
    await page.click('[data-testid="sign-document-button"]');
    
    // 8. Verify progress shows 3/3
    const progress3 = await page.locator('[data-testid="document-progress"]').textContent();
    expect(progress3).toContain('3/3');
    
    // 9. Verify success banner appears
    await page.waitForSelector('[data-testid="all-documents-signed-banner"]');
    
    // 10. Navigate to documents page
    await page.goto('/vendor/documents');
    
    // 11. Verify asset name visible
    const documentTitle = await page.locator('[data-testid="document-title"]').first().textContent();
    expect(documentTitle).toContain(' - '); // Asset name - Document type
  });
});
```

---

## Support & Troubleshooting

### Common Issues

**Issue:** Email not received
- Check spam folder
- Verify email service is configured
- Check audit logs for email sending errors

**Issue:** Documents not showing
- Check if auction is closed
- Verify vendor won the auction
- Check database for document records

**Issue:** Download button not working
- Check browser console for errors
- Verify document has pdfUrl in database
- Check Cloudinary storage

**Issue:** Payment not processing automatically
- Check if all 3 documents are signed
- Check console logs for errors
- Verify escrow wallet has sufficient balance
- Check audit logs for fund release errors

### Debug Commands

```bash
# Check document records
psql -d salvage_db -c "SELECT * FROM release_forms WHERE auction_id = '[auction-id]';"

# Check payment status
psql -d salvage_db -c "SELECT * FROM payments WHERE auction_id = '[auction-id]';"

# Check audit logs
psql -d salvage_db -c "SELECT * FROM audit_logs WHERE entity_id = '[auction-id]' ORDER BY created_at DESC LIMIT 10;"

# Check notification records
psql -d salvage_db -c "SELECT * FROM notifications WHERE user_id = '[user-id]' ORDER BY created_at DESC LIMIT 10;"
```

---

## Conclusion

This testing guide covers all aspects of the document management fixes. Complete all tests to ensure the system works correctly before deploying to production.

**Estimated Testing Time:** 2-3 hours for complete test suite

**Minimum Testing Time:** 5 minutes for smoke test

**Recommended:** Run full test suite before production deployment.
