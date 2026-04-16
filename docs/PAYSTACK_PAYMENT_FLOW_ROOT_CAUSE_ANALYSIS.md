# Paystack Payment Flow - Root Cause Analysis

## Current State (Broken)

### What's Happening:
1. ✅ Payment records show ₦120k (CORRECT per spec)
2. ❌ Paystack opens in NEW TAB (breaks callback flow)
3. ❌ Multiple duplicate payment records created (9 records!)
4. ❌ Webhook never triggered (no verified payments)
5. ❌ Deposit not unfrozen (still ₦380k frozen)
6. ❌ No success modal after payment
7. ❌ No pickup authorization modal
8. ❌ "Pay Now" button doesn't disappear

### Diagnostic Output:
```
PAYMENT RECORDS: 9 total (all pending)
- Amount: ₦120,000 (CORRECT)
- Method: paystack
- Status: pending (WRONG - should be verified after webhook)

WALLET STATE:
- Frozen: ₦380,000 (WRONG - should be ₦280k after unfreezing ₦100k)

DEPOSIT EVENTS:
- 2 unfreeze events (₦200k total) but from previous attempts
- No new unfreeze events after recent payments
```

## Root Causes

### 1. Paystack Opens in New Tab
**File:** `src/components/vendor/payment-options.tsx` line ~160
```typescript
// WRONG: Opens in new tab, breaks callback
window.open(data.authorization_url, '_blank');
```

**Problem:**
- New tab breaks the callback flow
- User completes payment in new tab
- Original tab has no way to know payment completed
- Webhook fires but UI doesn't update
- No success modal, no pickup modal

**Solution:** Use embedded iframe or redirect to Paystack, then redirect back

### 2. Multiple Duplicate Payment Records
**File:** `src/features/auction-deposit/services/payment.service.ts`

**Problem:**
- Every click on "Pay with Paystack" creates a new payment record
- No idempotency check BEFORE creating record
- `checkIdempotency()` only checks AFTER record is created

**Solution:** Check for existing pending payment BEFORE creating new one

### 3. Webhook Not Being Triggered
**Possible Causes:**
a) Webhook URL not configured in Paystack dashboard
b) Webhook signature verification failing
c) Paystack test mode vs live mode mismatch
d) Network/firewall blocking webhook

**Solution:** 
- Verify webhook URL in Paystack dashboard
- Test webhook with Paystack test tool
- Add more logging to webhook handler

### 4. No Success Modal / Pickup Modal
**File:** `src/components/vendor/payment-options.tsx`

**Problem:**
- Success modal only shows when `?payment=success` query param exists
- But Paystack callback URL doesn't add this param
- Pickup modal depends on page refresh + payment status check

**Solution:**
- Paystack callback should redirect to: `/vendor/auctions/${auctionId}?payment=success`
- Success modal should trigger on this param
- After modal closes, page should refresh to show pickup modal

## Correct Flow (Per Spec)

### Requirement 15: Paystack-Only Payment Processing

```
1. Vendor clicks "Pay with Paystack"
   ↓
2. Check for existing pending payment (idempotency)
   ↓
3. If no existing payment, create payment record (₦120k total)
   ↓
4. Initialize Paystack with ₦20k (remainingAmount)
   ↓
5. Show Paystack modal (EMBEDDED, not new tab)
   ↓
6. Vendor completes payment in modal
   ↓
7. Paystack redirects to callback URL with ?payment=success
   ↓
8. Paystack webhook fires → /api/webhooks/paystack-auction
   ↓
9. Webhook unfreezes ₦100k deposit atomically
   ↓
10. Webhook updates payment status to "verified"
    ↓
11. Page shows success modal: "Total: ₦120k (₦20k + ₦100k)"
    ↓
12. User clicks "Continue" → Page refreshes
    ↓
13. Pickup authorization modal appears
    ↓
14. "Pay Now" button disappears (status changed to "paid")
```

## Required Fixes

### Fix 1: Use Embedded Paystack Modal (Not New Tab)
**File:** `src/components/vendor/payment-options.tsx`

```typescript
// BEFORE (WRONG):
window.open(data.authorization_url, '_blank');

// AFTER (CORRECT):
// Option A: Redirect to Paystack, then back
window.location.href = data.authorization_url;

// Option B: Use Paystack inline (embedded)
// Requires Paystack inline JS library
```

### Fix 2: Add Idempotency Check BEFORE Creating Payment
**File:** `src/features/auction-deposit/services/payment.service.ts`

```typescript
async initializePaystackPayment(params) {
  // CHECK FIRST: Look for existing pending payment
  const existingPending = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, auctionId),
        eq(payments.vendorId, vendorId),
        eq(payments.status, 'pending')
      )
    )
    .limit(1);
  
  if (existingPending.length > 0) {
    // Return existing payment, don't create new one
    return {
      authorizationUrl: 'ALREADY_PENDING',
      message: 'Payment already in progress'
    };
  }
  
  // THEN: Create new payment record
  // ...
}
```

### Fix 3: Update Callback URL to Include Success Param
**File:** `src/features/auction-deposit/services/payment.service.ts`

```typescript
const paystackPayload = {
  email: user.email,
  amount: amountInKobo,
  reference: idempotencyKey,
  callback_url: `${APP_URL}/vendor/auctions/${auctionId}?payment=success`, // ADD ?payment=success
  metadata: { ... }
};
```

### Fix 4: Success Modal Should Refresh Page After Close
**File:** `src/components/vendor/payment-options.tsx`

```typescript
<button
  onClick={() => {
    setShowSuccessModal(false);
    // REFRESH PAGE to trigger pickup modal
    window.location.reload();
  }}
>
  Continue
</button>
```

### Fix 5: Verify Webhook Configuration
**Action Required:**
1. Log into Paystack dashboard
2. Go to Settings → Webhooks
3. Add webhook URL: `https://your-domain.com/api/webhooks/paystack-auction`
4. Test webhook with Paystack test tool
5. Verify signature is correct

## Testing Checklist

- [ ] Clean up duplicate payment records
- [ ] Test payment with embedded modal (not new tab)
- [ ] Verify only ONE payment record created per attempt
- [ ] Verify webhook fires and unfreezes deposit
- [ ] Verify success modal appears with correct breakdown
- [ ] Verify pickup modal appears after success modal closes
- [ ] Verify "Pay Now" button disappears after payment
- [ ] Verify finance dashboard shows ₦120k auto-verified

## SQL Cleanup Script

```sql
-- Delete duplicate pending payments (keep only the latest one)
DELETE FROM payments
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY auction_id, vendor_id 
      ORDER BY created_at DESC
    ) as rn
    FROM payments
    WHERE status = 'pending'
  ) t
  WHERE rn = 1
);
```

## Next Steps

1. Stop making changes without understanding the complete flow
2. Read the spec requirements line by line
3. Understand the EXISTING code before modifying
4. Fix ONE issue at a time
5. Test each fix before moving to the next
6. Don't hardcode values like ₦100k or ₦20k
7. Use the actual values from the database (finalBid, depositAmount)
