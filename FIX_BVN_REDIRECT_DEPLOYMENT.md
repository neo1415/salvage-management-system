# Fix: BVN Redirect After Phone Verification

## Problem
Vendors who register and verify their phone are not being redirected to Tier 1 (BVN) verification page on production, but it works on localhost.

## Root Cause
The JWT token's `bvnVerified` flag was only checked during initial sign-in. When a user logged in again after phone verification, the session was reused with the stale `bvnVerified: false` value, preventing the middleware redirect.

## Solution Applied
Modified `src/lib/auth/next-auth.config.ts` to:
1. **Always check BVN status on initial login** (already existed)
2. **NEW: Periodically refresh BVN status for existing sessions** (every 5 minutes)
3. **NEW: Log BVN status changes** for debugging

This ensures that even if a session is reused, the BVN verification status is refreshed within 5 minutes.

## Deployment Steps

### 1. Commit and Push Changes
```bash
# Check what changed
git status
git diff src/lib/auth/next-auth.config.ts

# Stage the fix
git add src/lib/auth/next-auth.config.ts
git add DEPLOYMENT_SYNC_CHECKLIST.md
git add FIX_BVN_REDIRECT_DEPLOYMENT.md

# Commit with clear message
git commit -m "fix: refresh BVN verification status on existing sessions

- Add periodic BVN status check (every 5 minutes) for vendor sessions
- Ensures middleware redirect works after phone verification
- Fixes production issue where localhost worked but prod didn't
- Adds logging for BVN status changes for debugging"

# Push to production
git push origin main
```

### 2. Verify Deployment
Check your hosting platform (Vercel, Railway, etc.) to ensure:
- ✅ Build succeeded
- ✅ Deployment is live
- ✅ No environment variable errors

### 3. Clear Production Caches (Important!)
The fix won't take effect for existing sessions until they expire or are cleared.

#### Option A: Wait for Natural Expiry
- Sessions expire after 24 hours (desktop) or 2 hours (mobile)
- BVN status will refresh within 5 minutes of next request

#### Option B: Force Cache Clear (Recommended)
Create a temporary admin script to clear affected user caches:

```typescript
// scripts/clear-vendor-session-cache.ts
import { redis } from '@/lib/redis/client';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function clearVendorSessions() {
  // Get all vendors
  const vendors = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'vendor'));
  
  console.log(`Found ${vendors.length} vendors`);
  
  for (const vendor of vendors) {
    try {
      // Clear user cache
      await redis.del(`user:${vendor.id}`);
      
      // Clear session mapping
      const sessionId = await redis.get(`user:${vendor.id}:session`);
      if (sessionId) {
        await redis.del(`session:${sessionId}`);
      }
      await redis.del(`user:${vendor.id}:session`);
      
      console.log(`✅ Cleared cache for ${vendor.email}`);
    } catch (error) {
      console.error(`❌ Failed to clear cache for ${vendor.email}:`, error);
    }
  }
  
  console.log('Done!');
}

clearVendorSessions();
```

Run it:
```bash
npx tsx scripts/clear-vendor-session-cache.ts
```

### 4. Test the Fix

#### Test Case 1: New User Registration
1. Register a new vendor account
2. Verify phone with OTP
3. Log out
4. Log in again
5. **Expected**: Redirect to `/vendor/kyc/tier1`

#### Test Case 2: Existing User (After Cache Clear)
1. Log in as existing vendor (without BVN verification)
2. **Expected**: Redirect to `/vendor/kyc/tier1` within 5 minutes

#### Test Case 3: Verify Logs
Check production logs for:
```
[JWT Initial Login] Vendor BVN status: { vendorId: '...', bvnVerified: false, ... }
[JWT Session Refresh] Vendor BVN status changed: { oldStatus: false, newStatus: true, ... }
```

### 5. Monitor Production

Watch for these indicators:
- ✅ Vendors are redirected to tier1 KYC page
- ✅ No infinite redirect loops
- ✅ BVN status logs appear in production logs
- ✅ No increase in database query load

## Rollback Plan

If issues occur, revert the change:
```bash
git revert HEAD
git push origin main
```

The previous behavior will be restored (BVN check only on initial sign-in).

## Why This Fixes Both Localhost and Production

### Before Fix:
- **Localhost**: You were likely clearing cookies/cache between tests, forcing fresh JWT generation → BVN check ran → redirect worked
- **Production**: Sessions persisted, JWT was reused with stale `bvnVerified: false` → no redirect

### After Fix:
- **Both environments**: BVN status is refreshed every 5 minutes for existing sessions
- **Both environments**: Fresh logins always check BVN status
- **Both environments**: Middleware redirect works correctly

## Performance Impact

- **Minimal**: BVN check runs every 5 minutes per vendor session
- **Optimized**: Uses existing database connection pool
- **Cached**: User data is still cached for 30 minutes (separate from BVN check)
- **Scalable**: Only affects vendors, not all users

## Additional Notes

### Why 5 Minutes?
- Fast enough to catch recent verifications (user won't wait long)
- Slow enough to avoid excessive database queries
- Balances UX and performance

### Why Not Check on Every Request?
- Would cause excessive database load
- The 30-minute user validation already exists
- 5 minutes is acceptable for this use case

### Alternative Solutions Considered
1. ❌ **Force logout after phone verification**: Bad UX
2. ❌ **Check BVN on every request**: Performance issue
3. ❌ **WebSocket notification**: Over-engineered
4. ✅ **Periodic refresh (5 min)**: Best balance

## Success Criteria

- ✅ New vendors redirected to tier1 KYC after phone verification
- ✅ Existing vendors redirected within 5 minutes
- ✅ No performance degradation
- ✅ Logs show BVN status checks working
- ✅ No user complaints about redirect issues

## Questions?

If the issue persists after deployment:
1. Check production logs for BVN status messages
2. Verify environment variables are correct
3. Confirm database has correct `bvnVerifiedAt` values
4. Check if Redis/KV is working properly
5. Test with a fresh incognito window (no cached session)
