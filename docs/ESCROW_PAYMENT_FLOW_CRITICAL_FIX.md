# Escrow Payment Flow - CRITICAL FIX

## Problem Summary

1. **Only 1 document generating** instead of 2 (Bill of Sale + Liability Waiver)
2. **Funds showing in finance dashboard** before vendor signs documents
3. **Finance officer can "approve"** payments that haven't been signed yet (meaningless ritual)

## Root Cause

### Issue 1: Document Generation Failure
One of the two documents is failing to generate silently. The `Promise.all()` catches errors but doesn't throw them, so the closure service thinks it succeeded.

### Issue 2: Finance Dashboard Counting Escrow Payments Too Early
The finance dashboard counts ALL `status='pending'` payments, including escrow wallet payments that are waiting for document signing. These shouldn't appear until documents are signed and auto-release happens.

### Issue 3: Premature Fund Visibility
Escrow wallet payments with `escrowStatus='frozen'` show up in finance dashboard immediately after auction closes, even though:
- Vendor hasn't signed documents yet
- Funds haven't been released yet
- Finance officer approval is meaningless (funds auto-release after signing)

## The Fix

### Fix 1: Make Document Generation Failures Visible

**File:** `src/features/auctions/services/closure.service.ts`

**Change:** Throw error if ANY document fails to generate

```typescript
// BEFORE: Errors are caught but not thrown
.catch((error) => {
  console.error(`❌ Failed to generate Bill of Sale:`, error);
})

// AFTER: Throw error to make failure visible
.catch((error) => {
  console.error(`❌ Failed to generate Bill of Sale:`, error);
  throw error; // Re-throw to fail the entire operation
})
```

### Fix 2: Exclude Escrow Payments from Finance Dashboard Until Documents Signed

**File:** `src/app/api/dashboard/finance/route.ts`

**Change:** Only count escrow wallet payments that have been released (documents signed)

```typescript
// BEFORE: Counts ALL pending payments
const pendingVerificationResult = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(payments)
  .where(eq(payments.status, 'pending'));

// AFTER: Exclude escrow_wallet payments with frozen status
const pendingVerificationResult = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(payments)
  .where(
    and(
      eq(payments.status, 'pending'),
      // Exclude escrow wallet payments that are waiting for document signing
      or(
        ne(payments.paymentMethod, 'escrow_wallet'),
        ne(payments.escrowStatus, 'frozen')
      )
    )
  );
```

### Fix 3: Update Total Amount to Exclude Frozen Escrow

**File:** `src/app/api/dashboard/finance/route.ts`

**Change:** Don't count frozen escrow funds in total amount

```typescript
// BEFORE: Includes ALL payments
const totalAmountResult = await db
  .select({ 
    total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric` 
  })
  .from(payments);

// AFTER: Exclude frozen escrow payments
const totalAmountResult = await db
  .select({ 
    total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric` 
  })
  .from(payments)
  .where(
    or(
      ne(payments.paymentMethod, 'escrow_wallet'),
      ne(payments.escrowStatus, 'frozen')
    )
  );
```

## Correct Flow

### Phase 1: Auction Closes
```
✅ Auction ends
✅ Closure service generates 2 documents (Bill of Sale + Liability Waiver)
✅ Payment record created:
   - paymentMethod: 'escrow_wallet'
   - escrowStatus: 'frozen'
   - status: 'pending'
❌ Finance dashboard does NOT show this payment yet
❌ Finance dashboard does NOT count this in total amount
```

### Phase 2: Vendor Signs Documents
```
✅ Vendor signs Bill of Sale (1/2)
✅ Vendor signs Liability Waiver (2/2)
✅ System detects all documents signed
✅ triggerFundReleaseOnDocumentCompletion() runs
✅ Funds released from escrow to NEM Insurance
✅ Payment updated:
   - status: 'verified'
   - escrowStatus: 'released'
   - autoVerified: true
```

### Phase 3: Finance Dashboard Shows Completed Payment
```
✅ Finance dashboard shows payment in "Verified" count
✅ Finance dashboard includes amount in total
✅ Finance officer sees read-only completed payment
❌ NO approve/reject buttons (already complete)
```

## Implementation

I'll implement these fixes now.
