# Heavy Equipment Search Query Improvements

## Problem Summary

The internet search system was returning inaccurate prices for heavy equipment in Nigeria:

- **User's Serper Playground Search**: Found ₦120M - ₦130M for CAT 320BL on Jiji.ng
- **Our System**: Found ₦54M (too low)
- **Root Cause**: Query was getting international sites (machineryline.ng showing €13,000 = ₦20M) instead of local Nigerian marketplaces

## Implemented Fixes

### 1. ✅ Prioritize Nigerian Marketplaces
**File**: `src/features/internet-search/services/query-builder.service.ts`

**Changes**:
- Modified `buildMachineryQuery()` to add `site:jiji.ng OR site:cheki.ng` for heavy equipment
- Restructured query to include condition terms directly in the machinery query
- Improved query format: `"{brand} {model} {year} {condition} {type} price Nigeria site:jiji.ng OR site:cheki.ng"`

**Example Query**:
```
"Caterpillar CAT 320 2022 foreign used excavator price Nigeria site:jiji.ng OR site:cheki.ng"
```

### 2. ✅ Increase Search Results for Machinery
**File**: `src/features/internet-search/services/internet-search.service.ts`

**Changes**:
- Increased default `maxResults` from 10 to 15 for machinery searches
- Added conditional logic: `const defaultMaxResults = options.item.type === 'machinery' ? 15 : 10;`

### 3. ✅ Improve Price Extraction for Jiji.ng Format
**File**: `src/features/internet-search/services/price-extraction.service.ts`

**Changes**:
- Added new regex pattern specifically for Jiji.ng format: `/₦\s+([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/gi`
- This handles: "₦ 120,000,000" (space after ₦ and commas in large numbers)
- Improved `parseNairaPrice()` to give higher confidence (+10%) for properly formatted large numbers with commas
- Enhanced error handling with detailed logging

### 4. ✅ Add Comprehensive Logging
**Files**: 
- `src/features/internet-search/services/internet-search.service.ts`
- `src/features/internet-search/services/price-extraction.service.ts`

**Added Logging**:
- Query sent to Serper: `🔍 Serper Search Query: "{query}"`
- Search parameters: `📊 Search Parameters: maxResults=15, timeout=3000ms, itemType=machinery`
- Results summary: `📄 Search Results: X results found`
- Result sources: `🌐 Result Sources: jiji.ng, cheki.ng, ...`
- Price extraction per result with domain
- Parsed prices with confidence scores
- Total prices before/after filtering

### 5. ✅ Enhanced Source Confidence Scoring
**File**: `src/features/internet-search/services/price-extraction.service.ts`

**Existing Feature** (verified working):
- Jiji.ng: +25% confidence bonus
- Cheki.ng: +20% confidence bonus
- Cars45: +20% confidence bonus
- Autochek: +20% confidence bonus

## Expected Results

After these improvements, searching for "CAT 320 foreign used" should:

1. ✅ Prioritize Jiji.ng and Cheki.ng results via `site:` operators
2. ✅ Find prices in the ₦100M-₦130M range (matching real market prices)
3. ✅ Extract prices correctly from Jiji.ng format (₦ 120,000,000)
4. ✅ Process 15 results instead of 10 for better coverage
5. ✅ Log detailed information about queries, sources, and extracted prices

## Testing

Run the test script to verify improvements:

```bash
npm run tsx scripts/test-heavy-equipment-search-improvements.ts
```

Or use tsx directly:

```bash
tsx scripts/test-heavy-equipment-search-improvements.ts
```

The test will:
- Search for CAT 320 2022 Foreign Used excavator
- Display the query used and all extracted prices
- Validate prices are in the expected ₦100M-₦130M range
- Verify results are coming from Nigerian marketplaces
- Show detailed logging of the entire process

## Technical Details

### Query Structure Comparison

**Before**:
```
"caterpillar machinery CAT 320 heavy equipment construction excavator dealer price Nigeria"
```

**After**:
```
"Caterpillar CAT 320 2022 foreign used excavator price Nigeria site:jiji.ng OR site:cheki.ng"
```

### Key Improvements

1. **Site Operators**: Forces Google to prioritize Jiji.ng and Cheki.ng
2. **Condition Terms**: Includes "foreign used" directly in query
3. **Cleaner Structure**: Removed redundant terms like "machinery", "heavy equipment", "construction", "dealer"
4. **More Results**: 15 instead of 10 gives better coverage of Nigerian marketplaces

### Price Extraction Enhancements

The new regex pattern specifically handles Jiji.ng's format:
- Pattern: `/₦\s+([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/gi`
- Matches: "₦ 120,000,000", "₦ 54,000,000", etc.
- Properly handles spaces and comma separators

## Impact

These changes will significantly improve pricing accuracy for:
- Heavy equipment (excavators, bulldozers, loaders)
- Construction machinery
- Agricultural equipment
- Industrial machinery

All machinery searches will now prioritize local Nigerian marketplaces over international sites, resulting in more accurate market prices.
