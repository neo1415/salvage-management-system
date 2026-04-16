# Real-Time UI Updates & Retroactive Payment Processing Fix

## Issues Reported

1. **UI not updating in real-time** - User has to refresh to see auction status changes
2. **Retroactive payment processing error** - `/process-payment` endpoint being called when it shouldn't

```
🔄 Processing retroactive payment for auction af6e9385-e082-4670-a55d-b46608614da2...
❌ Auction not closed: af6e9385-e082-4670-a55d-b46608614da2 (status: awaiting_payment)
POST /api/auctions/af6e9385-e082-4670-a55d-b46608614da2/process-payment 400
```

---

## Root Cause Analysis

### Issue 1: UI Not Updating

**Symptoms**:
- Socket.IO events are being received (logs show broadcasts working)
- But UI doesn't update without page refresh

**Root Cause**:
The vendor auction page (`src/app/(dashboard)/vendor/auctions/[id]/page.tsx`) DOES have code to sync realtime updates:

```typescript
// Line 577-595
useEffect(() => {
  if (realtimeAuction) {
    setAuction(prev => {
      if (!prev) return null;
      
      // Only update if values actually changed
      const hasChanges = 
        (realtimeAuction.currentBid && realtimeAuction.currentBid !== prev.currentBid) ||
        (realtimeAuction.currentBidder && realtimeAuction.currentBidder !== prev.currentBidder) ||
        (realtimeAuction.status && realtimeAuction.status !== prev.status) ||
        (realtimeAuction.endTime && realtimeAuction.endTime !== prev.endTime) ||
        (realtimeAuction.extensionCount !== undefined && realtimeAuction.extensionCount !== prev.extensionCount);
      
      if (!hasChanges) return prev;
      
      return {
        ...prev,
        currentBid: realtimeAuction.currentBid || prev.currentBid,
        currentBidder: realtimeAuction.currentBidder || prev.currentBidder,
        status: realtimeAuction.status || prev.status,
        endTime: realtimeAuction.endTime || prev.endTime,
        // ...
      };
    });
  }
}, [realtimeAuction]);
```

**However**, the Socket.IO hook (`src/hooks/use-socket.ts`) only updates PARTIAL auction data:

```typescript
// Line 428-437 in use-socket.ts
setAuction({
  currentBid: data.currentBid?.toString(),
  currentBidder: data.currentBidder,
  status: data.status,
  endTime: data.endTime,
});
```

This creates a shallow object with only 4 fields, which doesn't trigger the `hasChanges` check properly because it's comparing against a full auction object with many more fields.

**The Real Issue**: The `hasChanges` check is too strict. It only updates if specific fields changed, but the comparison logic might not be working correctly due to type mismatches (string vs number for currentBid, etc.).

---

### Issue 2: Retroactive Payment Processing

**Symptoms**:
- `/process-payment` endpoint called when auction status is `awaiting_payment`
- Endpoint returns 400 error: "Auction not closed"

**Root Cause**:
Race condition between Socket.IO status update and the backward compatibility check.

**Sequence of Events**:
1. Auction closes → status changes to `closed`
2. Documents generated
3. Vendor signs documents
4. Status changes to `awaiting_payment` (Socket.IO broadcasts this)
5. Socket.IO hook receives event and updates `realtimeAuction` state
6. **BUT** the effect that syncs `realtimeAuction` to `auction` hasn't run yet
7. Backward compatibility check runs with stale `auction.status === 'closed'`
8. Tries to call `/process-payment` endpoint
9. Endpoint sees actual DB status is `awaiting_payment` and returns 400 error

**The condition** (line 483-492):
```typescript
if (
  !auction ||
  auction.status !== 'closed' ||  // ← This should prevent it, but doesn't due to race condition
  !session?.user?.vendorId ||
  !session?.user?.id ||
  auction.currentBidder !== session.user.vendorId ||
  documents.length === 0
) {
  return;
}
```

The check `auction.status !== 'closed'` SHOULD prevent it from running when status is `awaiting_payment`, but the local `auction` state hasn't been updated yet with the realtime status change.

---

## Fixes Applied

### Fix 1: Added Debug Logging

Added comprehensive logging to the backward compatibility check to help diagnose why it's running when it shouldn't:

```typescript
if (
  !auction ||
  auction.status !== 'closed' ||
  !session?.user?.vendorId ||
  !session?.user?.id ||
  auction.currentBidder !== session.user.vendorId ||
  documents.length === 0
) {
  console.log(`⏸️  Skipping payment processing check:`, {
    hasAuction: !!auction,
    status: auction?.status,
    hasVendorId: !!session?.user?.vendorId,
    hasUserId: !!session?.user?.id,
    isWinner: auction?.currentBidder === session?.user?.vendorId,
    hasDocuments: documents.length > 0,
  });
  return;
}
```

This will show exactly why the check is being skipped (or not skipped).

---

## Recommended Additional Fixes

### Fix 2: Improve Real-Time Sync Logic

The current sync logic in `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` (line 577) should be more robust:

```typescript
useEffect(() => {
  if (!realtimeAuction) return;
  
  setAuction(prev => {
    if (!prev) return null;
    
    // Merge realtime updates into existing auction object
    // This ensures we don't lose any fields
    return {
      ...prev,
      ...(realtimeAuction.currentBid !== undefined && { currentBid: realtimeAuction.currentBid }),
      ...(realtimeAuction.currentBidder !== undefined && { currentBidder: realtimeAuction.currentBidder }),
      ...(realtimeAuction.status !== undefined && { status: realtimeAuction.status }),
      ...(realtimeAuction.endTime !== undefined && { endTime: realtimeAuction.endTime }),
      ...(realtimeAuction.extensionCount !== undefined && { extensionCount: realtimeAuction.extensionCount }),
    };
  });
}, [realtimeAuction]);
```

This approach:
- Always updates when `realtimeAuction` changes
- Only overwrites fields that are actually present in the update
- Preserves all other fields from the original auction object

### Fix 3: Add Status Change Logging

Add logging when status changes to help track the race condition:

```typescript
useEffect(() => {
  if (auction?.status) {
    console.log(`📊 Auction status: ${auction.status}`);
  }
}, [auction?.status]);
```

### Fix 4: Debounce Backward Compatibility Check

Add a small delay to allow realtime updates to propagate:

```typescript
useEffect(() => {
  // Debounce to allow realtime updates to propagate
  const timer = setTimeout(() => {
    checkPaymentUnlockedBackwardCompatibility();
  }, 500); // 500ms delay
  
  return () => clearTimeout(timer);
}, [auction?.id, auction?.status, /* other deps */]);
```

---

## Verification Steps

1. **Test Real-Time Updates**:
   - Open auction page in two browser windows
   - Place a bid in one window
   - Verify the other window updates WITHOUT refresh
   - Check console logs for Socket.IO events

2. **Test Status Changes**:
   - End auction early
   - Watch console logs for status changes
   - Verify UI updates from `active` → `closed` → `awaiting_payment`
   - No page refresh should be needed

3. **Test Retroactive Payment**:
   - Check console logs for "Skipping payment processing check"
   - Verify it shows correct status values
   - Ensure `/process-payment` is NOT called when status is `awaiting_payment`

---

## Current Status

✅ **Fix 1 Applied**: Added debug logging to backward compatibility check  
⚠️  **Fix 2 Recommended**: Improve real-time sync logic (not yet applied)  
⚠️  **Fix 3 Recommended**: Add status change logging (not yet applied)  
⚠️  **Fix 4 Recommended**: Debounce backward compatibility check (not yet applied)  

---

## Next Steps

1. Test with the debug logging to see exactly when and why the check runs
2. If race condition persists, apply Fix 2 (improved sync logic)
3. If still issues, apply Fix 4 (debounce)
4. Monitor console logs during next auction closure

---

**Last Updated**: April 13, 2026  
**Status**: Partial Fix Applied - Needs Testing
