# Intelligence Dashboard Testing Guide

## Quick Testing Steps

### 1. Verify Data Exists in Database
```bash
npx tsx scripts/verify-intelligence-dashboards.ts
```

**Expected Output**:
```
✅ Trending Assets: Available
✅ Temporal Patterns: Available
✅ Geographic Patterns: Available
✅ ML Datasets: Available
✅ Vendor Segments: Available
✅ Conversion Funnel: Available
✅ Attribute Performance: Available
```

### 2. Test API Service Methods
```bash
npx tsx scripts/test-intelligence-apis.ts
```

**Expected Output**:
```
✅ Asset Performance Service: 10 records found
✅ Temporal Patterns Service: 22 records found
✅ Geographic Patterns Service: 6 records found
```

### 3. Test Frontend Pages

#### Vendor Market Insights Page
1. Navigate to `/vendor/market-insights`
2. Login as a vendor user
3. Verify the following sections display data:
   - **Trending Assets** table with 10 rows
   - **Best Time to Bid** showing 5 optimal time slots
   - **Regional Insights** showing geographic patterns
   - **Your Performance** (placeholder - shows "Coming soon")

4. Test filters:
   - Change **Asset Type** dropdown (All Types, Vehicles, Electronics, Machinery)
   - Change **Date Range** dropdown (7d, 30d, 90d, 1y)
   - Change **Region** dropdown (All Regions, Lagos, Abuja, etc.)
   - Verify data updates after each filter change

5. Test download:
   - Click **Download Report** button
   - Verify Excel file downloads (if export API is implemented)

#### Admin Intelligence Dashboard
1. Navigate to `/admin/intelligence`
2. Login as an admin user
3. Verify the **Overview** tab shows:
   - **Prediction Accuracy** metric card with percentage
   - **Recommendation Conversion** metric card
   - **Fraud Alerts** count
   - **System Health** metrics
   - **Prediction Accuracy Trend** chart
   - **Match Score Distribution** chart
   - **Recent Fraud Alerts** table

4. Test other tabs:
   - **System Health**: Shows detailed health metrics
   - **Vendor Analytics**: Shows vendor segment pie chart
   - **Schema Evolution**: Shows schema change log
   - **ML Datasets**: Shows list of ML training datasets

#### Admin Analytics Dashboard
1. Navigate to `/admin/analytics` (if exists)
2. Verify real data displays instead of hardcoded samples

## API Endpoint Testing

### Using curl or Postman

#### 1. Asset Performance API
```bash
curl -X GET "http://localhost:3000/api/intelligence/analytics/asset-performance?startDate=2026-03-07T00:00:00.000Z&endDate=2026-04-06T23:59:59.999Z&limit=10" \
  -H "Cookie: your-session-cookie"
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "assetType": "vehicle",
      "make": "Toyota",
      "model": "Camry",
      "demandScore": 70,
      "totalAuctions": 10,
      ...
    }
  ],
  "meta": {
    "count": 10,
    "filters": { ... }
  }
}
```

#### 2. Temporal Patterns API
```bash
curl -X GET "http://localhost:3000/api/intelligence/analytics/temporal-patterns?startDate=2026-03-07T00:00:00.000Z&endDate=2026-04-06T23:59:59.999Z" \
  -H "Cookie: your-session-cookie"
```

#### 3. Geographic Patterns API
```bash
curl -X GET "http://localhost:3000/api/intelligence/analytics/geographic-patterns?startDate=2026-03-07T00:00:00.000Z&endDate=2026-04-06T23:59:59.999Z" \
  -H "Cookie: your-session-cookie"
```

#### 4. ML Datasets API
```bash
curl -X GET "http://localhost:3000/api/intelligence/ml/datasets?limit=20" \
  -H "Cookie: your-session-cookie"
```

#### 5. Vendor Segments API
```bash
curl -X GET "http://localhost:3000/api/intelligence/admin/vendor-segments" \
  -H "Cookie: your-session-cookie"
```

#### 6. Admin Dashboard API
```bash
curl -X GET "http://localhost:3000/api/intelligence/admin/dashboard" \
  -H "Cookie: your-session-cookie"
```

## Troubleshooting

### Issue: "No data available" still showing

**Check 1: Verify data exists**
```bash
npx tsx scripts/verify-intelligence-dashboards.ts
```

**Check 2: Check date ranges**
```bash
npx tsx scripts/check-analytics-dates.ts
```
Ensure the populated data's period dates overlap with the frontend's date range.

**Check 3: Check browser console**
Open browser DevTools (F12) and check:
- Network tab: Are API calls returning 200 OK?
- Console tab: Any JavaScript errors?

**Check 4: Check API response**
Use browser DevTools Network tab to inspect API responses:
- Click on the API call
- Check "Response" tab
- Verify `data` array is not empty

### Issue: TypeScript compilation errors

**Solution**: Run diagnostics
```bash
npm run build
```
or
```bash
npx tsc --noEmit
```

All files should compile without errors after the fixes.

### Issue: API returns 401 Unauthorized

**Solution**: Ensure you're logged in with the correct role:
- Vendor routes: Require vendor role
- Admin routes: Require admin or system_admin role

### Issue: API returns empty data array

**Possible causes**:
1. Date range doesn't overlap with populated data
2. Filters are too restrictive
3. Data was not populated correctly

**Solution**: Try removing all filters and using a wide date range (1 year).

## Data Population

If data is missing, repopulate using:
```bash
npx tsx scripts/populate-intelligence-data-fixed.ts
```

This will:
- Clear existing analytics data
- Recalculate analytics from closed auctions
- Populate all intelligence tables

## Performance Testing

### Check Query Performance
```bash
# Enable query logging in Drizzle
# Add to src/lib/db/index.ts:
# logger: true
```

Then monitor query execution times in the console.

### Expected Performance
- Asset Performance query: < 100ms
- Temporal Patterns query: < 100ms
- Geographic Patterns query: < 100ms
- Dashboard metrics: < 200ms

## Browser Testing Checklist

- [ ] Chrome: Vendor Market Insights page loads with data
- [ ] Chrome: Admin Intelligence Dashboard loads with data
- [ ] Chrome: Filters work correctly
- [ ] Chrome: Download report works
- [ ] Firefox: All pages load correctly
- [ ] Safari: All pages load correctly
- [ ] Mobile: Responsive layout works

## Success Criteria

✅ All API endpoints return 200 OK  
✅ All API responses contain data arrays with records  
✅ Frontend pages display data (no "No data available")  
✅ Filters update data correctly  
✅ No TypeScript compilation errors  
✅ No browser console errors  
✅ Charts and tables render properly  

## Additional Resources

- [Intelligence Dashboard Data Display Fix](./INTELLIGENCE_DASHBOARD_DATA_DISPLAY_FIX.md)
- [AI Marketplace Intelligence Complete](./AI_MARKETPLACE_INTELLIGENCE_COMPLETE.md)
- [Intelligence API Documentation](./intelligence/API_DOCUMENTATION.md)
