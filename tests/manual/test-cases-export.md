# Manual Test: Cases Export Functionality

**Feature:** Task 6.3 - Add export to Cases Created page  
**Requirements:** 13.1, 13.2, 13.3, 13.4, 13.5, 13.7  
**Date:** 2024-01-XX  
**Tester:** [Your Name]

## Test Environment
- [ ] Development server running
- [ ] Logged in as adjuster user
- [ ] At least 3-5 test cases created with different statuses

## Test Cases

### TC1: Export Button Visibility
**Steps:**
1. Navigate to `/adjuster/cases`
2. Locate the "Export" button next to the "Filters" button

**Expected Results:**
- [ ] Export button is visible with download icon
- [ ] Export button is enabled when cases are present
- [ ] Export button is disabled when no cases match filters

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC2: Export Dropdown Menu
**Steps:**
1. Click the "Export" button
2. Observe the dropdown menu

**Expected Results:**
- [ ] Dropdown menu appears below the button
- [ ] "Export to CSV" option is visible with spreadsheet icon
- [ ] "Export to PDF" option is visible with document icon
- [ ] Clicking outside closes the dropdown

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC3: CSV Export - All Cases
**Steps:**
1. Ensure no filters are applied (status = "All")
2. Click "Export" → "Export to CSV"
3. Wait for download to complete
4. Open the downloaded CSV file

**Expected Results:**
- [ ] File downloads with name format: `cases-all-YYYY-MM-DD.csv`
- [ ] CSV contains headers: Claim Reference, Asset Type, Status, Created Date, Adjuster Name, Market Value, Reserve Price, Location
- [ ] All cases are included in the export
- [ ] Currency values formatted with ₦ symbol (e.g., ₦5,000,000)
- [ ] Status values are human-readable (e.g., "Pending Approval" not "pending_approval")
- [ ] Dates formatted as "Jan 15, 2024" format

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC4: CSV Export - Filtered by Status
**Steps:**
1. Set status filter to "Pending Approval"
2. Click "Export" → "Export to CSV"
3. Open the downloaded CSV file

**Expected Results:**
- [ ] File downloads with name format: `cases-pending_approval-YYYY-MM-DD.csv`
- [ ] Only cases with "Pending Approval" status are included
- [ ] All columns are present and correctly formatted

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC5: CSV Export - With Search Filter
**Steps:**
1. Enter a search term (e.g., "Toyota" or a claim reference)
2. Click "Export" → "Export to CSV"
3. Open the downloaded CSV file

**Expected Results:**
- [ ] Only cases matching the search query are included
- [ ] File name includes "all" status: `cases-all-YYYY-MM-DD.csv`
- [ ] All columns are present and correctly formatted

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC6: CSV Export - Special Characters
**Steps:**
1. Create a test case with special characters in location (e.g., "Lagos, Nigeria")
2. Export to CSV
3. Open the CSV file in Excel or text editor

**Expected Results:**
- [ ] Fields with commas are properly quoted (e.g., "Lagos, Nigeria")
- [ ] Naira symbol (₦) displays correctly
- [ ] No data corruption or encoding issues

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC7: PDF Export - All Cases
**Steps:**
1. Ensure no filters are applied
2. Click "Export" → "Export to PDF"
3. Wait for download to complete
4. Open the downloaded PDF file

**Expected Results:**
- [ ] File downloads with name format: `cases-all-YYYY-MM-DD.pdf`
- [ ] PDF has NEM Insurance letterhead (burgundy header, logo, company name)
- [ ] PDF has "Cases Export" title below letterhead
- [ ] Table includes all specified columns
- [ ] PDF has footer with company info and generation timestamp
- [ ] All cases are included in the export
- [ ] Currency values formatted with ₦ symbol

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC8: PDF Export - Filtered by Status
**Steps:**
1. Set status filter to "Approved"
2. Click "Export" → "Export to PDF"
3. Open the downloaded PDF file

**Expected Results:**
- [ ] File downloads with name format: `cases-approved-YYYY-MM-DD.pdf`
- [ ] Only approved cases are included
- [ ] PDF formatting is consistent with letterhead/footer

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC9: PDF Export - Multiple Pages
**Steps:**
1. Ensure you have 20+ cases
2. Export to PDF
3. Open the PDF file

**Expected Results:**
- [ ] PDF spans multiple pages if needed
- [ ] Each page has letterhead at top
- [ ] Each page has footer at bottom
- [ ] Table headers repeat on each new page
- [ ] No content is cut off between pages

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC10: Export Loading State
**Steps:**
1. Click "Export" → "Export to CSV"
2. Observe the button during export

**Expected Results:**
- [ ] Button shows "Exporting..." text
- [ ] Button shows loading spinner icon
- [ ] Button is disabled during export
- [ ] Dropdown menu closes immediately
- [ ] Button returns to normal state after export completes

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC11: Export with No Data
**Steps:**
1. Apply filters that result in no matching cases
2. Observe the Export button

**Expected Results:**
- [ ] Export button is disabled
- [ ] Clicking the button does nothing
- [ ] No error messages appear

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC12: Export Error Handling
**Steps:**
1. Disconnect from network (or simulate API error)
2. Click "Export" → "Export to CSV"
3. Observe the error handling

**Expected Results:**
- [ ] Error alert/message is displayed
- [ ] Error message is descriptive
- [ ] Button returns to normal state
- [ ] User can retry the export

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC13: Mobile Responsiveness
**Steps:**
1. Open the page on mobile device or resize browser to mobile width
2. Test export functionality

**Expected Results:**
- [ ] Export button is visible and accessible
- [ ] Dropdown menu is properly positioned
- [ ] Dropdown doesn't overflow screen
- [ ] Export works correctly on mobile

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

### TC14: Combined Filters Export
**Steps:**
1. Apply multiple filters (status + search + asset type)
2. Export to CSV
3. Verify the exported data

**Expected Results:**
- [ ] Only cases matching ALL filters are exported
- [ ] File name reflects the status filter
- [ ] Data is accurate and complete

**Status:** ⬜ Pass / ⬜ Fail  
**Notes:**

---

## Summary

**Total Tests:** 14  
**Passed:** ___  
**Failed:** ___  
**Blocked:** ___  

**Overall Status:** ⬜ Pass / ⬜ Fail

## Issues Found
1. 
2. 
3. 

## Additional Notes

