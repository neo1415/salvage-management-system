# Adjuster My Cases - Bug Fixes

## Issues Fixed

### 1. Schema Mismatch - "Rejected" vs "Cancelled"
**Problem**: The code was looking for `rejected` status and `rejectedAt`/`rejectionReason` fields that don't exist in the database schema.

**Solution**: 
- Changed all references from "rejected" to "cancelled" (the actual status in the enum)
- Removed references to `rejectedAt` and `rejectionReason` fields
- Updated status filters and counts to use "cancelled" instead

**Files Modified**:
- `src/app/api/dashboard/adjuster/route.ts` - Changed rejected to cancelled
- `src/app/(dashboard)/adjuster/my-cases/page.tsx` - Updated interface and filters
- `src/app/api/cases/route.ts` - Removed non-existent fields from query

### 2. Dashboard Stats Enhancement
**Problem**: Dashboard was only showing 4 stats (total, pending, approved, rejected)

**Solution**: Added counts for all case statuses:
- Total Cases
- Pending Approval
- Approved
- Cancelled (was "Rejected")
- Active Auction (NEW)
- Sold (NEW)

**File Modified**: `src/app/api/dashboard/adjuster/route.ts`

### 3. 401 Unauthorized Error
**Problem**: The `/api/cases?createdByMe=true` endpoint is returning 401 Unauthorized

**Root Cause**: This is likely a session/authentication issue. The `auth()` function from NextAuth is working correctly on the server, but the client-side fetch might not be including credentials.

**Potential Solutions**:

#### Option 1: Add credentials to fetch (RECOMMENDED)
Update the fetch call in `my-cases/page.tsx`:

```typescript
const response = await fetch('/api/cases?createdByMe=true', {
  credentials: 'include', // Include cookies
  headers: {
    'Content-Type': 'application/json',
  },
});
```

#### Option 2: Check Session Provider
Ensure the page is wrapped in SessionProvider. Check `src/app/(dashboard)/layout.tsx` or the root layout.

#### Option 3: Use getServerSession for Server Components
Convert the page to a Server Component and use `getServerSession` instead of client-side fetching.

## Testing Steps

1. **Clear browser cache and cookies**
2. **Login as Claims Adjuster**
3. **Navigate to Dashboard** - Verify stats show correct counts
4. **Navigate to "My Cases"** - Should load without 401 error
5. **Test each status filter tab**
6. **Verify "Cancelled" appears instead of "Rejected"**
7. **Create a new case and verify it appears**
8. **Check that approved cases show approver name**

## Database Schema Reference

```typescript
export const caseStatusEnum = pgEnum('case_status', [
  'draft',
  'pending_approval',
  'approved',
  'active_auction',
  'sold',
  'cancelled',  // NOT 'rejected'
]);
```

## Next Steps

If the 401 error persists:
1. Check browser console for session errors
2. Verify NextAuth configuration
3. Check middleware.ts for route protection
4. Try logging out and back in
5. Check if other API endpoints work (like `/api/dashboard/adjuster`)

## Files Changed

1. `src/app/api/dashboard/adjuster/route.ts` - Added activeAuction and sold counts
2. `src/app/(dashboard)/adjuster/my-cases/page.tsx` - Fixed status references
3. `src/app/api/cases/route.ts` - Removed non-existent fields from query

## Status Badge Mapping

- Draft → Gray
- Pending Approval → Yellow
- Approved → Green
- Cancelled → Red (was "Rejected")
- Active Auction → Blue
- Sold → Purple
