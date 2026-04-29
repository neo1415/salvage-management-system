# Case Processing Report Consistency Verification

## Overview

This document explains how to verify that the Case Processing Report data is accurate and consistent with both the raw database data and the Master Report.

## Verification Script

Run the verification script to check data consistency:

```bash
npx tsx scripts/verify-case-processing-consistency.ts
```

## What the Script Checks

### 1. Raw Database Data (Ground Truth)
- Queries the database directly to get actual values
- Excludes draft cases (`status != 'draft'`)
- Calculates all metrics from scratch

### 2. Case Processing Report Simulation
- Simulates the exact logic used by `CaseProcessingService`
- Applies the same filters and calculations
- Should match raw database data exactly

### 3. Master Report Data
- Queries the same data used by Master Report
- Verifies that both reports use consistent logic
- Checks case counts and processing times

## Key Metrics Verified

| Metric | Description | Consistency Check |
|--------|-------------|-------------------|
| **Total Cases** | Count of non-draft cases | Must match across all sources |
| **Total Market Value** | Sum of estimated market values | Must match between raw data and Case Processing |
| **Total Salvage Value** | Sum of estimated salvage values | Must match between raw data and Case Processing |
| **Approved Cases** | Cases with status='approved' | Must match across all sources |
| **Sold Cases** | Cases with status='sold' | Must match across all sources |
| **Active Auction Cases** | Cases with status='active_auction' | Must match across all sources |
| **Pending Cases** | Cases with status='pending_approval' | Must match across all sources |
| **Cancelled Cases** | Cases with status='cancelled' | Must match across all sources |
| **Avg Processing Days** | Average time from creation to approval (in days) | Must match across all sources |
| **Approval Rate** | (approved + sold + active_auction) / total × 100 | Must match across all sources |

## Important Distinctions

### Market Value vs Revenue

**Market Value** (₦1B+ range):
- Estimated value of assets
- Set when case is created
- Represents potential value
- Shown in Case Processing Report

**Revenue** (₦6M range):
- Actual payments received
- From verified payment records
- Represents realized value
- Shown in Master Report

**These are DIFFERENT metrics and should NOT match!**

## Common Discrepancies and Solutions

### 1. Draft Cases Included
**Symptom**: Case count is higher than expected
**Cause**: Draft cases not being filtered out
**Fix**: Ensure `status != 'draft'` filter is applied

### 2. Processing Time Mismatch
**Symptom**: Processing time differs between reports
**Cause**: Hours vs days conversion issue
**Fix**: Ensure hours are divided by 24 to get days

### 3. Approval Rate Calculation
**Symptom**: Approval rate doesn't match
**Cause**: Wrong formula being used
**Fix**: Use formula: `(approved + sold + active_auction) / total × 100`

### 4. Date Range Issues
**Symptom**: Different case counts for same date range
**Cause**: Timezone or date comparison issues
**Fix**: Use consistent date format (ISO strings) and >= / <= comparisons

## Expected Results

### Test Range 1: March 29 - April 28, 2026
- **Total Cases**: 47
- **Total Market Value**: ₦770,352,313
- **All metrics should be consistent** across raw data, Case Processing Report, and Master Report

### Test Range 2: February 1 - April 28, 2026
- **Total Cases**: 100
- **Total Market Value**: ₦1,090,615,247
- **Total Revenue** (Master Report only): ₦6,097,500
- **All metrics should be consistent** across raw data, Case Processing Report, and Master Report

## Troubleshooting

### If Discrepancies Are Found

1. **Check the specific metric** that's inconsistent
2. **Review the calculation logic** in the service layer
3. **Verify database queries** are using correct filters
4. **Check date range handling** for timezone issues
5. **Run the verification script** again after fixes

### If All Checks Pass

✅ Your Case Processing Report is accurate and consistent!

## Maintenance

Run this verification script:
- After any changes to reporting logic
- Before deploying to production
- When investigating data accuracy issues
- As part of regular quality checks

## Related Files

- `scripts/verify-case-processing-consistency.ts` - Verification script
- `src/features/reports/operational/repositories/operational-data.repository.ts` - Data repository
- `src/features/reports/operational/services/index.ts` - Case Processing Service
- `src/features/reports/executive/services/master-report.service.ts` - Master Report Service
