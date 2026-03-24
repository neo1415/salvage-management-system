# Manual Test Plan: Critical Issues Fixes

## Test Environment Setup
- [ ] Application running locally or on staging
- [ ] Test user accounts for each role (Admin, Finance, Vendor)
- [ ] Sample data: transactions, payments, fraud alerts
- [ ] Network throttling tools available (Chrome DevTools)

---

## Issue 1: PDF Logo URL Construction

### Test 1.1: Client-Side PDF Generation
**Steps:**
1. Navigate to Finance Payments page
2. Click Export → Export as PDF
3. Wait for PDF to download
4. Open PDF and verify NEM Insurance logo appears in header

**Expected Result:**
- ✅ PDF downloads successfully
- ✅ Logo appears in header
- ✅ No console errors

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 1.2: Server-Side PDF Generation
**Steps:**
1. Trigger PDF generation from API route (e.g., document generation)
2. Check server logs for errors
3. Verify PDF contains logo

**Expected Result:**
- ✅ PDF generates without errors
- ✅ Logo loads correctly
- ✅ No "Invalid URL" errors in logs

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 1.3: Offline PDF Generation
**Steps:**
1. Open Chrome DevTools → Network tab
2. Set to "Offline" mode
3. Navigate to Wallet Transactions
4. Click Export → Export as PDF
5. Check if PDF generates (without logo)

**Expected Result:**
- ✅ PDF generates successfully
- ✅ No errors thrown
- ✅ PDF content displays correctly (without logo)
- ✅ Offline warning banner shows

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 1.4: Invalid Environment URL
**Steps:**
1. Set `NEXT_PUBLIC_APP_URL` to invalid value (e.g., "not-a-url")
2. Restart application
3. Try to generate PDF
4. Check console for errors

**Expected Result:**
- ✅ PDF generates without crashing
- ✅ Warning logged about invalid URL
- ✅ PDF displays without logo

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

## Issue 2: Admin Dashboard SQL Error

### Test 2.1: No Fraud Alerts
**Steps:**
1. Ensure database has no fraud alerts
2. Login as Admin
3. Navigate to Admin Dashboard
4. Check fraud alert count

**Expected Result:**
- ✅ Dashboard loads without SQL errors
- ✅ Fraud alert count shows "0"
- ✅ System health shows "healthy"

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 2.2: Fraud Alerts Without Dismissals
**Steps:**
1. Create fraud alert (flag an auction)
2. Do NOT dismiss the alert
3. Navigate to Admin Dashboard
4. Check fraud alert count

**Expected Result:**
- ✅ Dashboard loads successfully
- ✅ Fraud alert count shows "1" (or correct number)
- ✅ No SQL errors in console or logs

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 2.3: Fraud Alerts With Dismissals
**Steps:**
1. Create 3 fraud alerts
2. Dismiss 1 fraud alert
3. Navigate to Admin Dashboard
4. Verify count shows 2 pending alerts

**Expected Result:**
- ✅ Dashboard loads successfully
- ✅ Fraud alert count shows "2"
- ✅ Dismissed alert not counted

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 2.4: Cache Invalidation
**Steps:**
1. Note current fraud alert count
2. Create new fraud alert
3. Refresh Admin Dashboard
4. Verify count updated

**Expected Result:**
- ✅ Count updates within 5 minutes (cache TTL)
- ✅ Or immediately if cache invalidation triggered

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

## Issue 3: Wallet Transactions Export & Pagination

### Test 3.1: Pagination with < 10 Transactions
**Steps:**
1. Login as Vendor with < 10 transactions
2. Navigate to Wallet page
3. Check if pagination controls appear

**Expected Result:**
- ✅ All transactions displayed on one page
- ✅ No pagination controls shown
- ✅ Export button available

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 3.2: Pagination with > 10 Transactions
**Steps:**
1. Login as Vendor with > 10 transactions
2. Navigate to Wallet page
3. Verify only 10 transactions shown
4. Click "Next" button
5. Verify next 10 transactions shown

**Expected Result:**
- ✅ First page shows 10 transactions
- ✅ "Previous" button disabled on first page
- ✅ "Next" button enabled
- ✅ Page numbers displayed correctly
- ✅ "Showing 1 to 10 of X transactions" text accurate

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 3.3: CSV Export
**Steps:**
1. Navigate to Wallet page
2. Click Export → Export as CSV
3. Open downloaded CSV file
4. Verify columns and data

**Expected Result:**
- ✅ CSV downloads with filename `wallet-transactions-{date}.csv`
- ✅ Contains all transactions (not just current page)
- ✅ Columns: Transaction ID, Type, Amount, Balance After, Description, Date, Reference
- ✅ Data properly escaped (commas, quotes)
- ✅ Success message displayed

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 3.4: PDF Export
**Steps:**
1. Navigate to Wallet page
2. Click Export → Export as PDF
3. Open downloaded PDF file
4. Verify content and formatting

**Expected Result:**
- ✅ PDF downloads with filename `wallet-transactions-{date}.pdf`
- ✅ NEM Insurance letterhead present
- ✅ Contains all transactions
- ✅ Columns: Date, Type, Amount, Balance, Description
- ✅ Multi-page support if > 20 transactions
- ✅ Footer with total count

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 3.5: Export Button Disabled When Offline
**Steps:**
1. Navigate to Wallet page
2. Open DevTools → Network → Set to "Offline"
3. Try to click Export button

**Expected Result:**
- ✅ Export button disabled
- ✅ Tooltip shows "Export is not available offline"
- ✅ WiFi off icon displayed

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 3.6: Pagination State Preservation
**Steps:**
1. Navigate to Wallet page
2. Go to page 2
3. Navigate away (e.g., to Dashboard)
4. Navigate back to Wallet page

**Expected Result:**
- ✅ Returns to page 1 (default behavior)
- OR
- ✅ Remembers page 2 (if state persistence implemented)

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

## Issue 4: Enhanced PDF Exports

### Test 4.1: Finance Payments CSV Export
**Steps:**
1. Login as Finance Officer
2. Navigate to Finance Payments page
3. Click Export → Export as CSV
4. Open CSV file
5. Verify all columns present

**Expected Result:**
- ✅ CSV contains 14 columns:
  - Payment ID
  - Auction ID
  - Claim Reference ✨ NEW
  - Vendor Name
  - Amount
  - Status
  - Payment Method
  - Transaction Reference ✨ NEW
  - Created Date
  - Verified Date
  - Escrow Status ✨ NEW
  - Auto-Verified ✨ NEW
  - Vendor Email ✨ NEW
  - Vendor Phone ✨ NEW

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 4.2: Finance Payments PDF Export (Landscape)
**Steps:**
1. Navigate to Finance Payments page
2. Click Export → Export as PDF
3. Open PDF file
4. Verify orientation and columns

**Expected Result:**
- ✅ PDF in landscape orientation
- ✅ Contains 10 columns:
  - Pay ID
  - Auction
  - Claim Ref ✨ NEW
  - Vendor
  - Amount
  - Status
  - Method
  - Reference ✨ NEW
  - Created
  - Verified
- ✅ All columns fit on page
- ✅ Font size readable (7pt)

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 4.3: PDF Footer Statistics
**Steps:**
1. Navigate to Finance Payments page
2. Note number of auto-verified payments
3. Export as PDF
4. Check footer

**Expected Result:**
- ✅ Footer shows: `Total Records: X | Auto-Verified: Y`
- ✅ Numbers match actual data

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 4.4: Multi-Page PDF Export
**Steps:**
1. Filter Finance Payments to show > 30 records
2. Export as PDF
3. Open PDF and check page count

**Expected Result:**
- ✅ Multiple pages generated
- ✅ Headers repeated on each page
- ✅ Footer on each page
- ✅ No data truncation

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

## Issue 5: Offline-First Considerations

### Test 5.1: Offline Detection
**Steps:**
1. Navigate to Wallet page (online)
2. Open DevTools → Network → Set to "Offline"
3. Observe UI changes

**Expected Result:**
- ✅ Offline warning banner appears immediately
- ✅ Banner shows WiFi off icon
- ✅ Message: "You are currently offline"
- ✅ Explains cached data and sync behavior

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 5.2: Online Detection
**Steps:**
1. Start with offline mode
2. Set Network to "Online"
3. Observe UI changes

**Expected Result:**
- ✅ Offline warning banner disappears
- ✅ Export button becomes enabled
- ✅ Add Funds button becomes enabled

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 5.3: Add Funds Disabled Offline
**Steps:**
1. Navigate to Wallet page
2. Set to offline mode
3. Try to add funds

**Expected Result:**
- ✅ Add Funds button disabled
- ✅ Shows "Offline" label with WiFi icon
- ✅ Tooltip: "Adding funds is not available offline"

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 5.4: Cached Data Display
**Steps:**
1. Navigate to Wallet page (online)
2. Note balance and transactions
3. Set to offline mode
4. Refresh page

**Expected Result:**
- ✅ Balance displays from cache
- ✅ Transactions display from cache
- ✅ Offline warning shown
- ✅ No "Failed to fetch" errors

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 5.5: PDF Generation Without Logo (Offline)
**Steps:**
1. Set to offline mode
2. Navigate to Wallet page
3. Export as PDF
4. Open PDF

**Expected Result:**
- ✅ PDF generates successfully
- ✅ No logo in header (graceful fallback)
- ✅ All other content present
- ✅ No errors in console

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

## Cross-Browser Testing

### Test on Chrome
- [ ] All tests pass
- [ ] Notes:

### Test on Firefox
- [ ] All tests pass
- [ ] Notes:

### Test on Safari
- [ ] All tests pass
- [ ] Notes:

### Test on Edge
- [ ] All tests pass
- [ ] Notes:

---

## Mobile Testing

### Test on Mobile Chrome (Android)
- [ ] Offline detection works
- [ ] Export buttons accessible
- [ ] Pagination controls usable
- [ ] Notes:

### Test on Mobile Safari (iOS)
- [ ] Offline detection works
- [ ] Export buttons accessible
- [ ] Pagination controls usable
- [ ] Notes:

---

## Performance Testing

### Test 5.1: Large Dataset Export (1000+ records)
**Steps:**
1. Create 1000+ transactions
2. Export as CSV
3. Measure time to download

**Expected Result:**
- ✅ Export completes within 10 seconds
- ✅ No browser freeze
- ✅ File size reasonable

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 5.2: PDF Generation Performance
**Steps:**
1. Export 100+ records as PDF
2. Measure generation time

**Expected Result:**
- ✅ PDF generates within 15 seconds
- ✅ Loading indicator shown
- ✅ No UI blocking

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

## Security Testing

### Test 6.1: CSV Injection Prevention
**Steps:**
1. Create transaction with description: `=1+1`
2. Export as CSV
3. Open in Excel
4. Verify formula not executed

**Expected Result:**
- ✅ Formula escaped as text
- ✅ No code execution
- ✅ Displays as `"=1+1"`

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 6.2: URL Validation
**Steps:**
1. Set `NEXT_PUBLIC_APP_URL` to malicious URL
2. Try to generate PDF
3. Check logs

**Expected Result:**
- ✅ Invalid URL rejected
- ✅ Warning logged
- ✅ PDF generates without logo

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

## Accessibility Testing

### Test 7.1: Keyboard Navigation
**Steps:**
1. Navigate to Wallet page using only keyboard
2. Tab through pagination controls
3. Tab through export dropdown

**Expected Result:**
- ✅ All controls keyboard accessible
- ✅ Focus indicators visible
- ✅ Can activate with Enter/Space

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

### Test 7.2: Screen Reader
**Steps:**
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate to Wallet page
3. Listen to announcements

**Expected Result:**
- ✅ Offline warning announced
- ✅ Pagination state announced
- ✅ Button states announced (disabled/enabled)

**Actual Result:**
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test Summary

### Overall Results
- Total Tests: 35
- Passed: ___
- Failed: ___
- Blocked: ___

### Critical Issues Found
1. 
2. 
3. 

### Recommendations
1. 
2. 
3. 

### Sign-off
- Tester Name: _______________
- Date: _______________
- Approved for Production: [ ] Yes [ ] No
