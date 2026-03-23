# Manual Test: Auction Expiry Hook Critical Fix

## Test Objective
Verify that the `useAuctionExpiryCheck` hook now runs correctly when refreshing an expired auction page.

## Prerequisites
- Development server running (`npm run dev`)
- Browser with console open (F12)
- Test auction with expired endTime (auction ID: `6fac712e-02ef-4001-96ea-0f9863c0e090` or similar)

## Test Cases

### Test Case 1: Refresh Expired Auction Page ✅ CRITICAL

**Steps:**
1. Open browser and navigate to: `http://localhost:3000/vendor/auctions/6fac712e-02ef-4001-96ea-0f9863c0e090`
2. Open browser console (F12 → Console tab)
3. Clear console (Ctrl+L or Cmd+K)
4. Refresh the page (Ctrl+R or Cmd+R)
5. Watch console output

**Expected Results:**
```
✅ Console logs appear:
   🚀 Starting expiry check for auction 6fac712e-02ef-4001-96ea-0f9863c0e090
   🔍 Checking auction 6fac712e-02ef-4001-96ea-0f9863c0e090 expiry: { ... }
   ⏰ Auction 6fac712e-02ef-4001-96ea-0f9863c0e090 has expired! Calling API to close...
   📡 API response for auction 6fac712e-02ef-4001-96ea-0f9863c0e090: { closed: true }
   ✅ Auction 6fac712e-02ef-4001-96ea-0f9863c0e090 successfully closed by API
   🔔 Triggering onAuctionClosed callback
   🎯 Auction expired and closed! Refreshing data...

✅ UI updates:
   - Status badge changes from "🟢 Active" to "⚫ Closed"
   - Toast notification appears: "Auction Closed - This auction has ended"
   - Documents section appears (if user is winner)

✅ Network tab shows:
   - GET /api/auctions/check-expired?auctionId=... (200 OK)
   - Response: { success: true, closed: true, auction: {...} }
```

**Failure Indicators:**
```
❌ NO console logs appear
❌ Status still shows "🟢 Active"
❌ No API call to /api/auctions/check-expired
❌ No toast notification
```

---

### Test Case 2: Watch Timer Expire in Real-Time ✅ CRITICAL

**Steps:**
1. Create a test auction that expires in 30 seconds:
   ```sql
   UPDATE auctions 
   SET end_time = NOW() + INTERVAL '30 seconds',
       status = 'active'
   WHERE id = '6fac712e-02ef-4001-96ea-0f9863c0e090';
   ```
2. Navigate to auction page
3. Open browser console (F12)
4. Watch countdown timer
5. Wait for timer to reach 00:00:00

**Expected Results:**
```
✅ Before expiry:
   - Hook checks every 10 seconds
   - Console shows: "🔍 Checking auction ... hasExpired: false"
   - Status remains "🟢 Active"

✅ At expiry (timer hits 00:00:00):
   - Within 10 seconds, hook detects expiry
   - Console shows: "⏰ Auction ... has expired! Calling API to close..."
   - API is called automatically
   - Status changes to "⚫ Closed"
   - Toast notification appears
   - NO PAGE REFRESH NEEDED

✅ After expiry:
   - Polling stops (no more console logs)
   - Status remains "⚫ Closed"
```

---

### Test Case 3: Already Closed Auction ✅

**Steps:**
1. Navigate to an auction that's already closed
2. Open browser console (F12)
3. Refresh page

**Expected Results:**
```
✅ Console shows:
   🚀 Starting expiry check for auction ...
   🔍 Checking auction ... status: "closed"
   ⏸️  Auction status is 'closed', not 'active'. Skipping check.

✅ Behavior:
   - Hook runs ONCE
   - No API calls made
   - Polling stops immediately
   - Status shows "⚫ Closed"
   - No unnecessary network requests
```

---

### Test Case 4: Active Auction (Not Expired) ✅

**Steps:**
1. Navigate to an active auction with future endTime
2. Open browser console (F12)
3. Watch console for 30 seconds

**Expected Results:**
```
✅ Console shows (every 10 seconds):
   🚀 Starting expiry check for auction ...
   🔍 Checking auction ... hasExpired: false

✅ Behavior:
   - Hook polls every 10 seconds
   - No API calls made (auction not expired)
   - Status remains "🟢 Active"
   - Countdown timer continues
```

---

## Debugging Tips

### If Hook Doesn't Run
1. Check console for errors
2. Verify `auction` object is loaded: `console.log(auction)`
3. Check `enabled` prop: Should be `true` when auction is loaded
4. Check React DevTools: Look for `useAuctionExpiryCheck` hook state

### If API Call Fails
1. Check Network tab for failed requests
2. Verify API endpoint exists: `/api/auctions/check-expired`
3. Check server logs for errors
4. Verify auction ID is valid

### If Status Doesn't Update
1. Check if `onAuctionClosed` callback is triggered
2. Verify API returns `{ closed: true }`
3. Check if page data refresh succeeds
4. Look for React state update issues

## Success Criteria

✅ All 4 test cases pass
✅ Console logs appear in all scenarios
✅ Expired auctions close immediately on refresh
✅ Timer expiry triggers immediate closure
✅ No unnecessary API calls for closed auctions
✅ User sees "⚫ Closed" status immediately

## Regression Testing

After fix, verify these still work:
- ✅ Bid placement on active auctions
- ✅ Watch/unwatch functionality
- ✅ Real-time bid updates via Socket.io
- ✅ Document signing for closed auctions
- ✅ Payment processing for winners

## Related Documentation
- `AUCTION_EXPIRY_HOOK_CRITICAL_FIX.md` - Detailed fix explanation
- `src/hooks/use-auction-expiry-check.ts` - Hook implementation
- `src/app/api/auctions/check-expired/route.ts` - API endpoint
