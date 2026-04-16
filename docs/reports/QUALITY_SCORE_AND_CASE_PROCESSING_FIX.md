# Quality Score Explanation & Case Processing Fix

## Issues Fixed

### 1. Case Processing Report Error - FIXED

**Error**: `Cannot read properties of undefined (reading 'map')`

**Root Cause**: The component expected a flat data structure but the service returns a nested structure with `summary`, `byStatus`, `byAssetType`, etc.

**Fix**: Updated the component interface and rendering to match the service output:

```typescript
// Before (WRONG):
interface CaseProcessingData {
  totalCases: number;
  avgProcessingTime: number;
  byStatus: Array<...>;
}

// After (CORRECT):
interface CaseProcessingData {
  summary: {
    totalCases: number;
    averageProcessingTimeHours: number;
    ...
  };
  byStatus: Array<...>;
  byAssetType: Array<...>;
  trend: Array<...>;
}
```

Also added null checks:
```typescript
if (!data || !data.byStatus || !data.byAssetType || !data.trend) {
  return <div>No data available</div>;
}
```

### 2. Quality Score Meaning

**Current Implementation**: Quality Score = Approval Rate

This is too simplistic. Quality score should be a composite metric that reflects overall performance quality.

**Recommended Formula**:
```
Quality Score = (
  Approval Rate × 40% +           // How many cases get approved
  (100 - Rejection Rate) × 30% +  // How few cases get rejected
  Processing Efficiency × 30%      // How quickly cases are processed
)

Where Processing Efficiency = 100 - (actual_time / target_time × 100)
```

**Example**:
- Approval Rate: 85%
- Rejection Rate: 15%
- Processing Time: 1.5 days (target: 2 days) = 75% efficiency → 25% score

Quality Score = (85 × 0.4) + (85 × 0.3) + (25 × 0.3) = 34 + 25.5 + 7.5 = 67/100

## User Request: Comprehensive Breakdowns for Managers/Admins

The user wants detailed breakdowns for salvage managers and system admins:

### Current State

**KPI Dashboard** shows high-level metrics:
- Total Revenue: ₦4,055,000
- Recovery Rate: 23.15%
- Profit Margin: 85%
- Total Cases: 65
- Processing Time: 15.41h
- Auction Success: 40.79%
- Vendor Participation: 46.05%

**What's Missing**: Drill-down capabilities

### Required Breakdowns

1. **Per Case Breakdown**
   - Case ID, Claim Reference
   - Adjuster assigned
   - Asset type, market value
   - Processing time (submission → approval → auction → payment)
   - Revenue generated
   - Status and outcome

2. **Per Auction Breakdown**
   - Auction ID, Case reference
   - Start/end dates, duration
   - Number of bidders, bids placed
   - Starting bid, winning bid, reserve price
   - Vendor winner
   - Payment status and amount
   - Success/failure reason

3. **Per Adjuster Breakdown**
   - Name, ID
   - Cases submitted (total, approved, rejected, pending)
   - Approval rate, rejection rate
   - Average processing time
   - Revenue contribution
   - Quality score
   - Performance trend

4. **Per Vendor Breakdown**
   - Business name, tier
   - Auctions participated in
   - Auctions won
   - Win rate
   - Total spent
   - Average bid amount
   - Payment reliability (on-time %)
   - Document compliance rate

### Implementation Approach

**Option 1: Expandable Tables**
- Summary cards at top
- Detailed table below with expand/collapse rows
- Click row to see full details

**Option 2: Drill-Down Pages**
- Summary dashboard (current)
- Click metric → detailed breakdown page
- Click row → individual entity page

**Option 3: Tabs**
- Tab 1: Summary (current view)
- Tab 2: Cases Detail
- Tab 3: Auctions Detail
- Tab 4: Adjusters Detail
- Tab 5: Vendors Detail

**Recommended**: Combination of Options 1 & 2
- Keep summary dashboard
- Add "View Details" buttons on each KPI card
- Details page shows comprehensive table with filters/search
- Click row for full entity details

### Example: Case Detail Breakdown

```
KPI Dashboard → "Total Cases: 65" → Click "View Details"

Cases Detail Page:
┌─────────────────────────────────────────────────────────────────────┐
│ Filters: [Date Range] [Status] [Asset Type] [Adjuster] [Search]    │
├─────────────────────────────────────────────────────────────────────┤
│ Claim Ref │ Adjuster │ Asset │ Market Value │ Time │ Revenue │ Status│
├───────────┼──────────┼───────┼──────────────┼──────┼─────────┼───────┤
│ OMO-7429  │ Ademola  │ Veh   │ ₦500,000     │ 2.1d │ ₦345k   │ Sold  │
│ HTU-3728  │ Ademola  │ Veh   │ ₦450,000     │ 1.8d │ ₦335k   │ Active│
│ ...       │ ...      │ ...   │ ...          │ ...  │ ...     │ ...   │
└─────────────────────────────────────────────────────────────────────┘

Export: [CSV] [Excel] [PDF]
```

### Files to Create/Modify

1. **New Detail Pages**:
   - `src/app/(dashboard)/reports/executive/kpi-dashboard/cases/page.tsx`
   - `src/app/(dashboard)/reports/executive/kpi-dashboard/auctions/page.tsx`
   - `src/app/(dashboard)/reports/executive/kpi-dashboard/adjusters/page.tsx`
   - `src/app/(dashboard)/reports/executive/kpi-dashboard/vendors/page.tsx`

2. **New Services**:
   - `src/features/reports/executive/services/case-details.service.ts`
   - `src/features/reports/executive/services/auction-details.service.ts`
   - `src/features/reports/executive/services/adjuster-details.service.ts`
   - `src/features/reports/executive/services/vendor-details.service.ts`

3. **New Components**:
   - `src/components/reports/executive/case-details-table.tsx`
   - `src/components/reports/executive/auction-details-table.tsx`
   - `src/components/reports/executive/adjuster-details-table.tsx`
   - `src/components/reports/executive/vendor-details-table.tsx`

4. **Modify Existing**:
   - `src/app/(dashboard)/reports/executive/kpi-dashboard/page.tsx` - Add "View Details" buttons

## Next Steps

1. Fix quality score calculation (make it meaningful)
2. Implement drill-down detail pages for managers/admins
3. Add comprehensive filtering and search
4. Add export functionality for detailed reports
5. Consider adding charts/visualizations to detail pages

## Files Changed

- `src/components/reports/operational/case-processing-report.tsx` - Fixed data structure mismatch
