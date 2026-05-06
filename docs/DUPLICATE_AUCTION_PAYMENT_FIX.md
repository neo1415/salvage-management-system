# Duplicate Auction Payment Fix

## Problem Summary

Users are experiencing duplicate payment records when paying for won auctions. The issue manifests as:

1. User wins auction and clicks "Pay Now"
2. User completes payment via Paystack
3. Webhook processes payment successfully and marks it as `verified`
4. UI doesn't update fast enough to show "Payment Verified" banner
5. User thinks payment didn't work and clicks "Pay Now" again
6. Second payment record is created (shows as `pending` with status `awaiting_payment`)
7. Finance officer page shows BOTH payments, causing confusion

## Root Causes

### 1. **UI Update Delay** (Primary Issue)
- The `hasVerifiedPayment` flag is correctly returned by the polling endpoint
- The auction detail page has code to update from realtime data
- **BUT** the polling interval (every 3 seconds) means there can be a 0-3 second delay
- During this delay, the "Pay Now" button is still visible and clickable

### 2. **Duplicate Prevention Works But UX is Poor**
- The backend DOES prevent duplicate Paystack payments (see `payment.service.ts` lines 358-383)
- When a duplicate is detected, it returns `authorization_url: 'ALREADY_PENDING'`
- The frontend shows an error: "A payment is already in progress"
- **BUT** this error message doesn't help the user understand what happened

### 3. **Finance Officer Page Shows Both Records**
- The first payment: `status='verified'`, `auctionStatus='awaiting_payment'`
- The second payment: `status='pending'`, `auctionStatus='awaiting_payment'`
- Finance officer sees action buttons for the second payment (incorrect)
- This creates confusion about which payment is real

## Solution

### Fix 1: Immediate UI Feedback (Prevents Duplicate Clicks)

**File**: `src/components/vendor/payment-options.tsx`

Add immediate loading state when "Pay Now" is clicked:

```typescript
const handlePaystackPayment = async () => {
  try {
    setProcessing(true); // ✅ Already exists
    setError(null);
    
    // ✅ NEW: Show immediate feedback
    toast.info('Initializing Payment', 'Redirecting to Paystack...');
    
    const response = await fetch(`/api/auctions/${auctionId}/payment/paystack`, {
      method: 'POST',
    });
    
    const data = await response.json();

    if (response.ok) {
      if (!data.authorization_url) {
        setError('Payment initialization failed: No authorization URL received');
        return;
      }
      
      // Check if payment already pending
      if (data.authorization_url === 'ALREADY_PENDING') {
        // ✅ IMPROVED: Better error message with action
        setError('A payment is already being processed. Please wait for the payment confirmation email or check your payment status.');
        return;
      }
      
      // ✅ NEW: Show redirect message
      toast.success('Redirecting', 'Taking you to Paystack payment page...');
      
      // REDIRECT to Paystack - Paystack will redirect back after payment
      window.location.href = data.authorization_url;
    } else {
      setError(data.error || data.message || 'Failed to initialize payment. Please try again.');
    }
  } catch (error) {
    console.error('Paystack initialization failed:', error);
    setError('Failed to initialize payment. Please check your connection and try again.');
  } finally {
    setProcessing(false);
  }
};
```

### Fix 2: Faster Polling After Payment

**File**: `src/hooks/use-socket.ts`

Increase polling frequency when payment is expected:

```typescript
// Current: Poll every 3 seconds
const POLL_INTERVAL = 3000;

// ✅ NEW: Poll every 1 second when in awaiting_payment status
const pollInterval = auction.status === 'awaiting_payment' ? 1000 : 3000;
```

### Fix 3: Hide Duplicate Payments in Finance Officer Page

**File**: `src/app/api/finance/payments/route.ts`

Filter out duplicate pending payments when a verified payment exists:

```typescript
// After fetching payments, filter out duplicates
const filteredPayments = payments.filter((payment, index, self) => {
  // If this is a pending payment
  if (payment.status === 'pending') {
    // Check if there's a verified payment for the same auction
    const hasVerifiedPayment = self.some(
      p => p.auctionId === payment.auctionId && 
           p.status === 'verified' && 
           p.id !== payment.id
    );
    
    // Hide this pending payment if a verified one exists
    if (hasVerifiedPayment) {
      console.log(`🔍 Hiding duplicate pending payment ${payment.id} (verified payment exists)`);
      return false;
    }
  }
  
  return true;
});
```

### Fix 4: Auto-Cancel Duplicate Pending Payments

**File**: `src/features/auction-deposit/services/payment.service.ts`

When webhook processes a payment, auto-cancel any other pending payments:

```typescript
async handlePaystackWebhook(reference: string, success: boolean) {
  // ... existing code ...
  
  if (success) {
    // ✅ NEW: Cancel any other pending payments for this auction
    const otherPendingPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, payment.auctionId),
          eq(payments.status, 'pending'),
          ne(payments.id, payment.id) // Not the current payment
        )
      );
    
    if (otherPendingPayments.length > 0) {
      console.log(`🗑️  Auto-canceling ${otherPendingPayments.length} duplicate pending payments`);
      
      for (const duplicatePayment of otherPendingPayments) {
        await db
          .update(payments)
          .set({
            status: 'cancelled',
            updatedAt: new Date(),
          })
          .where(eq(payments.id, duplicatePayment.id));
        
        console.log(`   ✅ Cancelled duplicate payment: ${duplicatePayment.id}`);
      }
    }
  }
  
  // ... rest of existing code ...
}
```

### Fix 5: Disable "Pay Now" Button After First Click

**File**: `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

Add state to track if payment initialization is in progress:

```typescript
const [paymentInitializing, setPaymentInitializing] = useState(false);

// When opening payment modal
const handleOpenPaymentModal = () => {
  setPaymentInitializing(true);
  setShowPaymentModal(true);
};

// Pass to PaymentOptions component
<PaymentOptions
  auctionId={auction.id}
  asModal={true}
  onClose={() => {
    setShowPaymentModal(false);
    setPaymentInitializing(false);
  }}
  onPaymentSuccess={() => {
    setShowPaymentModal(false);
    setPaymentInitializing(false);
    window.location.reload();
  }}
  disabled={paymentInitializing} // ✅ NEW: Disable if already initializing
/>

// Disable "Pay Now" button
<button
  onClick={handleOpenPaymentModal}
  disabled={paymentInitializing}
  className="..."
>
  {paymentInitializing ? 'Processing...' : 'Pay Now'}
</button>
```

## Implementation Priority

1. **Fix 1** (Immediate UI Feedback) - **HIGH PRIORITY** - Prevents user confusion
2. **Fix 4** (Auto-Cancel Duplicates) - **HIGH PRIORITY** - Cleans up existing duplicates
3. **Fix 3** (Hide Duplicates in Finance Page) - **MEDIUM PRIORITY** - Improves finance officer UX
4. **Fix 2** (Faster Polling) - **MEDIUM PRIORITY** - Reduces delay
5. **Fix 5** (Disable Button) - **LOW PRIORITY** - Extra safety measure

## Testing

### Test Case 1: Normal Payment Flow
1. Win an auction
2. Click "Pay Now"
3. Complete Paystack payment
4. Verify UI updates to show "Payment Verified" within 3 seconds
5. Verify "Pay Now" button is hidden
6. Verify only ONE payment record exists in database

### Test Case 2: Duplicate Click Prevention
1. Win an auction
2. Click "Pay Now"
3. **Immediately click "Pay Now" again before redirect**
4. Verify second click shows error: "A payment is already being processed"
5. Verify only ONE payment record exists in database

### Test Case 3: Webhook Auto-Cancel
1. Create a duplicate pending payment manually in database
2. Trigger webhook for the first payment
3. Verify duplicate pending payment is auto-cancelled
4. Verify finance officer page only shows the verified payment

## Diagnostic Commands

```bash
# Diagnose duplicate payments for an auction
npx tsx scripts/diagnose-duplicate-auction-payments.ts HON-2700

# Cancel a stuck pending payment
npx tsx scripts/cancel-stuck-payment.ts <payment-id>

# Check payment status
npx tsx scripts/diagnose-latest-payment.ts
```

## Database Cleanup

If duplicates already exist in production:

```sql
-- Find auctions with multiple payments
SELECT 
  auction_id,
  COUNT(*) as payment_count,
  STRING_AGG(id::text, ', ') as payment_ids,
  STRING_AGG(status, ', ') as statuses
FROM payments
WHERE auction_id IS NOT NULL
GROUP BY auction_id
HAVING COUNT(*) > 1;

-- Cancel duplicate pending payments (keep verified ones)
UPDATE payments
SET status = 'cancelled', updated_at = NOW()
WHERE id IN (
  SELECT p1.id
  FROM payments p1
  INNER JOIN payments p2 ON p1.auction_id = p2.auction_id
  WHERE p1.status = 'pending'
    AND p2.status = 'verified'
    AND p1.id != p2.id
);
```

## Prevention Going Forward

1. **Rate Limiting**: Add rate limiting to payment initialization endpoint (max 1 request per 10 seconds per user)
2. **Idempotency**: Use idempotency keys for all payment operations
3. **UI Feedback**: Always show loading states and disable buttons during async operations
4. **Monitoring**: Add alerts for duplicate payment detection
5. **User Education**: Add tooltip explaining payment process and expected wait time

## Related Files

- `src/features/auction-deposit/services/payment.service.ts` - Payment service with duplicate prevention
- `src/components/vendor/payment-options.tsx` - Payment UI component
- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - Auction detail page
- `src/app/api/webhooks/paystack-auction/route.ts` - Webhook handler
- `src/app/api/finance/payments/route.ts` - Finance officer payments API
- `src/hooks/use-socket.ts` - Real-time updates hook

## Success Criteria

✅ Users cannot create duplicate payments by clicking "Pay Now" multiple times
✅ UI updates within 1-3 seconds after payment verification
✅ Finance officer page only shows one payment record per auction
✅ Existing duplicate pending payments are auto-cancelled by webhook
✅ Clear error messages guide users when payment is already in progress
