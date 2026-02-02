# Production Login Redirect Loop - Fix

## Issue
Login works in development but causes infinite redirect loop in production:
- User logs in successfully
- Session is created (verified in logs)
- `/vendor/dashboard` returns 307 redirect
- Redirects back to `/login?callbackUrl=%2Fvendor%2Fdashboard`
- Loop continues indefinitely

## Root Cause Analysis

Based on the logs, the session IS being created successfully:
```json
{
  "user": {
    "name": "oyeniyi Daniel",
    "email": "adneo502@gmail.com",
    "role": "vendor",
    "status": "verified_tier_1"
  },
  "expires": "2026-02-03T21:37:02.735Z"
}
```

The issue is likely one of these:

### 1. **useAuth Hook Not Detecting Session in Production**
The `useAuth` hook uses `useSession` from `next-auth/react`, which might not be properly initialized in production.

### 2. **SessionProvider Missing or Not Wrapping Dashboard**
The SessionProvider might not be wrapping the dashboard pages properly.

### 3. **Race Condition in useEffect**
The useEffect in dashboard page might be triggering redirects before session is fully loaded.

## Fixes Applied

### Fix 1: Improved useEffect Logic in Dashboard
**File:** `src/app/(dashboard)/vendor/dashboard/page.tsx`

**Changed:**
```typescript
// OLD - Could cause race condition
useEffect(() => {
  if (!isAuthenticated && !isLoading) {
    router.push('/login');
    return;
  }
  // ...
}, [isAuthenticated, isLoading, user, router, fetchDashboardData]);

// NEW - Better handling of loading state
useEffect(() => {
  // Don't redirect if still loading
  if (isLoading) {
    return;
  }

  // Only redirect to login if definitely not authenticated
  if (!isAuthenticated) {
    router.push('/login');
    return;
  }

  // Check role only after we know user is authenticated
  if (user && user.role !== 'vendor') {
    setError('Access denied. Vendor role required.');
    setIsLoadingData(false);
    return;
  }

  // Fetch dashboard data only if authenticated and is vendor
  if (user && user.role === 'vendor') {
    fetchDashboardData();
  }
}, [isAuthenticated, isLoading, user, router, fetchDashboardData]);
```

**Why this helps:**
- Explicitly waits for loading to complete before any redirects
- Only redirects when definitely not authenticated
- Prevents race conditions

### Fix 2: Fixed Mobile Overflow Issue
**File:** `src/app/(dashboard)/vendor/dashboard/page.tsx`

Added `break-words` class to the rating text to prevent overflow on mobile.

## Additional Checks Needed

### 1. Verify SessionProvider is Present

**Check `src/app/layout.tsx`:**
```typescript
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

If SessionProvider is missing, the session won't be available to client components.

### 2. Check Auth Provider Wrapper

**Check `src/lib/auth/auth-provider.tsx`:**
Make sure it's properly exporting and wrapping the SessionProvider.

### 3. Verify Environment Variables in Production

**Critical variables for Vercel:**
```bash
NEXTAUTH_URL=https://thevaultlyne.com  # NOT localhost!
NEXTAUTH_SECRET=<your-secret>
DATABASE_URL=<production-database>
KV_REST_API_URL=<redis-url>
KV_REST_API_TOKEN=<redis-token>
```

**How to check in Vercel:**
1. Go to Vercel Dashboard
2. Select project
3. Settings → Environment Variables
4. Verify `NEXTAUTH_URL` is set to `https://thevaultlyne.com`

### 4. Check for Middleware

If you have a `middleware.ts` file in the root or `src` directory, it might be interfering with authentication.

**Look for:**
- `middleware.ts`
- `middleware.js`
- `src/middleware.ts`

If found, check if it's redirecting authenticated users.

## Testing the Fix

### In Development:
```bash
npm run dev
# Try logging in and accessing dashboard
```

### In Production:
1. Deploy the changes to Vercel
2. Clear browser cookies for thevaultlyne.com
3. Try logging in again
4. Check browser DevTools → Network tab for redirect loops

## If Issue Persists

### Debug Steps:

1. **Add Console Logs to Dashboard Page:**
```typescript
useEffect(() => {
  console.log('[Dashboard] Auth state:', { isLoading, isAuthenticated, user });
  
  if (isLoading) {
    console.log('[Dashboard] Still loading, waiting...');
    return;
  }

  if (!isAuthenticated) {
    console.log('[Dashboard] Not authenticated, redirecting to login');
    router.push('/login');
    return;
  }

  console.log('[Dashboard] Authenticated, fetching data');
  // ...
}, [isAuthenticated, isLoading, user, router, fetchDashboardData]);
```

2. **Check Browser Console in Production:**
- Open DevTools
- Go to Console tab
- Look for the debug logs
- Share what you see

3. **Check Network Tab:**
- Look for `/api/auth/session` requests
- Check the response - is the session data present?
- Look for redirect responses (307, 302)

4. **Verify SessionProvider:**
```bash
# Search for SessionProvider in your codebase
grep -r "SessionProvider" src/
```

Should find it in `src/app/layout.tsx` or `src/lib/auth/auth-provider.tsx`

## Alternative Solution: Server-Side Authentication

If client-side session detection continues to fail, we can use server-side authentication:

**Create `src/app/(dashboard)/vendor/dashboard/page-server.tsx`:**
```typescript
import { auth } from '@/lib/auth/next-auth.config';
import { redirect } from 'next/navigation';
import VendorDashboardClient from './page-client';

export default async function VendorDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'vendor') {
    redirect('/unauthorized');
  }

  return <VendorDashboardClient />;
}
```

This checks authentication on the server before rendering, preventing redirect loops.

## Summary of Changes

1. ✅ Fixed mobile overflow issue (added `break-words`)
2. ✅ Improved useEffect logic to prevent race conditions
3. ✅ Better handling of loading states
4. ⏳ Need to verify SessionProvider is present
5. ⏳ Need to verify NEXTAUTH_URL in production

## Next Steps

1. **Deploy these changes to production**
2. **Verify NEXTAUTH_URL environment variable**
3. **Test login in production**
4. **If still failing, add debug logs and share console output**

The most likely cause is either:
- Missing/incorrect `NEXTAUTH_URL` in production
- SessionProvider not wrapping the app
- Race condition in useEffect (now fixed)

Let me know what happens after deploying these changes!
