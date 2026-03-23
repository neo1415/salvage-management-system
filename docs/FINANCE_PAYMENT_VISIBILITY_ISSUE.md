# Finance Payment Visibility Issue

## Problem Statement

The Finance Dashboard shows:
- Total Payments: 1
- Pending: 0
- Verified: 0
- Rejected: 0
- Total Amount: ₦0

But the Finance Payments page shows:
- Total Today: 0
- Auto-Verified: 0
- Pending Manual: 0
- Overdue: 0
- No pending payments

User mentions there's a payment "frozen in the escrow wallet" but it's not visible on the payments page.

## Root Cause Analysis

There are TWO different systems for tracking money:

### 1. Payments Table (`payments`)
- Tracks auction payments from vendors
- Used by Finance Dashboard API (`/api/dashboard/finance`)
- Shows ALL payments regardless of date
- Statuses: pending, verified, rejected, overdue
- Payment methods: paystack, flutterwave, bank_transfer, escrow_wallet

### 2. Escrow Wallets (`escrow_wallets` + `wallet_transactions`)
- Tracks vendor wallet balances
- Has `frozenAmount` field for money held in escrow
- Wallet transactions track: credit, debit, freeze, unfreeze
- NOT shown on Finance Payments page

## Why Payments Don't Show

The Finance Payments page (`/api/finance/payments`) has VERY specific filters:

```typescript
// Only shows payments that meet ALL these criteria:
1. Created TODAY (since midnight)
2. Payment method = 'bank_transfer'
3. Status = 'pending'
```

So if your payment is:
- ❌ Created yesterday or earlier → Won't show
- ❌ Using escrow_wallet method → Won't show
- ❌ Already verified/rejected → Won't show
- ❌ Just an escrow wallet transaction (not in payments table) → Won't show

## Debugging Steps

### Step 1: Check What's in the Database

Run the debug script:

```bash
npx tsx scripts/check-payment-status.ts
```

This will show you:
- All payments in the `payments` table
- All escrow wallets and their balances
- Frozen amounts in wallets
- All wallet transactions
- Today's payments specifically
- Bank transfer payments

### Step 2: Understand What You're Looking At

**If you see a payment in the `payments` table:**
- Check the `createdAt` date - is it today?
- Check the `paymentMethod` - is it bank_transfer?
- Check the `status` - is it pending?
- Check the `escrowStatus` - is it frozen?

**If you only see escrow wallet transactions:**
- The "payment" is actually just a wallet transaction
- It won't show on the Finance Payments page
- It's tracked in the vendor's wallet, not the payments table

## Solutions

### Option 1: Show All Payments (Recommended)

Update `/api/finance/payments` to show ALL pending payments, not just today's bank transfers:

```typescript
// Remove the date filter
// Remove the payment method filter
// Show all pending payments

const pendingPayments = await db
  .select({...})
  .from(payments)
  .where(eq(payments.status, 'pending'))  // Just this
  .orderBy(sql`${payments.createdAt} DESC`);
```

### Option 2: Add Tabs for Different Views

Add tabs to the Finance Payments page:
- **Today's Payments** (current view)
- **All Pending** (all pending payments)
- **Escrow Frozen** (payments with escrowStatus='frozen')
- **All Payments** (everything)

### Option 3: Show Escrow Wallet Transactions

If the "payment" is actually an escrow wallet transaction, you need a separate page to view:
- Escrow wallet balances
- Frozen amounts
- Wallet transaction history

## Quick Fix

To see ALL pending payments immediately, update the Finance Payments API:

**File**: `src/app/api/finance/payments/route.ts`

**Change this:**
```typescript
.where(
  and(
    eq(payments.status, 'pending'),
    eq(payments.paymentMethod, 'bank_transfer')
  )
)
```

**To this:**
```typescript
.where(eq(payments.status, 'pending'))
```

And remove the "today" filter from stats calculation.

## Understanding the Data Flow

### When a vendor wins an auction:

1. **Payment Record Created** in `payments` table
   - Status: 'pending'
   - Payment method: chosen by vendor
   - Escrow status: 'none' initially

2. **If using escrow wallet:**
   - Money is FROZEN in their wallet
   - `escrowStatus` changes to 'frozen'
   - `frozenAmount` increases in `escrow_wallets`
   - Wallet transaction created with type='freeze'

3. **Finance Officer verifies:**
   - Payment status changes to 'verified'
   - If escrow: money is RELEASED from wallet
   - `escrowStatus` changes to 'released'
   - Wallet transaction created with type='unfreeze'

## Next Steps

1. **Run the debug script** to see what's actually in your database
2. **Decide which solution** fits your needs best
3. **Update the API** to show the payments you want to see
4. **Consider adding** an escrow wallet management page for Finance Officers

## Important Notes

- The Finance Dashboard counts ALL payments (no filters)
- The Finance Payments page only shows TODAY's BANK TRANSFER payments
- This disconnect causes confusion
- Escrow wallet transactions are separate from payment records
- A payment can have `escrowStatus='frozen'` but still be in `payments` table

---

**Status**: Issue Identified - Awaiting User Decision on Solution
**Date**: 2026-02-14
**Impact**: Medium - Finance Officers can't see all pending payments
