# Case Processing Report Consistency Fix

## Problem
The Case Processing Report shows different data than the Master Report:
- **Case Processing Report**: 60 cases, 6.0 hours avg processing, 100% approval rate
- **Master Report**: 100 cases, 0.85 days avg processing

## Root Cause Analysis

### 1. Draft Cases Not Excluded
- **Master Report**: Excludes draft cases (`WHERE status != 'draft'`)
- **Case Processing Report**: Includes all cases (no draft filter)
- **Impact**: Shows 113 total cases instead of 100

### 2. Processing Time Unit Mismatch
- **Master Report**: Calculates in DAYS (`EXTRACT(EPOCH FROM (approved_at - created_at)) / 86400`)
- **Case Processing Report**: Calculates in HOURS
- **Impact**: Shows 6.0 hours instead of 0.85 days (20.4 hours)

### 3. Approval Rate Calculation
- **Master Report**: Uses `approved / (approved + pending + sold + active_auction)`
- **Case Processing Report**: Uses `approved / (approved + rejected)`
- **Impact**: Incorrect approval rate calculation

## Actual Database Data (Feb 1 - April 28, 2026)

```
Total Cases (including drafts): 113
Total Cases (excluding drafts): 100
Avg Processing Time: 0.85 days
Approved: 43
Pending Approval: 6
Sold: 51
Active Auction: 0
Cancelled: 0
Draft: 13
```

### By Asset Type:
```
vehicle: 82 cases, 0.53 days avg, 96.3% approval
electronics: 14 cases, 2.27 days avg, 78.6% approval
machinery: 4 cases, 0.00 days avg, 100.0% approval
```

### By Adjuster:
```
Ademola Dan: 55 cases, 0.90 days avg, 92.7% approval
```

## Comprehensive Metrics Available

Based on database schema analysis, we can add:

### Data Quality Metrics:
- Cases with AI Assessment: 75
- Avg AI Confidence: 85.72%
- Avg Photos per Case: 2.5
- Cases with 5+ Photos: 12
- Cases with Voice Notes: 10

### Valuation Metrics:
- Avg Market Value: ₦10,906,152.47
- Avg Salvage Value: ₦4,456,140.34
- Avg Reserve Price: ₦1,325,683.11
- Cases with Manager Overrides: 30

## Fix Implementation

### 1. Repository Layer (`operational-data.repository.ts`)
```typescript
// Add filter to exclude draft cases
conditions.push(sql`${salvageCases.status} != 'draft'`);
```

### 2. Service Layer (`operational/services/index.ts`)
```typescript
// Update interface to use DAYS instead of HOURS
averageProcessingTimeDays: number;

// Convert hours to days in calculations
const avgProcessingDays = avgProcessingHours / 24;

// Fix approval rate to match Master Report logic
const approved = data.filter(c => ['approved', 'active_auction', 'sold'].includes(c.status)).length;
const approvalRate = data.length > 0 ? (approved / data.length) * 100 : 0;
```

### 3. Add Comprehensive Metrics
```typescript
interface CaseProcessingReport {
  // ... existing fields
  dataQuality: {
    casesWithAIAssessment: number;
    avgAIConfidence: number;
    avgPhotosPerCase: number;
    casesWith5PlusPhotos: number;
    casesWithVoiceNotes: number;
  };
  valuationMetrics: {
    avgMarketValue: number;
    avgSalvageValue: number;
    avgReservePrice: number;
    casesWithManagerOverrides: number;
  };
}
```

## Expected Results After Fix

### Summary Metrics:
- Total Cases: 100 (excluding drafts)
- Avg Processing Time: 0.85 days
- Approval Rate: 94.0% (94 approved/sold out of 100 total)
- Pending Cases: 6
- Approved Cases: 43
- Sold Cases: 51

### By Asset Type:
- Vehicle: 82 cases, 0.53 days, 96.3% approval
- Electronics: 14 cases, 2.27 days, 78.6% approval
- Machinery: 4 cases, 0.00 days, 100.0% approval

### By Adjuster:
- Ademola Dan: 55 cases, 0.90 days, 92.7% approval

## Files to Modify

1. ✅ `src/features/reports/operational/repositories/operational-data.repository.ts`
   - Add draft exclusion filter
   
2. ⏳ `src/features/reports/operational/services/index.ts`
   - Update interface to use days
   - Fix approval rate calculation
   - Add comprehensive metrics
   
3. ⏳ `src/components/reports/operational/case-processing-report.tsx`
   - Update UI to display days instead of hours
   - Add comprehensive metrics display

## Testing

Create verification script:
```bash
npx tsx scripts/verify-case-processing-report-fix.ts
```

Should show:
- ✅ Total cases: 100 (matches Master Report)
- ✅ Avg processing: 0.85 days (matches Master Report)
- ✅ Approval rate: 94.0% (correct calculation)
- ✅ Comprehensive metrics displayed
