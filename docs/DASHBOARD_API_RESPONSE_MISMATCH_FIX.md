# Dashboard API Response Mismatch Fix

## Issue Summary

The Intelligence Dashboard and Market Intelligence dashboards are showing "No data" because the UI components expect different response formats than what the APIs actually return.

## Root Causes

### 1. Intelligence Dashboard - ML Datasets Tab
**Component**: `src/components/intelligence/admin/ml-datasets-table.tsx`
**API**: `/api/intelligence/ml/datasets`

**Problem**:
- Component expects: `{ datasets: [...] }`
- API returns: `{ success: true, data: [...] }`

**Fix**: ✅ APPLIED
```typescript
// BEFORE
const result = await response.json();
setDatasets(result.datasets || []);

// AFTER
const result = await response.json();
setDatasets(result.data || []);
```

### 2. Intelligence Dashboard - Schema Evolution Tab
**Component**: `src/components/intelligence/admin/schema-evolution-table.tsx`
**API**: `/api/intelligence/admin/schema/pending`

**Problem**:
- Component expects: `{ changes: [...] }`
- API returns: `{ success: true, data: { pendingChanges: [...] } }`

**Fix**: ✅ APPLIED
```typescript
// BEFORE
const result = await response.json();
setChanges(result.changes || []);

// AFTER
const result = await response.json();
setChanges(result.data?.pendingChanges || []);
```

### 3. Market Intelligence - Temporal Patterns
**Component**: `src/app/(dashboard)/vendor/market-insights/page.tsx`
**Interface**: `TemporalPattern`

**Problem**:
- Component expects: `{ hour, dayOfWeek, activityScore, competitionLevel }`
- API returns: `{ hourOfDay, dayOfWeek, peakActivityScore, ... }` (no competitionLevel)

**Fix**: NEEDS TO BE APPLIED
- API already transforms `hourOfDay` → `hour`
- API already transforms `peakActivityScore` → `activityScore`
- Need to add `competitionLevel` calculation in API

### 4. Market Intelligence - Asset Performance
**Component**: `src/app/(dashboard)/vendor/market-insights/page.tsx`
**Interface**: `AssetPerformance`

**Problem**:
- Component expects: `{ avgPrice, auctionCount, sellThroughRate, trend }`
- API returns: `{ avgFinalPrice, totalAuctions, avgSellThroughRate, ... }` (no trend)

**Fix**: NEEDS TO BE APPLIED
- API already transforms `avgFinalPrice` → `avgPrice`
- Need to transform `totalAuctions` → `auctionCount`
- Need to add `trend` calculation in API
- `sellThroughRate` is already transformed but needs to be divided by 100 (API multiplies by 100)

### 5. Market Intelligence - Geographic Patterns
**Component**: `src/app/(dashboard)/vendor/market-insights/page.tsx`
**Interface**: `GeographicPattern`

**Problem**:
- Component expects: `{ region, avgPrice, demandScore, priceVariance }`
- API returns: `{ region, avgFinalPrice, demandScore, priceVariance }`

**Fix**: NEEDS TO BE APPLIED
- API already transforms `avgFinalPrice` → `avgPrice`
- `demandScore` needs to be kept as-is (0-1 range), component multiplies by 100
- `priceVariance` needs to be kept as-is (0-1 range), component multiplies by 100

## Fixes Applied

### ✅ Fix 1: ML Datasets Component
**File**: `src/components/intelligence/admin/ml-datasets-table.tsx`
**Change**: Updated to read `result.data` instead of `result.datasets`

### ✅ Fix 2: Schema Evolution Component
**File**: `src/components/intelligence/admin/schema-evolution-table.tsx`
**Change**: Updated to read `result.data.pendingChanges` instead of `result.changes`

## Fixes Needed

### 🔧 Fix 3: Asset Performance API - Add Missing Fields
**File**: `src/app/api/intelligence/analytics/asset-performance/route.ts`

Need to add:
1. `auctionCount` field (from `totalAuctions`)
2. `trend` calculation (price change over time)
3. Fix `sellThroughRate` (should be 0-1, not 0-100)
4. Add `demandScore` field

### 🔧 Fix 4: Temporal Patterns API - Add competitionLevel
**File**: `src/app/api/intelligence/analytics/temporal-patterns/route.ts`

Need to add:
1. `competitionLevel` calculation based on `avgBidCount` or `peakActivityScore`
   - low: < 5 bids or < 0.3 activity
   - medium: 5-10 bids or 0.3-0.7 activity
   - high: > 10 bids or > 0.7 activity

### 🔧 Fix 5: Geographic Patterns API - Verify Field Names
**File**: `src/app/api/intelligence/analytics/geographic-patterns/route.ts`

Already transforms correctly, but verify:
1. `demandScore` is in 0-1 range (component multiplies by 100)
2. `priceVariance` is in 0-1 range (component multiplies by 100)

## Testing Checklist

After applying all fixes:

### Intelligence Dashboard (`/admin/intelligence`)
- [ ] Overview tab displays metrics
- [ ] System Health tab shows indicators
- [ ] Vendor Analytics tab shows pie chart with segments
- [ ] Schema Evolution tab shows table with entries
- [ ] ML Datasets tab shows table with 3 datasets

### Market Intelligence (`/vendor/market-insights`)
- [ ] Trending Assets shows table with data
- [ ] Best Time to Bid shows cards with optimal times
- [ ] Regional Insights shows cards with regional data
- [ ] All sections respond to filter changes

## Related Files

- `src/components/intelligence/admin/ml-datasets-table.tsx` ✅
- `src/components/intelligence/admin/schema-evolution-table.tsx` ✅
- `src/components/intelligence/admin/vendor-segments-pie-chart.tsx` (OK)
- `src/app/(dashboard)/vendor/market-insights/page.tsx` (needs API fixes)
- `src/app/api/intelligence/analytics/asset-performance/route.ts` 🔧
- `src/app/api/intelligence/analytics/temporal-patterns/route.ts` 🔧
- `src/app/api/intelligence/analytics/geographic-patterns/route.ts` ✅

## Status

- ✅ Intelligence Dashboard: ML Datasets - FIXED
- ✅ Intelligence Dashboard: Schema Evolution - FIXED
- ✅ Intelligence Dashboard: Vendor Analytics - OK (no changes needed)
- 🔧 Market Intelligence: Trending Assets - NEEDS API FIX
- 🔧 Market Intelligence: Best Time to Bid - NEEDS API FIX
- ✅ Market Intelligence: Regional Insights - OK (API already correct)

**Last Updated**: 2026-04-07
