# Socket.io Broadcast Fix - Quick Reference

## The Bug
Multiple vendors watching the same auction don't receive bid updates in real-time.

## The Cause
Event deduplication logic in `src/hooks/use-socket.ts` was blocking legitimate events:

```typescript
// BUGGY CODE:
if (data.auctionId === auctionId && data.bid.id !== lastBidIdRef.current) {
  // Process event
}
```

The `bid.id` is the same for ALL clients, so the second condition blocks other vendors.

## The Fix
Remove the bid ID check and only verify the auction ID:

```typescript
// FIXED CODE:
if (data.auctionId === auctionId) {
  // Process event - React handles deduplication
  setLatestBid(data.bid);
  lastBidIdRef.current = data.bid.id; // Track for reference only
}
```

## Testing
1. Open two browser windows with different vendors
2. Both navigate to the same auction
3. Vendor A places a bid
4. **Expected:** Both vendors see "📡 Received new bid event" in console
5. **Expected:** Both UIs update without refresh

## Files Changed
- `src/hooks/use-socket.ts` - Line 269-283 (handleNewBid function)

## Impact
- **Before:** Vendors must refresh to see new bids ❌
- **After:** All vendors see bids in real-time ✅
