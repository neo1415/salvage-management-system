# User Deletion Fix - Deleted Users Still Appearing in List

## Problem

When deleting a user in the admin user management page:
1. The system reports "User deleted successfully"
2. The user still appears in the list after refreshing the page
3. The deletion appears to have no effect

## Root Cause

The system uses **soft delete** for users:
- When a user is deleted, their `status` field is set to `'deleted'`
- The user record remains in the database
- However, the user list API (`/api/admin/users`) was **not filtering out deleted users**
- This caused deleted users to continue appearing in the list

## Technical Details

### Soft Delete Implementation
File: `src/app/api/admin/users/[id]/route.ts`

```typescript
// DELETE endpoint sets status to 'deleted'
const [deletedUser] = await db
  .update(users)
  .set({
    status: 'deleted',
    updatedAt: new Date(),
  })
  .where(eq(users.id, id))
  .returning();
```

### Missing Filter
File: `src/app/api/admin/users/route.ts`

The GET endpoint was building query conditions but **not excluding deleted users by default**:

```typescript
// Build query conditions
const conditions = [];

// Filter by role
if (roleFilter && roleFilter !== 'all') {
  conditions.push(inArray(users.role, roles));
}

// Filter by status
if (statusFilter && statusFilter !== 'all') {
  conditions.push(inArray(users.status, statuses));
}
// ❌ No filter to exclude deleted users!
```

## Solution

### 1. API Fix - Exclude Deleted Users by Default

Added a condition to automatically exclude deleted users unless explicitly requested:

```typescript
import { eq, or, ilike, and, inArray, ne } from 'drizzle-orm';

// Build query conditions
const conditions = [];

// Filter by role...

// Filter by status
if (statusFilter && statusFilter !== 'all') {
  const statuses = statusFilter.split(',') as Array<...>;
  conditions.push(inArray(users.status, statuses));
} else if (statusFilter !== 'deleted') {
  // If no specific status filter, exclude deleted users by default
  conditions.push(ne(users.status, 'deleted'));
}
```

**Logic:**
- If a specific status is selected (e.g., "Suspended", "Tier 1"), show only those users
- If status filter is "All Statuses" (default), exclude deleted users automatically
- If status filter is explicitly set to "Deleted", show only deleted users
- This prevents deleted users from appearing in the default view while allowing admins to view them when needed

### 2. UI Enhancement - Add "Deleted" Status Filter

Added "Deleted" option to the status filter dropdown:

```typescript
<select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
  <option value="all">All Statuses</option>
  <option value="unverified_tier_0">Unverified</option>
  <option value="phone_verified_tier_0">Phone Verified</option>
  <option value="verified_tier_1">Tier 1</option>
  <option value="verified_tier_2">Tier 2</option>
  <option value="suspended">Suspended</option>
  <option value="deleted">Deleted</option> {/* ✅ New option */}
</select>
```

## Files Modified

1. **`src/app/api/admin/users/route.ts`**
   - Added `ne` import from drizzle-orm
   - Added condition to exclude deleted users by default
   - Allows viewing deleted users when status filter is set to "deleted"

2. **`src/app/(dashboard)/admin/users/page.tsx`**
   - Added "Deleted" option to status filter dropdown
   - Allows admins to view deleted users for auditing purposes

## Testing

### Test Case 1: Delete User
1. Go to Admin → User Management
2. Select a user and click "Delete User"
3. Confirm deletion
4. Refresh the page
5. **Expected:** User no longer appears in the list

### Test Case 2: View Deleted Users
1. Go to Admin → User Management
2. Change status filter to "Deleted"
3. **Expected:** Only deleted users appear in the list

### Test Case 3: Filter Combinations
1. Go to Admin → User Management
2. Set status filter to "All Statuses"
3. **Expected:** Deleted users are NOT shown (excluded by default)
4. Set status filter to "Deleted"
5. **Expected:** Only deleted users are shown

## Why Soft Delete?

Soft delete is used instead of hard delete for:
- **Audit trail:** Maintain history of who was in the system
- **Data integrity:** Preserve foreign key relationships
- **Compliance:** Meet regulatory requirements for data retention
- **Recovery:** Ability to restore accidentally deleted users

## Future Enhancements

Potential improvements:
1. Add "Restore User" functionality for deleted users
2. Add "Permanently Delete" option for hard delete (with extra confirmation)
3. Add "Deleted At" timestamp field to track when users were deleted
4. Add "Deleted By" field to track who deleted the user
5. Auto-archive deleted users after X days

## Related Files

- `src/app/api/admin/users/[id]/route.ts` - User deletion endpoint
- `src/app/api/admin/users/route.ts` - User list endpoint
- `src/app/(dashboard)/admin/users/page.tsx` - User management UI
- `src/app/(dashboard)/admin/users/action-modal.tsx` - Delete confirmation modal
- `src/lib/db/schema/users.ts` - User schema definition

## Status

✅ **FIXED** - Deleted users are now properly excluded from the user list by default.
