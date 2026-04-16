# Auction Config Authorization Fix

**Date**: Current session  
**Status**: ✅ FIXED

---

## Issue

System Admin users were unable to access the Auction Config page at `/admin/auction-config`. The page was redirecting to `/unauthorized` even though:

1. The sidebar showed the "Auction Config" link for `system_admin` role
2. The link was clickable and visible

**Error Logs**:
```
GET /admin/auction-config 307 in 4.7s (redirect to /unauthorized)
GET /unauthorized 404 in 1096ms
```

---

## Root Cause

The page authorization check was only allowing `'admin'` and `'manager'` roles, but NOT `'system_admin'`:

```typescript
// BEFORE (incorrect)
if (!session || (session.user.role !== 'admin' && session.user.role !== 'manager')) {
  redirect('/unauthorized');
}
```

This was inconsistent with the sidebar configuration which correctly included `'system_admin'`:

```typescript
// Sidebar (correct)
{
  label: 'Auction Config',
  href: '/admin/auction-config',
  icon: Settings,
  roles: ['system_admin', 'admin'],  // ✅ Includes system_admin
}
```

---

## Fix Applied

**File**: `src/app/(dashboard)/admin/auction-config/page.tsx`

```typescript
// AFTER (correct)
if (!session || (
  session.user.role !== 'admin' && 
  session.user.role !== 'system_admin' && 
  session.user.role !== 'manager'
)) {
  redirect('/unauthorized');
}
```

---

## Authorized Roles

The Auction Config page is now accessible to:

1. ✅ `system_admin` - System administrators (highest level)
2. ✅ `admin` - Regular administrators
3. ✅ `manager` - Salvage managers (can view/modify config)

---

## Testing

To verify the fix:

1. Login as `system_admin` user
2. Navigate to Admin Dashboard
3. Click "Auction Config" in the sidebar
4. Page should load successfully (no redirect to /unauthorized)
5. You should see the auction deposit configuration form

---

## Related Files

- `src/app/(dashboard)/admin/auction-config/page.tsx` - Page authorization (FIXED)
- `src/components/layout/dashboard-sidebar.tsx` - Sidebar navigation (already correct)
- `src/components/admin/auction-config-content.tsx` - Config form component
- `src/app/api/admin/config/route.ts` - Config API endpoint

---

## Summary

The authorization mismatch has been fixed. System Admin users can now access the Auction Config page as intended. The sidebar link was always visible and correct - the issue was only in the page-level authorization check.
