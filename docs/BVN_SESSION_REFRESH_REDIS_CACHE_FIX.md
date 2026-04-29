# BVN Session Refresh Redis Cache Fix

**Status**: ✅ FIXED  
**Date**: 2026-04-29  
**Issue**: Session doesn't refresh after BVN verification - user must logout/login

## Problem Description

After successful BVN verification, the user's session still shows `bvnVerified: false` in the JWT token, causing the middleware to continuously redirect them back to the KYC page. The user must logout and login again for the session to recognize the BVN verification.

## Root Cause

The issue was caused by **Redis cache staleness** in the JWT callback:

1. **BVN Verification API** updates the database:
   - Sets `vendors.bvnVerifiedAt = new Date()`
   - Sets `users.status = 'verified_tier_1'`

2. **Client calls `update()`** to refresh the session:
   - Triggers JWT callback with `trigger='update'`
   - JWT callback queries database for fresh user data

3. **JWT Callback has Redis caching** (30-minute TTL):
   ```typescript
   // In next-auth.config.ts JWT callback
   const userCacheKey = `user:${token.id}`;
   let cachedUser = await redis.get(userCacheKey);
   
   if (cachedUser) {
     // Uses STALE cached data (still has bvnVerified=false)
     currentUser = cachedUser;
   } else {
     // Fetches fresh data from database
     currentUser = await db.select()...
     await redis.set(userCacheKey, currentUser, { ex: 30 * 60 });
   }
   ```

4. **Problem**: The Redis cache still contains the **old user data** from before BVN verification, so the JWT callback returns stale data with `bvnVerified=false`.

## Solution

**Invalidate the Redis user cache immediately after BVN verification** so the next JWT callback fetch gets fresh data from the database.

### Code Changes

**File**: `src/app/api/vendors/verify-bvn/route.ts`

Added cache invalidation after database updates:

```typescript
// 12. CRITICAL: Invalidate Redis cache to force session refresh
// The JWT callback caches user data in Redis for 30 minutes
// We must clear this cache so the next request gets fresh data with bvnVerified=true
const { redis } = await import('@/lib/redis/client');
const userCacheKey = `user:${userId}`;

try {
  await redis.del(userCacheKey);
  console.log('[BVN Verification] Cleared user cache:', userCacheKey);
} catch (cacheError) {
  console.error('[BVN Verification] Failed to clear user cache (non-fatal):', cacheError);
  // Continue - this is non-fatal, session will refresh eventually
}
```

## Flow After Fix

1. ✅ User submits BVN for verification
2. ✅ API verifies BVN with Paystack
3. ✅ API updates database (vendors.bvnVerifiedAt, users.status)
4. ✅ **API clears Redis cache** (`user:${userId}`)
5. ✅ API returns `refreshSession: true`
6. ✅ Client calls `update()` to refresh session
7. ✅ JWT callback checks Redis cache → **MISS** (we just cleared it)
8. ✅ JWT callback fetches fresh data from database
9. ✅ JWT callback sees `bvnVerifiedAt` is set → returns `bvnVerified: true`
10. ✅ Session callback updates session with `bvnVerified: true`
11. ✅ Middleware sees `bvnVerified: true` → allows dashboard access
12. ✅ User is redirected to dashboard successfully

## Testing

### Test with Test BVN

```bash
# 1. Login as vendor
# Phone: +2348012345678
# Password: (your test password)

# 2. You'll be redirected to /vendor/kyc/tier1

# 3. Enter test BVN: 12345678901

# 4. Submit verification

# 5. After success message, you should be redirected to dashboard
#    WITHOUT needing to logout/login
```

### Verify Cache Invalidation

Check server logs for:
```
[BVN Verification] Cleared user cache: user:${userId}
[JWT Update] Refreshed vendor BVN status: { vendorId: '...', bvnVerified: true, ... }
```

## Why This Works

The fix ensures that:

1. **Cache is cleared immediately** after database update
2. **Next JWT callback** (triggered by `update()`) gets fresh data
3. **No stale data** is served from Redis
4. **Session refresh happens instantly** without logout/login

## Alternative Approaches Considered

### ❌ Approach 1: Force full page reload
```typescript
window.location.href = '/vendor/dashboard';
```
**Problem**: Still uses cached session data, doesn't solve root cause

### ❌ Approach 2: signOut() then signIn()
```typescript
await signOut({ redirect: false });
await signIn('credentials', { ...credentials });
```
**Problem**: Poor UX, user loses context, requires re-entering credentials

### ✅ Approach 3: Clear Redis cache (CHOSEN)
```typescript
await redis.del(`user:${userId}`);
```
**Benefits**: 
- Solves root cause
- No UX disruption
- Works with existing `update()` mechanism
- Minimal code changes

## Related Files

- `src/app/api/vendors/verify-bvn/route.ts` - BVN verification API (MODIFIED)
- `src/lib/auth/next-auth.config.ts` - JWT callback with Redis caching
- `src/lib/redis/client.ts` - Redis client and cache utilities
- `src/middleware.ts` - BVN verification gate
- `src/app/(dashboard)/vendor/kyc/tier1/page.tsx` - Client-side session refresh

## Cache Strategy

The JWT callback uses a **30-minute cache** to reduce database load:

```typescript
// Validation interval: 30 minutes
const validationInterval = 30 * 60;
const shouldValidate = !lastValidation || (now - lastValidation) > validationInterval;

if (shouldValidate) {
  // Try Redis cache first
  const userCacheKey = `user:${token.id}`;
  let cachedUser = await redis.get(userCacheKey);
  
  if (cachedUser) {
    currentUser = cachedUser; // Use cached data
  } else {
    currentUser = await db.select()...; // Fetch from DB
    await redis.set(userCacheKey, currentUser, { ex: 30 * 60 }); // Cache for 30 min
  }
}
```

**This is good for performance**, but requires **cache invalidation** when critical data changes (like BVN verification status).

## Future Improvements

1. **Centralized cache invalidation utility**:
   ```typescript
   // src/lib/cache/invalidation.ts
   export async function invalidateUserCache(userId: string) {
     await redis.del(`user:${userId}`);
     await redis.del(`session:${userId}`);
     // ... other related caches
   }
   ```

2. **Cache invalidation on all user updates**:
   - Profile updates
   - Role changes
   - Status changes
   - KYC tier changes

3. **Event-driven cache invalidation**:
   - Emit events when user data changes
   - Listeners automatically invalidate related caches

## Conclusion

The fix is simple but critical: **clear the Redis user cache after BVN verification** so the JWT callback gets fresh data. This ensures the session refreshes immediately without requiring logout/login.

**Test BVN**: `12345678901` (works in test mode with `sk_test_...` keys)
