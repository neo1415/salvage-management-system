# Payment Flow - Complete Diagnosis and Issues

## Date: 2026-04-10
## Auction: 260582d5-5c55-4ca5-8e22-609fef09b7f3

---

## Current State

### Auction
- Status: `awaiting_payment` ✅
- Current Bid: ₦130,000
- Winner: Vendor 5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3

### Winner Record
- Bid Amount: ₦130,000
- Deposit Amount: ₦100,000 (frozen)
- Remaining to Pay: ₦30,000 (via Paystack)

### Documents
- **ISSUE #1**: Total documents: 0 ❌
- User says "2/2 documents signed" but database shows 0 documents
- This is a CRITICAL issue - documents should have been generated

### Payments
- 1 Paystack payment: PENDING (waiting for completion)
- Amount: ₦130,000 (FULL amount, not just ₦30k)
- Created: 2 hours ago
- Status: Waiting for Paystack webhook

### Wallet
- Balance: ₦1,090,000
- Available: ₦80,000
- Frozen: ₦1,010,000 (includes ₦100k deposit for this auction)
- Invariant: ✅ PASS

---

## Issues Identified

### Issue #1: Missing Documents ❌

**Problem**: Database shows 0 documents, but UI shows "2/2 signed"

**Root Cause**: Documents were never generated when auction closed

**Impact**:
- User sees "Waiting for Documents" status
- Cannot proceed to pickup authorization
- Confusing UI state

**Fix Required**: Generate documents for this auction

---

### Issue #2: Payment Amount Confusion ❌

**Problem**: Payment record shows ₦130k (full amount) but user only needs to pay ₦30k via Paystack

**Explanation**: This is actually CORRECT behavior:
- Payment record stores TOTAL payment amount (₦130k)
- This includes: ₦100k deposit (from wallet) + ₦30k (via Paystack)
- Paystack is only charged ₦30k (the remaining amount)
- Finance dashboard shows full ₦130k payment

**Why**: Finance needs to see the complete payment, not just the Paystack portion

---

### Issue #3: Deposit Not Unfrozen ❌

**Problem**: ₦100k deposit still frozen in wallet

**Root Cause**: Payment is still PENDING (waiting for Paystack completion)

**Expected Flow**:
1. User completes Paystack payment (₦30k)
2. Paystack webhook fires
3. Payment status → `verified`
4. Deposit (₦100k) unfrozen from wallet
5. Total deduction: ₦130k (₦100k from frozen + ₦30k from Paystack)

**Current State**: Stuck at step 1 (payment not completed)

---

### Issue #4: "Pay Now" Button Still Visible ❌

**Problem**: Button doesn't disappear after payment initiation

**Root Cause**: UI checks for `verified` payment, not `pending` payment

**Fix Required**: Hide "Pay Now" button when pending payment exists

---

### Issue #5: Finance Approval Required? ❌

**Problem**: Finance dashboard shows "Approve/Reject" buttons

**Root Cause**: Paystack payments should be auto-verified by webhook, not manually approved

**Expected**: 
- Wallet payments: Auto-verified immediately
- Paystack payments: Auto-verified by webhook
- Manual approval: Only for failed/suspicious payments

---

## What Should Happen

### Correct Flow:

1. **Auction Closes** ✅ DONE
   - Status → `awaiting_payment`
   - Winner record created
   - Deposit (₦100k) frozen

2. **Documents Generated** ❌ MISSING
   - Sale agreement
   - Transfer documents
   - Status: `pending_signature`

3. **User Signs Documents** ❌ SKIPPED (no documents)
   - Documents → `signed`
   - Payment deadline set (72 hours)

4. **User Initiates Payment** ✅ DONE
   - Selects Paystack
   - Payment record created (₦130k total)
   - Paystack initialized (₦30k charge)

5. **User Completes Paystack** ⏳ PENDING
   - Pays ₦30k via Paystack
   - Paystack webhook fires
   - Payment → `verified`

6. **Deposit Unfrozen** ⏳ WAITING
   - ₦100k unfrozen from wallet
   - Total deduction: ₦130k
   - Wallet balance reduced

7. **Pickup Authorization** ⏳ WAITING
   - Documents + Payment verified
   - Pickup code generated
   - User can collect vehicle

---

## Immediate Fixes Needed

### Fix #1: Generate Missing Documents

The auction closed but documents were never generated. Need to:

```bash
npx tsx scripts/generate-missing-documents-for-closed-auction.ts 260582d5-5c55-4ca5-8e22-609fef09b7f3
```

This will:
- Generate sale agreement
- Generate transfer documents
- Set status to `pending_signature`

### Fix #2: Complete Paystack Payment

User needs to actually complete the Paystack payment:

**Option A: Real Payment**
- Go to Paystack payment link
- Complete ₦30k payment
- Webhook will auto-verify

**Option B: Simulate for Testing**
```bash
npx tsx scripts/simulate-paystack-webhook-auction.ts 260582d5-5c55-4ca5-8e22-609fef09b7f3
```

This will:
- Mark payment as verified
- Unfreeze ₦100k deposit
- Trigger pickup authorization

### Fix #3: Hide "Pay Now" Button

Update UI to check for pending payments:

```typescript
// In auction page
const hasPendingPayment = paymentStatus === 'pending';
const hasVerifiedPayment = paymentStatus === 'verified';

if (hasPendingPayment) {
  return <div>Payment in progress... Please complete Paystack payment</div>;
}

if (hasVerifiedPayment) {
  return <div>Payment complete! Pickup authorization...</div>;
}

// Show "Pay Now" button only if no payment exists
```

---

## Why Finance Sees "Approve/Reject"

The finance dashboard shows approve/reject because:

1. Payment status is `pending`
2. Finance can manually verify if webhook fails
3. This is a fallback mechanism

**Normal flow**: Webhook auto-verifies, finance never needs to approve

**Manual approval**: Only if webhook fails or payment is suspicious

---

## Summary of Confusion

### What User Sees:
- "2/2 documents signed" (UI bug - no documents exist)
- "Waiting for Documents" (correct - documents missing)
- "Pay Now" button (shouldn't show if payment pending)
- Finance "Approve/Reject" (fallback for manual verification)
- Frozen funds not released (correct - payment not complete)

### What's Actually Happening:
- Documents: 0 (never generated) ❌
- Payment: Pending (waiting for Paystack completion) ⏳
- Deposit: Frozen (correct until payment verified) ✅
- Wallet: Correct state ✅

### What Needs to Happen:
1. Generate documents ❌
2. User signs documents ❌
3. User completes Paystack payment ⏳
4. Webhook verifies payment ⏳
5. Deposit unfrozen ⏳
6. Pickup authorization ⏳

---

## Action Items

### Immediate (Now):
1. ✅ Run document generation script
2. ⏳ Complete Paystack payment (or simulate)
3. ✅ Verify deposit unfrozen
4. ✅ Verify pickup authorization appears

### Short-term (Next Sprint):
1. Fix UI to hide "Pay Now" when payment pending
2. Fix document count display (show actual count)
3. Add payment status indicator (pending/verified)
4. Improve error messages

### Long-term (Future):
1. Add automatic document generation on auction close
2. Add payment timeout (auto-cancel after 30 min)
3. Add better payment status tracking
4. Improve finance dashboard (hide auto-verified payments)

---

## Testing Commands

```bash
# 1. Check current state
npx tsx scripts/diagnose-current-payment-state.ts

# 2. Generate missing documents
npx tsx scripts/generate-missing-documents-for-closed-auction.ts 260582d5-5c55-4ca5-8e22-609fef09b7f3

# 3. Simulate payment completion (for testing)
npx tsx scripts/simulate-paystack-webhook-auction.ts 260582d5-5c55-4ca5-8e22-609fef09b7f3

# 4. Check wallet state
npx tsx scripts/check-wallet-state.ts 5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3

# 5. Check frozen deposits
npx tsx scripts/check-all-frozen-deposits.ts
```

---

## Status

**Current**: Payment pending, documents missing
**Next**: Generate documents, complete payment
**Expected**: Deposit unfrozen, pickup authorized

