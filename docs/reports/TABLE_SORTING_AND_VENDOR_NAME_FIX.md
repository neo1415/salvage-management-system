# Table Sorting and Vendor Name Fallback Fix

**Date**: May 2, 2026  
**Status**: ✅ Complete

## Issues Fixed

### 1. Date Sorting in Report Tables

**Problem**: In the Revenue Analysis and Profitability reports, the "Detailed Item Breakdown" tables were showing the oldest items first instead of the latest items first.

**Root Cause**: The `itemBreakdown` arrays in both services were not being sorted by date after creation.

**Solution**: Added descending date sort to both services:

#### Files Modified:
- `src/features/reports/financial/services/revenue-analysis.service.ts`
- `src/features/reports/financial/services/profitability.service.ts`

#### Changes:
```typescript
// Before
const itemBreakdown = revenueData.map(row => ({
  // ... mapping
}));

// After
const itemBreakdown = revenueData
  .map(row => ({
    // ... mapping
  }))
  .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
```

**Result**: Latest items now appear at the top of the table, making it easier to see recent transactions first.

---

### 2. Vendor Name Fallback in Vendor Spending Report

**Problem**: In the "Top Vendors by Spending" table, some vendors showed as "Unknown" even though they had a full name in the users table.

**Root Cause**: The `getVendorSpendingData` method only checked `vendors.businessName` and fell back to "Unknown", without checking the user's `full_name` field.

**Solution**: Added fallback to user's full name, matching the pattern used in `getRegistrationFeeData`.

#### File Modified:
- `src/features/reports/financial/repositories/financial-data.repository.ts`

#### Changes:
```typescript
// Before
.select({
  vendorId: payments.vendorId,
  vendorName: vendors.businessName,
  vendorTier: vendors.tier,
  // ...
})
.from(payments)
.leftJoin(vendors, eq(payments.vendorId, vendors.id))
// ...

vendorMap.set(row.vendorId, {
  vendorName: row.vendorName || 'Unknown',
  // ...
});

// After
.select({
  vendorId: payments.vendorId,
  vendorBusinessName: vendors.businessName,
  userFullName: sql<string>`u.full_name`,
  vendorTier: vendors.tier,
  // ...
})
.from(payments)
.leftJoin(vendors, eq(payments.vendorId, vendors.id))
.leftJoin(sql`users u`, sql`${vendors.userId} = u.id`)
// ...

const vendorName = row.vendorBusinessName || row.userFullName || 'Unknown';
vendorMap.set(row.vendorId, {
  vendorName,
  // ...
});
```

**Result**: Vendor names now automatically fall back to the user's full name if business name is not set, reducing "Unknown" entries.

---

## Affected Reports

### Revenue Analysis Report
- **Page**: `/reports/financial/revenue-analysis`
- **Table**: "Detailed Item Breakdown"
- **Change**: Now sorted by date descending (latest first)

### Profitability Report
- **Page**: `/reports/financial/profitability`
- **Table**: "Detailed Item Breakdown"
- **Change**: Now sorted by date descending (latest first)

### Vendor Spending Report
- **Page**: `/reports/financial/vendor-spending`
- **Table**: "Top Vendors by Spending"
- **Change**: Vendor names now use business name → full name → "Unknown" fallback chain

---

## Testing

### Manual Testing Steps:

1. **Revenue Analysis Date Sorting**:
   ```bash
   # Navigate to Revenue Analysis report
   # Verify the "Detailed Item Breakdown" table shows latest dates at the top
   ```

2. **Profitability Date Sorting**:
   ```bash
   # Navigate to Profitability report
   # Verify the "Detailed Item Breakdown" table shows latest dates at the top
   ```

3. **Vendor Name Fallback**:
   ```bash
   # Navigate to Vendor Spending report
   # Verify vendors without business names show their full name instead of "Unknown"
   ```

### Expected Behavior:

**Before Fix**:
```
Date Column:
3/26/2026  (oldest)
4/9/2026
4/10/2026
4/13/2026
4/29/2026  (latest)
```

**After Fix**:
```
Date Column:
4/29/2026  (latest)
4/27/2026
4/21/2026
4/20/2026
3/26/2026  (oldest)
```

---

## Database Schema Notes

The vendor name fallback relies on the following schema relationships:
- `vendors.businessName` - Primary vendor name (optional)
- `vendors.userId` → `users.id` - Link to user account
- `users.full_name` - Fallback name from user profile

This ensures all vendors have a meaningful display name in reports.

---

## Future Improvements

1. **Consider adding a computed field** `display_name` to the vendors table that automatically resolves the fallback chain
2. **Add sorting controls** to the UI to allow users to sort by different columns
3. **Add pagination** to the detailed breakdown tables for better performance with large datasets

---

## Related Files

- `src/features/reports/financial/services/revenue-analysis.service.ts`
- `src/features/reports/financial/services/profitability.service.ts`
- `src/features/reports/financial/repositories/financial-data.repository.ts`
- `src/components/reports/financial/revenue-analysis-report.tsx`
- `src/app/(dashboard)/reports/financial/profitability/page.tsx`
- `src/app/(dashboard)/reports/financial/vendor-spending/page.tsx`
