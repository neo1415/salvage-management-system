# Auction Payment Flow - Critical Fixes

## Issues Identified

### 1. Duplicate Payment Records
**Problem**: Two payment records created for the same auction at the exact same time (10:43:39)
- Payment 1: `PAY_ea06c5e4_1776073420662`
- Payment 2: `PAY_ea06c5e4_1776073420375`

**Root Cause**: Auction closure API endpoint has no protection against concurrent calls. When the timer expires, multiple clients (or the same client making rapid requests) can trigger closure simultaneously.

**Impact**:
- Confuses payment flow
- Blocks payment method selection with error: "A payment is already in progress"
- Creates data inconsistency

### 2. Socket.IO Not Updating UI
**Problem**: UI requires page refresh to see status changes

**Root Cause**: 
- Socket.IO broadcasts are working (confirmed in logs)
- Client-side listeners may not be properly set up
- Reconnection logic may be missing

**Impact**: Poor user experience, requires manual page refreshes

### 3. Payment Status Display Incorrect
**Problem**: Payment cards show "⏳ Waiting for Documents" when documents are already signed (2/2)

**Root Cause**: UI component not checking actual document status, relying on payment status instead

**Impact**: Confusing UI, users don't know what action to take

## Solutions Implemented

### Fix 1: Add Distributed Lock to Prevent Concurrent Closure

**File**: `src/app/api/auctions/[id]/close/route.ts`

Added Redis-based distributed lock to ensure only one closure process runs at a time:

```typescript
// Acquire distributed lock
const lockKey = `auction:close:${auctionId}`;
const lockValue = `${session.user.id}:${Date.now()}`;
const lockAcquired = await redis.set(lockKey, lockValue, {
  nx: true, // Only set if not exists
  ex: 60,   // Expire after 60 seconds
});

if (!lockAcquired) {
  // Another process is already closing this auction
  return NextResponse.json({
    success: true,
    message: 'Auction closure already in progress',
  });
}

try {
  // Close auction
  const result = await closureService.closeAuction(auctionId);
  return NextResponse.json({ success: true, ...result });
} finally {
  // Release lock
  await redis.del(lockKey);
}
```

**Benefits**:
- Prevents duplicate payment records
- Ensures idempotent closure
- Works across multiple server instances (horizontal scaling)

### Fix 2: Add Unique Constraint on Payments Table

**Migration**: `drizzle/migrations/add-unique-payment-constraint.sql`

```sql
-- Add unique constraint to prevent duplicate payments
ALTER TABLE payments 
ADD CONSTRAINT unique_auction_vendor_payment 
UNIQUE (auction_id, vendor_id);
```

**Benefits**:
- Database-level protection against duplicates
- Fails fast if duplicate attempted
- Works even if application logic fails

### Fix 3: Cleanup Duplicate Payments Script

**File**: `scripts/cleanup-duplicate-payments.ts`

Identifies and removes duplicate payment records, keeping the most recent one.

### Fix 4: Broadcast Status Changes via Socket.IO

**File**: `src/features/documents/services/document.service.ts`

Added Socket.IO broadcast when auction status changes to "awaiting_payment":

```typescript
// Broadcast status change
await broadcastAuctionUpdate(signedDoc.auctionId, updatedAuction);
console.log(`✅ Broadcasted status change for auction ${signedDoc.auctionId}`);
```

### Fix 5: Fix Payment Status Display

**File**: `src/components/finance/payment-transactions-content.tsx`

Updated to check actual document status instead of relying on payment status:

```typescript
// Check actual document status
const documents = await getDocuments(payment.auctionId, payment.vendorId);
const allSigned = documents.length >= 2 && documents.every(d => d.status === 'signed');

// Display correct status
{allSigned ? (
  <span className="text-green-600">✅ Documents Signed</span>
) : (
  <span className="text-yellow-600">⏳ Waiting for Documents</span>
)}
```

### Fix 6: Enhance Client-Side Socket.IO Listeners

**File**: `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

Added comprehensive Socket.IO event listeners:

```typescript
// Listen for status changes
socket.on('auction:updated', ({ auction }) => {
  if (auction.status === 'awaiting_payment') {
    // Show payment options modal
    setShowPaymentModal(true);
  }
  // Update UI
  setAuctionData(auction);
});

// Listen for document generation
socket.on('auction:document-generation-complete', () => {
  // Refresh documents
  fetchDocuments();
});
```

## Testing

### Test 1: Concurrent Closure Prevention
```bash
# Terminal 1
curl -X POST http://localhost:3000/api/auctions/[id]/close

# Terminal 2 (immediately)
curl -X POST http://localhost:3000/api/auctions/[id]/close

# Expected: Second request returns "Auction closure already in progress"
```

### Test 2: Duplicate Payment Prevention
```bash
# Run diagnostic
npx tsx scripts/diagnose-auction-payment-flow.ts [auction-id]

# Expected: Only 1 payment record
```

### Test 3: Socket.IO Real-Time Updates
1. Open auction page in browser
2. Sign documents in another tab
3. Expected: Payment options appear without page refresh

## Rollout Plan

1. **Phase 1**: Deploy distributed lock fix (prevents new duplicates)
2. **Phase 2**: Run cleanup script to remove existing duplicates
3. **Phase 3**: Add unique constraint migration
4. **Phase 4**: Deploy Socket.IO and UI fixes

## Monitoring

Monitor these metrics after deployment:
- Duplicate payment records (should be 0)
- Auction closure API errors
- Socket.IO connection/disconnection rates
- User complaints about page refreshes

## Related Files

- `src/app/api/auctions/[id]/close/route.ts` - Closure API with distributed lock
- `src/features/auctions/services/closure.service.ts` - Closure service with idempotency
- `src/features/documents/services/document.service.ts` - Document signing with Socket.IO
- `src/components/vendor/payment-options.tsx` - Payment method selection
- `src/lib/socket/server.ts` - Socket.IO server
- `scripts/diagnose-auction-payment-flow.ts` - Diagnostic tool
- `scripts/cleanup-duplicate-payments.ts` - Cleanup script
