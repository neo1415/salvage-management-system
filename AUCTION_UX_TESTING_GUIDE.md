# Auction UX Fixes - Testing Guide

## Quick Test Scenarios

### Scenario 1: Toast Notifications (2 minutes)

**Test Watch/Unwatch**:
1. Navigate to any active auction
2. Click "Watch Auction" button
3. ✅ **Verify**: Green toast appears: "Now watching - You will receive real-time updates"
4. Click "Stop Watching" button
5. ✅ **Verify**: Toast appears: "Stopped watching - You will no longer receive updates"

**Test Bid Placement**:
1. Click "Place Bid" button
2. Enter valid bid amount
3. Complete OTP verification
4. ✅ **Verify**: Green toast appears: "Bid placed successfully! Your bid of ₦XXX has been placed"

**Test Error Handling**:
1. Disconnect internet
2. Try to watch auction
3. ✅ **Verify**: Red toast appears: "Failed to update watch status - Please check your connection"

---

### Scenario 2: Realtime Minimum Bid Updates (5 minutes)

**Setup**: Open auction in two browser windows (use incognito for second vendor)

**Test Flow**:
1. **Window 1 (Vendor A)**: 
   - Note current bid: ₦380,000
   - Note minimum bid: ₦400,000

2. **Window 2 (Vendor B)**:
   - Place bid: ₦405,000
   - Complete OTP

3. **Window 1 (Vendor A)** - WITHOUT REFRESHING:
   - ✅ **Verify**: Orange toast appears: "You've been outbid! New bid: ₦405,000"
   - ✅ **Verify**: Current bid updates to ₦405,000
   - ✅ **Verify**: Minimum bid updates to ₦425,000
   - Click "Place Bid"
   - Try to enter ₦400,000
   - ✅ **Verify**: Validation error shows: "Minimum bid: ₦425,000"
   - Enter ₦425,000
   - ✅ **Verify**: Bid is accepted (no error about stale data)

**Expected Behavior**:
- No page refresh needed
- Minimum bid updates instantly
- Validation prevents invalid bids before OTP flow
- No wasted time with OTP for invalid bids

---

### Scenario 3: Watching Count Accuracy (3 minutes)

**Test Initial Load**:
1. Open auction page
2. ✅ **Verify**: Watching count shows a number (not 0)
3. If you're the first viewer, it should show "1 watching"

**Test Real-time Updates**:
1. Keep auction open in Window 1
2. Open same auction in Window 2 (different browser/incognito)
3. ✅ **Verify**: Window 1 watching count increases by 1
4. Close Window 2
5. ✅ **Verify**: Window 1 watching count decreases by 1

**Test Persistence**:
1. Watch an auction
2. Refresh the page
3. ✅ **Verify**: Watching count remains accurate (doesn't reset to 0)

---

## Critical Edge Case Test (The Main Problem)

### The Scenario That Was Broken

**Before Fix**:
1. Vendor A bids ₦380k → minimum becomes ₦400k
2. Vendor B bids ₦405k → minimum should be ₦425k
3. Vendor A doesn't see update (still sees ₦400k minimum)
4. Vendor A tries to bid ₦400k
5. Goes through entire OTP flow (SMS, wait, enter code)
6. Only then finds out bid is invalid
7. **Result**: Wasted 2-3 minutes, frustrated user

**After Fix**:
1. Vendor A bids ₦380k → minimum becomes ₦400k
2. Vendor B bids ₦405k → minimum broadcasts as ₦425k
3. Vendor A sees toast: "You've been outbid!"
4. Vendor A's UI updates: minimum now ₦425k (no refresh)
5. Vendor A tries to bid ₦400k
6. Immediate validation error: "Minimum bid: ₦425,000"
7. **Result**: No wasted time, clear feedback

### How to Test This

1. **Setup**: Two browser windows, two different vendor accounts
2. **Window 1**: Place bid ₦380k
3. **Window 2**: Place bid ₦405k
4. **Window 1**: 
   - ✅ See outbid toast immediately
   - ✅ See minimum bid update to ₦425k
   - ✅ Try to bid ₦400k → instant validation error
   - ✅ No OTP flow triggered for invalid bid

---

## Visual Indicators

### Toast Notification Types

**Success (Green)**:
- ✅ Bid placed successfully
- ✅ Now watching auction

**Error (Red)**:
- ❌ Failed to place bid
- ❌ Failed to update watch status
- ❌ Insufficient wallet balance

**Warning (Orange)**:
- ⚠️ You've been outbid!
- ⚠️ Auction ending soon

**Info (Blue)**:
- ℹ️ New bid placed
- ℹ️ Auction extended

### Watching Count Display

```
👁️ 3 watching          // Normal
👁️ 6 watching 🔥 High Demand  // > 5 watchers
```

---

## Performance Checks

### Realtime Update Speed

**Bid Broadcast**: Should appear within 2 seconds
1. Place bid in Window 1
2. Start timer
3. Check Window 2 for update
4. ✅ **Verify**: Update appears in < 2 seconds

**Outbid Notification**: Should appear within 5 seconds
1. Get outbid
2. Start timer
3. Check for toast notification
4. ✅ **Verify**: Toast appears in < 5 seconds

---

## Common Issues & Solutions

### Issue: Toast doesn't appear
**Solution**: Check browser console for errors, ensure ToastProvider is wrapping the app

### Issue: Watching count shows 0
**Solution**: Check Redis connection, verify `/api/auctions/[id]/watching-count` endpoint

### Issue: Minimum bid doesn't update
**Solution**: Check Socket.IO connection, verify `broadcastNewBid()` includes `minimumBid`

### Issue: Outbid notification doesn't show
**Solution**: Check `useAuctionUpdates()` hook, verify `latestBid` is being received

---

## Browser Console Checks

### Expected Logs

**Socket.IO Connection**:
```
✅ Socket.io connected
👁️ User {userId} watching auction {auctionId}
```

**Bid Placement**:
```
✅ Bid placed in 45.2 seconds
✅ Bid broadcast completed in 1234ms
📢 Broadcasted new bid for auction {id} with minimum bid ₦425,000
```

**Watching Count**:
```
✅ Vendor {id} started watching auction {id}, count: 3
📢 Broadcasted watching count for auction {id}: 3
```

---

## Regression Testing

### Ensure Nothing Broke

1. ✅ Bid placement still works
2. ✅ OTP verification still works
3. ✅ Wallet balance check still works
4. ✅ Tier limits still enforced
5. ✅ Auto-extension still works
6. ✅ Auction closure still works
7. ✅ Payment flow still works

---

## Production Monitoring

### Metrics to Watch

1. **Socket.IO Connection Rate**: Should be > 95%
2. **Bid Broadcast Latency**: Should be < 2 seconds
3. **Toast Display Rate**: Should be 100% (all actions show feedback)
4. **Watching Count Accuracy**: Spot check against Redis data
5. **User Complaints**: Monitor for "didn't see update" reports

### Redis Keys to Monitor

```bash
# Watching count
GET auction:watching:{auctionId}

# Viewer tracking
GET auction:viewer:{auctionId}:{vendorId}
```

---

## Success Criteria

✅ **All toast notifications work** (no browser alerts)
✅ **Minimum bid updates in real-time** (no page refresh)
✅ **Watching count shows accurate numbers** (not 0)
✅ **Outbid notifications appear immediately**
✅ **No wasted time with invalid bids**
✅ **Professional, enterprise-grade UX**

---

## Quick Smoke Test (30 seconds)

1. Open any active auction
2. Click "Watch Auction" → See green toast ✅
3. Open in second window → Watching count increases ✅
4. Place a bid → See success toast ✅
5. Get outbid (if possible) → See warning toast ✅

If all 5 pass → **System is working correctly** 🎉
