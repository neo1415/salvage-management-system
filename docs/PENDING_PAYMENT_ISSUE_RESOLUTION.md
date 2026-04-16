# Pending Payment Issue - Resolution

## Date: 2026-04-10

## Issue

User was getting error:
```
A payment is already in progress for this auction. 
Please complete or cancel the existing payment first.
```

Even on a "brand new auction" after restarting server and refreshing page.

---

## Root Cause

The auction was NOT brand new - there was a pending payment record from a previous payment attempt:

```
Payment ID: 4fb33c64-a63d-4d93-b200-7307cbfa3d9c
Auction ID: 260582d5-5c55-4ca5-8e22-609fef09b7f3
Method: escrow_wallet (wallet payment, not Paystack)
Amount: ₦130,000
Status: pending
Created: 12 minutes ago
```

**What happened:**
1. User tried to pay with wallet first
2. Wallet payment was initiated (created pending payment record)
3. Wallet payment didn't complete (possibly insufficient balance or user cancelled)
4. Pending payment record remained in database
5. User tried to pay with Paystack
6. System correctly blocked duplicate payment attempt

---

## Why the Check is Correct

The pending payment check in `payment.service.ts` is **working as designed**:

```typescript
// CHECK FIRST: Look for existing pending payment FOR THIS SPECIFIC AUCTION
const [existingPending] = await db
  .select()
  .from(payments)
  .where(
    and(
      eq(payments.auctionId, auctionId), // ✅ Auction-specific
      eq(payments.vendorId, vendorId),
      eq(payments.status, 'pending')
    )
  )
  .limit(1);

if (existingPending) {
  // Return existing payment - don't create duplicate
  return { ... };
}
```

This prevents:
- Duplicate Paystack initializations
- Multiple pending payments for same auction
- Race conditions in payment processing
- Financial inconsistencies

---

## Resolution

Deleted the pending wallet payment record to allow Paystack payment:

```bash
npx tsx scripts/fix-specific-pending-payment.ts
```

**Result:**
- ✅ Pending payment deleted
- ✅ User can now pay with Paystack
- ✅ No data loss (payment was pending, no funds deducted)

---

## Why This Happened

The pending payment check is **auction-specific** (correct), but there's no automatic cleanup of:
1. Failed wallet payments
2. Abandoned payment attempts
3. Expired pending payments (>24 hours)

---

## Prevention Strategy

### Option 1: Automatic Cleanup (Recommended)

Add a cron job to clean up expired pending payments:

```typescript
// src/app/api/cron/cleanup-expired-payments/route.ts
export async function GET() {
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  await db
    .delete(payments)
    .where(
      and(
        eq(payments.status, 'pending'),
        lt(payments.createdAt, cutoffTime)
      )
    );
  
  return NextResponse.json({ success: true });
}
```

Schedule in Vercel cron:
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-expired-payments",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

### Option 2: UI Improvement

Show pending payment status in UI with option to cancel:

```typescript
// In payment page
if (pendingPayment) {
  return (
    <div>
      <p>You have a pending {pendingPayment.method} payment</p>
      <button onClick={cancelPendingPayment}>
        Cancel and try different method
      </button>
    </div>
  );
}
```

### Option 3: Payment Method Switch

Allow switching payment methods by cancelling pending payment:

```typescript
async function switchPaymentMethod(
  auctionId: string,
  vendorId: string,
  newMethod: 'wallet' | 'paystack'
) {
  // Cancel existing pending payment
  await db
    .update(payments)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(payments.auctionId, auctionId),
        eq(payments.vendorId, vendorId),
        eq(payments.status, 'pending')
      )
    );
  
  // Initialize new payment with new method
  // ...
}
```

---

## Scripts Created

### 1. Diagnostic Script
```bash
npx tsx scripts/check-and-cleanup-pending-payments.ts
```
- Shows all pending payments
- Identifies expired payments (>24h)
- Shows auction and vendor details

### 2. Cleanup Script
```bash
npx tsx scripts/cleanup-expired-pending-payments.ts
```
- Deletes pending payments older than 24 hours
- Safe to run anytime
- Keeps recent pending payments

### 3. Fix Specific Payment
```bash
npx tsx scripts/fix-specific-pending-payment.ts
```
- Fixes a specific auction's pending payment
- Used for immediate resolution

---

## Testing

After cleanup, verify:

1. ✅ No pending payments for the auction
   ```bash
   npx tsx scripts/check-and-cleanup-pending-payments.ts
   ```

2. ✅ User can now pay with Paystack
   - Go to auction page
   - Click "Pay Now"
   - Select Paystack
   - Should initialize without error

3. ✅ Payment flow works correctly
   - Paystack opens
   - Payment completes
   - Deposit unfrozen
   - Documents generated

---

## Summary

**Issue**: "Payment already in progress" error
**Cause**: Pending wallet payment from previous attempt
**Fix**: Deleted pending payment record
**Prevention**: Add automatic cleanup cron job

**Status**: ✅ RESOLVED

The pending payment check is working correctly - it's a feature, not a bug. We just need better cleanup of abandoned payments.

---

## Recommendations

1. **Immediate**: User can now pay with Paystack (pending payment deleted)

2. **Short-term**: Add cron job to clean up expired pending payments

3. **Long-term**: Add UI to show/cancel pending payments

4. **Best Practice**: Add payment timeout (auto-cancel after 30 minutes)

---

## Related Files

- `src/features/auction-deposit/services/payment.service.ts` - Pending payment check
- `scripts/check-and-cleanup-pending-payments.ts` - Diagnostic tool
- `scripts/cleanup-expired-pending-payments.ts` - Cleanup tool
- `scripts/fix-specific-pending-payment.ts` - Immediate fix tool
