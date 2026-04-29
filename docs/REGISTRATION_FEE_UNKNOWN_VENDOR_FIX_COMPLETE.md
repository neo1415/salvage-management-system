# Registration Fee "Unknown" Vendor Name - Fix Complete ✅

## Issue
The KPI Dashboard's "Registration Fees Breakdown" table showed "Unknown" as the vendor name for payments where the vendor's `business_name` field was NULL in the database.

## Root Cause
When vendors register, the `business_name` field in the `vendors` table is NOT populated during registration - it remains NULL. The report query only used `business_name`, so when it was NULL, it defaulted to 'Unknown'.

## Solution Implemented (Option 2 - Quick Fix for Demo)
Updated the registration fees query to use the user's `full_name` as a fallback when `business_name` is NULL.

### Changes Made

**File:** `src/features/reports/financial/repositories/financial-data.repository.ts`

1. **Added users import:**
```typescript
import { salvageCases, auctions, payments, vendors, users } from '@/lib/db/schema';
```

2. **Updated `getRegistrationFeeData()` method:**
   - Added LEFT JOIN to users table via vendors.userId
   - Selected both `vendors.businessName` and `users.full_name`
   - Applied fallback logic: `businessName || fullName || 'Unknown'`

**Query Change:**
```typescript
// Before:
.leftJoin(vendors, eq(payments.vendorId, vendors.id))
// vendorName: row.vendorName || 'Unknown'

// After:
.leftJoin(vendors, eq(payments.vendorId, vendors.id))
.leftJoin(sql`users u`, sql`${vendors.userId} = u.id`)
// vendorName: row.vendorBusinessName || row.userFullName || 'Unknown'
```

## Result
- Vendors with `business_name` set → Shows business name (e.g., "Master")
- Vendors without `business_name` → Shows user's full name (e.g., "Danalo" instead of "Unknown")
- Vendors with neither → Shows "Unknown" (edge case)

## Testing
The fix will show the user's full name for the 4/29/2026 payment that was previously showing "Unknown".

## Future Improvement (Post-Demo)
Consider implementing Option 1 from the root cause analysis:
- Add `businessName` field to registration form
- Update registration validation schema
- Populate `business_name` during vendor registration
- This ensures all new vendors have proper business names from the start

## Files Modified
- `src/features/reports/financial/repositories/financial-data.repository.ts`

## Related Documentation
- `docs/REGISTRATION_FEE_UNKNOWN_VENDOR_ROOT_CAUSE.md` - Detailed root cause analysis
