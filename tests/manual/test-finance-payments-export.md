# Manual Test: Finance Payments Export Functionality

**Feature:** System Cleanup and Polish - Task 6.1
**Requirements:** 12.1, 12.2, 12.3, 12.4, 12.5, 12.7
**Date:** 2024-01-15
**Tester:** [Your Name]

## Test Environment
- [ ] Development server running
- [ ] Logged in as Finance Officer
- [ ] Test payments exist in database

## Test Cases

### Test Case 1: Export Button Visibility
**Objective:** Verify the Export dropdown button is visible and properly positioned

**Steps:**
1. Navigate to `/finance/payments`
2. Locate the Export button in the header section (next to Refresh button)

**Expected Results:**
- [ ] Export button is visible with download icon
- [ ] Export button shows dropdown arrow
- [ ] Button is positioned next to the Refresh button
- [ ] Button is disabled when no payments exist
- [ ] Button is disabled when filtering is in progress

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 2: Export Dropdown Menu
**Objective:** Verify the Export dropdown menu displays correctly

**Steps:**
1. Click the Export button
2. Observe the dropdown menu

**Expected Results:**
- [ ] Dropdown menu appears below the Export button
- [ ] Menu shows two options: "Export as CSV" and "Export as PDF"
- [ ] CSV option has green document icon
- [ ] PDF option has red document icon
- [ ] Menu is properly aligned to the right
- [ ] Clicking outside closes the menu

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 3: CSV Export - All Payments
**Objective:** Verify CSV export generates correct file with all payments

**Steps:**
1. Ensure no filters are applied (view = "All Payments")
2. Click Export button
3. Click "Export as CSV"
4. Wait for download to complete
5. Open the downloaded CSV file

**Expected Results:**
- [ ] File downloads with name format: `finance-payments-YYYY-MM-DD.csv`
- [ ] CSV contains header row with columns:
  - Payment ID
  - Auction ID
  - Vendor Name
  - Amount
  - Status
  - Payment Method
  - Created Date
  - Verified Date
- [ ] All visible payments are included in the export
- [ ] Currency amounts show Naira symbol (₦) and proper formatting
- [ ] Dates are formatted in Nigerian locale
- [ ] Success modal appears with message: "Successfully exported X payment records to CSV"

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 4: CSV Export - Filtered Payments
**Objective:** Verify CSV export respects active filters

**Steps:**
1. Apply filters:
   - Status: "Pending"
   - Payment Method: "Escrow Wallet"
2. Note the number of filtered payments
3. Click Export button
4. Click "Export as CSV"
5. Open the downloaded CSV file

**Expected Results:**
- [ ] CSV contains only the filtered payments
- [ ] Number of rows matches the filtered count
- [ ] All exported payments have status "Pending"
- [ ] All exported payments have payment method "Escrow Wallet"

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 5: CSV Export - Special Characters
**Objective:** Verify CSV properly escapes special characters (RFC 4180 compliance)

**Steps:**
1. Find or create a payment with vendor name containing:
   - Comma (e.g., "Test, Vendor")
   - Quote (e.g., "Test "Quoted" Vendor")
2. Export to CSV
3. Open the CSV file in a text editor

**Expected Results:**
- [ ] Fields with commas are wrapped in double quotes
- [ ] Fields with quotes are wrapped in double quotes
- [ ] Internal quotes are escaped by doubling them ("")
- [ ] CSV can be opened correctly in Excel/Google Sheets

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 6: PDF Export - All Payments
**Objective:** Verify PDF export generates correct file with standardized branding

**Steps:**
1. Ensure no filters are applied
2. Click Export button
3. Click "Export as PDF"
4. Wait for download to complete
5. Open the downloaded PDF file

**Expected Results:**
- [ ] File downloads with name format: `finance-payments-YYYY-MM-DD.pdf`
- [ ] PDF has standardized NEM Insurance letterhead:
  - Burgundy header bar
  - NEM Insurance logo (top-left)
  - Company name "NEM INSURANCE PLC" (centered)
  - Gold accent line
  - Document title "FINANCE PAYMENTS REPORT"
  - Company address at bottom of header
- [ ] PDF has standardized footer:
  - Thin burgundy line above footer
  - Company name and address
  - Contact information
  - Generation timestamp
  - Total records count
- [ ] Payment data is displayed in table format
- [ ] All visible payments are included
- [ ] Currency amounts show Naira symbol (₦)
- [ ] Success modal appears with message: "Successfully exported X payment records to PDF"

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 7: PDF Export - Multi-Page
**Objective:** Verify PDF export handles pagination correctly

**Steps:**
1. Ensure there are enough payments to span multiple pages (>30 payments)
2. Export to PDF
3. Open the PDF file

**Expected Results:**
- [ ] PDF has multiple pages
- [ ] Each page has the letterhead at the top
- [ ] Each page has the footer at the bottom
- [ ] Table headers are repeated on each new page
- [ ] No content overlaps with header or footer
- [ ] Page breaks occur at appropriate positions

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 8: PDF Export - Filtered Payments
**Objective:** Verify PDF export respects active filters

**Steps:**
1. Apply filters:
   - Tab: "Today's Payments"
   - Status: "Verified"
2. Note the number of filtered payments
3. Export to PDF
4. Open the PDF file

**Expected Results:**
- [ ] PDF contains only the filtered payments
- [ ] Number of records in footer matches the filtered count
- [ ] All exported payments are from today
- [ ] All exported payments have status "Verified"

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 9: Export During Filtering
**Objective:** Verify export button is disabled during filtering

**Steps:**
1. Apply a filter that triggers data loading
2. Observe the Export button during the loading state

**Expected Results:**
- [ ] Export button is disabled (grayed out)
- [ ] Export button shows disabled cursor
- [ ] Clicking the button has no effect

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 10: Export with No Payments
**Objective:** Verify export button is disabled when no payments exist

**Steps:**
1. Apply filters that result in zero payments
2. Observe the Export button

**Expected Results:**
- [ ] Export button is disabled (grayed out)
- [ ] Export button shows disabled cursor
- [ ] Message shows "0 payments found"

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 11: Export Error Handling
**Objective:** Verify error handling when export fails

**Steps:**
1. Simulate an export failure (e.g., by blocking browser downloads)
2. Attempt to export to CSV or PDF

**Expected Results:**
- [ ] Error modal appears with title "Export Failed"
- [ ] Error message explains the failure
- [ ] User can close the error modal
- [ ] Export button returns to enabled state

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 12: Export Menu Closes After Selection
**Objective:** Verify export menu closes after selecting an option

**Steps:**
1. Click Export button to open menu
2. Click "Export as CSV"
3. Observe the menu

**Expected Results:**
- [ ] Export menu closes immediately after clicking CSV option
- [ ] Export process begins
- [ ] Menu does not remain open

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 13: Date Range Filter Export
**Objective:** Verify export respects date range filters

**Steps:**
1. Set "From Date" to a specific date (e.g., 2024-01-01)
2. Set "To Date" to a specific date (e.g., 2024-01-15)
3. Export to CSV
4. Open the CSV file

**Expected Results:**
- [ ] All exported payments have Created Date within the specified range
- [ ] No payments outside the date range are included

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 14: Payment Method Labels
**Objective:** Verify payment method labels are correctly displayed in exports

**Steps:**
1. Ensure payments exist with different payment methods:
   - Paystack
   - Flutterwave
   - Bank Transfer
   - Escrow Wallet
2. Export to CSV
3. Open the CSV file

**Expected Results:**
- [ ] Payment methods are displayed as:
  - "Paystack" (not "paystack")
  - "Flutterwave" (not "flutterwave")
  - "Bank Transfer" (not "bank_transfer")
  - "Escrow Wallet" (not "escrow_wallet")

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

### Test Case 15: Verified Date Column
**Objective:** Verify Verified Date column shows correct values

**Steps:**
1. Ensure payments exist with different statuses:
   - Pending
   - Verified
   - Rejected
2. Export to CSV
3. Open the CSV file

**Expected Results:**
- [ ] Verified payments show the verification date
- [ ] Pending payments show "N/A" in Verified Date column
- [ ] Rejected payments show "N/A" in Verified Date column

**Status:** ⬜ Pass / ⬜ Fail
**Notes:**

---

## Summary

**Total Test Cases:** 15
**Passed:** ___
**Failed:** ___
**Blocked:** ___

**Overall Status:** ⬜ Pass / ⬜ Fail

**Issues Found:**
1. 
2. 
3. 

**Recommendations:**
1. 
2. 
3. 

**Sign-off:**
- Tester: _________________ Date: _______
- Reviewer: _________________ Date: _______
