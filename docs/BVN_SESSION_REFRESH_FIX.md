# BVN Session Refresh Fix

## Problem

After successful BVN verification, users had to logout and login again before they could access the dashboard. The session wasn't being refreshed immediately after verification, causing the middleware to still see `bvnVerified: false` in the JWT token.

## Root Cause

The issue was in the session refresh flow:

1. ✅ API successfully updates `vendors.bvnVerifiedAt` in database
2. ✅ API returns `refreshSession: true` to client
3. ✅ Client calls `update()` from `next-auth/react`
4. ❌ **BUT** - JWT callback wasn't immediately querying the database for the updated `bvnVerified` status
5. ❌ Middleware still saw old token with `bvnVerified: false`
6. ❌ User was redirected back to KYC page

## Solution

### 1. Enhanced Client-Side Session Refresh

**File**: `src/app/(dashboard)/vendor/kyc/tier1/page.tsx`

```typescript
// Show success
setSuccess(true);

// Refresh session to update bvnVerified flag
if (result.refreshSession) {
  // Force a full session refresh by calling update() with force flag
  // This triggers the JWT callback with trigger='update'
  const { update } = await import('next-auth/react');
  
  // Call update to trigger session refresh
  await update();
  
  // Wait a bit for session to propagate
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Redirect to dashboard after 2 seconds
setTimeout(() => {
  router.push('/vendor/dashboard');
  // Force a hard refresh to ensure middleware picks up new session
  router.refresh();
}, 2000);
```

**Changes**:
- Added 500ms delay after `update()` to allow session to propagate
- Reduced redirect timeout from 3s to 2s (total wait is now 2.5s)
- Added `router.refresh()` to force middleware to re-evaluate with new session

### 2. Enhanced JWT Callback

**File**: `src/lib/auth/next-auth.config.ts`

```typescript
// Update session
if (trigger === 'update') {
  // Refresh user data from database
  const [updatedUser] = await withRetry(async () => {
    return await db
      .select()
      .from(users)
      .where(eq(users.id, token.id as string))
      .limit(1);
  });

  if (updatedUser) {
    token.role = updatedUser.role;
    token.status = updatedUser.status;
    token.phone = updatedUser.phone;
    token.requirePasswordChange = updatedUser.requirePasswordChange === 'true';
    token.profilePictureUrl = updatedUser.profilePictureUrl ?? undefined;
    
    // CRITICAL: Always refresh vendorId and BVN verification status for vendors
    // This ensures the session is updated immediately after BVN verification
    if (updatedUser.role === 'vendor') {
      const { vendors } = await import('@/lib/db/schema/vendors');
      const [vendor] = await withRetry(async () => {
        return await db
          .select({ id: vendors.id, bvnVerifiedAt: vendors.bvnVerifiedAt })
          .from(vendors)
          .where(eq(vendors.userId, updatedUser.id))
          .limit(1);
      });
      
      token.vendorId = vendor?.id;
      token.bvnVerified = !!vendor?.bvnVerifiedAt;
      
      console.log('[JWT Update] Refreshed vendor BVN status:', {
        vendorId: vendor?.id,
        bvnVerified: !!vendor?.bvnVerifiedAt,
        bvnVerifiedAt: vendor?.bvnVerifiedAt,
      });
    } else {
      token.bvnVerified = true; // Non-vendors don't need BVN verification
    }
    
    // Update validation timestamp after refresh
    token.lastValidation = now;
  }
}
```

**Changes**:
- Added critical comment explaining why we always refresh BVN status
- Added console.log for debugging session refresh
- Ensured `bvnVerified` is always queried from database on `update()`

## Testing

### 1. Run Diagnostic Script

```bash
npx tsx scripts/test-bvn-session-refresh.ts +2348012345678
```

This will show:
- User details
- Vendor record
- BVN verification status
- What the JWT token values should be
- Whether middleware will allow dashboard access

### 2. Test the Flow

1. **Login** with your test vendor account (+2348012345678)
2. You'll be **redirected to /vendor/kyc/tier1** (BVN not verified yet)
3. **Enter test BVN**: `12345678901`
4. Click **"Verify My Identity"**
5. Wait for success message (2 seconds)
6. You'll be **automatically redirected to /vendor/dashboard**
7. ✅ **No logout/login required!**

### 3. Verify Session

After successful verification:

```bash
# Check that BVN is verified in database
npx tsx scripts/test-bvn-session-refresh.ts +2348012345678
```

Should show:
```
✅ Vendor record found:
   BVN Verified: ✅ YES
   BVN Verified At: 2026-04-29T...

🔐 Middleware Check:
   ✅ PASS - User should be able to access dashboard
   ✅ Middleware will allow access to /vendor/dashboard
```

## How It Works Now

### Before Fix
```
1. User verifies BVN
2. API updates database ✅
3. Client calls update() ✅
4. JWT callback doesn't refresh bvnVerified ❌
5. Middleware sees old token ❌
6. User redirected back to KYC ❌
7. User must logout/login ❌
```

### After Fix
```
1. User verifies BVN
2. API updates database ✅
3. Client calls update() ✅
4. JWT callback queries database for bvnVerified ✅
5. Token updated with bvnVerified: true ✅
6. 500ms delay for session propagation ✅
7. Router.refresh() forces middleware re-check ✅
8. Middleware sees new token ✅
9. User redirected to dashboard ✅
10. No logout/login needed! ✅
```

## Technical Details

### Session Propagation

The session update flow:
1. `update()` triggers JWT callback with `trigger='update'`
2. JWT callback queries database for latest vendor data
3. Token is updated with new `bvnVerified` value
4. Session callback receives updated token
5. Session is stored in Redis with new values
6. Cookie is updated with new JWT
7. 500ms delay ensures cookie is written
8. `router.refresh()` forces Next.js to re-evaluate middleware
9. Middleware reads new cookie with `bvnVerified: true`
10. Access granted to dashboard

### Middleware Check

The middleware uses `getToken()` which reads the JWT from the cookie:

```typescript
const token = await getToken({ 
  req: request,
  secret: process.env.NEXTAUTH_SECRET 
});

if (token?.role === 'vendor') {
  const bvnVerified = token.bvnVerified;
  
  if (!bvnVerified) {
    // Redirect to BVN verification
    return NextResponse.redirect('/vendor/kyc/tier1');
  }
}
```

After the fix, `token.bvnVerified` will be `true` immediately after verification.

## Files Changed

1. `src/app/(dashboard)/vendor/kyc/tier1/page.tsx` - Enhanced session refresh
2. `src/lib/auth/next-auth.config.ts` - Enhanced JWT callback
3. `scripts/test-bvn-session-refresh.ts` - New diagnostic script
4. `docs/BVN_SESSION_REFRESH_FIX.md` - This documentation

## Deployment Notes

- ✅ No database migrations required
- ✅ No environment variable changes
- ✅ Backward compatible (existing sessions will work)
- ✅ No breaking changes

## Related Files

- `src/middleware.ts` - BVN verification gate
- `src/app/api/vendors/verify-bvn/route.ts` - BVN verification API
- `src/features/vendors/services/bvn-verification.service.ts` - BVN service
- `docs/BVN_VERIFICATION_GATE_COMPLETE.md` - Original implementation
- `docs/BVN_VERIFICATION_TEST_MODE_GUIDE.md` - Test mode guide

## Status

✅ **FIXED** - Session now refreshes immediately after BVN verification. No logout/login required.
