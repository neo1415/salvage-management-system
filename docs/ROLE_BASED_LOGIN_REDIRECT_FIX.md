# Role-Based Login Redirect Fix

## Problem
User `adneo502@gmail.com` with role `system_admin` was being redirected to `/vendor/dashboard` after login, resulting in an "Access Denied - Vendor role required" error. The sidebar showed correct admin navigation, but the page content was the vendor dashboard access denial.

## Root Cause
The login page had a hardcoded default `callbackUrl` of `/vendor/dashboard`:

```typescript
const callbackUrl = searchParams.get('callbackUrl') || '/vendor/dashboard';
```

This meant:
1. System admin logs in
2. Login succeeds
3. Redirects to `/vendor/dashboard` (hardcoded)
4. Vendor dashboard checks role → sees `system_admin` → shows "Access Denied"

## Solution

### 1. Remove Hardcoded Callback URL
Updated `src/app/(auth)/login/page.tsx` to not assume vendor role:

```typescript
// Before
const callbackUrl = searchParams.get('callbackUrl') || '/vendor/dashboard';

// After
const callbackUrl = searchParams.get('callbackUrl') || null;
```

### 2. Role-Based Redirect After Login
Modified login success handler to redirect to root `/` when no callback URL exists:

```typescript
if (callbackUrl) {
  window.location.href = callbackUrl;
} else {
  // Let middleware handle role-based redirect
  window.location.href = '/';
}
```

### 3. Middleware Root Path Handling
Added logic in `src/middleware.ts` to redirect authenticated users from root to their role-specific dashboard:

```typescript
// Redirect authenticated users from root to their dashboard
if (pathname === '/' && isAuthenticated) {
  const role = token.role as string;
  const dashboardUrl = getDashboardUrl(role);
  return NextResponse.redirect(new URL(dashboardUrl, request.url));
}
```

### 4. OAuth Login Fix
Updated OAuth login to also use role-based redirect:

```typescript
await signIn(provider, {
  callbackUrl: callbackUrl || '/',
});
```

## How It Works Now

### Login Flow
1. User enters credentials
2. Login succeeds
3. If `callbackUrl` query param exists → redirect there
4. Otherwise → redirect to `/`
5. Middleware sees authenticated user at `/`
6. Middleware checks role and redirects to appropriate dashboard:
   - `system_admin` → `/admin/dashboard`
   - `vendor` → `/vendor/dashboard`
   - `salvage_manager` → `/manager/dashboard`
   - `claims_adjuster` → `/adjuster/dashboard`
   - `finance_officer` → `/finance/dashboard`

### Role-to-Dashboard Mapping
```typescript
function getDashboardUrl(role: string): string {
  switch (role) {
    case 'vendor':
      return '/vendor/dashboard';
    case 'salvage_manager':
      return '/manager/dashboard';
    case 'claims_adjuster':
      return '/adjuster/dashboard';
    case 'finance_officer':
      return '/finance/dashboard';
    case 'system_admin':
    case 'admin':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}
```

## Testing
1. Login as `system_admin` → Should redirect to `/admin/dashboard`
2. Login as `vendor` → Should redirect to `/vendor/dashboard`
3. Login as `salvage_manager` → Should redirect to `/manager/dashboard`
4. Login as `claims_adjuster` → Should redirect to `/adjuster/dashboard`
5. Login as `finance_officer` → Should redirect to `/finance/dashboard`
6. Access protected route while logged out → Should redirect to login with `callbackUrl`
7. Login with `callbackUrl` → Should redirect to that URL after login

## Files Changed
- `src/app/(auth)/login/page.tsx`: Removed hardcoded vendor dashboard default
- `src/middleware.ts`: Added root path role-based redirect logic

## Prevention
- Never hardcode role-specific URLs in shared authentication flows
- Always use role-based routing logic in middleware
- Let the middleware handle dashboard redirects based on user role
