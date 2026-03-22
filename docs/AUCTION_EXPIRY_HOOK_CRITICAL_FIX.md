# CRITICAL FIX: Auction Expiry Hook Not Running on Page Refresh

## Problem Summary
The `useAuctionExpiryCheck` hook was NOT running when users refreshed an expired auction page, causing:
- Status still showing "🟢 Active" instead of "⚫ Closed"
- NO console logs appearing (hook wasn't executing at all)
- Expired auctions not being closed immediately

## Root Causes

### Issue 1: Incorrect `enabled` Prop in Page Component
**Location:** `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

**Before:**
```typescript
enabled: !!auction && auction.status === 'active',
```

**Problem:**
- Hook was disabled when `auction` was `null` (during initial page load)
- Hook was disabled when status was already 'closed'
- This prevented the hook from ever checking expired auctions on refresh

**After:**
```typescript
enabled: !!auction, // Run whenever auction data is loaded
```

**Fix:** Hook now runs as soon as auction data is loaded, regardless of status

### Issue 2: Premature Status Check in Hook
**Location:** `src/hooks/use-auction-expiry-check.ts`

**Before:**
```typescript
useEffect(() => {
  // Update isClosed state when status prop changes
  if (status !== 'active') {
    setState((prev) => ({ ...prev, isClosed: true }));
    hasClosedRef.current = true; // ❌ This prevented hook from running!
  }
}, [status]);
```

**Problem:**
- When status was passed as 'closed', the hook immediately set `hasClosedRef.current = true`
- This prevented `checkExpiry()` from ever running
- The hook would exit early with "Skipping expiry check - already closed"

**After:**
```typescript
// Status check moved INSIDE checkExpiry() function
if (status !== 'active') {
  console.log(`⏸️  Auction status is '${status}', not 'active'. Skipping check.`);
  setState((prev) => ({ ...prev, isClosed: true }));
  hasClosedRef.current = true;
  return;
}
```

**Fix:** Status is now checked AFTER the hook starts, allowing it to run at least once

## How It Works Now

### Flow on Page Refresh (Expired Auction)

1. **Page loads** → `auction` is `null`
2. **Auction data fetched** → `auction` is set with status 'active' (not yet closed)
3. **Hook enabled** → `enabled: !!auction` becomes `true`
4. **Hook runs** → `checkExpiry()` is called immediately
5. **Status check** → Status is 'active', so check continues
6. **Expiry check** → `endTime <= now` is `true`
7. **API call** → `/api/auctions/check-expired?auctionId=...`
8. **Auction closed** → API closes auction and returns `{ closed: true }`
9. **Callback triggered** → `onAuctionClosed()` refreshes page data
10. **UI updates** → Status changes to "⚫ Closed"

### Console Logs You Should See

```
🚀 Starting expiry check for auction 6fac712e-02ef-4001-96ea-0f9863c0e090
🔍 Checking auction 6fac712e-02ef-4001-96ea-0f9863c0e090 expiry: {
  now: "2024-01-15T10:30:00.000Z",
  endTime: "2024-01-15T10:00:00.000Z",
  hasExpired: true,
  status: "active"
}
⏰ Auction 6fac712e-02ef-4001-96ea-0f9863c0e090 has expired! Calling API to close...
📡 API response for auction 6fac712e-02ef-4001-96ea-0f9863c0e090: { closed: true, ... }
✅ Auction 6fac712e-02ef-4001-96ea-0f9863c0e090 successfully closed by API
🔔 Triggering onAuctionClosed callback
🎯 Auction expired and closed! Refreshing data...
```

## Testing Instructions

### Test 1: Refresh Expired Auction Page
1. Navigate to an expired auction (e.g., auction ID: `6fac712e-02ef-4001-96ea-0f9863c0e090`)
2. Open browser console (F12)
3. Refresh the page (Ctrl+R or Cmd+R)
4. **Expected:**
   - Console logs appear showing "🚀 Starting expiry check"
   - API is called to close auction
   - Status updates to "⚫ Closed"
   - Toast notification: "Auction Closed - This auction has ended"

### Test 2: Watch Timer Expire in Real-Time
1. Navigate to an auction that will expire in < 1 minute
2. Open browser console (F12)
3. Wait for countdown timer to reach 00:00:00
4. **Expected:**
   - Hook checks every 10 seconds
   - When timer hits zero, auction is closed immediately
   - Status updates to "⚫ Closed"
   - No need to refresh page

### Test 3: Already Closed Auction
1. Navigate to an auction that's already closed
2. Open browser console (F12)
3. **Expected:**
   - Hook runs once
   - Console shows "⏸️ Auction status is 'closed', not 'active'. Skipping check."
   - No API calls made
   - Polling stops immediately

## Files Changed

1. **src/app/(dashboard)/vendor/auctions/[id]/page.tsx**
   - Changed `enabled` prop from `!!auction && auction.status === 'active'` to `!!auction`
   - Added comment explaining the fix

2. **src/hooks/use-auction-expiry-check.ts**
   - Moved status check from separate `useEffect` into `checkExpiry()` function
   - Removed premature `hasClosedRef.current = true` assignment
   - Status is now checked AFTER hook starts running

## Impact

✅ **Immediate auction closure on page refresh**
✅ **Immediate auction closure when timer expires**
✅ **No waiting for cron jobs**
✅ **Console logs now appear for debugging**
✅ **User's request fulfilled: "next time the timer expires, the auction will close with it"**

## Related Files

- `src/hooks/use-auction-expiry-check.ts` - The hook implementation
- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - Where hook is used
- `src/app/api/auctions/check-expired/route.ts` - API endpoint for closing auctions
- `src/features/auctions/services/closure.service.ts` - Auction closure service

## Notes

- The hook polls every 10 seconds while auction is active
- Polling stops automatically when auction is closed
- The fix is backward compatible - works for both new and existing auctions
- No database migrations needed
- No breaking changes to API
