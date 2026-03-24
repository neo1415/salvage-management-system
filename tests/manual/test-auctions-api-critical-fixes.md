# Auctions API Critical Fixes - Manual Test Plan

## Overview
This test plan verifies two critical fixes in the auctions API:
1. **Asset Type Filter with Multiple Values** - Fixed to support comma-separated values with OR logic
2. **Database Connection Pool Exhaustion** - Fixed by replacing separate queries with EXISTS subqueries

## Fixed Issues

### Issue 1: Asset Type Filter with Multiple Values
**Problem:** Error `invalid input value for enum asset_type: "vehicle,electronics"` when multiple asset types selected

**Fix Applied:**
- Parse comma-separated asset type values
- Use `inArray()` for multiple values with OR logic
- Single values still use `eq()` for optimization

**Location:** `src/app/api/auctions/route.ts` lines 100-108

### Issue 2: Database Connection Pool Exhaustion
**Problem:** Error `MaxClientsInSessionMode: max clients reached`

**Fix Applied:**
- Replaced separate database queries with EXISTS subqueries
- `my_bids` tab now uses EXISTS instead of fetching all bid IDs
- `completed` tab now uses EXISTS instead of fetching all verified payment IDs
- Reduces connection usage from 3 queries to 1 query per request

**Location:** `src/app/api/auctions/route.ts` lines 56-96

---

## Test Cases

### Test 1: Single Asset Type Filter
**Objective:** Verify single asset type filtering still works

**Steps:**
1. Navigate to auctions page
2. Select single asset type filter (e.g., "Vehicle")
3. Verify only vehicle auctions are displayed
4. Check browser console for errors

**Expected Result:**
- ✅ Only vehicle auctions displayed
- ✅ No console errors
- ✅ API response successful

**Status:** [ ] Pass [ ] Fail

---

### Test 2: Multiple Asset Types Filter (Primary Fix)
**Objective:** Verify multiple asset type filtering with OR logic

**Steps:**
1. Navigate to auctions page
2. Select multiple asset types (e.g., "Vehicle" and "Electronics")
3. Verify auctions of BOTH types are displayed
4. Check browser console for errors
5. Verify no enum error in console

**Expected Result:**
- ✅ Vehicle auctions displayed
- ✅ Electronics auctions displayed
- ✅ No property auctions displayed
- ✅ No enum error: `invalid input value for enum asset_type`
- ✅ API response successful

**API Test:**
```bash
# Test with curl
curl "http://localhost:3000/api/auctions?assetType=vehicle,electronics"
```

**Status:** [ ] Pass [ ] Fail

---

### Test 3: All Asset Types Selected
**Objective:** Verify filtering with all three asset types

**Steps:**
1. Navigate to auctions page
2. Select all asset types: "Vehicle", "Property", "Electronics"
3. Verify all auctions are displayed
4. Check browser console for errors

**Expected Result:**
- ✅ All auction types displayed
- ✅ No console errors
- ✅ API response successful

**API Test:**
```bash
curl "http://localhost:3000/api/auctions?assetType=vehicle,property,electronics"
```

**Status:** [ ] Pass [ ] Fail

---

### Test 4: Asset Type + Location Filter
**Objective:** Verify multiple filters work together

**Steps:**
1. Navigate to auctions page
2. Select multiple asset types (e.g., "Vehicle,Electronics")
3. Enter location filter (e.g., "Nairobi")
4. Verify only matching auctions displayed
5. Check browser console for errors

**Expected Result:**
- ✅ Only vehicle/electronics auctions in Nairobi displayed
- ✅ No console errors
- ✅ Filters work together correctly

**API Test:**
```bash
curl "http://localhost:3000/api/auctions?assetType=vehicle,electronics&location=Nairobi"
```

**Status:** [ ] Pass [ ] Fail

---

### Test 5: My Bids Tab (Connection Pool Fix)
**Objective:** Verify my_bids tab uses EXISTS subquery

**Steps:**
1. Login as vendor who has placed bids
2. Navigate to "My Bids" tab
3. Verify auctions with your bids are displayed
4. Check browser console for errors
5. Monitor database connections (if possible)

**Expected Result:**
- ✅ Auctions with vendor bids displayed
- ✅ No connection pool errors
- ✅ No `MaxClientsInSessionMode` error
- ✅ API response successful

**API Test:**
```bash
# Test with authenticated session
curl "http://localhost:3000/api/auctions?tab=my_bids" \
  -H "Cookie: your-session-cookie"
```

**Status:** [ ] Pass [ ] Fail

---

### Test 6: Completed Tab (Connection Pool Fix)
**Objective:** Verify completed tab uses EXISTS subquery

**Steps:**
1. Navigate to "Completed" tab
2. Verify only auctions with verified payments displayed
3. Check browser console for errors
4. Monitor database connections (if possible)

**Expected Result:**
- ✅ Only completed auctions with verified payments displayed
- ✅ No connection pool errors
- ✅ No `MaxClientsInSessionMode` error
- ✅ API response successful

**API Test:**
```bash
curl "http://localhost:3000/api/auctions?tab=completed"
```

**Status:** [ ] Pass [ ] Fail

---

### Test 7: High Load Scenario (Connection Pool Stress Test)
**Objective:** Verify connection pool handles multiple concurrent requests

**Steps:**
1. Open multiple browser tabs (5-10 tabs)
2. In each tab, navigate to different auction filters:
   - Tab 1: Active auctions
   - Tab 2: My Bids
   - Tab 3: Completed
   - Tab 4: Multiple asset types filter
   - Tab 5: Location filter
3. Refresh all tabs simultaneously (Ctrl+Shift+R)
4. Check for connection pool errors in any tab

**Expected Result:**
- ✅ All tabs load successfully
- ✅ No `MaxClientsInSessionMode` errors
- ✅ No connection timeout errors
- ✅ All API responses successful

**Load Test Script:**
```bash
# Run 10 concurrent requests
for i in {1..10}; do
  curl "http://localhost:3000/api/auctions?assetType=vehicle,electronics" &
done
wait
```

**Status:** [ ] Pass [ ] Fail

---

### Test 8: Edge Cases

#### Test 8.1: Empty Asset Type Filter
**Steps:**
1. Navigate to auctions with no asset type filter
2. Verify all auctions displayed

**Expected:** ✅ All auctions displayed
**Status:** [ ] Pass [ ] Fail

---

#### Test 8.2: Invalid Asset Type
**Steps:**
1. Test API with invalid asset type: `?assetType=invalid`
2. Verify graceful handling

**Expected:** ✅ No results or error handled gracefully
**Status:** [ ] Pass [ ] Fail

---

#### Test 8.3: Asset Type with Spaces
**Steps:**
1. Test API with spaces: `?assetType=vehicle, electronics`
2. Verify trimming works correctly

**Expected:** ✅ Both vehicle and electronics auctions displayed
**Status:** [ ] Pass [ ] Fail

---

## Performance Verification

### Database Query Analysis
**Objective:** Verify query optimization

**Steps:**
1. Enable PostgreSQL query logging
2. Make API request to each tab
3. Count number of queries executed
4. Verify EXISTS subqueries are used

**Expected Results:**
- ✅ `my_bids` tab: 1 main query with EXISTS subquery (not 2 separate queries)
- ✅ `completed` tab: 1 main query with EXISTS subquery (not 2 separate queries)
- ✅ No separate SELECT queries for bids or payments tables

**Status:** [ ] Pass [ ] Fail

---

## Regression Testing

### Test 9: Existing Functionality
**Objective:** Verify no breaking changes

**Checklist:**
- [ ] Active tab works correctly
- [ ] Won tab works correctly
- [ ] Price range filter works
- [ ] Location filter works
- [ ] Search filter works
- [ ] Sorting works (ending_soon, newest, price_low, price_high)
- [ ] Pagination works
- [ ] isWinner flag works correctly

**Status:** [ ] Pass [ ] Fail

---

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| Single Asset Type | [ ] | |
| Multiple Asset Types | [ ] | Primary fix verification |
| All Asset Types | [ ] | |
| Asset Type + Location | [ ] | |
| My Bids Tab | [ ] | Connection pool fix |
| Completed Tab | [ ] | Connection pool fix |
| High Load Scenario | [ ] | Stress test |
| Edge Cases | [ ] | |
| Performance | [ ] | Query optimization |
| Regression | [ ] | No breaking changes |

---

## Sign-off

**Tester Name:** ___________________
**Date:** ___________________
**Overall Status:** [ ] Pass [ ] Fail
**Notes:**

---

## Rollback Plan

If issues are found:
1. Revert changes to `src/app/api/auctions/route.ts`
2. Restore previous version from git
3. Investigate root cause
4. Re-apply fixes with additional testing

**Git Revert Command:**
```bash
git checkout HEAD~1 -- src/app/api/auctions/route.ts
```
