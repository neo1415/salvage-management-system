# Intelligence Dashboard Live Diagnostic Guide

## Problem Statement

The intelligence dashboard is showing "No data available" even after:
1. ✅ Fixing all type assertions
2. ✅ Adding data transformation in API routes
3. ✅ Restarting the server
4. ✅ Database HAS data

**The issue**: APIs return data in terminal tests, but the UI shows nothing.

## Root Cause Analysis

This is a **client-side vs server-side** disconnect. Possible causes:

1. **Authentication Issues**: Browser requests may not have valid session cookies
2. **CORS/Credentials**: Fetch requests may not include credentials
3. **Response Format Mismatch**: UI expects `data.data` but API returns `data`
4. **Field Name Mismatch**: UI looks for `avgPrice` but API returns `avgFinalPrice`
5. **JavaScript Errors**: Silent errors preventing data display
6. **State Management**: React state not updating properly
7. **Network Errors**: Requests failing silently in browser

## Diagnostic Tools

We've created two comprehensive diagnostic tools:

### 1. Server-Side Script: `scripts/diagnose-dashboard-live.ts`

**Purpose**: Test API endpoints from Node.js environment

**Usage**:
```bash
npx tsx scripts/diagnose-dashboard-live.ts
```

**What it does**:
- ✅ Makes HTTP requests to all 7 analytics endpoints
- ✅ Logs full response (status, headers, body)
- ✅ Shows field names in returned data
- ✅ Checks if `data.data` exists and has items
- ✅ Uses exact same query params as dashboard
- ✅ Generates detailed diagnostic report

**Limitations**:
- ⚠️ Cannot test with browser authentication (no session cookies)
- ⚠️ May show 401 Unauthorized errors
- ⚠️ Best for testing API structure, not authentication flow

### 2. Browser Test Page: `public/test-dashboard-apis.html`

**Purpose**: Test API endpoints with real browser authentication

**Usage**:
1. Start your development server:
   ```bash
   npm run dev
   ```

2. Log in to your application as an **admin** or **manager** user

3. Open in browser:
   ```
   http://localhost:3000/test-dashboard-apis.html
   ```

4. Click "Run All Tests"

**What it does**:
- ✅ Makes fetch requests with real session cookies
- ✅ Tests all 7 analytics endpoints
- ✅ Shows visual results in a table
- ✅ Displays response data and field names
- ✅ Identifies authentication, authorization, and data issues
- ✅ Provides actionable recommendations
- ✅ Allows custom date range testing

**Features**:
- 🎨 Beautiful, responsive UI
- 📊 Summary cards showing success/failure counts
- 📋 Detailed results table with expandable details
- ⚠️ Issue detection and highlighting
- 💡 Smart recommendations based on results
- 🔍 View full JSON responses

## The 7 Analytics Endpoints

All endpoints tested:

1. **Asset Performance**: `/api/intelligence/analytics/asset-performance`
   - Returns: Make/model/year performance metrics
   - Expected fields: `make`, `model`, `year`, `avgPrice`, `sellThroughRate`

2. **Attribute Performance**: `/api/intelligence/analytics/attribute-performance`
   - Returns: Color, trim, storage performance
   - Expected structure: `{ color: [], trim: [], storage: [] }`

3. **Temporal Patterns**: `/api/intelligence/analytics/temporal-patterns`
   - Returns: Time-based patterns (hour, day, month)
   - Expected fields: `hour`, `dayOfWeek`, `month`, `auctionCount`

4. **Geographic Patterns**: `/api/intelligence/analytics/geographic-patterns`
   - Returns: Regional performance data
   - Expected fields: `region`, `state`, `auctionCount`, `avgPrice`

5. **Vendor Segments**: `/api/intelligence/analytics/vendor-segments`
   - Returns: Vendor segmentation data
   - Expected fields: `segment`, `vendorCount`, `totalBids`

6. **Conversion Funnel**: `/api/intelligence/analytics/conversion-funnel`
   - Returns: Funnel metrics
   - Expected fields: `stage`, `count`, `conversionRate`

7. **Session Metrics**: `/api/intelligence/analytics/session-metrics`
   - Returns: Session analytics
   - Expected structure: `{ metrics: {}, trends: [] }`

## Step-by-Step Diagnostic Process

### Step 1: Run Browser Test (RECOMMENDED)

1. **Start server**: `npm run dev`
2. **Log in** as admin/manager
3. **Open**: `http://localhost:3000/test-dashboard-apis.html`
4. **Click**: "Run All Tests"
5. **Review results**:
   - ✅ Green badges = Success
   - ❌ Red badges = Failed
   - Check "Has Data" column
   - Click "View Details" to see full responses

### Step 2: Analyze Results

#### Scenario A: All 401 Unauthorized
**Problem**: Not logged in or session expired

**Solution**:
1. Go to main app: `http://localhost:3000`
2. Log in as admin/manager
3. Return to test page
4. Run tests again

#### Scenario B: All 403 Forbidden
**Problem**: User doesn't have admin/manager role

**Solution**:
1. Check user role in database
2. Log in with admin/manager account
3. Or update user role to admin/manager

#### Scenario C: 200 OK but "No Data"
**Problem**: Database is empty or date range has no data

**Solution**:
1. Check database tables have data
2. Run population scripts:
   ```bash
   npx tsx scripts/populate-intelligence-data-fixed.ts
   ```
3. Adjust date range in test page
4. Run tests again

#### Scenario D: All Success with Data, but UI Still Shows "No Data"
**Problem**: Client-side issue (JavaScript error, state management, data transformation)

**Solution**:
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for red error messages
4. Go to **Network** tab
5. Filter by "Fetch/XHR"
6. Look for failed requests
7. Click on each request to see response
8. Compare with test page results

### Step 3: Check Browser Console

Open DevTools (F12) → Console tab

**Look for**:
- ❌ Red error messages
- ⚠️ Yellow warnings
- 🔍 Network errors
- 🐛 JavaScript exceptions

**Common errors**:
```javascript
// Field name mismatch
Cannot read property 'avgPrice' of undefined

// Data structure mismatch
Cannot read property 'data' of undefined

// State update error
Cannot update state on unmounted component

// Network error
Failed to fetch
```

### Step 4: Check Network Tab

Open DevTools (F12) → Network tab

**Steps**:
1. Filter by "Fetch/XHR"
2. Reload dashboard page
3. Look for requests to `/api/intelligence/analytics/*`
4. Check status codes (should be 200)
5. Click on each request
6. View "Response" tab
7. Compare with test page results

**What to check**:
- ✅ Status: 200 OK
- ✅ Response has `data` field
- ✅ `data` is not empty array
- ✅ Field names match UI expectations
- ✅ Values are not null/undefined

### Step 5: Compare API Response vs UI Expectations

**Example mismatch**:

API returns:
```json
{
  "success": true,
  "data": [
    {
      "make": "Toyota",
      "avgFinalPrice": 8500000,
      "avgSellThroughRate": 0.825
    }
  ]
}
```

UI expects:
```typescript
interface AssetPerformance {
  make: string;
  avgPrice: number;        // ❌ API returns avgFinalPrice
  sellThroughRate: number; // ❌ API returns decimal, UI expects percentage
}
```

**Solution**: Check data transformation in API route:
```typescript
// In route.ts
const transformedData = performance.map(item => ({
  ...item,
  avgPrice: item.avgFinalPrice,              // ✅ Transform field name
  sellThroughRate: Number(item.avgSellThroughRate) * 100, // ✅ Convert to percentage
}));
```

## Common Issues and Solutions

### Issue 1: "No data available" but APIs return 200 OK with data

**Diagnosis**:
- ✅ APIs work
- ✅ Data exists
- ❌ UI not displaying

**Possible causes**:
1. React state not updating
2. Data transformation error
3. Conditional rendering hiding data
4. CSS hiding elements

**Solution**:
```typescript
// Check component state
console.log('Asset Performance Data:', assetPerformance);

// Check if data is array
console.log('Is Array:', Array.isArray(assetPerformance));

// Check data length
console.log('Data Length:', assetPerformance.length);

// Check first item
console.log('First Item:', assetPerformance[0]);
```

### Issue 2: APIs return empty arrays

**Diagnosis**:
- ✅ APIs work (200 OK)
- ❌ No data in response

**Possible causes**:
1. Database tables empty
2. Date range has no data
3. Filters too restrictive
4. SQL query issues

**Solution**:
1. Check database:
   ```sql
   SELECT COUNT(*) FROM auction_performance_metrics;
   SELECT COUNT(*) FROM vendor_behavior_patterns;
   ```

2. Run population script:
   ```bash
   npx tsx scripts/populate-intelligence-data-fixed.ts
   ```

3. Adjust date range to include data

### Issue 3: Field name mismatches

**Diagnosis**:
- ✅ APIs return data
- ❌ UI shows undefined/null

**Possible causes**:
- API returns `avgFinalPrice`
- UI expects `avgPrice`

**Solution**:
Add transformation in API route:
```typescript
const transformedData = data.map(item => ({
  ...item,
  avgPrice: item.avgFinalPrice,
  // Add other transformations
}));
```

### Issue 4: Authentication issues

**Diagnosis**:
- ❌ 401 Unauthorized
- ❌ 403 Forbidden

**Solution**:
1. Ensure user is logged in
2. Check user has admin/manager role
3. Verify session cookies are sent
4. Check `credentials: 'include'` in fetch

## Testing Checklist

Use this checklist to systematically diagnose the issue:

- [ ] Server is running (`npm run dev`)
- [ ] Logged in as admin/manager user
- [ ] Opened test page: `http://localhost:3000/test-dashboard-apis.html`
- [ ] Ran all tests
- [ ] All endpoints return 200 OK
- [ ] All endpoints have data (not empty arrays)
- [ ] Checked field names in responses
- [ ] Opened browser DevTools (F12)
- [ ] Checked Console for errors
- [ ] Checked Network tab for failed requests
- [ ] Compared API responses with UI expectations
- [ ] Verified data transformation logic
- [ ] Checked React component state
- [ ] Verified conditional rendering logic
- [ ] Checked CSS for hidden elements

## Expected Test Results

### ✅ Healthy System

```
Total Endpoints: 7
Successful (2xx): 7
With Data: 7
Failed: 0

All endpoints return:
- Status: 200 OK
- Has Data: ✓ Yes
- Count: > 0
- Fields: Correct field names
```

### ⚠️ Empty Database

```
Total Endpoints: 7
Successful (2xx): 7
With Data: 0
Failed: 0

All endpoints return:
- Status: 200 OK
- Has Data: ✗ No
- Count: 0
- Response: { success: true, data: [] }
```

**Action**: Run population scripts

### ❌ Authentication Issue

```
Total Endpoints: 7
Successful (2xx): 0
With Data: 0
Failed: 7

All endpoints return:
- Status: 401 Unauthorized
- Has Data: ✗ No
- Response: { error: 'Unauthorized' }
```

**Action**: Log in first

### ❌ Authorization Issue

```
Total Endpoints: 7
Successful (2xx): 0
With Data: 0
Failed: 7

All endpoints return:
- Status: 403 Forbidden
- Has Data: ✗ No
- Response: { error: 'Forbidden: Admin access required' }
```

**Action**: Log in as admin/manager

## Next Steps After Diagnosis

### If APIs work but UI doesn't:

1. **Check React Component**:
   ```typescript
   // src/components/intelligence/admin/analytics/analytics-dashboard-content.tsx
   
   // Add debug logging
   useEffect(() => {
     console.log('Asset Performance:', assetPerformance);
     console.log('Color Performance:', colorPerformance);
     // ... log all state
   }, [assetPerformance, colorPerformance, ...]);
   ```

2. **Check Data Transformation**:
   ```typescript
   // In fetchAllAnalytics()
   if (assetRes.ok) {
     const data = await assetRes.json();
     console.log('Raw API Response:', data);
     console.log('Transformed Data:', data.data);
     setAssetPerformance(data.data || []);
   }
   ```

3. **Check Conditional Rendering**:
   ```typescript
   // Look for conditions that might hide data
   {assetPerformance.length > 0 ? (
     <AssetPerformanceMatrix data={assetPerformance} />
   ) : (
     <p>No data available</p> // ← This might be showing
   )}
   ```

4. **Check Component Props**:
   ```typescript
   // In child component
   export function AssetPerformanceMatrix({ data, loading }: Props) {
     console.log('Received data:', data);
     console.log('Data length:', data?.length);
     
     if (!data || data.length === 0) {
       return <p>No data available</p>; // ← Check this condition
     }
     
     // ...
   }
   ```

## Quick Reference Commands

```bash
# Start development server
npm run dev

# Run server-side diagnostic
npx tsx scripts/diagnose-dashboard-live.ts

# Populate test data
npx tsx scripts/populate-intelligence-data-fixed.ts

# Check database
npx tsx scripts/check-intelligence-tables.ts

# Run migrations
npx tsx scripts/run-intelligence-migrations.ts
```

## Browser Test Page URL

```
http://localhost:3000/test-dashboard-apis.html
```

## Support

If issues persist after following this guide:

1. **Capture screenshots** of:
   - Test page results
   - Browser console errors
   - Network tab responses

2. **Export test results**:
   - Click "View Details" on each endpoint
   - Copy JSON responses

3. **Check logs**:
   - Server console output
   - Browser console output
   - Network tab details

4. **Verify environment**:
   - Node.js version
   - Database connection
   - Environment variables

## Summary

The diagnostic tools help identify:
- ✅ Authentication issues (401/403)
- ✅ Empty database (200 OK but no data)
- ✅ Field name mismatches
- ✅ Response format issues
- ✅ Client-side JavaScript errors
- ✅ Network request failures

**Recommended workflow**:
1. Run browser test page first
2. Check all endpoints return 200 OK with data
3. If yes, check browser console for errors
4. If no, fix authentication or populate database
5. Compare API responses with UI expectations
6. Fix any field name or format mismatches

---

**Created**: 2024
**Last Updated**: 2024
**Status**: Active Diagnostic Tool
