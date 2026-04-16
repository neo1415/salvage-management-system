# Payment Flow Spec Violation - Critical Issue

## Issue Summary

The system is automatically deducting payment from vendor wallet after document signing, bypassing the required payment method selection modal. This violates Requirements 13-16 of the auction deposit spec.

## Current (Incorrect) Flow

```
1. Vendor wins auction
2. Deposit frozen (₦100k for ₦230k bid) ✅
3. Vendor signs documents ✅
4. System AUTOMATICALLY deducts ₦230k from wallet ❌
5. Funds transferred to finance officer ❌
6. No payment choice given to vendor ❌
```

## Required (Correct) Flow Per Spec

```
1. Vendor wins auction
2. Deposit frozen (₦100k for ₦230k bid) ✅
3. Vendor signs documents ✅
4. System shows PAYMENT MODAL with 3 options: ⏳ MISSING
   - Wallet Only (if balance >= ₦130k remaining)
   - Paystack Only (pay ₦130k via card/bank)
   - Hybrid (use wallet + Paystack for remainder)
5. Vendor CHOOSES payment method ⏳ MISSING
6. System processes payment based on choice ⏳ MISSING
7. Funds transferred to finance officer
```

## Spec Requirements Violated

### Requirement 13: Payment Method Selection
**Violated:** System doesn't show payment options modal

**Spec Says:**
> WHEN all required documents are signed, THE Payment_UI SHALL display payment options modal with three choices: "Wallet Only", "Paystack Only", "Hybrid"

**What Happens:** No modal shown, automatic wallet deduction

### Requirement 14: Wallet-Only Payment
**Partially Correct:** Wallet deduction works

**Spec Says:**
> WHEN a vendor **SELECTS** "Wallet Only" payment, THE Payment_Service SHALL verify availableBalance >= remaining_amount

**What Happens:** System automatically uses wallet without vendor selection

### Requirement 15: Paystack-Only Payment
**Not Implemented:** No Paystack option shown

**Spec Says:**
> WHEN a vendor **SELECTS** "Paystack Only" payment, THE Payment_Service SHALL initialize Paystack transaction

**What Happens:** Paystack option never presented to vendor

### Requirement 16: Hybrid Payment
**Not Implemented:** No hybrid option shown

**Spec Says:**
> WHEN a vendor **SELECTS** "Hybrid" payment, THE Payment_Service SHALL calculate wallet_portion and paystack_portion

**What Happens:** Hybrid option never presented to vendor

## Root Cause

**File:** `src/features/documents/services/document.service.ts`
**Line:** ~897

**Code:**
```typescript
console.log(`✅ All documents signed for auction ${auctionId}. Proceeding with fund release...`);

// Step 2: Get payment record
// ... automatically processes payment from wallet
```

**Problem:** The document signing service directly triggers fund release instead of:
1. Updating auction status to "awaiting_payment"
2. Showing payment modal to vendor
3. Waiting for vendor to choose payment method
4. Processing payment based on vendor's choice

## Impact

### For Vendors
- ❌ No choice in payment method
- ❌ Cannot use Paystack to preserve wallet balance
- ❌ Cannot split payment between wallet and Paystack
- ❌ Forced to use wallet even if they prefer card payment

### For Business
- ❌ Spec requirements not met
- ❌ User experience doesn't match design
- ❌ Payment gateway integration (Paystack) not utilized
- ❌ Vendor flexibility reduced

## Evidence from Logs

```
✅ All documents signed for auction d8a59464-f9e5-4be7-8354-050c490bee1d. Proceeding with fund release...
💰 Payment found: 4678f4ca-ccbe-4dd3-8926-4f98ca8e59a2, Amount: ₦230000.00, Status: pending
✅ All duplicate prevention checks passed. Proceeding with fund release...
🔓 Releasing ₦230,000 from vendor wallet...
✅ ATOMIC RELEASE: Balance 900000 → 670000, Frozen 710000 → 480000
✅ Funds released successfully via Paystack
```

**Analysis:**
- "Proceeding with fund release" happens immediately after signing
- No payment modal shown
- No vendor choice recorded
- Wallet automatically debited

## Correct Implementation Required

### 1. Update Document Signing Flow
**File:** `src/features/documents/services/document.service.ts`

**Change:**
```typescript
// WRONG (current):
console.log(`✅ All documents signed. Proceeding with fund release...`);
await this.releaseFunds(...);

// CORRECT (required):
console.log(`✅ All documents signed. Updating status to awaiting_payment...`);
await db.update(auctions)
  .set({ status: 'awaiting_payment' })
  .where(eq(auctions.id, auctionId));

// Notify vendor to choose payment method
await notificationService.sendPaymentOptionsNotification(vendorId, auctionId);
```

### 2. Create Payment Options Modal
**File:** `src/components/vendor/payment-options-modal.tsx` (NEW)

**Features:**
- Show remaining amount (bid - deposit)
- Show 3 payment options with radio buttons
- Wallet Only: Show available balance, enable if sufficient
- Paystack Only: Show Paystack logo, always enabled
- Hybrid: Show wallet portion + Paystack portion calculation
- Submit button triggers payment API with chosen method

### 3. Create Payment Processing API
**File:** `src/app/api/auctions/[id]/payment/process/route.ts` (NEW or UPDATE)

**Logic:**
```typescript
POST /api/auctions/[id]/payment/process
Body: { method: 'wallet' | 'paystack' | 'hybrid' }

Switch on method:
  case 'wallet':
    - Verify balance >= remaining
    - Deduct from wallet
    - Unfreeze deposit
    - Mark paid
  
  case 'paystack':
    - Initialize Paystack transaction
    - Return payment URL
    - Webhook handles success/failure
  
  case 'hybrid':
    - Calculate wallet_portion
    - Deduct wallet_portion
    - Initialize Paystack for remainder
    - Return payment URL
```

### 4. Update Vendor Auction Detail Page
**File:** `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

**Add:**
- Check if auction status is 'awaiting_payment'
- Show payment options modal
- Handle payment method selection
- Process payment based on choice
- Show success/error messages

## Testing Checklist

### Scenario 1: Wallet-Only Payment
- [ ] Vendor has ₦200k balance, ₦100k frozen deposit
- [ ] Bid is ₦230k (remaining ₦130k)
- [ ] Signs documents
- [ ] Sees payment modal with 3 options
- [ ] "Wallet Only" is enabled (balance sufficient)
- [ ] Selects "Wallet Only"
- [ ] System deducts ₦130k from wallet
- [ ] System unfreezes ₦100k deposit
- [ ] Total ₦230k transferred to FO

### Scenario 2: Paystack-Only Payment
- [ ] Vendor has ₦50k balance, ₦100k frozen deposit
- [ ] Bid is ₦230k (remaining ₦130k)
- [ ] Signs documents
- [ ] Sees payment modal with 3 options
- [ ] "Wallet Only" is disabled (balance insufficient)
- [ ] Selects "Paystack Only"
- [ ] Redirected to Paystack payment page
- [ ] Pays ₦130k via card
- [ ] System unfreezes ₦100k deposit
- [ ] Total ₦230k transferred to FO

### Scenario 3: Hybrid Payment
- [ ] Vendor has ₦80k balance, ₦100k frozen deposit
- [ ] Bid is ₦230k (remaining ₦130k)
- [ ] Signs documents
- [ ] Sees payment modal with 3 options
- [ ] Selects "Hybrid"
- [ ] Modal shows: "₦80k from wallet + ₦50k via Paystack"
- [ ] System deducts ₦80k from wallet
- [ ] Redirected to Paystack for ₦50k
- [ ] Pays ₦50k via card
- [ ] System unfreezes ₦100k deposit
- [ ] Total ₦230k transferred to FO

### Scenario 4: Paystack Failure Handling
- [ ] Vendor selects Paystack or Hybrid
- [ ] Paystack payment fails
- [ ] If Hybrid: wallet portion refunded
- [ ] Vendor can retry payment
- [ ] No penalty applied

## Priority

**CRITICAL** - This is a fundamental spec violation that affects every auction payment

## Estimated Effort

- Payment options modal: 2-3 hours
- Payment processing API updates: 3-4 hours
- Paystack integration: 2-3 hours
- Testing all scenarios: 2-3 hours
- **Total: 9-13 hours**

## Dependencies

- Paystack API credentials configured
- Paystack webhook endpoint set up
- Payment verification logic implemented
- Refund logic for failed hybrid payments

## Notes

- The deposit calculation (₦100k for ₦230k bid) is working correctly
- The document signing flow is working correctly
- The issue is ONLY in the automatic payment after signing
- This should be a separate task/ticket to implement properly
- Current behavior works but doesn't give vendors choice
- Fixing this requires significant UI and API changes

## Recommendation

**DO NOT** try to quick-fix this in the current session. This requires:
1. New payment modal component
2. New payment processing API
3. Paystack integration testing
4. Comprehensive E2E testing
5. Proper error handling and retry logic

Create a new task: "Implement Payment Method Selection Modal (Requirements 13-16)"

## Date Identified

April 10, 2026

## Identified By

Kiro AI Assistant during auction deposit system testing
