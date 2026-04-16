# My Performance Report - Quick Reference

## Overview

The My Performance report now shows different metrics based on user role:
- **Claims Adjusters**: Personal performance (cases they created)
- **Salvage Managers**: Team dashboard (all adjusters' performance)

## Key Metrics Explained

### For Claims Adjusters

| Metric | What It Shows | How It's Calculated |
|--------|---------------|---------------------|
| Cases Processed | Cases you created | Count of cases with `created_by = your_id` |
| Avg Processing Time | Time from submission to decision | Average of `(approved_at - created_at)` in days |
| Approval Rate | % of your cases approved | `approved / (approved + rejected) * 100` |
| Quality Score | Your approval success rate | Same as approval rate |
| Revenue Contribution | Money from your sold cases | Sum of verified payments from sold cases |

### For Salvage Managers

| Metric | What It Shows | How It's Calculated |
|--------|---------------|---------------------|
| Pending Approval | Cases awaiting your review | Count of cases with `status = 'pending_approval'` |
| Team Cases | Total cases by all adjusters | Count of all cases in date range |
| Avg Processing Time | Team average decision time | Average of `(approved_at - created_at)` in days |
| Team Approval Rate | % of team cases approved | `approved / (approved + rejected) * 100` |
| Quality Score | Team approval success rate | Same as team approval rate |
| Total Revenue | Money from all sold cases | Sum of verified payments from sold cases |

## Status Flow

```
draft → pending_approval → approved → active_auction → sold
                        ↓
                    rejected (back to draft with approvedAt set)
```

**Important**: There is NO 'rejected' status in the database. Rejected cases:
- Have `status = 'draft'`
- Have `approvedAt` timestamp set
- Can be identified by: `status === 'draft' AND approvedAt IS NOT NULL`

## Revenue Calculation

Revenue only counts:
1. Cases with `status = 'sold'`
2. Payments with `status = 'verified'`
3. Joined through: `salvage_cases → auctions → payments`

**Not included**:
- Auction bids (not actual money)
- Unverified payments
- Cases still in auction
- Cancelled cases

## Quality Score

The quality score is intentionally simple:
- **For adjusters**: Your approval rate (% of cases approved)
- **For managers**: Team approval rate (% of team cases approved)

This matches the trend graph exactly, so there's no confusion.

## Team Breakdown (Managers Only)

The team breakdown table shows per-adjuster metrics:

| Column | Description |
|--------|-------------|
| Adjuster | Adjuster's full name |
| Cases | Total cases submitted by this adjuster |
| Approved | Cases approved by managers |
| Rejected | Cases rejected by managers |
| Approval Rate | `approved / (approved + rejected) * 100` |
| Avg Time | Average time from submission to decision |
| Revenue | Sum of verified payments from their sold cases |

## API Endpoint

```
GET /api/reports/user-performance/my-performance
  ?startDate=2026-03-16T00:00:00.000Z
  &endDate=2026-04-15T23:59:59.999Z
```

**Response** (Claims Adjuster):
```json
{
  "status": "success",
  "data": {
    "casesProcessed": 0,
    "avgProcessingTime": 0.0,
    "approvalRate": 0.0,
    "qualityScore": 0.0,
    "trends": [],
    "revenueContribution": 0
  }
}
```

**Response** (Salvage Manager):
```json
{
  "status": "success",
  "data": {
    "casesProcessed": 84,
    "avgProcessingTime": 0.6,
    "approvalRate": 100.0,
    "qualityScore": 100.0,
    "trends": [...],
    "revenueContribution": 700000,
    "pendingApproval": 1,
    "teamBreakdown": [
      {
        "adjusterId": "...",
        "adjusterName": "Ademola Dan",
        "casesSubmitted": 36,
        "casesApproved": 36,
        "casesRejected": 0,
        "approvalRate": 100.0,
        "avgProcessingTime": 0.7,
        "revenue": 400000
      },
      ...
    ]
  }
}
```

## Common Issues

### Issue: Approval Rate is 0%
**Cause**: No cases have been approved or rejected yet
**Solution**: Wait for managers to review cases

### Issue: Revenue is 0
**Cause**: No cases have sold with verified payments yet
**Solution**: Wait for auctions to complete and payments to be verified

### Issue: Quality Score doesn't match trend graph
**Cause**: This was a bug, now fixed
**Solution**: Quality score now equals approval rate everywhere

### Issue: Manager sees 0 cases
**Cause**: No cases in the selected date range
**Solution**: Expand the date range or check if cases exist

## Testing

Run the test script:
```bash
npx tsx scripts/test-role-specific-performance.ts
```

This will verify:
- ✅ Adjuster report shows only their cases
- ✅ Manager report shows team breakdown
- ✅ Revenue matches verified payments
- ✅ Quality score matches trend graph

## Files

- Service: `src/features/reports/user-performance/services/index.ts`
- Component: `src/components/reports/user-performance/my-performance-report.tsx`
- API: `src/app/api/reports/user-performance/my-performance/route.ts`
- Page: `src/app/(dashboard)/reports/user-performance/my-performance/page.tsx`
