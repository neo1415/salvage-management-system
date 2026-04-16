# Salvage Recovery Calculations - Fixed

**Date**: 2026-04-15  
**Status**: ✅ COMPLETE

## What Was Fixed

### 1. Corrected Business Logic

**Before (WRONG)**:
```typescript
Profit = Salvage Sale - Market Value
Recovery Rate = Salvage Sale / Market Value × 100%
Result: -₦290M "profit", 1.87% recovery rate
```

**After (CORRECT)**:
```typescript
Net Loss = Market Value (ACV) - Salvage Recovery
Recovery Rate = Salvage Recovery / Market Value (ACV) × 100%
Result: ₦5.5M salvage recovered, 1.87% recovery rate
```

### 2. Understanding the Metrics

**Market Value** = Actual Cash Value (ACV) = What insurance paid out to policyholder  
**Salvage Recovery** = What we recovered from auction  
**Recovery Rate** = Percentage of claim payout recovered through salvage  
**Net Loss** = Claim paid minus salvage recovered

### 3. Why 1.87% is Correct

The 1.87% recovery rate means:
- Total claims paid: ₦296M
- Total salvage recovered: ₦5.5M  
- Recovery rate: 5.5M / 296M = 1.87%

This is LOW compared to industry standard (20-50% for vehicles), but it's the correct calculation.

### 4. Files Updated

**Repository Layer**:
- `src/features/reports/financial/repositories/financial-data.repository.ts`
  - Changed `recoveryValue` → `salvageRecovery`
  - Changed `profit` → `netLoss`
  - Updated interface `RevenueData`
  - Fixed `getProfitabilityData()` method

**Service Layer**:
- `src/features/reports/financial/services/revenue-analysis.service.ts`
  - Updated `RevenueAnalysisReport` interface
  - Changed all `marketValue` → `claimsPaid`
  - Changed all `recoveryValue` → `salvageRecovered`
  - Changed `profit` → `netLoss`
  - Updated `calculateByAssetType()`
  - Updated `calculateByRegion()`
  - Updated `calculateTrend()`
  - Updated `generateForecast()`

**API Layer**:
- `src/app/api/reports/financial/revenue-analysis/route.ts`
  - Updated field mappings to use `salvageRecovered`

**UI Layer**:
- `src/components/reports/financial/revenue-analysis-report.tsx`
  - Changed "Total Revenue" → "Total Salvage Recovered"
  - Changed "Revenue by Asset Type" → "Salvage Recovered by Asset Type"
  - Changed "Revenue Trend" → "Salvage Recovery Trend"
  - Updated tooltip: "Of claim payouts recovered"
- `src/app/(dashboard)/reports/financial/revenue-analysis/page.tsx`
  - Changed title: "Revenue Analysis" → "Salvage Recovery Analysis"
  - Updated description

### 5. What the Metrics Now Show

**Summary Card**:
- Total Salvage Recovered: ₦5,530,000
- Recovery Rate: 1.87% (of ₦296M in claims)
- Total Cases: 20

**By Asset Type**:
- Vehicle: ₦3.7M recovered (11 cases)
- Electronics: ₦1.3M recovered (7 cases)
- Machinery: ₦520K recovered (2 cases)

**Trend Chart**:
- Shows daily salvage recovery amounts
- Recovery rate percentage over time

### 6. Centralized Data Access

All reports now use the same repository:
```typescript
FinancialDataRepository.getRevenueData(filters)
```

This ensures:
- Consistent calculations across all reports
- Single source of truth for financial data
- Easy to maintain and update

## Next Steps

1. ✅ Core calculations fixed
2. ⏳ Fix placeholder report pages
3. ⏳ Implement missing report APIs
4. ⏳ Add proper export functionality
5. ⏳ Fix broken reports (Case Processing, My Performance, etc.)

## Testing

Run the test script to verify:
```bash
npx tsx scripts/test-revenue-api-directly.ts
```

Expected output:
- Total Salvage Recovered: ₦5,530,000
- Recovery Rate: 1.87%
- No negative "profit" values
- Correct terminology throughout

