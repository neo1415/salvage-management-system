# Escrow Payment Flow - How It Works

## Your Question

> "If the money has been frozen by the escrow logic after the bid is over, shouldn't the money then be released to the finance officer? How would the vendor pay it again when it has been frozen already? Where is the page to pay again? I'm confused."

## The Answer: There Are TWO Different Payment Methods

You're seeing confusion because there are **TWO completely different payment flows**:

---

## Flow 1: Escrow Wallet Payment (Money Already in System)

### When This Happens:
- Vendor has money in their escrow wallet (they funded it earlier)
- Vendor wins an auction
- System FREEZES the money from their wallet automatically

### The Flow:
1. **Vendor wins auction** → Money is FROZEN in their wallet
2. **Finance Officer verifies** → Money is RELEASED from wallet to company
3. **No additional payment needed** → Money was already there!

### Key Point:
- Vendor does NOT need to "pay again"
- The money was already in their wallet
- Finance just needs to VERIFY and RELEASE it
- Payment status: `escrow_wallet` method, `escrowStatus='frozen'`

---

## Flow 2: External Payment (Paystack/Flutterwave/Bank Transfer)

### When This Happens:
- Vendor has NO money in escrow wallet (or chooses not to use it)
- Vendor wins an auction
- System creates a PENDING payment record
- Vendor must PAY using external method

### The Flow:
1. **Vendor wins auction** → Payment record created with status='pending'
2. **Vendor goes to payment page** → `/vendor/payments/[id]`
3. **Vendor chooses payment method:**
   - Paystack (card/bank)
   - Flutterwave (card/bank)
   - Bank Transfer (upload proof)
4. **Vendor completes payment**
5. **Finance Officer verifies** → Marks as verified

### Key Point:
- Vendor MUST make a new payment
- Money is NOT in the system yet
- Payment page exists at `/vendor/payments/[id]`
- Payment status: `paystack`/`flutterwave`/`bank_transfer` method

---

## How to Tell Which Flow You're In

### Check the Payment Record:

```typescript
// Escrow Wallet Payment
{
  paymentMethod: 'escrow_wallet',
  escrowStatus: 'frozen',  // Money is frozen in wallet
  status: 'pending'        // Waiting for Finance to release
}

// External Payment
{
  paymentMethod: 'paystack' | 'flutterwave' | 'bank_transfer',
  escrowStatus: 'none',    // No escrow involved
  status: 'pending'        // Waiting for vendor to pay
}
```

---

## The Payment Page You're Looking For

### For Vendors Who Need to Pay:

**URL**: `/vendor/payments/[paymentId]`

**File**: `src/app/(dashboard)/vendor/payments/[id]/page.tsx`

**What it does:**
- Shows payment details (amount, deadline, auction info)
- Offers payment method choices:
  - Pay with Paystack
  - Pay with Flutterwave
  - Pay via Bank Transfer (upload proof)
  - Pay from Escrow Wallet (if they have balance)

### For Finance Officers:

**URL**: `/finance/payments`

**File**: `src/app/(dashboard)/finance/payments/page.tsx`

**What it does:**
- Shows ALL payments (both escrow and external)
- Allows verification of:
  - Escrow wallet payments (release frozen money)
  - External payments (verify payment was received)

---

## Example Scenarios

### Scenario A: Vendor Has Escrow Wallet Balance

1. Vendor wins auction for ₦30,000
2. Vendor has ₦50,000 in escrow wallet
3. System AUTOMATICALLY freezes ₦30,000
4. Payment record created:
   ```
   method: 'escrow_wallet'
   escrowStatus: 'frozen'
   status: 'pending'
   ```
5. Finance Officer sees payment in Finance Payments page
6. Finance Officer clicks "Approve"
7. Money is RELEASED from wallet to company
8. Payment status changes to 'verified'
9. Vendor's wallet balance: ₦50,000 - ₦30,000 = ₦20,000

**Vendor does NOT need to pay again!**

### Scenario B: Vendor Has NO Escrow Wallet Balance

1. Vendor wins auction for ₦30,000
2. Vendor has ₦0 in escrow wallet
3. Payment record created:
   ```
   method: null (not set yet)
   escrowStatus: 'none'
   status: 'pending'
   ```
4. Vendor goes to `/vendor/payments/[id]`
5. Vendor chooses "Pay with Paystack"
6. Vendor completes payment via Paystack
7. Webhook updates payment:
   ```
   method: 'paystack'
   status: 'verified' (auto-verified)
   ```
8. Finance Officer sees it as verified

**Vendor HAD to pay because money wasn't in system!**

---

## Why Your ₦30,000 Payment Shows as Overdue

Based on your debug output:
```
Payment from Feb 10, 2026
Method: paystack
Status: overdue
Escrow Status: none
```

This means:
- Vendor chose to pay via Paystack (NOT escrow wallet)
- Vendor either:
  - Never completed the Paystack payment, OR
  - Payment failed, OR
  - Webhook didn't fire
- Deadline passed → Status changed to 'overdue'

**This is NOT an escrow wallet payment!** The vendor needs to go to the payment page and complete the Paystack payment.

---

## Summary

| Payment Method | Money Location | Vendor Action | Finance Action |
|---|---|---|---|
| **Escrow Wallet** | Already in system | None (auto-frozen) | Verify & Release |
| **Paystack** | Not in system | Go to payment page & pay | Verify (usually auto) |
| **Flutterwave** | Not in system | Go to payment page & pay | Verify (usually auto) |
| **Bank Transfer** | Not in system | Go to payment page & upload proof | Verify manually |

**Key Insight**: If `paymentMethod='escrow_wallet'`, vendor doesn't pay again. If `paymentMethod='paystack'/'flutterwave'/'bank_transfer'`, vendor MUST pay via the payment page.

---

## Where to Find the Payment Page

Vendors can access their pending payments from:
1. **Vendor Dashboard** → "Pending Payments" section
2. **Direct URL**: `/vendor/payments/[paymentId]`
3. **Email notification** with payment link (if implemented)

The page shows:
- Amount due
- Payment deadline
- Auction details
- Payment method options
- "Pay Now" buttons

---

**Status**: Explanation Complete
**Date**: 2026-02-14
**Confusion Resolved**: Escrow wallet payments don't require additional payment; external payments do.
