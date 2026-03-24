# Manual Test: My Cases Export Functionality

**Feature**: Task 6.6 - Add export to My Cases page  
**Spec**: system-cleanup-and-polish  
**Requirements**: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7

## Test Overview

This test validates the export functionality for the My Cases page, ensuring that adjusters can export their case data to CSV and PDF formats with proper filtering and formatting.

## Prerequisites

- User account with `claims_adjuster` role
- At least 5 test cases created by the adjuster with various statuses
- Cases should have different asset types and locations for comprehensive testing

## Test Cases

### Test Case 1: Export Button Visibility and State

**Steps**:
1. Log in as a claims adjuster
2. Navigate to `/adjuster/my-cases`
3. Observe the Export button in the header

**Expected Results**:
- ✅ Export button is visible next to "Create New Case" button
- ✅ Export button shows download icon and dropdown arrow
- ✅ Export button is disabled when no cases exist
- ✅ Export button is enabled when cases are present

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Results:
```

---

### Test Case 2: Export Dropdown Menu

**Steps**:
1. Click the Export button
2. Observe the dropdown menu

**Expected Results**:
- ✅ Dropdown menu appears below the Export button
- ✅ Menu shows two options: "Export as CSV" and "Export as PDF"
- ✅ CSV option has green icon
- ✅ PDF option has red icon
- ✅ Clicking outside the menu closes it

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Results:
```

---

### Test Case 3: CSV Export - All Cases

**Steps**:
1. Ensure no filters are applied (status = "All Cases")
2. Clear search query
3. Click Export → Export as CSV
4. Wait for download to complete
5. Open the downloaded CSV file

**Expected Results**:
- ✅ File downloads with name format: `my-cases-YYYY-MM-DD.csv`
- ✅ CSV contains header row: Claim Reference, Asset Type, Status, Created Date, Market Value, Reserve Price, Location, Damage Severity
- ✅ All cases are included in the export
- ✅ Currency values formatted as ₦X,XXX,XXX
- ✅ Status values are human-readable (e.g., "Pending Approval" not "pending_approval")
- ✅ Dates formatted as "MMM DD, YYYY"
- ✅ Special characters in fields are properly escaped
- ✅ Success alert shows: "Successfully exported X case records to CSV"

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
CSV filename:
Number of records:
Sample data validation:
```

---

### Test Case 4: CSV Export - With Status Filter

**Steps**:
1. Click on "Pending" status tab
2. Verify filtered cases are displayed
3. Click Export → Export as CSV
4. Open the downloaded CSV file

**Expected Results**:
- ✅ Only cases with "pending_approval" status are exported
- ✅ Export count matches the filtered count shown in UI
- ✅ All exported cases have status "Pending Approval"
- ✅ Filename is `my-cases-YYYY-MM-DD.csv`

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Filter applied:
Expected count:
Actual count:
```

---

### Test Case 5: CSV Export - With Search Query

**Steps**:
1. Enter a search query (e.g., "Lagos" or a specific claim reference)
2. Verify filtered results
3. Click Export → Export as CSV
4. Open the downloaded CSV file

**Expected Results**:
- ✅ Only cases matching the search query are exported
- ✅ Export count matches the filtered count shown in UI
- ✅ All exported cases contain the search term in claim reference, asset type, or location

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Search query:
Expected count:
Actual count:
```

---

### Test Case 6: CSV Export - Combined Filters

**Steps**:
1. Select a status filter (e.g., "Approved")
2. Enter a search query (e.g., "vehicle")
3. Verify filtered results
4. Click Export → Export as CSV
5. Open the downloaded CSV file

**Expected Results**:
- ✅ Only cases matching BOTH status AND search criteria are exported
- ✅ Export count matches the filtered count shown in UI
- ✅ All exported cases have the selected status AND contain the search term

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Status filter:
Search query:
Expected count:
Actual count:
```

---

### Test Case 7: PDF Export - All Cases

**Steps**:
1. Ensure no filters are applied
2. Click Export → Export as PDF
3. Wait for download to complete
4. Open the downloaded PDF file

**Expected Results**:
- ✅ File downloads with name format: `my-cases-YYYY-MM-DD.pdf`
- ✅ PDF has NEM Insurance letterhead (burgundy header, logo, company name)
- ✅ Document title shows "MY CASES REPORT"
- ✅ Table headers: Claim Ref, Asset Type, Status, Created, Value, Location
- ✅ All cases are included in the export
- ✅ Currency values formatted as ₦X,XXX,XXX
- ✅ Footer includes company details and generation timestamp
- ✅ Footer shows "Total Records: X"
- ✅ Multi-page PDFs have letterhead and footer on each page
- ✅ Success alert shows: "Successfully exported X case records to PDF"

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
PDF filename:
Number of pages:
Number of records:
Letterhead present: Yes/No
Footer present: Yes/No
```

---

### Test Case 8: PDF Export - With Filters

**Steps**:
1. Apply status filter and/or search query
2. Click Export → Export as PDF
3. Open the downloaded PDF file

**Expected Results**:
- ✅ Only filtered cases are included in PDF
- ✅ Export count matches the filtered count shown in UI
- ✅ PDF formatting is consistent with unfiltered export

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Filters applied:
Expected count:
Actual count:
```

---

### Test Case 9: Export with No Results

**Steps**:
1. Apply filters that result in zero cases (e.g., search for non-existent claim reference)
2. Observe Export button state
3. Attempt to click Export button

**Expected Results**:
- ✅ Export button is disabled when no cases match filters
- ✅ Button appears grayed out with cursor-not-allowed
- ✅ Clicking disabled button has no effect

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Results:
```

---

### Test Case 10: CSV Special Characters Handling

**Steps**:
1. Create or find a case with special characters in fields:
   - Claim reference with commas
   - Location with quotes
   - Asset type with newlines (if possible)
2. Export to CSV
3. Open in Excel/Google Sheets

**Expected Results**:
- ✅ Fields with commas are wrapped in quotes
- ✅ Fields with quotes have quotes escaped (doubled)
- ✅ Data displays correctly in spreadsheet applications
- ✅ No data corruption or parsing errors

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Special characters tested:
Results:
```

---

### Test Case 11: Export Performance

**Steps**:
1. Create or ensure at least 50 cases exist
2. Export all cases to CSV
3. Export all cases to PDF
4. Measure time taken for each export

**Expected Results**:
- ✅ CSV export completes within 5 seconds
- ✅ PDF export completes within 10 seconds
- ✅ No browser freezing or UI blocking during export
- ✅ Success message appears after export completes

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Number of records:
CSV export time:
PDF export time:
```

---

### Test Case 12: Export Button Loading State

**Steps**:
1. Click Export → Export as PDF (slower than CSV)
2. Observe button state during export
3. Try clicking Export button again during export

**Expected Results**:
- ✅ Export button shows loading/disabled state during export
- ✅ Cannot trigger multiple exports simultaneously
- ✅ Button returns to normal state after export completes

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Results:
```

---

### Test Case 13: Mobile Responsiveness

**Steps**:
1. Open My Cases page on mobile device or mobile viewport
2. Locate Export button
3. Click Export button
4. Select export format

**Expected Results**:
- ✅ Export button is visible and accessible on mobile
- ✅ Dropdown menu displays correctly on mobile
- ✅ Export functionality works on mobile devices
- ✅ Downloaded files are accessible on mobile

**Status**: ⬜ Not Tested | ✅ Passed | ❌ Failed

**Notes**:
```
Date tested:
Tester:
Device/viewport:
Results:
```

---

## Requirements Validation

### Requirement 16.1: Export Button Display
- ✅ Export dropdown button with CSV and PDF options is present on My Cases page

### Requirement 16.2: CSV Export Columns
- ✅ CSV includes: Claim Reference, Asset Type, Status, Created Date, Market Value, Reserve Price, Location, Damage Severity

### Requirement 16.3: PDF Export with Templates
- ✅ PDF uses ExportService and PDFTemplateService for generation
- ✅ PDF has standardized NEM Insurance letterhead and footer

### Requirement 16.4: Filter Respect
- ✅ Export respects status filters
- ✅ Export respects search query

### Requirement 16.5: Filename Format
- ✅ Filename follows pattern: `my-cases-{date}.{format}`
- ✅ Date format is YYYY-MM-DD

### Requirement 16.7: Export Completion
- ✅ Export completes within acceptable time (5 seconds for CSV, 10 seconds for PDF)
- ✅ Success message displayed after export

---

## Bug Report Template

If any test fails, document the bug using this template:

```
**Bug Title**: [Brief description]

**Test Case**: [Test case number and name]

**Severity**: Critical | High | Medium | Low

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:


**Actual Result**:


**Screenshots/Logs**:


**Environment**:
- Browser:
- OS:
- User Role:

**Additional Notes**:

```

---

## Test Summary

**Total Test Cases**: 13  
**Passed**: ___  
**Failed**: ___  
**Not Tested**: ___  

**Overall Status**: ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

**Tester Name**: _______________  
**Test Date**: _______________  
**Sign-off**: _______________

---

## Notes

- Ensure test data includes cases with various statuses, asset types, and locations
- Test with both small (< 10 cases) and large (> 50 cases) datasets
- Verify CSV files open correctly in Excel, Google Sheets, and text editors
- Verify PDF files display correctly in various PDF readers
- Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- Test on both desktop and mobile devices
