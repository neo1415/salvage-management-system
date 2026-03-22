# Honda Accord 2022 Pricing Bug - Root Cause Analysis

## Bug Summary
User reports: Serper API returns 10 results but system falls back to ₦4,160,000 (incorrect estimation)
Expected: ₦8-12 million for 2022 Honda Accord tokunbo

## Investigation Results

### ✅ What's Working
1. **Serper API**: Returns 10 results successfully
2. **Price Extraction**: Extracts 11 prices from results
3. **Part Searches**: Work perfectly (bumper: ₦201K average)

### ❌ Root Cause Identified

**The system IS working now** - returns ₦24.2M (reasonable for 2022 tokunbo)

However, there are **TWO ISSUES**:

#### Issue 1: Outlier Contamination
Price extraction includes prices from **wrong years**:
- ₦1,500,000 (likely 2003 model)
- ₦3,640,000 (likely 2018 model)  
- ₦15,187,500 (likely older model)

These outliers pull down the average from ₦34.2M to ₦24.2M.

**Evidence from debug output:**
```
Result 2 snippet: "Honda Accord 2018 Brown for sale. ₦ 15,187,500"
Result 2 snippet: "Honda Accord 2003 Silver for sale. ₦ 3,640,000"
```

The search query is "Honda Accord 2022 tokunbo price Nigeria" but Serper returns listings for ALL years.

#### Issue 2: Missing Year Filtering
The internet search service does NOT filter by year like the legacy scraping system does.

**Legacy scraping has year filtering** (in market-data.service.ts lines 180-220):
- Extracts year from each listing
- Filters to target year ± tolerance
- Applies depreciation if needed
- Requires minimum 3 year-matched listings

**Internet search has NO year filtering**:
- Accepts all prices regardless of year
- No year extraction from titles/snippets
- No depreciation adjustment

### Historical Context
User says: "This worked before and returned ~₦30 million"
- Back then: Gemini was rate-limited → fell back to Google Vision
- Now: Gemini works but pricing is broken

**This suggests**: The old system used legacy scraping (with year filtering), new system uses internet search (without year filtering).

## The ₦4,160,000 Mystery

User reports seeing ₦4,160,000 fallback. This is **52% of base value** (₦8M).

Checking estimation logic in ai-assessment-enhanced.service.ts:
```typescript
const baseValues: Record<string, number> = {
  'vehicle': 8000000,  // 8M default
  ...
}
```

₦4,160,000 = ₦8,000,000 × 0.52

This suggests:
- Internet search returned 0 prices (or failed validation)
- System fell back to estimation
- Applied condition adjustment: 0.52 multiplier

**Condition adjustments** (need to find in code):
- Brand New: 1.0
- Foreign Used: ~0.7-0.8
- Nigerian Used: ~0.5-0.6
- Heavily Used: ~0.3-0.4

0.52 suggests "Nigerian Used" or "Fair" condition adjustment.

## Required Fixes

### Fix 1: Add Year Filtering to Internet Search
**File**: `src/features/internet-search/services/price-extraction.service.ts`

Add year extraction and filtering:
1. Extract year from title/snippet using regex
2. Filter prices to target year ± 2 years tolerance
3. Reject prices from significantly different years
4. Add `extractedYear` and `yearMatched` fields to ExtractedPrice

### Fix 2: Improve Outlier Detection
**File**: `src/features/internet-search/services/price-extraction.service.ts`

Current validation only checks:
- Price range: ₦500K - ₦1B for vehicles
- Confidence threshold: 30%

Need to add:
- Statistical outlier detection (IQR method)
- Year-based filtering
- Condition-based validation

### Fix 3: Add Condition Parameter Validation
**File**: `src/features/internet-search/services/query-builder.service.ts`

User said: "revert that change where you removed the condition from the search parameter"

Need to verify:
1. Condition parameter is properly typed in ItemIdentifier
2. Condition is included in search queries
3. TypeScript interfaces match

### Fix 4: Use Median Instead of Average
**File**: `src/features/market-data/services/market-data.service.ts`

Currently uses `averagePrice` which is affected by outliers.
Should use `medianPrice` which is more robust.

Line 127:
```typescript
const conditionSpecificPrice = searchResult.priceData.averagePrice;
```

Should be:
```typescript
const conditionSpecificPrice = searchResult.priceData.medianPrice || searchResult.priceData.averagePrice;
```

## Next Steps

1. ✅ Add year extraction to price extraction service
2. ✅ Add year filtering to internet search service  
3. ✅ Use median instead of average for vehicle prices
4. ✅ Add statistical outlier detection
5. ✅ Create test script to verify fix
6. ✅ Verify condition parameter is working correctly
