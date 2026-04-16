# Intelligence Data Population Diagnosis

## Issue
Market intelligence pages are "still almost empty for the most part" despite running the populate script.

## Root Causes Identified

### 1. Wrong Table Names in Populate Script
The `scripts/populate-intelligence-data.ts` script uses incorrect table names:

**WRONG:**
- `vendorInteractions` → Should be `interactions`
- `vendorProfiles` → Should be `vendorSegments`
- `assetPerformance` → Should be `assetPerformanceAnalytics`

**CORRECT TABLE NAMES:**

From `src/lib/db/schema/intelligence.ts`:
- `predictions` ✅
- `recommendations` ✅
- `interactions` (not vendorInteractions)
- `fraudAlerts` ✅
- `algorithmConfig` ✅

From `src/lib/db/schema/analytics.ts`:
- `assetPerformanceAnalytics` (not assetPerformance)
- `attributePerformanceAnalytics`
- `temporalPatternsAnalytics`
- `geographicPatternsAnalytics`
- `vendorSegments` (not vendorProfiles)
- `sessionAnalytics`
- `conversionFunnelAnalytics`
- `schemaEvolutionLog`

### 2. Missing Analytics Tables Population
The current populate script only attempts to populate:
- predictions ✅
- interactions (but with wrong name)
- vendorSegments (but with wrong name)
- assetPerformanceAnalytics (but with wrong name)

**Missing tables that need data:**
- `attributePerformanceAnalytics` - Color/trim performance data
- `temporalPatternsAnalytics` - Peak hour/day patterns
- `geographicPatternsAnalytics` - Regional demand data
- `sessionAnalytics` - User session tracking
- `conversionFunnelAnalytics` - Conversion metrics
- `recommendations` - Auction recommendations for vendors

### 3. Schema Mismatch Issues
The populate script has TypeScript errors because:
- Import statements reference non-existent exports
- Table schemas don't match what's being inserted
- Some fields are nullable but script treats them as non-null

## What Pages Are Empty and Why

### Admin Intelligence Dashboard (`/admin/intelligence`)
**Needs:**
- `predictions` table data ✅ (26 records created)
- `fraudAlerts` table data ❌ (not populated)
- `recommendations` table data ❌ (not populated)
- `algorithmConfig` table data ❌ (not populated)

### Vendor Market Insights (`/vendor/market-insights`)
**Needs:**
- `recommendations` table data ❌ (not populated)
- `predictions` table data ✅ (26 records created)
- `interactions` table data ❌ (wrong table name, failed to populate)

### Admin Analytics Dashboard
**Needs:**
- `assetPerformanceAnalytics` ❌ (wrong table name, failed to populate)
- `attributePerformanceAnalytics` ❌ (not populated)
- `temporalPatternsAnalytics` ❌ (not populated)
- `geographicPatternsAnalytics` ❌ (not populated)
- `vendorSegments` ❌ (wrong table name, failed to populate)
- `sessionAnalytics` ❌ (not populated)
- `conversionFunnelAnalytics` ❌ (not populated)

## Solution Required

### Immediate Fix
1. Fix table names in populate script
2. Fix import statements
3. Fix schema mismatches
4. Re-run population script

### Complete Solution
Create a comprehensive population script that:
1. Populates all intelligence tables with correct names
2. Populates all analytics tables
3. Creates realistic test data for:
   - Recommendations (vendor-auction matches)
   - Fraud alerts (sample suspicious patterns)
   - Algorithm config (default settings)
   - Attribute performance (color/trim data)
   - Temporal patterns (hourly/daily data)
   - Geographic patterns (regional data)
   - Session analytics (user sessions)
   - Conversion funnels (conversion metrics)

## Next Steps
1. Create fixed populate script with correct table names
2. Add population logic for missing tables
3. Test script to ensure no TypeScript errors
4. Run script and verify data in database
5. Check that intelligence pages display populated data

## Status
🔍 Diagnosed - Ready to create fixed populate script
