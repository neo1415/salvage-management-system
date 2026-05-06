# Revenue Analysis PDF Export - Testing Guide

## Quick Start

### 1. Navigate to Revenue Analysis Report
```
http://localhost:3000/reports/financial/revenue-analysis
```

### 2. Apply Filters (Optional)
- Select date range (e.g., Last 30 days)
- Select asset types (e.g., Vehicle, Electronics)
- Select regions (e.g., Lagos, Abuja)
- Click "Apply Filters"

### 3. Export PDF
- Click "Export" button (top right)
- Select "Export as PDF"
- Wait for PDF generation (5-10 seconds)
- PDF should download automatically

## What to Verify

### ✅ Letterhead Section
- [ ] Burgundy background (#800020)
- [ ] "NEM Insurance" title visible
- [ ] "Salvage Management Platform" subtitle visible
- [ ] Company address on the right side
- [ ] White text, professional appearance

### ✅ Report Content
- [ ] "Revenue Analysis Report" title in burgundy
- [ ] Generation date displayed
- [ ] 4 summary cards showing:
  - Total Revenue
  - Salvage Recovered
  - Registration Fees
  - Recovery Rate
- [ ] All values formatted with ₦ currency symbol
- [ ] Trend indicators (↑ or ↓) visible

### ✅ Charts
- [ ] "Salvage Recovery Trend" line chart displays
- [ ] Chart has proper labels and legend
- [ ] "Salvage Recovery by Asset Type" bar chart displays
- [ ] Charts are clear and readable (not blurry)
- [ ] No animation artifacts

### ✅ Tables
- [ ] "Asset Type Details" table displays
- [ ] Headers have burgundy background
- [ ] All columns visible (Asset Type, Cases, Claims Paid, etc.)
- [ ] Numbers are right-aligned
- [ ] Currency values formatted correctly
- [ ] "Regional Breakdown" table displays (if data available)
- [ ] "Detailed Item Breakdown" table displays (if data available)

### ✅ Footer Section
- [ ] Light gray background
- [ ] Burgundy top border (3px)
- [ ] "NEM Insurance - Salvage Management Platform" text
- [ ] Confidentiality notice visible
- [ ] Generation timestamp visible
- [ ] "Page 1" indicator visible

### ✅ No Unwanted Elements
- [ ] No navigation menu
- [ ] No "Back to Reports" button
- [ ] No "Export" button
- [ ] No cookie banners
- [ ] No loading spinners
- [ ] No filter controls
- [ ] No browser UI elements

### ✅ Data Accuracy
- [ ] Summary metrics match the dashboard
- [ ] Chart data matches table data
- [ ] Filters applied correctly (check date range)
- [ ] All expected items included in tables
- [ ] Percentages calculated correctly

## Testing Different Scenarios

### Scenario 1: Default Filters (Last 30 Days)
1. Navigate to report
2. Don't change any filters
3. Export PDF
4. Verify data shows last 30 days

### Scenario 2: Custom Date Range
1. Select custom date range (e.g., Jan 1 - Mar 31)
2. Apply filters
3. Export PDF
4. Verify PDF shows correct date range in data

### Scenario 3: Asset Type Filter
1. Select only "Vehicle" asset type
2. Apply filters
3. Export PDF
4. Verify only vehicle data appears in tables and charts

### Scenario 4: Region Filter
1. Select only "Lagos" region
2. Apply filters
3. Export PDF
4. Verify only Lagos data appears

### Scenario 5: Multiple Filters
1. Select date range + asset types + regions
2. Apply filters
3. Export PDF
4. Verify all filters applied correctly

### Scenario 6: Large Dataset
1. Select a wide date range (e.g., 1 year)
2. Export PDF
3. Verify:
   - PDF generates successfully (may take longer)
   - Item breakdown shows "Showing first 20 of X items" note
   - All charts still render properly
   - No data truncation issues

## Common Issues and Solutions

### Issue: PDF is blank
**Solution**: 
- Check browser console for errors
- Verify API endpoint is accessible
- Check server logs for Puppeteer errors

### Issue: Charts not visible
**Solution**:
- Ensure Chart.js is loaded
- Check that `animation: false` is set
- Verify chart data is not empty

### Issue: PDF cuts off
**Solution**:
- Check page break settings
- Verify content fits within A4 dimensions
- Adjust padding/margins if needed

### Issue: Styling looks wrong
**Solution**:
- Verify CSS is inline or in `<style>` tag
- Check print media query is applied
- Ensure Puppeteer emulates print media

### Issue: Authentication error
**Solution**:
- Verify user is logged in
- Check session cookies are passed correctly
- Verify cookie domain matches

### Issue: Timeout error
**Solution**:
- Increase timeout in API route
- Check data query performance
- Verify network connectivity

## Performance Testing

### Expected Generation Times
- **Small reports** (< 10 items): 3-5 seconds
- **Medium reports** (10-50 items): 5-8 seconds
- **Large reports** (50+ items): 8-12 seconds

### Load Testing
1. Generate 5 PDFs concurrently
2. Verify all complete successfully
3. Check server memory usage
4. Monitor response times

## Browser Compatibility

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] iOS Safari
- [ ] Chrome Mobile
- [ ] Samsung Internet

## Accessibility Testing

### Screen Reader Testing
- [ ] Letterhead content is readable
- [ ] Table headers are properly announced
- [ ] Chart alt text is meaningful

### Keyboard Navigation
- [ ] Export button is keyboard accessible
- [ ] Dropdown menu is keyboard navigable

## Visual Regression Testing

### Compare PDFs
1. Generate PDF with known data
2. Compare with reference PDF
3. Verify:
   - Layout is identical
   - Colors match
   - Fonts are consistent
   - Spacing is correct

## Production Readiness Checklist

### Before Deploying
- [ ] All tests pass
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] Error handling works
- [ ] Logging is in place
- [ ] Documentation is complete

### After Deploying
- [ ] Monitor error rates
- [ ] Check generation times
- [ ] Verify memory usage
- [ ] Collect user feedback

## Reporting Issues

### Information to Include
1. **Environment**: Browser, OS, device
2. **Steps to reproduce**: Exact steps taken
3. **Expected result**: What should happen
4. **Actual result**: What actually happened
5. **Screenshots**: If visual issue
6. **Console errors**: Any JavaScript errors
7. **Network logs**: API request/response details

## Success Criteria

The PDF export is considered successful when:
- ✅ PDF downloads without errors
- ✅ All content is visible and complete
- ✅ Letterhead and footer are professional
- ✅ Charts render clearly
- ✅ Tables are well-formatted
- ✅ No UI elements or navigation visible
- ✅ Data matches the dashboard
- ✅ Filters apply correctly
- ✅ Generation time is acceptable (< 15 seconds)
- ✅ File size is reasonable (< 5MB)

## Next Steps

After successful testing:
1. Apply same pattern to other reports:
   - Payment Analytics
   - Vendor Spending
   - Profitability Analysis
   - KPI Dashboard
   - etc.

2. Consider enhancements:
   - Custom logo upload
   - Multiple letterhead templates
   - Email integration
   - Scheduled reports
   - Batch export

3. Gather user feedback:
   - Survey users on PDF quality
   - Collect feature requests
   - Monitor usage analytics
