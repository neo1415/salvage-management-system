# Salvage Value Calculation: Real Data Priority Fix

**Date**: 2026-04-20  
**Status**: ✅ Complete  
**Priority**: Critical

## Problem

The salvage value calculation was applying multipliers to ALL parts, including those with real prices from internet search. This violated the principle of prioritizing real data over assumptions.

### Issues:
1. Real part prices (from Serper/Claude internet search) were being multiplied by severity and cumulative multipliers
2. This made accurate pricing less accurate by applying arbitrary assumptions on top of real market data
3. The system should only use multipliers as a fallback when real data is unavailable

## Solution

Implemented a two-tier approach that **prioritizes real data over assumptions**:

### Tier 1: Parts with Real Prices (NO Multipliers)
- Use actual cost from internet search directly
- No severity multipliers applied
- No cumulative damage multipliers applied
- Real market data is trusted as-is

### Tier 2: Parts without Prices (WITH Multipliers)
- Use traditional database deductions
- Apply severity multipliers (1.0x - 1.5x)
- Apply cumulative damage multipliers (1.0x - 1.5x)
- Enforce minimum deductions for severe cases
- This is the fallback when real data isn't available

## Implementation

### File Modified
- `src/features/valuations/services/damage-calculation.service.ts`

### Key Changes

1. **Separated parts into two groups**:
   ```typescript
   const partsWithRealPrices = partPrices.filter(p => 
     p.partPrice && p.confidence && p.source === 'internet_search'
   );
   const componentsWithoutPrices = deduplicatedDamages.filter(damage => 
     !componentsWithRealPrices.has(damage.component)
   );
   ```

2. **Real prices used directly**:
   ```typescript
   // NO multipliers applied to real prices
   const totalRealPartsCost = partsWithRealPrices.reduce(
     (sum, part) => sum + (part.partPrice || 0), 0
   );
   const realPartsDeductionPercent = totalRealPartsCost / basePrice;
   ```

3. **Traditional deductions with multipliers**:
   ```typescript
   // Multipliers ONLY applied to parts without real prices
   if (componentsWithoutPrices.length > 0) {
     // Apply severity multiplier
     // Apply cumulative multiplier
     // Enforce minimum deductions
   }
   ```

4. **Combined approach**:
   ```typescript
   let totalDeductionPercent = realPartsDeductionPercent + traditionalDeductionPercent;
   ```

## Test Results

### Test Scenario
- Base price: ₦5,700,000
- 13 severely damaged parts
- 10 parts with real prices (₦1,200,000 total)
- 3 parts without prices

### Results
```
✅ Real price deductions: 10 parts = ₦1,200,000 (21.1%)
   - NO multipliers applied
   - Used actual market prices directly

⚠️ Traditional deductions: 3 parts = 90% (capped)
   - WITH multipliers applied (1.5x severity)
   - Fallback for missing data

📊 Final: 90% total deduction (capped at maximum)
💰 Salvage value: ₦570,000
```

### Verification
✅ Real prices used exactly as found (₦1,200,000)  
✅ No multipliers applied to real data  
✅ Multipliers only applied to fallback calculations  
✅ Clear separation between real data and assumptions  

## Benefits

1. **Accuracy**: Real market prices are trusted and used as-is
2. **Transparency**: Clear distinction between real data and estimates
3. **Flexibility**: System adapts based on data availability
4. **Reliability**: Falls back gracefully when data is missing

## Next Steps

The system now correctly prioritizes real data. Future enhancements:

1. **Improve part price search** (separate task):
   - Use Serper API for internet search
   - Fall back to Claude for price extraction
   - Provide specific, accurate item names for searches
   - Support all asset types (not just vehicles)

2. **Make multipliers configurable** (if needed):
   - Store multipliers in database
   - Allow admin to adjust based on real-world data
   - Track accuracy over time

## Related Files

- `src/features/valuations/services/damage-calculation.service.ts` - Main implementation
- `scripts/test-real-data-priority.ts` - Test script
- `docs/SALVAGE_VALUE_DEDUCTION_FIX_COMPLETE.md` - Previous fix documentation

## Conclusion

The system now correctly prioritizes real data over assumptions. Parts with real prices from internet search are used directly without multipliers, while parts without prices fall back to traditional deductions with multipliers. This ensures maximum accuracy while maintaining reliability.
