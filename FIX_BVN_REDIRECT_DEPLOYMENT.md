# BVN Redirect Fix - Production Deployment

## Problem Summary

After vendors register and verify their phone number, they should be redirected to `/vendor/kyc/tier1` (BVN verification) on next login. This worked correctly on localhost but **NOT on production**.

## Root Cause

The issue was in `src/app/(auth)/login/page.tsx` (lines 82-103). After successful login, the page performed a **client-side redirect** using `window.location.href`:

```typescript
// OLD CODE (BROKEN)
window.location.href = '/vendor/dashboard';
```

**Why this broke the BVN redirect:**
- `window.location.href` performs a **full page reload** with client-side navigation
- Next.js middleware (`src/middleware.ts`) **only runs on server-side navigation**
- The client-side redirect bypassed the middleware entirely
- Therefore, the middleware's BVN verification check never ran
- Vendors were sent directly to `/vendor/dashboard` instead of being intercepted

## Why It Worked on Localhost

The behavior difference between localhost and production was likely due to:
- **Session timing**: On localhost, the session might not be fully established when the redirect happens
- **Browser caching**: Production has more aggressive caching, so the client-side redirect completes faster
- **Network latency**: Production has higher latency, giving the session more time to propagate

However, the **fundamental issue** was the use of `window.location.href` which bypasses middleware in **both** environments.

## The Fix

Changed all `window.location.href` redirects to `router.push()` in the login page:

```typescript
// NEW CODE (FIXED)
router.push('/vendor/dashboard');
```

**Why this fixes it:**
- `router.push()` uses Next.js client-side routing
- Next.js client-side routing **triggers middleware** on navigation
- Middleware can now intercept the navigation and check BVN status
- If `bvnVerified === false`, middleware redirects to `/vendor/kyc/tier1`

## Files Changed

### `src/app/(auth)/login/page.tsx`
- **Lines 82-103**: Changed all `window.location.href` to `router.push()`
- Added comment explaining why `router.push()` is used

## How Middleware Works

The middleware in `src/middleware.ts` checks:

1. **Is this a dashboard route?** (e.g., `/vendor/dashboard`)
2. **Is the user a vendor?** (check `token.role === 'vendor'`)
3. **Is BVN verified?** (check `token.bvnVerified`)
4. **If BVN not verified** → Redirect to `/vendor/kyc/tier1`

This middleware **only runs** when:
- Server-side navigation occurs (initial page load, `router.push()`)
- **NOT** when `window.location.href` is used (full page reload)

## Testing the Fix

### On Localhost
1. Register a new vendor account
2. Verify phone number with OTP
3. Log out
4. Log in again
5. **Expected**: Should redirect to `/vendor/kyc/tier1` (BVN verification)

### On Production
1. Deploy the fix
2. Clear browser cache and site data
3. Register a new vendor account
4. Verify phone number with OTP
5. Log out
6. Log in again
7. **Expected**: Should redirect to `/vendor/kyc/tier1` (BVN verification)

## Deployment Checklist

- [x] Fix applied to `src/app/(auth)/login/page.tsx`
- [ ] Commit changes with message: "fix: use router.push instead of window.location.href for BVN redirect"
- [ ] Push to repository
- [ ] Deploy to production
- [ ] Clear browser cache and test with a new vendor account
- [ ] Verify middleware logs show BVN check running

## Related Files

- `src/app/(auth)/login/page.tsx` - Login page with redirect logic
- `src/middleware.ts` - Middleware that checks BVN verification
- `src/lib/auth/next-auth.config.ts` - JWT callback that sets `bvnVerified` flag

## Additional Notes

### Why Not Remove Client-Side Redirect Entirely?

We still need to fetch the session to determine the user's role and redirect to the correct dashboard. The key change is using `router.push()` instead of `window.location.href`.

### Why Does Middleware Check BVN?

The middleware checks BVN verification to ensure vendors complete KYC before accessing the dashboard. This is a security requirement to prevent unverified vendors from participating in auctions.

### Session Refresh Logic

The JWT callback in `src/lib/auth/next-auth.config.ts` has logic to refresh BVN status every 5 minutes for existing sessions. This ensures that if a vendor verifies their BVN in another tab, the session is updated automatically.

## Verification Commands

```bash
# Check if middleware is running
grep -r "BVN verification check" src/middleware.ts

# Check if JWT callback refreshes BVN status
grep -r "JWT Session Refresh" src/lib/auth/next-auth.config.ts

# Test the fix locally
npm run dev
# Then test the login flow
```

## Success Criteria

✅ Vendors are redirected to `/vendor/kyc/tier1` after phone verification on **both** localhost and production
✅ Middleware logs show BVN check running
✅ No more client-side redirects using `window.location.href` in login flow
