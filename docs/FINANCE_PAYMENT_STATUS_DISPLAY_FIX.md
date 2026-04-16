# Finance Payment Status Display Fix

## Problem

On the Finance Officer payments page, Approve/Reject buttons were showing for a payment with:
- Status: `pending`
- Payment Method: `paystack`
- Auction Status: `awaiting_payment`

At this stage, the vendor hasn't even completed the Paystack payment yet! The buttons should only show when payment is actually completed and needs manual verification.

## Root Cause

The condition for showing Approve/Reject buttons was:

```typescript
{payment.status === 'pending' && 
 !(payment.paymentMethod === 'escrow_wallet' && payment.escrowStatus === 'frozen') && (
```

This only excluded escrow_wallet payments with frozen status (waiting for documents), but didn't exclude Paystack payments where the vendor hasn't completed payment yet (auction status is `awaiting_payment`).

## Solution

### 1. Updated Button Display Logic

**File**: `src/app/(dashboard)/finance/payments/page.tsx`

Added check for Paystack payments with `awaiting_payment` status:

```typescript
{payment.status === 'pending' && 
 !(payment.paymentMethod === 'escrow_wallet' && payment.escrowStatus === 'frozen') &&
 !(payment.paymentMethod === 'paystack' && payment.auctionStatus === 'awaiting_payment') && (
```

### 2. Added Waiting Message for Paystack Payments

Added a blue info box for Paystack payments that are awaiting payment:

```typescript
{payment.status === 'pending' && 
 payment.paymentMethod === 'paystack' && 
 payment.auctionStatus === 'awaiting_payment' && (
  <div className="w-full sm:w-auto sm:ml-4 flex flex-col items-start sm:items-end">
    <div className="w-full sm:w-auto px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
      <p className="text-blue-800 font-medium">⏳ Awaiting Payment</p>
      <p className="text-blue-600 text-xs mt-1">
        Vendor must complete Paystack payment
      </p>
    </div>
  </div>
)}
```

### 3. Added Auction Status to API Response

**File**: `src/app/api/finance/payments/route.ts`

Added `auctionStatus` field to the payment response:

```typescript
const base = {
  id: payment.id,
  auctionId: payment.auctionId,
  auctionStatus: auction.status, // CRITICAL FIX: Include auction status for UI logic
  vendorId: payment.vendorId,
  // ... rest of fields
};
```

### 4. Updated Payment Type Definition

**File**: `src/app/(dashboard)/finance/payments/page.tsx`

Added `auctionStatus` to the Payment interface:

```typescript
interface Payment {
  id: string;
  auctionId: string;
  auctionStatus: string; // CRITICAL FIX: Include auction status for UI logic
  vendorId: string;
  // ... rest of fields
}
```

## Payment Flow States

### 1. Awaiting Documents (escrow_wallet, frozen)
- **Display**: Yellow box "⏳ Waiting for Documents"
- **Message**: "Vendor must sign documents"
- **Buttons**: None (waiting for vendor action)

### 2. Awaiting Payment (paystack, awaiting_payment)
- **Display**: Blue box "⏳ Awaiting Payment"
- **Message**: "Vendor must complete Paystack payment"
- **Buttons**: None (waiting for vendor to pay)

### 3. Payment Completed (pending, not awaiting_payment)
- **Display**: Approve/Reject buttons
- **Action**: Finance officer can verify payment
- **Buttons**: Approve, Reject

### 4. Payment Verified
- **Display**: Green checkmark
- **Status**: Completed
- **Buttons**: None

## Expected Behavior

### Before Fix ❌

1. Vendor signs documents
2. Auction status changes to "awaiting_payment"
3. Vendor hasn't selected payment method yet
4. Finance officer sees: **Approve/Reject buttons** (WRONG!)
5. Finance officer confused - nothing to approve yet

### After Fix ✅

1. Vendor signs documents
2. Auction status changes to "awaiting_payment"
3. Vendor selects Paystack and completes payment
4. Finance officer sees: **"⏳ Awaiting Payment - Vendor must complete Paystack payment"** (CORRECT!)
5. After Paystack webhook confirms payment
6. Finance officer sees: **Approve/Reject buttons** (CORRECT!)

## Files Modified

1. ✅ `src/app/(dashboard)/finance/payments/page.tsx`
   - Updated button display logic
   - Added waiting message for Paystack payments
   - Added `auctionStatus` to Payment type

2. ✅ `src/app/api/finance/payments/route.ts`
   - Added `auctionStatus` to API response

## Testing

To verify the fix:

1. Go to Finance Officer payments page
2. Find a payment with:
   - Status: `pending`
   - Payment Method: `paystack`
   - Auction Status: `awaiting_payment`
3. Verify you see: **"⏳ Awaiting Payment - Vendor must complete Paystack payment"**
4. Verify you DON'T see: Approve/Reject buttons

## Summary

The Approve/Reject buttons now only show when payment is actually completed and needs verification. For Paystack payments where the vendor hasn't completed payment yet (auction status is `awaiting_payment`), a blue info box shows "⏳ Awaiting Payment" instead.

This prevents finance officers from seeing irrelevant action buttons and provides clear status information about what's happening with the payment.


## Verification and Troubleshooting

After implementing the fix, if you still see incorrect button display:

1. **Clear browser cache** and hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. **Open in incognito/private window** to bypass all cache
3. **Check console logs** for debug information

See [FINANCE_PAYMENT_BUTTON_DISPLAY_VERIFICATION.md](./FINANCE_PAYMENT_BUTTON_DISPLAY_VERIFICATION.md) for:
- Detailed verification steps
- Console log examples
- Diagnostic scripts
- Troubleshooting guide

## Diagnostic Scripts

Two diagnostic scripts are available to verify the fix:

```bash
# Check database state and evaluate button logic
npx tsx scripts/diagnose-finance-payment-display.ts

# Test API endpoint directly (requires authentication)
npx tsx scripts/test-finance-payments-api.ts
```

## Additional Fixes Applied

To ensure the fix works correctly and help with debugging:

1. **Force Dynamic Rendering**: Added `export const dynamic = 'force-dynamic'` to API route to prevent caching
2. **Server-side Logging**: Added console logs in API route to track Paystack payment status
3. **Client-side Logging**: Added console logs in frontend to verify data received from API

These logs will appear in:
- **Server logs**: Terminal where Next.js is running
- **Client logs**: Browser console (F12)
