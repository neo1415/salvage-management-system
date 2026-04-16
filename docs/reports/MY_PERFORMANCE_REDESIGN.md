# My Performance Report Redesign - COMPLETE

## Problem Analysis

The current "My Performance" page shows the same metrics for all roles, which doesn't make sense:

- **Claims Adjusters**: Should see cases THEY CREATED
- **Salvage Managers**: Should see a TEAM DASHBOARD with all adjusters' performance

## Issues Fixed

### 1. Role-Specific Reports
- ✅ Claims adjusters now see only cases they created
- ✅ Salvage managers see team dashboard with all adjusters
- ✅ Pending approval count shown for managers

### 2. Correct Status Handling
- ✅ Fixed: No 'rejected' status in enum - rejected cases go back to 'draft' with approvedAt timestamp
- ✅ Approval rate now correctly calculated based on approved vs rejected decisions

### 3. Revenue Calculation
- ✅ Revenue now only counts verified payments from sold cases
- ✅ No longer includes auction bids or unverified payments

### 4. Quality Score Consistency
- ✅ Quality score now matches the trend graph (both use approval rate)
- ✅ Removed complex weighted calculations that didn't match

## Implementation Details

### For Claims Adjusters (My Performance)
Shows:
- Cases I created
- How many were approved/rejected by managers
- Average time from submission to approval
- Revenue from cases that sold at auction (verified payments only)
- Quality score = approval rate

### For Salvage Managers (Team Dashboard)
Shows:
- Total cases pending my approval
- Team-wide metrics (cases, approval rate, processing time, revenue)
- Breakdown by adjuster:
  - Cases submitted
  - Cases approved/rejected
  - Approval rate
  - Average processing time
  - Revenue generated
- Quality score = team approval rate

## Database Schema

The `salvage_cases` table has:
- `created_by` - The adjuster who created the case
- `approved_by` - The manager who approved/rejected it
- `approved_at` - When the decision was made
- `status` - Current status (no 'rejected' status - rejected cases go back to 'draft')

## Test Results

✅ Claims adjuster report shows only their cases
✅ Manager report shows team breakdown with all adjusters
✅ Revenue calculation matches verified payments (₦700,000)
✅ Quality score matches trend graph (100.0%)
✅ Pending approval count shown for managers (1 case)

## Files Modified

1. `src/features/reports/user-performance/services/index.ts`
   - Added `generateAdjusterPersonalReport()` method
   - Added `generateManagerTeamReport()` method
   - Fixed status checks (no 'rejected' status)
   - Fixed revenue calculation (verified payments only)
   - Fixed quality score calculation (matches trend graph)

2. `src/components/reports/user-performance/my-performance-report.tsx`
   - Added team breakdown table for managers
   - Added pending approval card for managers
   - Conditional rendering based on role

3. `src/app/api/reports/user-performance/my-performance/route.ts`
   - Passes user role to service

## Next Steps (Optional)

1. Consider renaming page title based on role:
   - Claims Adjusters: "My Performance"
   - Salvage Managers: "Team Performance"

2. Add filtering/sorting for managers to drill down into specific adjusters

3. Add export functionality for team breakdown
