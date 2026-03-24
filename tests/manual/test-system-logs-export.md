# Manual Test: System Logs Export

**Feature**: Task 6.7 - Add export to System Logs page  
**Spec**: system-cleanup-and-polish  
**Date**: 2025-01-XX  
**Tester**: [Your Name]

## Test Environment
- [ ] Development server running
- [ ] Logged in as system_admin user
- [ ] System logs page accessible at `/admin/audit-logs`

## Test Cases

### TC1: Export Dropdown Button Display
**Objective**: Verify the Export dropdown button is displayed correctly

**Steps**:
1. Navigate to `/admin/audit-logs`
2. Locate the Export button in the filters section
3. Verify button shows "Export" text with download icon
4. Verify button has dropdown arrow icon

**Expected Result**:
- Export button is visible next to "Reset Filters" button
- Button is styled consistently with other buttons
- Button is disabled when no logs are present
- Button is enabled when logs are present

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC2: Export Dropdown Menu
**Objective**: Verify the Export dropdown menu opens and displays options

**Steps**:
1. Click the Export button
2. Verify dropdown menu appears
3. Check for "Export as CSV" option with green icon
4. Check for "Export as PDF" option with red icon
5. Click outside the dropdown
6. Verify dropdown closes

**Expected Result**:
- Dropdown menu appears below the Export button
- Two export options are visible
- CSV option has green document icon
- PDF option has red document icon
- Clicking outside closes the dropdown

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC3: CSV Export - No Filters
**Objective**: Export all system logs to CSV without filters

**Steps**:
1. Ensure no filters are applied (click "Reset Filters" if needed)
2. Click Export button
3. Click "Export as CSV"
4. Wait for download to complete
5. Open the downloaded CSV file

**Expected Result**:
- File downloads with name format: `system-logs-YYYY-MM-DD.csv`
- CSV contains headers: Timestamp, User, Action, Resource Type, Resource ID, IP Address, Status
- CSV contains all visible log records (up to 5000)
- Data is properly formatted with commas and quotes escaped
- Success alert shows: "Successfully exported X log records to CSV"

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC4: CSV Export - With Filters
**Objective**: Export filtered system logs to CSV

**Steps**:
1. Apply filters:
   - Action Type: "login"
   - Start Date: [select a date]
   - End Date: [select a date]
2. Click Export button
3. Click "Export as CSV"
4. Wait for download to complete
5. Open the downloaded CSV file

**Expected Result**:
- File downloads with name format: `system-logs-YYYY-MM-DD.csv`
- CSV contains only logs matching the applied filters
- All filtered records are included in the export
- Success alert shows correct count of exported records

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC5: PDF Export - No Filters
**Objective**: Export all system logs to PDF without filters

**Steps**:
1. Ensure no filters are applied (click "Reset Filters" if needed)
2. Click Export button
3. Click "Export as PDF"
4. Wait for download to complete
5. Open the downloaded PDF file

**Expected Result**:
- File downloads with name format: `system-logs-YYYY-MM-DD.pdf`
- PDF has NEM Insurance letterhead (burgundy header, logo, company name)
- PDF has standardized footer (company details, generation timestamp)
- PDF contains table with columns: Timestamp, User, Action, Resource, Resource ID, IP
- Data is properly formatted and readable
- Multiple pages are created if needed with headers repeated
- Footer shows "Total Records: X"
- Success alert shows: "Successfully exported X log records to PDF"

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC6: PDF Export - With Filters
**Objective**: Export filtered system logs to PDF

**Steps**:
1. Apply filters:
   - Entity Type: "payment"
   - Action Type: "payment_verified"
2. Click Export button
3. Click "Export as PDF"
4. Wait for download to complete
5. Open the downloaded PDF file

**Expected Result**:
- File downloads with name format: `system-logs-YYYY-MM-DD.pdf`
- PDF contains only logs matching the applied filters
- PDF has proper letterhead and footer
- All filtered records are included in the export
- Success alert shows correct count of exported records

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC7: Export Limit Warning (5000 Records)
**Objective**: Verify warning message when export exceeds 5000 records

**Steps**:
1. Ensure database has more than 5000 audit log records
2. Remove all filters to get maximum records
3. Click Export button
4. Click "Export as CSV" or "Export as PDF"
5. Wait for alert message

**Expected Result**:
- Alert message appears: "Export limited to 5000 most recent records. Please apply filters to reduce the dataset."
- Export still proceeds with 5000 most recent records
- Downloaded file contains exactly 5000 records

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC8: Export with Empty Results
**Objective**: Verify export behavior when no logs match filters

**Steps**:
1. Apply filters that return no results:
   - User ID: "nonexistent-user-id"
2. Verify "No audit logs found" message is displayed
3. Verify Export button is disabled

**Expected Result**:
- Export button is disabled (grayed out)
- Cannot click Export button
- No export occurs

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC9: CSV Data Integrity
**Objective**: Verify CSV data matches displayed logs

**Steps**:
1. Note the first 5 log entries displayed on the page
2. Export to CSV
3. Open CSV file
4. Compare first 5 rows with displayed logs

**Expected Result**:
- Timestamp matches exactly
- User name matches
- Action type matches
- Resource type matches
- Resource ID matches
- IP address matches
- Status is "completed" for all records

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC10: PDF Data Integrity
**Objective**: Verify PDF data matches displayed logs

**Steps**:
1. Note the first 5 log entries displayed on the page
2. Export to PDF
3. Open PDF file
4. Compare first 5 rows with displayed logs

**Expected Result**:
- Timestamp matches (formatted for readability)
- User name matches (truncated to 20 chars if needed)
- Action type matches (truncated to 20 chars if needed)
- Resource type matches (truncated to 15 chars if needed)
- Resource ID matches (truncated to 12 chars if needed)
- IP address matches

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC11: Special Characters in CSV
**Objective**: Verify CSV properly escapes special characters

**Steps**:
1. Find or create a log entry with special characters in user agent or other fields
2. Export to CSV
3. Open CSV in Excel or text editor
4. Verify special characters are properly escaped

**Expected Result**:
- Commas in fields are properly escaped with quotes
- Quotes in fields are doubled ("")
- Newlines in fields are properly escaped
- CSV can be opened in Excel without errors

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC12: PDF Multi-Page Handling
**Objective**: Verify PDF correctly handles multiple pages

**Steps**:
1. Ensure there are enough logs to span multiple pages (>30 records)
2. Export to PDF
3. Open PDF file
4. Check all pages

**Expected Result**:
- Each page has letterhead at the top
- Each page has footer at the bottom
- Headers are repeated on each new page
- No content overlaps with footer
- Page breaks occur at appropriate points
- Last page shows total record count in footer

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC13: Export Button State During Export
**Objective**: Verify button states during export process

**Steps**:
1. Click Export button
2. Click "Export as CSV"
3. Observe button state during export
4. Wait for export to complete

**Expected Result**:
- Export button shows "Exporting..." text during export
- Export button is disabled during export
- Dropdown menu closes immediately when export starts
- Button returns to normal state after export completes

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC14: Concurrent Filter and Export
**Objective**: Verify export respects filters applied before export

**Steps**:
1. Apply Action Type filter: "case_created"
2. Wait for logs to load
3. Note the count of displayed logs
4. Export to CSV
5. Open CSV and count rows (excluding header)

**Expected Result**:
- CSV row count matches displayed log count
- All CSV records have action type "case_created"
- No other action types are included in export

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

### TC15: Filename Format Validation
**Objective**: Verify exported files have correct filename format

**Steps**:
1. Note today's date (YYYY-MM-DD format)
2. Export to CSV
3. Check downloaded filename
4. Export to PDF
5. Check downloaded filename

**Expected Result**:
- CSV filename: `system-logs-YYYY-MM-DD.csv` (where YYYY-MM-DD is today's date)
- PDF filename: `system-logs-YYYY-MM-DD.pdf` (where YYYY-MM-DD is today's date)
- Filenames use ISO date format (YYYY-MM-DD)

**Status**: [ ] Pass [ ] Fail  
**Notes**:

---

## Summary

**Total Test Cases**: 15  
**Passed**: ___  
**Failed**: ___  
**Blocked**: ___  

**Overall Status**: [ ] Pass [ ] Fail

## Issues Found

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| 1 | | | |
| 2 | | | |

## Notes

- Test performed on: [Date]
- Browser: [Browser name and version]
- Screen resolution: [Resolution]
- Additional observations:

## Sign-off

**Tester**: ___________________  
**Date**: ___________________  
**Reviewer**: ___________________  
**Date**: ___________________
