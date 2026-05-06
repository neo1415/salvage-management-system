# Hybrid Payment Amount Bug Fix

## Problem Summary

When using hybrid payment (wallet + Paystack), the system was storing the **full auction amount** in the payment record instead of just the **Paystack portion**. This caused the UI to ask the user to pay the full amount again after the wallet portion was already deducted.

## Root Cause

In `src/features/auction-deposit/services/payment.service.ts`, the `processHybridPayment` method was creating/updating payment records with `finalBid` (full amount) instead of `paystackPortion` (balance after wallet deduction).

### Example Scenario

User wins auction for ₦400,000:
- Deposit: ₦42,000 (frozen)
- Remaining: ₦358,000
- Wallet balance: ₦42,000
- **Hybrid payment breakdown:**
  - Wallet portion: ₦42,000
  - Paystack portion: ₦316,000 (₦358,000 - ₦42,000)

### What Was Happening (BUG)

1. User selects hybrid payment
2. System deducts ₦42,000 from wallet ✅
3. System creates payment record with amount = ₦400,000 ❌ (WRONG - should be ₦316,000)
4. User redirected to Paystack to pay ₦316,000 ✅
5. Paystack webhook fails (localhost refused to connect)
6. Payment stays pending with amount = ₦400,000
7. UI shows "Pay ₦400,000" even though ₦42,000 was already deducted from wallet ❌

## The Fix

### Code Changes

**File**: `src/features/auction-deposit/services/payment.service.ts`

**Line ~1103** (Update existing payment record):
```typescript
// BEFORE (BUG)
[payment] = await db
  .update(payments)
  .set({
    paymentMethod: 'paystack',
    paymentReference: idempotencyKey,
    updatedAt: new Date(),
  })
  .where(eq(payments.id, existingPaymentRecord.id))
  .returning();

// AFTER (FIXED)
[payment] = await db
  .update(payments)
  .set({
    amount: paystackPortion.toFixed(2), // ✅ FIXED: Update to Paystack portion
    paymentMethod: 'paystack',
    paymentReference: idempotencyKey,
    updatedAt: new Date(),
  })
  .where(eq(payments.id, existingPaymentRecord.id))
  .returning();
```

**Line ~1115** (Create new payment record):
```typescript
// BEFORE (BUG)
[payment] = await db
  .insert(payments)
  .values({
    auctionId,
    vendorId,
    amount: finalBid.toFixed(2), // ❌ WRONG - full amount
    paymentMethod: 'paystack',
    paymentReference: idempotencyKey,
    status: 'pending',
    paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  .returning();

// AFTER (FIXED)
[payment] = await db
  .insert(payments)
  .values({
    auctionId,
    vendorId,
    amount: paystackPortion.toFixed(2), // ✅ FIXED - Paystack portion only
    paymentMethod: 'paystack',
    paymentReference: idempotencyKey,
    status: 'pending',
    paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  .returning();
```

### Recovery Script

**File**: `scripts/fix-hybrid-payment-stuck.ts`

For users who got stuck with this bug, the script:
1. Refunds the wallet portion that was deducted
2. Cancels the pending payment record
3. Resets auction status to `awaiting_payment`
4. Allows user to retry payment with the fixed code

## Testing

### Test Case 1: Hybrid Payment with Sufficient Wallet Balance

**Setup:**
- Auction amount: ₦400,000
- Deposit: ₦42,000
- Remaining: ₦358,000
- Wallet balance: ₦100,000

**Expected:**
- Wallet portion: ₦100,000
- Paystack portion: ₦258,000
- Payment record amount: ₦258,000 ✅

### Test Case 2: Hybrid Payment with Partial Wallet Balance

**Setup:**
- Auction amount: ₦400,000
- Deposit: ₦42,000
- Remaining: ₦358,000
- Wallet balance: ₦42,000

**Expected:**
- Wallet portion: ₦42,000
- Paystack portion: ₦316,000
- Payment record amount: ₦316,000 ✅

### Test Case 3: Paystack Webhook Failure Recovery

**Setup:**
- User completes hybrid payment
- Paystack webhook fails (localhost refused to connect)

**Expected:**
- Payment record shows correct Paystack portion amount
- UI shows correct amount to pay (not full amount)
- User can retry payment without double-charging

## Related Issues

This bug is related to but different from:
- **Cache invalidation issue** (docs/AUCTION_CACHE_INVALIDATION_FIX.md) - That was about stale UI data
- **This issue** - Payment record storing wrong amount

Both issues can cause confusing UI behavior, but have different root causes.

## Monitoring

Watch for these log messages:
```
✅ Updating existing payment record: {id}
✅ Creating new payment record
```

And verify the payment amount matches the Paystack portion, not the full bid.

## Prevention

To prevent similar issues:
1. Always store the **actual amount being charged** in payment records
2. For hybrid payments, that's the Paystack portion, not the full amount
3. Add validation to ensure payment.amount matches the Paystack initialization amount
4. Add integration tests for hybrid payment flow

## Conclusion

The fix ensures that payment records accurately reflect the amount being charged via Paystack, preventing confusion when the UI displays payment amounts to users.

**Key Principle:** Payment records should store the **amount being charged through that payment method**, not the total auction amount.
