# Transaction History - Paystack Payment Fix

## Problem

Transaction history doesn't show "debit" events for Paystack payments. Only "unfreeze" events are visible.

### What Users See
```
Transaction History:
- unfreeze | ₦100,000 | Deposit unfrozen after paystack payment completion
```

### What Users Should See
```
Transaction History:
- unfreeze | ₦100,000 | Deposit unfrozen after paystack payment completion
- debit | ₦390,000 | Payment to NEM Insurance via Paystack
```

## Root Cause

The `handlePaystackWebhook` function in `payment.service.ts`:
1. ✅ Creates "unfreeze" event in `depositEvents` table
2. ❌ Does NOT create "debit" event in `walletTransactions` table

This is because for Paystack payments, the money is paid directly to NEM Insurance via Paystack, not from the wallet. However, for transparency and record-keeping, we should still show this as a debit in the transaction history.

## Current Flow

```
Paystack Payment Webhook
  ↓
handlePaystackWebhook()
  ↓
1. Unfreeze deposit (₦100,000)
   - Creates "unfreeze" in depositEvents ✅
   - Updates wallet: frozen ₦410,000 → ₦310,000 ✅
  ↓
2. Mark payment as verified ✅
  ↓
3. Call triggerFundReleaseOnDocumentCompletion()
   - This is designed for escrow wallet payments
   - For Paystack, it does nothing (money already paid)
  ↓
4. Generate pickup authorization ✅
  ↓
END - NO DEBIT RECORDED ❌
```

## The Fix

Add a "debit" transaction to `walletTransactions` table when Paystack payment is verified, for record-keeping purposes.

### Location
`src/features/auction-deposit/services/payment.service.ts`
Function: `handlePaystackWebhook`

### What to Add

After unfreezing the deposit and before updating payment status, add:

```typescript
// Record payment debit in wallet transactions for transparency
// Note: For Paystack payments, money was paid directly to NEM Insurance
// This is a record-keeping entry to show the payment in transaction history
const paymentAmount = parseFloat(payment.amount);

await tx.insert(walletTransactions).values({
  walletId: wallet.id,
  type: 'debit',
  amount: paymentAmount.toFixed(2),
  balanceAfter: newBalance.toFixed(2), // Balance after unfreeze
  reference: `PAYMENT_${auctionId.substring(0, 8)}_${Date.now()}`,
  description: `Payment of ₦${paymentAmount.toLocaleString()} to NEM Insurance via Paystack for auction ${auctionId.substring(0, 8)}`,
});
```

### Why This Works

1. The debit transaction shows in the merged transaction history
2. Users can see both the deposit unfreeze AND the payment debit
3. The balance is correct (already updated during unfreeze)
4. The description clearly states it was paid via Paystack
5. Finance officers can track all payments in one place

## Testing

1. Make a Paystack payment via ngrok webhook
2. Check transaction history API:
   ```bash
   curl http://localhost:3000/api/vendors/{vendorId}/wallet/deposit-history
   ```
3. Should see BOTH events:
   - "unfreeze" event (deposit unfrozen)
   - "debit" event (payment to NEM Insurance)

## Alternative Approach (Not Recommended)

We could skip creating the debit transaction and instead:
- Show Paystack payments separately in the UI
- Add a "Payments" section distinct from "Wallet Transactions"

**Why not:** This creates confusion and inconsistency. Users expect to see all money movements in one place.

## Impact

- ✅ Transaction history will be complete
- ✅ Users can see where their money went
- ✅ Finance officers can track all payments
- ✅ Audit trail is complete
- ✅ No breaking changes to existing code

## Files to Modify

1. `src/features/auction-deposit/services/payment.service.ts`
   - Function: `handlePaystackWebhook`
   - Add debit transaction after unfreeze

## Related Issues

- Pickup modal not showing (separate issue - notification not created)
- Wallet/hybrid payment options not working (separate issue - to investigate)
