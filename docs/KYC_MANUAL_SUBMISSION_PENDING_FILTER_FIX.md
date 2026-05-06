# KYC Manual Submission Pending Filter Fix

## Issue Summary

Vendors who submitted Tier 2 KYC manually were showing with a yellow "Pending Review" badge on the vendor management page, but when clicking the "Pending" tab, they were not appearing in the filtered list.

## Root Cause

The vendors API was filtering by the wrong status field:

1. **WHERE Clause Filter (WRONG)**: The API was filtering by `vendors.status` (general vendor status from Tier 1) in the SQL WHERE clause
2. **Badge Display (CORRECT)**: The UI was displaying badges based on `kycStatus` (calculated from Tier 2 approval fields)
3. **Mismatch**: A vendor could have `status='approved'` (from Tier 1) but `kycStatus='pending'` (for Tier 2), causing them to not appear in the pending filter

## The Fix

### Changed: `src/app/api/vendors/route.ts`

**Before:**
```typescript
// Build query conditions
const conditions = [];
if (statusFilter) {
  conditions.push(eq(vendors.status, statusFilter as 'pending' | 'approved' | 'suspended'));
}
```

**After:**
```typescript
// Build query conditions
const conditions = [];
// NOTE: Do NOT filter by vendors.status here - we need to filter by Tier 2 KYC status AFTER determining it
// The statusFilter will be applied after we calculate kycStatus based on tier2ApprovedAt/tier2RejectionReason/tier2SubmittedAt
```

**And added client-side filtering after calculating kycStatus:**
```typescript
// CRITICAL: Apply status filter AFTER calculating kycStatus
const filteredVendors = statusFilter 
  ? vendorsWithVerification.filter(v => v.kycStatus === statusFilter)
  : vendorsWithVerification;

const response = {
  success: true,
  vendors: filteredVendors,
  count: filteredVendors.length,
  hasMore,
  page,
  pageSize,
};
```

## How It Works Now

1. **Fetch all vendors** from the database (filtered only by tier, not status)
2. **Calculate kycStatus** for each vendor based on Tier 2 approval fields:
   - `tier2ApprovedAt` exists → `kycStatus = 'approved'`
   - `tier2RejectionReason` exists → `kycStatus = 'rejected'`
   - `tier2SubmittedAt` exists but not approved/rejected → `kycStatus = 'pending'`
3. **Filter by kycStatus** (not `vendors.status`) based on the status filter parameter
4. **Return filtered results** to the UI

## Testing

1. Clear the cache:
   ```bash
   npx tsx scripts/clear-vendors-cache.ts
   ```

2. Refresh the `/manager/vendors` page

3. Verify:
   - Vendors with yellow "Pending Review" badge appear in the "Pending" tab
   - Vendors with green "Approved" badge appear in the "Approved" tab
   - Vendors with red "Rejected" badge appear in the "Rejected" tab

## Files Modified

- `src/app/api/vendors/route.ts` - Fixed status filtering logic

## Cache Cleared

- All vendors API cache keys cleared to ensure immediate effect

## Status

✅ **FIXED** - Pending filter now correctly shows vendors with pending Tier 2 KYC status
