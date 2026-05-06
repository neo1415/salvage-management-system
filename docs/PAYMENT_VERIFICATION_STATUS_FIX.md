# Payment Verification Status Fix

## Problem

The payment webhook handler was incorrectly setting the auction status to `'closed'` after payment verification, which broke the `hasVerifiedPayment` logic in the UI.

### Incorrect Behavior (Before Fix)

```
Auction Status: 'closed'
Payment Status: 'verified'
hasVerifiedPayment: false ❌ WRONG!
```

**Result**: The green "Payment Verified" banner did not appear, and the UI showed incorrect state.

### Correct Behavior (After Fix)

```
Auction Status: 'awaiting_payment'
Payment Status: 'verified'
hasVerifiedPayment: true ✅ CORRECT!
```

**Result**: The green "Payment Verified" banner appears, "Pay Now" button is hidden, and polling shows correct state.

## Root Cause

The webhook handler in `payment.service.ts` was changing the auction status to `'closed'` after payment verification:

```typescript
// ❌ WRONG CODE (before fix)
await db
  .update(auctions)
  .set({
    status: 'closed',  // ❌ This breaks hasVerifiedPayment logic
    updatedAt: new Date(),
  })
  .where(eq(auctions.id, auctionId));
```

This broke the `hasVerifiedPayment` computation in the API routes, which only works when the auction status is `'awaiting_payment'`:

```typescript
// From src/app/api/auctions/[id]/route.ts
let hasVerifiedPayment = false;

if (auction.status === 'awaiting_payment') {  // ✅ Only checks when status is 'awaiting_payment'
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, auction.id),
        eq(payments.status, 'verified')
      )
    )
    .limit(1);
  hasVerifiedPayment = !!payment;
}
```

## Solution

### 1. Fixed Payment Service

Updated both `handlePaystackWebhook` and `processWalletPayment` methods to **NOT** change the auction status:

```typescript
// ✅ CORRECT CODE (after fix)
// Keep auction status as 'awaiting_payment' (DO NOT change to 'closed')
// CRITICAL: The auction status must remain 'awaiting_payment' so that:
// - The API can compute hasVerifiedPayment: true
// - The UI shows the green "Payment Verified" banner
// - The "Pay Now" button is hidden
console.log(`✅ Auction status remains 'awaiting_payment' (payment verified)`);
```

### 2. Fixed Existing Test Payment

Created and ran `scripts/fix-test-payment-status.ts` to fix the test payment (REF-5677):

```bash
npx tsx scripts/fix-test-payment-status.ts
```

This script:
1. Found the payment with reference `PAY-962dc370-973f-49b8-a533-8286b61c0271-1777989845198`
2. Changed the auction status from `'closed'` to `'awaiting_payment'`
3. Verified that `hasVerifiedPayment` is now computed as `true`

## Files Changed

### Modified Files

1. **src/features/auction-deposit/services/payment.service.ts**
   - `handlePaystackWebhook()` method (line ~707)
   - `processWalletPayment()` method (line ~317)
   - Removed code that sets auction status to `'closed'`
   - Added comments explaining why status must remain `'awaiting_payment'`

### New Files

1. **scripts/fix-test-payment-status.ts**
   - Script to fix existing payments with incorrect auction status
   - Can be reused if this issue occurs again

2. **docs/PAYMENT_VERIFICATION_STATUS_FIX.md** (this file)
   - Documentation of the issue and fix

## How hasVerifiedPayment Works

The `hasVerifiedPayment` field is **computed dynamically** by the API routes, not stored in the database:

### API Routes That Compute It

1. **GET /api/auctions/[id]** (`src/app/api/auctions/[id]/route.ts`)
2. **GET /api/auctions/[id]/poll** (`src/app/api/auctions/[id]/poll/route.ts`)

### Computation Logic

```typescript
let hasVerifiedPayment = false;

if (auction.status === 'awaiting_payment') {
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, auction.id),
        eq(payments.status, 'verified')
      )
    )
    .limit(1);
  hasVerifiedPayment = !!payment;
}
```

**Key Point**: The auction status MUST be `'awaiting_payment'` for this logic to work!

### UI Usage

The UI uses `hasVerifiedPayment` to:

1. **Show green "Payment Verified" banner** when `hasVerifiedPayment === true`
2. **Hide "Pay Now" button** when `hasVerifiedPayment === true`
3. **Update realtime via polling** (every 5 seconds)

```typescript
// From src/app/(dashboard)/vendor/auctions/[id]/page.tsx

// Show green banner when payment is verified
{auction.status === 'awaiting_payment' && 
 session?.user?.vendorId && 
 auction.currentBidder === session.user.vendorId &&
 hasVerifiedPayment && (
  <div className="bg-gradient-to-r from-green-500 to-emerald-600 ...">
    ✅ Payment Verified
  </div>
)}

// Show "Pay Now" button only when payment is NOT verified
{auction.status === 'awaiting_payment' && 
 session?.user?.vendorId && 
 auction.currentBidder === session.user.vendorId &&
 !hasVerifiedPayment && (
  <div className="mb-6">
    <button>Pay Now</button>
  </div>
)}
```

## Testing

### Manual Test

1. Create a test payment using the simulation script:
   ```bash
   npx tsx scripts/simulate-test-payment-webhook.ts
   ```

2. Check the auction status in the database:
   ```sql
   SELECT id, status FROM auctions WHERE id = '962dc370-973f-49b8-a533-8286b61c0271';
   ```
   
   **Expected**: `status = 'awaiting_payment'` (NOT 'closed')

3. Check the payment status:
   ```sql
   SELECT id, status, payment_reference FROM payments 
   WHERE payment_reference = 'PAY-962dc370-973f-49b8-a533-8286b61c0271-1777989845198';
   ```
   
   **Expected**: `status = 'verified'`

4. Check the API response:
   ```bash
   curl http://localhost:3000/api/auctions/962dc370-973f-49b8-a533-8286b61c0271
   ```
   
   **Expected**: `hasVerifiedPayment: true`

5. Check the UI:
   - Navigate to the auction page
   - **Expected**: Green "Payment Verified" banner appears
   - **Expected**: "Pay Now" button is hidden
   - **Expected**: Console logs show `hasVerifiedPayment: true`

### Automated Test

The existing integration tests should pass with this fix:

```bash
npm run test:integration
```

## Comparison: Before vs After

### Before Fix (WRONG)

```
📊 Poll: Auction 962dc370-973f-49b8-a533-8286b61c0271 updated
   - Current bid: ₦5,900,000
   - Status: closed                    ❌ WRONG!
   - hasVerifiedPayment: false         ❌ WRONG!
✅ Auction state updated with hasVerifiedPayment: false
```

**UI Result**: No green banner, "Pay Now" button still visible

### After Fix (CORRECT)

```
📊 Poll: Auction 962dc370-973f-49b8-a533-8286b61c0271 updated
   - Current bid: ₦5,900,000
   - Status: awaiting_payment          ✅ CORRECT!
   - hasVerifiedPayment: true          ✅ CORRECT!
✅ Auction state updated with hasVerifiedPayment: true
```

**UI Result**: Green "Payment Verified" banner appears, "Pay Now" button hidden

## Reference Payment (RGA-3700)

The correct behavior was already working for payment RGA-3700:

```
📊 Poll: Auction c1c20342-25ba-4d1a-9132-0d79ba0efd42 updated
   - Current bid: ₦350,000
   - Status: awaiting_payment          ✅ CORRECT!
   - hasVerifiedPayment: true          ✅ CORRECT!
```

This payment was processed correctly because it was created before the bug was introduced.

## Future Prevention

To prevent this issue from happening again:

1. **Never change auction status to 'closed' in payment webhook handlers**
2. **Always keep status as 'awaiting_payment' after payment verification**
3. **Let the admin manually close the auction after pickup confirmation**
4. **Add integration tests that verify `hasVerifiedPayment` logic**

## Related Files

- `src/features/auction-deposit/services/payment.service.ts` - Payment service (fixed)
- `src/app/api/auctions/[id]/route.ts` - API route that computes `hasVerifiedPayment`
- `src/app/api/auctions/[id]/poll/route.ts` - Polling API route
- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - UI component
- `src/hooks/use-socket.ts` - Socket hook for realtime updates
- `scripts/fix-test-payment-status.ts` - Fix script for existing payments
- `scripts/simulate-test-payment-webhook.ts` - Test payment simulation script

## Summary

✅ **Fixed**: Payment webhook no longer changes auction status to 'closed'  
✅ **Fixed**: Auction status remains 'awaiting_payment' after payment verification  
✅ **Fixed**: `hasVerifiedPayment` is now computed correctly as `true`  
✅ **Fixed**: Green "Payment Verified" banner now appears in UI  
✅ **Fixed**: "Pay Now" button is now hidden after payment verification  
✅ **Fixed**: Existing test payment (REF-5677) corrected using fix script  

The payment verification flow now works correctly! 🎉
