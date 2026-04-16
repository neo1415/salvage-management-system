# Prediction SQL Numeric Cast Fix

## Issue
The prediction API was failing with error:
```
invalid input syntax for type integer: "6000000.00"
```

## Root Cause
In `buildSimilarityScoreSQL` method, the `targetMarketValue` parameter was being passed to SQL template literals, which converted it to a string first. Then PostgreSQL tried to cast the string "6000000.00" to numeric, but in division operations it was expecting an integer in some contexts.

The problematic code was:
```typescript
WHEN ABS(sc.market_value - ${targetMarketValue}::numeric) / NULLIF(${targetMarketValue}::numeric, 0) < 0.2 THEN 10
```

## Solution
Convert `targetMarketValue` to a proper numeric value before using it in SQL:

```typescript
const marketValueNumeric = Number(targetMarketValue) || 0;

// Then use in SQL with explicit cast
WHEN ABS(sc.market_value::numeric - ${marketValueNumeric}::numeric) / NULLIF(${marketValueNumeric}::numeric, 0) < 0.2 THEN 10
```

Also added `::numeric` cast to `sc.market_value` to ensure both sides of the operation are numeric type.

## Files Modified
- `src/features/intelligence/services/prediction.service.ts`
  - Modified `buildSimilarityScoreSQL` method
  - Added `marketValueNumeric` conversion
  - Added explicit `::numeric` casts to both sides of comparison

## Testing
Test by visiting an auction page and checking that:
1. Prediction API returns 200 status
2. Predicted price displays correctly
3. No SQL errors in console
4. Confidence intervals are calculated properly

## Status
✅ Fixed - Ready for testing
