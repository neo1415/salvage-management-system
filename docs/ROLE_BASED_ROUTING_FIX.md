# Role-Based Dashboard Routing Fix

## Issue Summary
User with email `adneo502@gmail.com` was successfully elevated to `system_admin` role but was being redirected to `/vendor/dashboard` on login, resulting in "Access Denied. Vendor role required." error.

## Root Cause
The middleware's `getDashboardUrl()` function had incorrect role mappings:
- Used `'admin'` instead of `'system_admin'` (the actual role in database schema)
- Used `'manager'` instead of `'salvage_manager'`
- Used `'adjuster'` instead of `'claims_adjuster'`
- Used `'finance'` instead of `'finance_officer'`
- Mapped admin to `/admin/dashboard` instead of `/admin/users`

## Changes Made

### File: `src/middleware.ts`
Updated the `getDashboardUrl()` function to match the actual role enum values from the database schema:

```typescript
function getDashboardUrl(role: string): string {
  switch (role) {
    case 'vendor':
      return '/vendor/dashboard';
    case 'salvage_manager':        // Changed from 'manager'
      return '/manager/dashboard';
    case 'claims_adjuster':        // Changed from 'adjuster'
      return '/adjuster/cases';
    case 'finance_officer':        // Changed from 'finance'
      return '/finance/payments';
    case 'system_admin':           // Changed from 'admin'
      return '/admin/users';       // Changed from '/admin/dashboard'
    default:
      return '/vendor/dashboard';
  }
}
```

## Database Role Enum (Reference)
From `src/lib/db/schema/users.ts`:
```typescript
export const userRoleEnum = pgEnum('user_role', [
  'vendor',
  'claims_adjuster',
  'salvage_manager',
  'finance_officer',
  'system_admin',
]);
```

## Testing Results
- ✅ TypeScript compilation: No errors
- ✅ No diagnostic warnings
- ✅ Role mappings now match database schema exactly
- ✅ System admin users will be redirected to `/admin/users` on login

## Expected Behavior After Fix
1. User `adneo502@gmail.com` (system_admin) logs in
2. Middleware detects `role === 'system_admin'`
3. User is redirected to `/admin/users` (User Management page)
4. User can access all admin features:
   - Create/manage staff accounts
   - View audit logs
   - Manage fraud alerts
   - View all system users

## Notes
- The vendor dashboard page has explicit role checking that only allows `role === 'vendor'`
- This is correct behavior - system admins should use admin routes, not vendor routes
- All dashboard routes are protected by middleware authentication checks
- Individual pages may have additional role-specific checks for security

## Related Files
- `src/middleware.ts` - Fixed role-based routing
- `src/lib/db/schema/users.ts` - Role enum definition
- `src/lib/auth/next-auth.config.ts` - Authentication configuration
- `scripts/make-super-admin.ts` - Script to elevate users to system_admin
