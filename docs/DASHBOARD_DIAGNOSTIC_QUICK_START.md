# Dashboard Diagnostic Quick Start

## Problem
Intelligence dashboard shows "No data available" but database has data.

## Solution: 3-Minute Diagnostic

### Step 1: Open Browser Test Page (30 seconds)

1. Start server: `npm run dev`
2. Log in as **admin** or **manager**
3. Open: **http://localhost:3000/test-dashboard-apis.html**

### Step 2: Run Tests (1 minute)

1. Click **"Run All Tests"** button
2. Wait for results (tests all 7 endpoints)

### Step 3: Interpret Results (1 minute)

#### ✅ All Green (Success with Data)
```
Successful: 7/7
With Data: 7/7
```
**Meaning**: APIs work perfectly!

**Next**: Check browser console for UI errors
- Press F12
- Go to Console tab
- Look for red errors

---

#### ⚠️ Yellow (Success but No Data)
```
Successful: 7/7
With Data: 0/7
```
**Meaning**: Database is empty

**Fix**:
```bash
npx tsx scripts/populate-intelligence-data-fixed.ts
```

---

#### ❌ Red (401 Unauthorized)
```
Failed: 7/7
Status: 401
```
**Meaning**: Not logged in

**Fix**: Log in to the app first, then rerun tests

---

#### ❌ Red (403 Forbidden)
```
Failed: 7/7
Status: 403
```
**Meaning**: User is not admin/manager

**Fix**: Log in with admin/manager account

---

## Visual Guide

### Test Page Interface

```
┌─────────────────────────────────────────────────────┐
│  🔍 Intelligence Dashboard API Tester               │
├─────────────────────────────────────────────────────┤
│  Start Date: [2024-01-01]  End Date: [2024-01-31]  │
│  [▶ Run All Tests]  [🗑️ Clear]                      │
├─────────────────────────────────────────────────────┤
│  Summary Cards:                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │  7   │ │  7   │ │  7   │ │  0   │              │
│  │Total │ │Success│ │ Data │ │Failed│              │
│  └──────┘ └──────┘ └──────┘ └──────┘              │
├─────────────────────────────────────────────────────┤
│  Results Table:                                     │
│  Endpoint              Status    Has Data  Count   │
│  /asset-performance    200 OK    ✓ Yes     45      │
│  /attribute-perf...    200 OK    ✓ Yes     32      │
│  /temporal-patterns    200 OK    ✓ Yes     24      │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

### What Each Column Means

- **Endpoint**: Which API is being tested
- **Status**: HTTP response code (200 = good, 401 = auth, 403 = forbidden)
- **Has Data**: Whether response contains data
- **Count**: Number of items in response
- **Actions**: Click "View Details" to see full JSON

---

## Common Scenarios

### Scenario 1: "Everything looks good but UI still broken"

**Symptoms**:
- ✅ Test page shows all green
- ✅ All endpoints have data
- ❌ Dashboard UI shows "No data available"

**Diagnosis**: Client-side JavaScript error

**Steps**:
1. Open dashboard page
2. Press **F12** (DevTools)
3. Go to **Console** tab
4. Look for **red error messages**
5. Go to **Network** tab
6. Filter by **"Fetch/XHR"**
7. Look for **failed requests** (red)

**Common errors**:
```javascript
// Field name mismatch
Cannot read property 'avgPrice' of undefined

// Wrong data structure
Cannot read property 'data' of undefined
```

**Fix**: Check data transformation in API routes

---

### Scenario 2: "Some endpoints work, some don't"

**Symptoms**:
- ⚠️ Mixed results (some green, some red)

**Diagnosis**: Specific endpoint issues

**Steps**:
1. Click **"View Details"** on failed endpoints
2. Read error message
3. Check server console for errors

**Common causes**:
- Database table missing
- SQL query error
- Missing data for date range

---

### Scenario 3: "All endpoints return empty arrays"

**Symptoms**:
- ✅ Status: 200 OK
- ❌ Count: 0
- Response: `{ success: true, data: [] }`

**Diagnosis**: No data in database for date range

**Fix Option 1**: Populate database
```bash
npx tsx scripts/populate-intelligence-data-fixed.ts
```

**Fix Option 2**: Adjust date range
- Change dates in test page
- Try wider date range
- Try last 90 days instead of 30

---

## Advanced Debugging

### Check Specific Endpoint

Click **"View Details"** to see full response:

```json
{
  "success": true,
  "data": [
    {
      "make": "Toyota",
      "model": "Camry",
      "avgFinalPrice": 8500000,
      "avgSellThroughRate": 0.825
    }
  ],
  "meta": {
    "count": 1,
    "filters": { ... }
  }
}
```

**Check**:
- ✅ `success: true`
- ✅ `data` is array
- ✅ `data` has items
- ✅ Field names are correct
- ✅ Values are not null

### Compare with UI Expectations

**API returns**:
```json
{
  "avgFinalPrice": 8500000,
  "avgSellThroughRate": 0.825
}
```

**UI expects**:
```typescript
{
  avgPrice: number,        // ← Different name!
  sellThroughRate: number  // ← Different format! (percentage)
}
```

**Solution**: Add transformation in API route:
```typescript
const transformedData = data.map(item => ({
  ...item,
  avgPrice: item.avgFinalPrice,
  sellThroughRate: Number(item.avgSellThroughRate) * 100,
}));
```

---

## Checklist

Before asking for help, verify:

- [ ] Server is running
- [ ] Logged in as admin/manager
- [ ] Ran browser test page
- [ ] All endpoints return 200 OK
- [ ] All endpoints have data (count > 0)
- [ ] Checked browser console (F12 → Console)
- [ ] Checked network tab (F12 → Network)
- [ ] Clicked "View Details" on each endpoint
- [ ] Compared field names with UI expectations

---

## Files Created

1. **Browser Test Page**: `public/test-dashboard-apis.html`
   - Open at: http://localhost:3000/test-dashboard-apis.html
   - Visual interface for testing APIs
   - Works with real authentication

2. **Server Script**: `scripts/diagnose-dashboard-live.ts`
   - Run: `npx tsx scripts/diagnose-dashboard-live.ts`
   - Command-line diagnostic
   - May show auth errors (use browser test instead)

3. **Full Guide**: `docs/INTELLIGENCE_DASHBOARD_LIVE_DIAGNOSTIC_GUIDE.md`
   - Complete documentation
   - All scenarios covered
   - Detailed troubleshooting

---

## Quick Commands

```bash
# Start server
npm run dev

# Populate test data
npx tsx scripts/populate-intelligence-data-fixed.ts

# Run server diagnostic (may show auth errors)
npx tsx scripts/diagnose-dashboard-live.ts
```

---

## Summary

1. **Open**: http://localhost:3000/test-dashboard-apis.html
2. **Click**: "Run All Tests"
3. **Check**: Results (green = good, red = problem)
4. **If all green**: Check browser console for UI errors
5. **If red**: Follow fix for your scenario above

**Most common issue**: Empty database → Run population script

**Second most common**: Not logged in → Log in first

**Third most common**: UI error → Check browser console (F12)

---

**Time to diagnose**: 3 minutes
**Time to fix**: 5-30 minutes depending on issue
