# Manual Test: Wallet Transactions Export

## Test Date
[To be filled during testing]

## Test Environment
- Browser: [Chrome/Firefox/Safari]
- User Role: Vendor
- Test Data: Wallet with transaction history

## Prerequisites
1. Login as a vendor user
2. Navigate to Settings > Transactions
3. Ensure wallet has some transaction history

## Test Cases

### Test Case 1: Export Dropdown Display
**Steps:**
1. Navigate to `/vendor/settings/transactions`
2. Click on the "Export" button

**Expected Result:**
- Dropdown menu appears with two options:
  - "Export as CSV"
  - "Export as PDF"
- Dropdown is properly aligned below the Export button
- Both options have appropriate icons

**Actual Result:**
[ ] Pass [ ] Fail

**Notes:**

---

### Test Case 2: CSV Export - Wallet Transactions
**Steps:**
1. Ensure "Wallet Transactions" tab is active
2. Set date range filter (e.g., last 30 days)
3. Click "Export" button
4. Select "Export as CSV"

**Expected Result:**
- File downloads with name format: `wallet-transactions-YYYY-MM-DD.csv`
- CSV contains columns: Transaction ID, Type, Amount, Balance After, Description, Date, Reference
- CSV contains only transactions within the selected date range
- All data is properly formatted and escaped (RFC 4180 compliant)

**Actual Result:**
[ ] Pass [ ] Fail

**Notes:**

---

### Test Case 3: PDF Export - Wallet Transactions
**Steps:**
1. Ensure "Wallet Transactions" tab is active
2. Set date range filter (e.g., last 30 days)
3. Click "Export" button
4. Select "Export as PDF"

**Expected Result:**
- File downloads with name format: `wallet-transactions-YYYY-MM-DD.pdf`
- PDF has NEM Insurance letterhead (burgundy header, logo, company info)
- PDF has standardized footer (company details, generation timestamp)
- PDF contains table with columns: Transaction ID, Type, Amount, Balance After, Description, Date, Reference
- PDF contains only transactions within the selected date range
- Currency amounts are formatted with ₦ symbol

**Actual Result:**
[ ] Pass [ ] Fail

**Notes:**

---

### Test Case 4: Date Range Filter Respect
**Steps:**
1. Set date range to last 7 days
2. Export as CSV
3. Open CSV file
4. Verify all transactions are within the 7-day range
5. Change date range to last 90 days
6. Export as PDF
7. Open PDF file
8. Verify all transactions are within the 90-day range

**Expected Result:**
- Both CSV and PDF exports respect the active date range filter
- No transactions outside the selected date range appear in exports

**Actual Result:**
[ ] Pass [ ] Fail

**Notes:**

---

### Test Case 5: Export Button States
**Steps:**
1. Click "Export" button
2. Select "Export as CSV"
3. Observe button state during export

**Expected Result:**
- Button shows "Exporting..." with spinner during export
- Button is disabled during export
- Dropdown menu closes when export starts
- Button returns to normal state after export completes

**Actual Result:**
[ ] Pass [ ] Fail

**Notes:**

---

### Test Case 6: Dropdown Click Outside
**Steps:**
1. Click "Export" button to open dropdown
2. Click anywhere outside the dropdown menu

**Expected Result:**
- Dropdown menu closes when clicking outside
- No export is triggered

**Actual Result:**
[ ] Pass [ ] Fail

**Notes:**

---

### Test Case 7: Empty Data Export
**Steps:**
1. Set date range to a period with no transactions
2. Export as CSV
3. Export as PDF

**Expected Result:**
- CSV file contains only headers
- PDF file contains letterhead, footer, and headers but no data rows
- No errors occur

**Actual Result:**
[ ] Pass [ ] Fail

**Notes:**

---

### Test Case 8: Special Characters in Data
**Steps:**
1. Ensure wallet has transactions with special characters in description (commas, quotes, newlines)
2. Export as CSV
3. Open CSV in Excel/Google Sheets

**Expected Result:**
- Special characters are properly escaped
- CSV parses correctly in spreadsheet applications
- No data corruption or misaligned columns

**Actual Result:**
[ ] Pass [ ] Fail

**Notes:**

---

## Requirements Validation

### Requirement 14.1: Export Dropdown Button
- [ ] "Export" dropdown button is displayed on Wallet Transactions page
- [ ] Dropdown has CSV and PDF options

### Requirement 14.2: CSV Export Implementation
- [ ] CSV export includes all required columns
- [ ] CSV follows RFC 4180 standard

### Requirement 14.3: PDF Export Implementation
- [ ] PDF export uses ExportService
- [ ] PDF uses PDFTemplateService for letterhead/footer

### Requirement 14.4: Date Range Filter Respect
- [ ] Exports respect active date range filters

### Requirement 14.5: Date Range Filter Respect (continued)
- [ ] Only transactions within selected date range are exported

### Requirement 14.7: Filename Format
- [ ] Filename follows format: `wallet-transactions-{date}.{format}`
- [ ] Date is in YYYY-MM-DD format

## Summary
**Total Test Cases:** 8
**Passed:** 
**Failed:** 
**Blocked:** 

**Overall Status:** [ ] Pass [ ] Fail

**Tester Name:**
**Tester Signature:**
**Date:**

## Issues Found
[List any issues discovered during testing]

## Additional Notes
[Any additional observations or comments]
