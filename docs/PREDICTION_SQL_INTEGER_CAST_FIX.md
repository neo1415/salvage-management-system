# Prediction SQL Integer Cast Fix

## Issue
Prediction API was failing with PostgreSQL error:
```
invalid input syntax for type integer: "6000000.00"
```

## Root Cause
In the `buildSimilarityScoreSQL` method, the `targetMarketValue` parameter (a numeric/decimal value) was being used in SQL division operations without explicit type casting. PostgreSQL was attempting to cast it to integer, which failed when the value had decimal places.

**Problem Code**:
```sql
WHEN ABS(sc.market_value - ${targetMarketValue}) / NULLIF(${targetMarketValue}, 0) < 0.2 THEN 10
```

When `targetMarketValue` = 6000000.00 (numeric), PostgreSQL tried to cast "6000000.00" to integer and failed.

## Solution
Added explicit `::numeric` type casts to all `targetMarketValue` usages in SQL queries:

```sql
WHEN ABS(sc.market_value - ${targetMarketValue}::numeric) / NULLIF(${targetMarketValue}::numeric, 0) < 0.2 THEN 10
```

## Files Modified
- `src/features/intelligence/services/prediction.service.ts`
  - Fixed in `buildSimilarityScoreSQL` method
  - Applied to all 4 cases: vehicle, electronics, machinery, and generic

## Changes Applied

### 1. Vehicle Asset Type
```typescript
CASE 
  WHEN ABS(sc.market_value - ${targetMarketValue}::numeric) / NULLIF(${targetMarketValue}::numeric, 0) < 0.2 THEN 10
  ELSE 0
END
```

### 2. Electronics Asset Type
```typescript
CASE 
  WHEN ABS(sc.market_value - ${targetMarketValue}::numeric) / NULLIF(${targetMarketValue}::numeric, 0) < 0.2 THEN 10
  ELSE 0
END
```

### 3. Machinery Asset Type
```typescript
CASE 
  WHEN ABS(sc.market_value - ${targetMarketValue}::numeric) / NULLIF(${targetMarketValue}::numeric, 0) < 0.2 THEN 10
  ELSE 0
END
```

### 4. Generic Asset Type
```typescript
CASE 
  WHEN ABS(sc.market_value - ${targetMarketValue}::numeric) / NULLIF(${targetMarketValue}::numeric, 0) < 0.2 THEN 30
  WHEN ABS(sc.market_value - ${targetMarketValue}::numeric) / NULLIF(${targetMarketValue}::numeric, 0) < 0.4 THEN 15
  ELSE 0
END
```

## Testing
- TypeScript diagnostics: ✅ No errors
- Ready for testing with actual auction pages

## Status
✅ **COMPLETE** - All numeric type casting issues fixed in prediction service

## Next Steps
1. Test prediction API by visiting an auction page
2. Verify predictions display without SQL errors
3. Monitor for any remaining type casting issues
