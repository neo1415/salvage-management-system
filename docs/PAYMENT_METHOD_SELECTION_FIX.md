# Payment Method Selection Fix

## Problem Summary

User was getting error: "A payment is already in progress for this auction. Please complete or cancel the existing payment first."

### Root Causes

1. **Payment created during auction closure**: When auction closes, a payment record is created with `paymentMethod: escrow_wallet` and `status: pending`
2. **Overly strict check**: The `initializePaystackPayment()` method was checking for ANY pending payment, not just Paystack payments
3. **User hasn't selected method yet**: The escrow_wallet payment is a placeholder - user hasn't actually chosen a payment method

## Solution Implemented

### 1. Fixed Payment Method Check

**File**: `src/features/auction-deposit/services/payment.service.ts`

**Changes**:
- Modified `initializePaystackPayment()` to only check for pending PAYSTACK payments
- Added logic to delete pending escrow_wallet payments when user selects Paystack
- This allows users to select Paystack even if a placeholder payment exists from closure

**Before**:
```typescript
// Blocked if ANY pending payment exists
const [existingPending] = await db
  .select()
  .from(payments)
  .where(
    and(
      eq(payments.auctionId, auctionId),
      eq(payments.vendorId, vendorId),
      eq(payments.status, 'pending') // ❌ Too broad
    )
  )
  .limit(1);
```

**After**:
```typescript
// Only block if pending PAYSTACK payment exists
const [existingPending] = await db
  .select()
  .from(payments)
  .where(
    and(
      eq(payments.auctionId, auctionId),
      eq(payments.vendorId, vendorId),
      eq(payments.status, 'pending'),
      eq(payments.paymentMethod, 'paystack') // ✅ Specific check
    )
  )
  .limit(1);

// Delete any pending escrow_wallet payment from closure
const [escrowPayment] = await db
  .select()
  .from(payments)
  .where(
    and(
      eq(payments.auctionId, auctionId),
      eq(payments.vendorId, vendorId),
      eq(payments.status, 'pending'),
      eq(payments.paymentMethod, 'escrow_wallet')
    )
  )
  .limit(1);

if (escrowPayment) {
  await db.delete(payments).where(eq(payments.id, escrowPayment.id));
}
```

### 2. Socket.IO Status Change Broadcast

**File**: `src/features/documents/services/document.service.ts`

**Status**: Already implemented (line 470-510)

When all documents are signed, the auction status changes from "closed" → "awaiting_payment" and a Socket.IO broadcast is sent:

```typescript
// Update auction status to awaiting_payment
const [updatedAuction] = await db
  .update(auctions)
  .set({ 
    status: 'awaiting_payment',
    updatedAt: new Date()
  })
  .where(eq(auctions.id, signedDoc.auctionId))
  .returning();

// Broadcast status change via Socket.IO
const { broadcastAuctionUpdate } = await import('@/lib/socket/server');
await broadcastAuctionUpdate(signedDoc.auctionId, updatedAuction);
```

This ensures the payment button appears immediately without page refresh.

## Payment Flow

### Complete Flow

1. **Auction Closes**
   - Status: active → closed
   - Documents generated (bill_of_sale, liability_waiver)
   - Payment record created with `paymentMethod: escrow_wallet`, `status: pending` (placeholder)
   - Socket.IO broadcast: `auction:closed`

2. **User Signs Documents**
   - User signs bill_of_sale
   - User signs liability_waiver
   - When all signed → status: closed → awaiting_payment
   - Socket.IO broadcast: `auction:updated` (status change)
   - Payment button appears (no refresh needed)

3. **User Selects Payment Method**
   - User clicks "Pay with Paystack"
   - System checks for pending Paystack payment (none found)
   - System deletes pending escrow_wallet payment (placeholder)
   - System creates new Paystack payment record
   - User redirected to Paystack payment page

4. **Payment Complete**
   - Paystack webhook received
   - Payment status: pending → verified
   - Deposit unfrozen
   - Pickup authorization generated
   - Socket.IO broadcast: `auction:updated` (payment complete)

## Testing

### Test Script

Run the diagnostic script to check payment method selection readiness:

```bash
npx tsx scripts/test-payment-method-selection.ts <auctionId>
```

This will check:
- Auction status (should be awaiting_payment)
- Document signing status (all required docs signed)
- Existing payments (pending Paystack or escrow_wallet)
- Whether user can select payment method

### Expected Output

```
✅ READY: User can select payment method
   - Paystack payment initialization will succeed
   - Any pending escrow_wallet payment will be deleted
```

## Socket.IO Real-Time Updates

### Status Changes Broadcast

All critical status changes are now broadcast via Socket.IO:

1. **Auction Closing**: `auction:closing` (document generation starting)
2. **Document Generated**: `auction:document-generated` (each document)
3. **Documents Complete**: `auction:document-generation-complete` (all docs ready)
4. **Status Change**: `auction:updated` (closed → awaiting_payment)
5. **Payment Complete**: `auction:updated` (payment verified)

### Client-Side Listeners

**File**: `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

The client listens for these events and updates the UI in real-time:

```typescript
useSocket('auction:updated', (data) => {
  if (data.auctionId === auctionId) {
    // Refresh auction data
    fetchAuction();
  }
});
```

## Files Modified

1. `src/features/auction-deposit/services/payment.service.ts`
   - Fixed payment method check in `initializePaystackPayment()`
   - Added logic to delete placeholder escrow_wallet payments

2. `src/features/documents/services/document.service.ts`
   - Already had Socket.IO broadcast for status change (no changes needed)

3. `src/lib/socket/server.ts`
   - Already had all broadcast functions (no changes needed)

## Files Created

1. `scripts/test-payment-method-selection.ts`
   - Diagnostic script to test payment method selection flow

2. `docs/PAYMENT_METHOD_SELECTION_FIX.md`
   - This documentation file

## Verification Steps

1. Close an auction (or wait for auto-closure)
2. Sign all required documents (bill_of_sale, liability_waiver)
3. Verify status changes to "awaiting_payment" WITHOUT page refresh
4. Verify payment button appears WITHOUT page refresh
5. Click "Pay with Paystack"
6. Verify no "payment already in progress" error
7. Verify redirect to Paystack payment page
8. Complete payment on Paystack
9. Verify redirect back to auction page
10. Verify pickup authorization appears WITHOUT page refresh

## Key Improvements

1. **No more "payment already in progress" error**: Users can now select Paystack even if placeholder payment exists
2. **Real-time UI updates**: Status changes broadcast via Socket.IO, no refresh needed
3. **Clean payment flow**: Placeholder payments automatically deleted when user selects method
4. **Better diagnostics**: Test script helps identify issues in payment flow

## Notes

- The escrow_wallet payment created during closure is a PLACEHOLDER
- It's automatically deleted when user selects Paystack
- This is expected behavior and not a bug
- Socket.IO broadcasts ensure UI updates in real-time
- Polling fallback still works for users without WebSocket connection
