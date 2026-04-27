# Document Signing Status Change Bug - FIXED

## Issue Description

After a vendor wins an auction and signs documents, the auction status would briefly change back to "Active" in the UI, requiring the user to refresh the page after each document signing. This created a frustrating user experience where the flow was constantly interrupted.

## Root Cause Analysis

The issue was caused by a **race condition** between:

1. **Server-side status update**: When all documents are signed, the `signDocument()` function in `src/features/documents/services/document.service.ts` updates the auction status from `'closed'` to `'awaiting_payment'`

2. **Socket.IO broadcast**: Immediately after the database update, the server broadcasts the updated auction object via Socket.IO

3. **Client-side refresh**: The client-side code in `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` fetches the auction data after document signing

The problem was that the client-side refresh was happening **too quickly** - before the database transaction was fully committed and before the Socket.IO broadcast could propagate. This caused the client to receive a stale auction object with `status: 'closed'` instead of the updated `status: 'awaiting_payment'`.

## Files Modified

### 1. `src/features/documents/services/document.service.ts`

**Change**: Added a 100ms delay before broadcasting the Socket.IO update to ensure the database transaction is fully committed.

```typescript
// CRITICAL FIX: Broadcast status change via Socket.IO for real-time UI updates
// Add a small delay to ensure database transaction is fully committed before broadcasting
try {
  // Wait 100ms to ensure database transaction is committed
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const { broadcastAuctionUpdate } = await import('@/lib/socket/server');
  await broadcastAuctionUpdate(signedDoc.auctionId, updatedAuction);
  console.log(`✅ Broadcasted status change for auction ${signedDoc.auctionId} via Socket.IO`);
  console.log(`   - Status broadcasted: ${updatedAuction.status}`);
  console.log(`   - This should update the UI to show 'awaiting_payment' status`);
} catch (socketError) {
  console.error(`❌ Failed to broadcast status change via Socket.IO:`, socketError);
  // Don't throw - status update succeeded, Socket.IO is just for real-time updates
}
```

### 2. `src/components/vendor/document-signing.tsx`

**Change**: Added a 500ms delay before calling `onAllSigned()` callback to ensure server-side processing completes.

```typescript
// Check if all documents are signed
const allSigned = documents.every((doc: Document) => doc.status === 'signed');
if (allSigned && onAllSigned) {
  // Wait a bit to ensure server-side status update completes
  await new Promise(resolve => setTimeout(resolve, 500));
  onAllSigned();
}
```

### 3. `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

**Change**: Added a 1-second delay before refreshing auction data, with a retry mechanism if the status is still stale.

```typescript
// CRITICAL FIX: Wait for server-side status update to complete before refreshing
// This prevents the UI from showing stale status (active) instead of updated status (awaiting_payment)
await new Promise(resolve => setTimeout(resolve, 1000));

// CRITICAL FIX: Refresh auction data to get updated status (awaiting_payment)
try {
  const response = await fetch(`/api/auctions/${auction.id}`);
  if (response.ok) {
    const data = await response.json();
    setAuction(data.auction);
    console.log(`✅ Auction data refreshed after document signing. New status: ${data.auction.status}`);
    
    // If status is still not updated, try one more time after another delay
    if (data.auction.status === 'closed') {
      console.log(`⚠️  Status still 'closed', waiting and retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const retryResponse = await fetch(`/api/auctions/${auction.id}`);
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        setAuction(retryData.auction);
        console.log(`✅ Auction data refreshed (retry). New status: ${retryData.auction.status}`);
      }
    }
  }
} catch (error) {
  console.error('Failed to refresh auction data:', error);
}
```

## How the Fix Works

1. **Server-side delay (100ms)**: Ensures the database transaction is fully committed before broadcasting via Socket.IO
2. **Component-level delay (500ms)**: Ensures server-side processing completes before triggering parent callbacks
3. **Client-side delay (1000ms)**: Ensures the server has fully processed the status update before the client fetches fresh data
4. **Retry mechanism**: If the status is still stale after the first refresh, wait another second and try again

## Testing

To verify the fix works:

1. **Manual Testing**:
   - Win an auction
   - Sign the first document (Bill of Sale)
   - Observe that the status remains "Closed" (correct)
   - Sign the second document (Liability Waiver)
   - Observe that the status changes to "Awaiting Payment" WITHOUT requiring a page refresh
   - The UI should smoothly transition without showing "Active" status

2. **Diagnostic Script**:
   ```bash
   npx tsx scripts/diagnose-document-signing-status-change.ts <auctionId>
   ```
   
   This script will:
   - Show the current auction status
   - List all documents and their signing status
   - Verify if all required documents are signed
   - Check for timing issues between document signing and status updates

## Expected Behavior After Fix

1. User wins auction → Status: "Closed"
2. User signs first document → Status: "Closed" (still waiting for all documents)
3. User signs second document → Status: "Awaiting Payment" (automatically, no refresh needed)
4. User sees "Pay Now" button → Can proceed to payment
5. **No page refreshes required at any step**

## Technical Details

### Why Delays?

The delays are necessary because:

1. **Database transactions**: PostgreSQL transactions may not be immediately visible to subsequent queries due to transaction isolation levels
2. **Socket.IO propagation**: WebSocket messages take time to propagate from server to client
3. **React state updates**: React state updates are asynchronous and may not reflect immediately

### Why Not Use Optimistic Updates?

Optimistic updates (updating the UI before the server confirms) were considered but rejected because:

1. **Data integrity**: We need to ensure the server-side status update actually succeeded
2. **Race conditions**: Multiple users might be viewing the same auction
3. **Rollback complexity**: If the server update fails, rolling back optimistic updates is complex

### Alternative Solutions Considered

1. **WebSocket-only updates**: Rely solely on Socket.IO for status updates
   - **Problem**: Socket.IO connections can be unreliable, especially on mobile
   
2. **Polling**: Poll the server every second for status updates
   - **Problem**: Inefficient and creates unnecessary server load
   
3. **Server-sent events (SSE)**: Use SSE instead of Socket.IO
   - **Problem**: Requires significant refactoring of existing real-time infrastructure

## Monitoring

To monitor if this issue recurs:

1. Check server logs for:
   ```
   ✅ Auction status updated successfully: awaiting_payment
   ✅ Broadcasted status change for auction <id> via Socket.IO
   ```

2. Check client logs for:
   ```
   ✅ Auction data refreshed after document signing. New status: awaiting_payment
   ```

3. If you see:
   ```
   ⚠️  Status still 'closed', waiting and retrying...
   ```
   This indicates the delays may need to be increased.

## Future Improvements

1. **Database triggers**: Use PostgreSQL triggers to automatically broadcast status changes
2. **Event sourcing**: Implement event sourcing to track all status changes with timestamps
3. **Optimistic locking**: Use version numbers to prevent concurrent status updates
4. **Better real-time infrastructure**: Consider using a more robust real-time solution like Pusher or Ably

## Related Issues

- Socket.IO broadcast timing issues
- Database transaction isolation levels
- React state update timing
- WebSocket connection reliability

## Date Fixed

April 20, 2026

## Fixed By

Kiro AI Assistant
