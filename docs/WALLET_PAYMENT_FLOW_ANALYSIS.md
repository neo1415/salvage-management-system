# Wallet Payment Flow Analysis

## Overview
This document explains how wallet-only payments work in the auction deposit system, comparing them to Paystack payments and identifying how the system verifies successful payment completion.

## Payment Flow Comparison

### Paystack Payment Flow
1. **User initiates payment** → Paystack payment page
2. **User completes payment** → Paystack processes card/bank transfer
3. **Paystack webhook fires** → `POST /api/webhooks/paystack`
4. **Webhook handler**:
   - Marks payment as `verified`
   - Calls `escrowService.releaseFunds()` to transfer money to finance
   - Updates auction status to `closed`
   - Unfreezes non-winner deposits
   - Generates pickup authorization
   - Invalidates cache
5. **Auto-verification**: Payment is automatically verified by webhook

### Wallet Payment Flow
1. **User initiates payment** → `POST /api/auctions/[id]/payment/wallet`
2. **Payment service processes immediately**:
   - Deducts remaining amount from available balance
   - Unfreezes deposit amount
   - Marks payment as `verified` (auto-verified)
   - Calls `escrowService.releaseFunds()` to transfer money to finance
   - Updates auction status to `closed`
   - Unfreezes non-winner deposits
   - Generates pickup authorization
   - Invalidates cache
3. **Auto-verification**: Payment is automatically verified on successful deduction

## Key Differences

| Aspect | Paystack | Wallet |
|--------|----------|--------|
| **Payment Method** | External (card/bank) | Internal (wallet balance) |
| **Verification Trigger** | Webhook from Paystack | Immediate on deduction |
| **Verification Status** | `autoVerified: true` | `autoVerified: true` |
| **Fund Release** | After webhook | Immediately after deduction |
| **Finance Visibility** | After webhook processes | Immediately |
| **User Experience** | Redirect → Wait → Webhook | Instant |

## How Wallet Payment is Auto-Verified

### 1. Atomic Transaction
```typescript
// In processWalletPayment()
const result = await db.transaction(async (tx) => {
  // Lock wallet for update
  const [wallet] = await tx
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, vendorId))
    .for('update')
    .limit(1);

  // Verify sufficient balance
  if (currentAvailable < remainingAmount) {
    throw new Error('Insufficient available balance');
  }

  // Deduct from wallet
  const newBalance = currentBalance - remainingAmount - depositAmount;
  const newAvailable = currentAvailable - remainingAmount;
  const newFrozen = currentFrozen - depositAmount;

  // Update wallet
  await tx.update(escrowWallets).set({
    balance: newBalance.toFixed(2),
    availableBalance: newAvailable.toFixed(2),
    frozenAmount: newFrozen.toFixed(2),
  });

  // Mark payment as verified
  [payment] = await tx.update(payments).set({
    status: 'verified',
    autoVerified: true,
    verifiedAt: new Date(),
  });
});
```

**Key Point**: The wallet deduction and payment verification happen in the SAME database transaction. If the deduction succeeds, the payment is automatically verified. There's no separate verification step needed.

### 2. Fund Release to Finance
```typescript
// CRITICAL: Release funds to finance (same as Paystack webhook)
console.log(`💰 Releasing deposit funds to finance...`);
const { escrowService } = await import('@/features/payments/services/escrow.service');

await escrowService.releaseFunds(
  vendorId,
  depositAmount,
  auctionId,
  'system' // userId for audit trail
);
```

**What `releaseFunds()` does**:
1. **Unfreezes the deposit** from vendor wallet
2. **Debits the amount** from vendor wallet
3. **Transfers money to NEM Insurance** via Paystack Transfers API
4. **Creates wallet transactions** for audit trail:
   - Debit transaction: `TRANSFER_{auctionId}`
   - Unfreeze transaction: `UNFREEZE_{auctionId}`
5. **Records ledger entry** for reconciliation

### 3. Auction Status Update
```typescript
// Update auction status to closed (payment complete)
await db.update(auctions).set({
  status: 'closed',
  updatedAt: new Date(),
}).where(eq(auctions.id, auctionId));
```

**Key Point**: The auction status changes to `closed` immediately after wallet payment, just like with Paystack webhook.

### 4. Finance Dashboard Visibility
The payment appears in the finance dashboard because:
- Payment status is `verified`
- Payment has `autoVerified: true`
- Auction status is `closed`
- Fund release created debit transaction in `walletTransactions`

## Verification Mechanism

### How the System Knows Payment Succeeded

**For Wallet Payments**:
1. ✅ **Database transaction succeeds** → Wallet deduction worked
2. ✅ **Payment status = 'verified'** → Payment is complete
3. ✅ **autoVerified = true** → No manual verification needed
4. ✅ **verifiedAt timestamp** → Exact time of verification
5. ✅ **Auction status = 'closed'** → Payment flow complete
6. ✅ **Debit transaction exists** → Money transferred to finance
7. ✅ **Pickup authorization generated** → Vendor can collect asset

**For Paystack Payments**:
1. ✅ **Webhook received** → Paystack confirmed payment
2. ✅ **Payment status = 'verified'** → Payment is complete
3. ✅ **autoVerified = true** → No manual verification needed
4. ✅ **verifiedAt timestamp** → Exact time of verification
5. ✅ **Auction status = 'closed'** → Payment flow complete
6. ✅ **Debit transaction exists** → Money transferred to finance
7. ✅ **Pickup authorization generated** → Vendor can collect asset

## Common Issues & Solutions

### Issue 1: Payment Not Showing in Finance Dashboard
**Symptoms**:
- Wallet deducted
- Payment status still `pending`
- Auction status not `closed`

**Root Cause**: Fund release failed after wallet deduction

**Solution**: The code has atomic rollback:
```typescript
try {
  // Mark payment verified
  await db.update(payments).set({ status: 'verified' });
  
  // Release funds
  await escrowService.releaseFunds(...);
} catch (error) {
  // ROLLBACK: Mark payment as pending again
  await db.update(payments).set({
    status: 'pending',
    autoVerified: false,
    verifiedAt: null,
  });
  throw error;
}
```

### Issue 2: Duplicate Payments
**Symptoms**:
- Multiple payment records for same auction
- Wallet deducted multiple times

**Prevention**: Idempotency check
```typescript
// Check for existing payment with same idempotency key
const existingPayment = await this.checkIdempotency(auctionId, idempotencyKey);
if (existingPayment) {
  return existingPayment; // Return existing, don't create new
}
```

### Issue 3: Frozen Deposit Not Released
**Symptoms**:
- Payment complete
- Deposit still frozen in wallet

**Root Cause**: `releaseFunds()` not called or failed

**Verification**:
```sql
-- Check if debit transaction exists
SELECT * FROM wallet_transactions 
WHERE wallet_id = 'vendor_wallet_id' 
AND type = 'debit' 
AND reference LIKE 'TRANSFER_%';

-- Check if unfreeze transaction exists
SELECT * FROM wallet_transactions 
WHERE wallet_id = 'vendor_wallet_id' 
AND type = 'unfreeze' 
AND reference LIKE 'UNFREEZE_%';
```

## Payment Verification Checklist

To verify a wallet payment succeeded:

1. ✅ **Check payment record**:
   ```sql
   SELECT id, status, auto_verified, verified_at, payment_method
   FROM payments
   WHERE auction_id = 'auction_id' AND vendor_id = 'vendor_id';
   ```
   - Status should be `verified`
   - `auto_verified` should be `true`
   - `verified_at` should have timestamp

2. ✅ **Check auction status**:
   ```sql
   SELECT id, status FROM auctions WHERE id = 'auction_id';
   ```
   - Status should be `closed`

3. ✅ **Check wallet transactions**:
   ```sql
   SELECT * FROM wallet_transactions
   WHERE wallet_id = 'vendor_wallet_id'
   AND (reference LIKE 'TRANSFER_%' OR reference LIKE 'UNFREEZE_%')
   ORDER BY created_at DESC;
   ```
   - Should have debit transaction (money to finance)
   - Should have unfreeze transaction (deposit released)

4. ✅ **Check wallet balance**:
   ```sql
   SELECT balance, available_balance, frozen_amount
   FROM escrow_wallets
   WHERE vendor_id = 'vendor_id';
   ```
   - Balance should be reduced by (remaining_amount + deposit_amount)
   - Available balance should be reduced by remaining_amount
   - Frozen amount should be reduced by deposit_amount

5. ✅ **Check pickup authorization**:
   ```sql
   SELECT * FROM documents
   WHERE auction_id = 'auction_id'
   AND document_type = 'pickup_authorization';
   ```
   - Document should exist
   - Status should be `generated`

## Comparison with Paystack Webhook

Both payment methods follow the SAME post-payment flow:

```typescript
// WALLET PAYMENT (immediate)
await paymentService.processWalletPayment({...});
  ↓
1. Deduct from wallet (atomic transaction)
2. Mark payment as verified
3. Release funds to finance
4. Update auction to closed
5. Unfreeze non-winner deposits
6. Generate pickup authorization
7. Invalidate cache

// PAYSTACK PAYMENT (webhook-triggered)
await paymentService.handlePaystackWebhook(reference, true);
  ↓
1. Verify webhook signature
2. Mark payment as verified
3. Release funds to finance
4. Update auction to closed
5. Unfreeze non-winner deposits
6. Generate pickup authorization
7. Invalidate cache
```

**Key Insight**: The only difference is WHEN the flow executes:
- **Wallet**: Immediately on API call
- **Paystack**: After webhook received

Both use the SAME `escrowService.releaseFunds()` method to transfer money to finance.

## Security & Reliability

### Wallet Payment Security
1. **IDOR Protection**: Verifies user is the auction winner
2. **Balance Verification**: Checks sufficient available balance
3. **Atomic Transactions**: All-or-nothing database operations
4. **Wallet Locking**: `FOR UPDATE` prevents race conditions
5. **Invariant Verification**: Ensures balance = available + frozen
6. **Idempotency**: Prevents duplicate payments

### Reliability Features
1. **Automatic Rollback**: If fund release fails, payment reverts to pending
2. **Duplicate Prevention**: Idempotency key prevents double-charging
3. **Audit Trail**: All operations logged in wallet_transactions
4. **Cache Invalidation**: Ensures UI shows updated status
5. **Non-blocking Notifications**: Notification failures don't block payment

## Conclusion

**Yes, wallet payments are auto-verified!**

The system knows a wallet payment succeeded because:
1. The database transaction completed successfully
2. The payment status is `verified` with `autoVerified: true`
3. The auction status changed to `closed`
4. Fund release created debit and unfreeze transactions
5. Pickup authorization was generated

There is NO separate verification step needed for wallet payments. The successful wallet deduction IS the verification. This is different from Paystack where we wait for a webhook, but the end result is identical: money transferred to finance, payment verified, auction closed.

## Related Files
- `src/features/auction-deposit/services/payment.service.ts` - Main payment logic
- `src/app/api/auctions/[id]/payment/wallet/route.ts` - Wallet payment API
- `src/features/payments/services/escrow.service.ts` - Fund release logic
- `src/app/api/webhooks/paystack/route.ts` - Paystack webhook handler
