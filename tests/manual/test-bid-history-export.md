# Manual Test: Bid History Export Functionality

**Feature:** Task 6.5 - Add export to Bid History page  
**Spec:** system-cleanup-and-polish  
**Date:** 2025-01-XX  
**Tester:** [Your Name]

## Test Environment
- [ ] Development server running
- [ ] Logged in as: Manager/Adjuster/Admin
- [ ] Test data: Multiple auctions with bids in both active and completed states

## Requirements Coverage

### Requirement 15.1: Export Dropdown Button
- [ ] Navigate to `/bid-history` page
- [ ] Verify "Export" dropdown button is visible in the page header
- [ ] Verify button shows Download icon and "Export" text
- [ ] Verify button is disabled when no data is available
- [ ] Click the Export button
- [ ] Verify dropdown menu appears with "Export as CSV" and "Export as PDF" options

### Requirement 15.2: CSV Export with Correct Columns
- [ ] Click "Export as CSV" from the dropdown
- [ ] Verify file downloads with name format: `bid-history-YYYY-MM-DD.csv`
- [ ] Open the CSV file
- [ ] Verify columns are present in order:
  - Auction ID
  - Asset Name
  - Bid Amount
  - Bid Date
  - Status (Won/Lost/Active)
  - Final Price
- [ ] Verify all rows contain actual bid data
- [ ] Verify data is properly formatted (dates, currency)

### Requirement 15.3: PDF Export with Letterhead/Footer
- [ ] Click "Export as PDF" from the dropdown
- [ ] Verify file downloads with name format: `bid-history-YYYY-MM-DD.pdf`
- [ ] Open the PDF file
- [ ] Verify NEM Insurance letterhead is present:
  - Burgundy header bar
  - NEM logo
  - Company name and contact info
  - Document title: "BID HISTORY REPORT"
- [ ] Verify footer is present:
  - Company details
  - Contact information
  - Generation timestamp
- [ ] Verify data table contains all columns
- [ ] Verify data is readable and properly formatted

### Requirement 15.4: Correct Column Data
- [ ] Review exported CSV/PDF data
- [ ] Verify Auction ID matches actual auction IDs
- [ ] Verify Asset Name shows specific asset details (e.g., "2015 Toyota Camry" not just "Vehicle")
- [ ] Verify Bid Amount shows the current/highest bid
- [ ] Verify Bid Date shows when the bid was placed
- [ ] Verify Status shows:
  - "Active" for active/extended/scheduled auctions
  - "Won" for closed auctions
  - "Lost" for cancelled auctions
- [ ] Verify Final Price shows:
  - Actual final price for closed auctions
  - "N/A" for active auctions

### Requirement 15.5: Exclude Watching Auctions
- [ ] Create test scenario:
  - Auction A: Has actual bids
  - Auction B: Only being watched (no bids placed)
- [ ] Export bid history
- [ ] Verify Auction A is included in export
- [ ] Verify Auction B is NOT included in export
- [ ] Confirm only auctions with actual bids are exported

### Requirement 15.6: Respect Auction Status Filters
- [ ] On Bid History page, select "Active Auctions" tab
- [ ] Export data
- [ ] Verify export only contains active/extended/scheduled auctions
- [ ] Switch to "Completed Auctions" tab
- [ ] Export data
- [ ] Verify export only contains closed/cancelled auctions
- [ ] Confirm filter is respected in export

### Requirement 15.8: Correct Filename Format
- [ ] Export CSV
- [ ] Verify filename format: `bid-history-YYYY-MM-DD.csv`
- [ ] Verify date is current date
- [ ] Export PDF
- [ ] Verify filename format: `bid-history-YYYY-MM-DD.pdf`
- [ ] Verify date is current date

## Edge Cases

### Empty Data
- [ ] Navigate to Bid History page with no auctions
- [ ] Verify Export button is disabled
- [ ] Verify appropriate message is shown

### Large Dataset
- [ ] Test with 100+ auctions with bids
- [ ] Export CSV
- [ ] Verify all records are included
- [ ] Verify export completes within reasonable time (< 10 seconds)
- [ ] Export PDF
- [ ] Verify pagination works correctly (multiple pages)
- [ ] Verify letterhead/footer on all pages

### Special Characters
- [ ] Create auction with asset name containing special characters (quotes, commas)
- [ ] Export CSV
- [ ] Verify special characters are properly escaped (RFC 4180)
- [ ] Open CSV in Excel/Google Sheets
- [ ] Verify data displays correctly

### Currency Formatting
- [ ] Verify bid amounts show Naira symbol (₦) in PDF
- [ ] Verify amounts are formatted with commas (e.g., ₦1,234,567.89)
- [ ] Verify CSV contains numeric values without currency symbols

## UI/UX Tests

### Dropdown Behavior
- [ ] Click Export button to open dropdown
- [ ] Click outside dropdown
- [ ] Verify dropdown closes
- [ ] Click Export button again
- [ ] Verify dropdown toggles (opens/closes)

### Loading State
- [ ] Click "Export as CSV"
- [ ] Verify button shows loading spinner and "Exporting..." text
- [ ] Verify button is disabled during export
- [ ] Verify dropdown closes during export
- [ ] Wait for export to complete
- [ ] Verify button returns to normal state

### Success Feedback
- [ ] Export CSV successfully
- [ ] Verify success toast notification appears
- [ ] Verify message: "Bid history exported as CSV"
- [ ] Export PDF successfully
- [ ] Verify success toast notification appears
- [ ] Verify message: "Bid history exported as PDF"

### Error Handling
- [ ] Simulate network error (disconnect internet)
- [ ] Attempt to export
- [ ] Verify error toast notification appears
- [ ] Verify message: "Export Failed"
- [ ] Verify button returns to normal state

## Responsive Design

### Desktop View
- [ ] Test on desktop browser (1920x1080)
- [ ] Verify Export button is properly positioned in header
- [ ] Verify dropdown aligns correctly with button
- [ ] Verify dropdown doesn't overflow screen

### Mobile View
- [ ] Test on mobile browser (375x667)
- [ ] Verify Export button is visible and accessible
- [ ] Verify button text is readable
- [ ] Verify dropdown is fully visible on screen
- [ ] Verify dropdown options are tappable

## Browser Compatibility
- [ ] Chrome: Export CSV and PDF work correctly
- [ ] Firefox: Export CSV and PDF work correctly
- [ ] Safari: Export CSV and PDF work correctly
- [ ] Edge: Export CSV and PDF work correctly

## Performance
- [ ] Measure export time for 100 records
- [ ] CSV export: < 3 seconds
- [ ] PDF export: < 5 seconds
- [ ] Verify no memory leaks (check browser dev tools)

## Accessibility
- [ ] Verify Export button is keyboard accessible (Tab key)
- [ ] Verify dropdown can be opened with Enter/Space
- [ ] Verify dropdown options can be selected with keyboard
- [ ] Verify screen reader announces button and options correctly

## Test Results

### Summary
- Total Tests: [X]
- Passed: [X]
- Failed: [X]
- Blocked: [X]

### Issues Found
1. [Issue description]
   - Severity: [Critical/High/Medium/Low]
   - Steps to reproduce: [...]
   - Expected: [...]
   - Actual: [...]

### Notes
[Any additional observations or comments]

### Sign-off
- [ ] All critical tests passed
- [ ] All requirements validated
- [ ] Ready for production deployment

**Tester Signature:** _______________  
**Date:** _______________
