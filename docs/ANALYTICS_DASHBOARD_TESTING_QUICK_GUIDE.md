# Analytics Dashboard Testing Quick Guide

## Quick Test Commands

### 1. Run the Test Script
```bash
npx tsx scripts/test-vendor-segments-fix.ts
```

This will test:
- Vendor segments API accepts date parameters
- All analytics endpoints return consistent responses
- No 400 Bad Request errors

### 2. Start Development Server
```bash
npm run dev
```

### 3. Access the Dashboard
Navigate to: `http://localhost:3000/admin/intelligence/analytics`

## What to Look For

### ✅ Success Indicators

1. **All charts load without errors**
   - Asset Performance Matrix
   - Attribute Performance Tabs
   - Temporal Patterns Heatmap
   - Geographic Distribution Map
   - Vendor Segments Chart ⭐ (this was failing)
   - Conversion Funnel Diagram
   - Session Analytics Metrics

2. **Browser console is clean**
   - No 400 Bad Request errors
   - No validation errors
   - API calls return 200 OK or 401 (if not logged in)

3. **Date filtering works**
   - Change date range in filters
   - Click "Apply Filters"
   - All charts update with new data

### ❌ Failure Indicators

1. **400 Bad Request errors** in console
2. **Empty charts** with no data
3. **"Invalid query parameters"** error messages
4. **Charts fail to update** when filters change

## API Endpoints to Monitor

All endpoints should accept `startDate` and `endDate`:

```
GET /api/intelligence/analytics/asset-performance?startDate=...&endDate=...
GET /api/intelligence/analytics/attribute-performance?startDate=...&endDate=...
GET /api/intelligence/analytics/temporal-patterns?startDate=...&endDate=...
GET /api/intelligence/analytics/geographic-patterns?startDate=...&endDate=...
GET /api/intelligence/analytics/vendor-segments?startDate=...&endDate=... ⭐
GET /api/intelligence/analytics/conversion-funnel?startDate=...&endDate=...
GET /api/intelligence/analytics/session-metrics?startDate=...&endDate=...
```

## Browser DevTools Check

### Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "analytics"
4. Refresh the dashboard page
5. Check all requests return 200 OK (or 401 if not authenticated)

### Console Tab
1. Look for any red error messages
2. Verify no 400 errors
3. Check for successful data fetching logs

## Quick Fix Verification

### Before Fix
```
❌ GET /api/intelligence/analytics/vendor-segments?startDate=...&endDate=...
   Status: 400 Bad Request
   Error: Invalid query parameters
```

### After Fix
```
✅ GET /api/intelligence/analytics/vendor-segments?startDate=...&endDate=...
   Status: 200 OK
   Data: { success: true, data: [...], meta: {...} }
```

## Common Issues

### Issue: 401 Unauthorized
**Solution:** Log in as an admin user first
- Role required: `system_admin`, `salvage_manager`, or `finance_officer`

### Issue: Empty data arrays
**Solution:** Populate intelligence data
```bash
npx tsx scripts/populate-intelligence-data-fixed.ts
```

### Issue: TypeScript errors
**Solution:** Rebuild the project
```bash
npm run build
```

## Test Data Requirements

The analytics dashboard requires:
- Vendor segments data in `vendor_segments` table
- Session analytics in `session_analytics` table
- Conversion funnel data in `conversion_funnel_analytics` table
- Historical auction and bid data

If tables are empty, run data population scripts:
```bash
npx tsx scripts/populate-intelligence-data-fixed.ts
npx tsx scripts/comprehensive-intelligence-population.ts
```

## Expected Response Format

### Vendor Segments API Response
```json
{
  "success": true,
  "data": [
    {
      "vendorId": "uuid",
      "priceSegment": "bargain_hunter",
      "categorySegment": "specialist",
      "activitySegment": "active_bidder",
      "avgBidToValueRatio": "0.75",
      "preferredAssetTypes": ["vehicle", "electronics"],
      "preferredPriceRange": { "min": 1000000, "max": 5000000 },
      "bidsPerWeek": "3.5",
      "overallWinRate": "0.45",
      "lastBidAt": "2025-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "count": 1,
    "filters": {
      "segment": null,
      "startDate": "2024-12-15T00:00:00Z",
      "endDate": "2025-01-15T00:00:00Z"
    }
  }
}
```

## Troubleshooting

### Dashboard shows no data
1. Check if you're logged in as admin
2. Verify intelligence tables have data
3. Check date range isn't too narrow
4. Look for API errors in console

### Vendor segments chart is empty
1. Run: `npx tsx scripts/test-vendor-segments-fix.ts`
2. Check API response in Network tab
3. Verify `vendor_segments` table has data
4. Check date filters aren't excluding all data

### 400 Bad Request persists
1. Clear browser cache
2. Restart dev server
3. Check if changes were saved
4. Verify Zod schema includes startDate/endDate

## Success Criteria

✅ All 7 analytics endpoints return 200 OK  
✅ Vendor segments chart displays pie chart  
✅ No 400 errors in browser console  
✅ Date filtering updates all charts  
✅ Export functionality works  
✅ Refresh button reloads data  

---

**Last Updated:** 2025-01-XX  
**Related:** `ANALYTICS_DASHBOARD_VENDOR_SEGMENTS_FIX.md`
