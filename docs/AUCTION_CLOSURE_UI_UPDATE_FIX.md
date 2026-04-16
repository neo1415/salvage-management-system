# Auction Closure UI Update Fix

## Problem

When ending an auction early (or when it closes automatically), the UI doesn't update to show the "closed" status. The page requires a manual refresh to see the changes.

## Root Cause

The Socket.IO `auction:closed` event handler in `use-socket.ts` was only setting flags (`setIsClosed(true)`) but NOT updating the actual auction state that the UI displays.

```typescript
// ❌ BEFORE - Only sets flags
handleClosure: (data: { auctionId: string; winnerId: string }) => {
  if (data.auctionId === auctionId) {
    setIsClosed(true);  // Just a flag
    setIsClosing(false);
    setDocumentsGenerating(false);
    // ❌ MISSING: Update auction state!
  }
},
```

## Evidence from Logs

The logs show that:
1. ✅ Backend successfully closes auction (status: closed)
2. ✅ Documents generated (2/2)
3. ✅ Socket.IO broadcasts sent to 2 clients in room
4. ❌ UI still shows "active" status

This confirms that Socket.IO events ARE being broadcast and received, but the client isn't updating the UI state.

## Fix

Updated the `handleClosure` function to update the auction state when the closure event is received:

```typescript
// ✅ AFTER - Updates auction state
handleClosure: (data: { auctionId: string; winnerId: string }) => {
  if (data.auctionId === auctionId) {
    console.log(`📡 Received auction closure for ${auctionId}`);
    console.log(`   - Winner ID: ${data.winnerId}`);
    
    setIsClosed(true);
    setIsClosing(false);
    setDocumentsGenerating(false);
    
    // CRITICAL FIX: Update auction state with closed status
    setAuction((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: 'closed',
        currentBidder: data.winnerId,
      };
    });
    console.log(`✅ Auction state updated to 'closed'`);
  }
},
```

## How It Works

1. Backend closes auction and broadcasts `auction:closed` event
2. Socket.IO client receives event
3. `handleClosure` function is called
4. Auction state is updated with `status: 'closed'`
5. React re-renders with new state
6. UI shows "closed" status immediately

## Files Modified

- `src/hooks/use-socket.ts` - Updated `handleClosure` to update auction state

## Testing

1. End an auction early from manager dashboard
2. Verify UI updates immediately without refresh
3. Verify status changes from "active" to "closed"
4. Verify winner information is displayed
5. Verify documents section appears

## Result

The UI now updates in real-time when auctions close, without requiring a page refresh. This applies to:
- Manual early closure by managers
- Automatic closure when timer expires
- Any other closure triggers

The fix is minimal, focused, and doesn't change any other behavior.
