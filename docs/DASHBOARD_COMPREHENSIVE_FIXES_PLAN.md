# Dashboard Comprehensive Fixes Plan

## Issues Identified

### 1. ML Datasets - 403 Forbidden ❌
**Error**: `GET http://localhost:3000/api/intelligence/ml/datasets 403 (Forbidden)`
**Cause**: API requires 'admin' role but user might be 'system_admin'
**Fix**: Add 'system_admin' to allowedRoles in ML datasets API

### 2. Trending Assets - Multiple Issues ❌
- **Trend all 0%**: priceChangePercent field is NULL or 0 in database
- **Sell-through all 0%**: avgSellThroughRate is NULL or 0 in database
- **Asset names**: Should show make/model/year for vehicles, brand/model for electronics
- **Number formatting**: Need to format large numbers (K, M notation)

### 3. Regional Insights - Data Quality Issues ❌
- **Percentages in thousands**: demandScore showing as 10000% instead of 100%
- **Variance too large**: ±31625939.0% - needs proper calculation
- **"Unknown" locations**: NULL or empty region values in database
- **Region granularity**: Only showing country, need city/state level

### 4. Temporal Patterns - Not Showing ✅ FIXED
**Issue**: "No temporal pattern data available" in Market Intelligence
**Cause**: competitionLevel filter finding no 'low' competition records due to unnormalized activity scores
**Fix**: ✅ Normalized activity scores to 0-1 range before calculating competition levels
**Status**: COMPLETE - See `docs/TEMPORAL_PATTERNS_FIX_COMPLETE.md`

### 5. Vendor Segments - Empty Chart ❌
**Issue**: Shows "0192 total vendors" but no pie chart
**Cause**: Pie chart library issue or data format mismatch
**Fix**: Check chart data structure and rendering

### 6. Analytics Dashboard - Empty Sections ❌
- **Vendor Segments**: "No vendor segment data available"
- **Conversion Funnel**: "No conversion data available"
- **Session Analytics**: All showing 0
- **Performance by Color/Trim/Storage**: Empty boxes

## Fix Priority

### HIGH PRIORITY (Blocking user experience)
1. ML Datasets 403 error
2. Vendor Segments empty chart
3. Trending Assets data quality
4. Regional Insights percentage formatting

### MEDIUM PRIORITY (Data quality)
5. Temporal patterns not showing
6. Analytics Dashboard empty sections
7. Asset name formatting

### LOW PRIORITY (Nice to have)
8. Region granularity
9. Number formatting (K/M notation)

## Implementation Plan

### Phase 1: Authorization & Critical Fixes
1. Fix ML Datasets API authorization
2. Fix Vendor Segments chart rendering
3. Fix percentage formatting in Regional Insights
4. Fix temporal patterns display

### Phase 2: Data Quality
5. Investigate and fix trend calculations
6. Investigate and fix sell-through rates
7. Fix "Unknown" location data
8. Add proper asset name formatting

### Phase 3: Analytics Dashboard
9. Investigate empty sections
10. Add proper data or show meaningful empty states

## Next Steps

Use subagent to tackle each issue one at a time, starting with Phase 1.
