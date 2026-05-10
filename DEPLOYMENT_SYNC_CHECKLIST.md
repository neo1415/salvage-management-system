# Deployment Synchronization Checklist

## Issue Summary
Production is not redirecting vendors to Tier 1 (BVN) verification after phone verification, but localhost works correctly.

## Root Cause Analysis

### 1. **Git Sync Status** ✅
- Local and remote are in sync (both at commit `53bfe04`)
- No uncommitted changes affecting auth logic
- Last deployment: "cron jobs limit"

### 2. **Actual Problem: Session State Management** ⚠️
The BVN redirect logic exists in `src/middleware.ts` but relies on `token.bvnVerified` from the JWT token. The issue is:

**In `src/lib/auth/next-auth.config.ts` (lines 350-365):**
```typescript
// Check BVN verification status for vendors
if (user.role === 'vendor' && user.vendorId) {
  const { vendors } = await import('@/lib/db/schema/vendors');
  const [vendor] = await withRetry(async () => {
    return await db
      .select({ bvnVerifiedAt: vendors.bvnVerifiedAt })
      .from(vendors)
      .where(eq(vendors.id, user.vendorId!))
      .limit(1);
  });
  
  token.bvnVerified = !!vendor?.bvnVerifiedAt;
}
```

**The Problem:**
- This code only runs during **initial sign-in** (when `user` object is present)
- When a vendor logs in again after phone verification, the session is reused
- The `bvnVerified` flag is NOT refreshed unless `trigger === 'update'` is explicitly called
- On localhost, you might be clearing cookies/cache between tests, forcing fresh logins
- On production, the session persists, so the stale `bvnVerified: false` remains

### 3. **Why Localhost Works But Production Doesn't**
- **Localhost**: You're likely clearing browser data or using incognito, forcing fresh JWT generation
- **Production**: Sessions persist across logins, JWT token is reused with stale `bvnVerified` value
- **Redis Cache**: Production might have cached user data with old BVN status (30-minute cache)

## Solution: Force BVN Status Refresh on Every Login

### Fix 1: Always Check BVN Status on Login (Recommended)
Modify the JWT callback to ALWAYS check BVN status on login, not just initial sign-in.

### Fix 2: Clear Redis Cache After Phone Verification
Ensure the user cache is invalidated when phone verification completes.

### Fix 3: Add Session Update Trigger After Phone Verification
Call `update()` on the session after phone verification to force JWT refresh.

## Deployment Verification Steps

### Step 1: Verify All Changes Are Committed
```bash
git status
git log --oneline -5
```

### Step 2: Verify Remote Sync
```bash
git fetch origin
git diff HEAD origin/main
```

### Step 3: Check Production Environment Variables
Ensure these are set in production:
- `NEXTAUTH_SECRET` (must match between deployments)
- `NEXTAUTH_URL` (correct production URL)
- `DATABASE_URL` (production database)
- `REDIS_URL` or `KV_*` (Vercel KV credentials)

### Step 4: Force Production Rebuild
If using Vercel:
```bash
vercel --prod
```

If using other platforms:
```bash
# Trigger a new deployment even without code changes
git commit --allow-empty -m "force: trigger production rebuild"
git push origin main
```

### Step 5: Clear Production Caches
- Clear Redis/KV cache for user sessions
- Clear CDN cache if applicable
- Clear browser cache on production domain

### Step 6: Test Production Flow
1. Register new vendor account
2. Verify phone with OTP
3. Log out completely
4. Log in again
5. **Expected**: Should redirect to `/vendor/kyc/tier1`
6. **Actual**: Check if redirect happens

## Quick Fix Script

Run this to ensure everything is deployed:

```bash
# 1. Check for uncommitted changes
git status

# 2. Check if local is ahead of remote
git fetch origin
git status

# 3. If local is ahead, push
git push origin main

# 4. Force rebuild (if needed)
git commit --allow-empty -m "chore: force production rebuild for BVN redirect fix"
git push origin main

# 5. Verify deployment
# Check your hosting platform's deployment logs
```

## Redis Cache Invalidation

If the issue persists, clear the Redis cache for affected users:

```typescript
// Run this script or add to your admin panel
import { redis } from '@/lib/redis/client';

async function clearUserCache(userId: string) {
  await redis.del(`user:${userId}`);
  await redis.del(`user:${userId}:session`);
  console.log(`Cleared cache for user ${userId}`);
}
```

## Environment-Specific Debugging

### Check Production Logs
Look for these log messages:
```
[JWT] Refreshed vendor BVN status
[JWT Update] Refreshed vendor BVN status
```

If you don't see these after login, the BVN check isn't running.

### Check Middleware Logs
Add temporary logging to `src/middleware.ts`:
```typescript
if (token?.role === 'vendor') {
  console.log('[Middleware] Vendor BVN check:', {
    vendorId: token.vendorId,
    bvnVerified: token.bvnVerified,
    pathname,
  });
}
```

## Permanent Fix Implementation

The issue requires a code change to force BVN status refresh on every vendor login. See the fix in the next section.

## Status
- ✅ Git sync verified
- ⚠️ Code fix needed for BVN status refresh
- ⚠️ Redis cache may need clearing
- ⚠️ Production environment variables need verification
