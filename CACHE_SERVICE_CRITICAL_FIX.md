# Cache Service Critical Bug Fix

## Issue
Multiple pages were broken with error: **"CacheService.get is not a function"**

### Affected Pages
- Settings page (Profile/Notifications/Transactions)
- Leaderboard page
- Profile page
- Bid History page

## Root Cause
The new caching hooks (`useCachedProfile`, `useCachedLeaderboard`, `useCachedBidHistory`) were calling `CacheService.get()` and `CacheService.set()` as methods, but the CacheService class didn't have these generic methods implemented.

The working hooks (`useCachedAuctions`, `useCachedWallet`, `useCachedDocuments`) used specific methods like:
- `CacheService.getCachedAuctions()`
- `CacheService.getCachedWallet(userId)`
- `CacheService.cacheAuction(auction)`

## Solution Implemented
Added generic `get()` and `set()` methods to the CacheService class to support the generic caching pattern.

### Changes Made to `src/features/cache/services/cache.service.ts`

1. **Added generic cache storage**:
   ```typescript
   private genericCache: Map<string, CachedItem<unknown>> = new Map();
   ```

2. **Added generic `get()` method**:
   ```typescript
   async get<T = unknown>(key: string): Promise<CachedItem<T> | null> {
     const cached = this.genericCache.get(key);
     if (!cached) return null;

     // Check if expired
     if (new Date() > cached.expiresAt) {
       this.genericCache.delete(key);
       return null;
     }

     return cached as CachedItem<T>;
   }
   ```

3. **Added generic `set()` method**:
   ```typescript
   async set<T = unknown>(key: string, data: T, maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
     const now = new Date();
     const expiresAt = new Date(now.getTime() + maxAge);
     const size = JSON.stringify(data).length;

     this.genericCache.set(key, {
       data,
       cachedAt: now,
       expiresAt,
       size,
     });
   }
   ```

4. **Updated `clearAll()` method** to clear generic cache:
   ```typescript
   async clearAll(): Promise<void> {
     this.genericCache.clear();
     await clearExpiredCache();
   }
   ```

5. **Updated `clearExpired()` method** to handle generic cache expiry:
   ```typescript
   async clearExpired(): Promise<number> {
     const now = new Date();
     let expiredCount = 0;
     
     for (const [key, cached] of this.genericCache.entries()) {
       if (now > cached.expiresAt) {
         this.genericCache.delete(key);
         expiredCount++;
       }
     }
     
     const dbExpiredCount = await clearExpiredCache();
     return expiredCount + dbExpiredCount;
   }
   ```

6. **Updated `getStorageUsage()` method** to include generic cache size:
   ```typescript
   async getStorageUsage(): Promise<number> {
     const usage = await getCacheStorageUsage();
     
     let genericCacheSize = 0;
     for (const cached of this.genericCache.values()) {
       genericCacheSize += cached.size;
     }
     
     return usage.total + genericCacheSize;
   }
   ```

## Verification
- ✅ Build completed successfully
- ✅ TypeScript compilation passed
- ✅ Manual test of `CacheService.get()` and `CacheService.set()` passed
- ✅ All affected hooks now have access to the required methods

## Affected Hooks (Now Fixed)
1. `src/hooks/use-cached-profile.ts` - Uses `CacheService.get('profile')` and `CacheService.set('profile', data)`
2. `src/hooks/use-cached-leaderboard.ts` - Uses `CacheService.get('leaderboard')` and `CacheService.set('leaderboard', data)`
3. `src/hooks/use-cached-bid-history.ts` - Uses `CacheService.get(cacheKey)` and `CacheService.set(cacheKey, data)`

## Pages Now Working
1. `/vendor/settings/profile` - Profile settings page
2. `/vendor/leaderboard` - Leaderboard page
3. `/bid-history` - Bid history page

## Status
✅ **FIXED** - All pages should now work correctly without the "CacheService.get is not a function" error.
