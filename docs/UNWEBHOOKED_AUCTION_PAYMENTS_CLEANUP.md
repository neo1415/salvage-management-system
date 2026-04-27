# Unwebhooked Auction Payments Cleanup

## Overview

This document explains how to find and cancel auction payments that are stuck in 'pending' status because they haven't been processed by Paystack webhooks.

## Problem

Sometimes auction payments can get stuck in 'pending' status if:
- The Paystack webhook fails to fire
- The webhook endpoint is unreachable
- There's a network issue during webhook delivery
- The payment was initiated but never completed

These stuck payments can cause issues with:
- Vendor wallet balances
- Auction payment tracking
- Finance reporting

## Solution

We created a script that:
1. Finds all pending auction payments older than 30 minutes
2. Lists them with full details
3. Optionally cancels them to clean up the database

## Usage

### Dry Run (Safe - No Changes)

To see what payments would be cancelled without actually cancelling them:

```bash
npx tsx scripts/find-and-cancel-unwebhooked-auction-payments.ts
```

This will show you:
- How many unwebhooked payments exist
- Full details of each payment (ID, auction, vendor, amount, age, etc.)
- No changes will be made

### Live Mode (Cancels Payments)

To actually cancel the unwebhooked payments:

```bash
npx tsx scripts/find-and-cancel-unwebhooked-auction-payments.ts --live
```

Or:

```bash
npx tsx scripts/find-and-cancel-unwebhooked-auction-payments.ts -l
```

This will:
- Find all unwebhooked payments
- Cancel each one by setting status to 'cancelled'
- Report success/failure for each payment

## What Gets Cancelled

The script only cancels payments that meet ALL these criteria:

1. **Status is 'pending'** - Not completed, verified, or already cancelled
2. **Has an auction_id** - It's an auction payment (not registration fee, etc.)
3. **Older than 30 minutes** - To avoid cancelling legitimate pending payments

## Safety Features

- **Dry run by default** - You must explicitly use `--live` to make changes
- **30-minute threshold** - Recent payments are not touched
- **Detailed logging** - See exactly what will be cancelled before you do it
- **Error handling** - Failed cancellations are logged but don't stop the script

## Example Output

### Dry Run Mode

```
🔍 FINDING UNWEBHOOKED AUCTION PAYMENTS

============================================================
⚠️  DRY RUN MODE - No payments will be cancelled
============================================================

📊 FOUND 3 UNWEBHOOKED AUCTION PAYMENTS

Payment Details:
------------------------------------------------------------

Payment ID: abc-123
  Auction ID: auction-456
  Vendor ID: vendor-789
  Amount: ₦50,000
  Method: paystack
  Status: pending
  Reference: PAY-REF-123
  Created: 2026-04-20T12:00:00.000Z (89 minutes ago)
  Paystack Ref: ps_ref_xyz

Payment ID: def-456
  Auction ID: auction-789
  Vendor ID: vendor-012
  Amount: ₦75,000
  Method: paystack
  Status: pending
  Reference: PAY-REF-456
  Created: 2026-04-20T11:30:00.000Z (119 minutes ago)
  Paystack Ref: ps_ref_abc

============================================================

⚠️  DRY RUN - No changes made

To actually cancel these payments, run:
npx tsx scripts/find-and-cancel-unwebhooked-auction-payments.ts --live
```

### Live Mode

```
🔍 FINDING UNWEBHOOKED AUCTION PAYMENTS

============================================================
🚨 LIVE MODE - Payments will be cancelled!
============================================================

📊 FOUND 3 UNWEBHOOKED AUCTION PAYMENTS

Payment Details:
------------------------------------------------------------
[... payment details ...]

============================================================

🚨 CANCELLING PAYMENTS...

✅ Cancelled payment abc-123
✅ Cancelled payment def-456
✅ Cancelled payment ghi-789

============================================================

✅ Successfully cancelled: 3
❌ Failed to cancel: 0
📊 Total processed: 3

✅ Script completed successfully
```

## When to Use This

Use this script when:
- You notice stuck pending payments in the database
- Finance reports show incorrect pending amounts
- Vendors report payment issues
- After webhook configuration changes
- During system maintenance

## What Happens After Cancellation

When a payment is cancelled:
1. Status changes from 'pending' to 'cancelled'
2. The payment is no longer counted in pending totals
3. The vendor can initiate a new payment if needed
4. Finance reports will exclude the cancelled payment

## Important Notes

1. **Always run dry run first** - See what will be cancelled before doing it
2. **30-minute threshold** - Adjust if needed for your use case
3. **Auction payments only** - Registration fees and other payments are not affected
4. **No refunds** - This only updates the database status, it doesn't process refunds
5. **Manual verification** - Check with Paystack dashboard if payment was actually processed

## Troubleshooting

### No Payments Found

If the script finds 0 payments:
- All payments have been processed by webhooks ✅
- Or all pending payments are less than 30 minutes old
- This is the expected/healthy state

### Script Fails

If the script errors:
- Check database connection
- Verify the payments table exists
- Check the error message for details

### Payments Keep Appearing

If you keep finding unwebhooked payments:
- Check Paystack webhook configuration
- Verify webhook endpoint is reachable
- Check webhook logs in Paystack dashboard
- Review webhook handler code for errors

## Related Files

- Script: `scripts/find-and-cancel-unwebhooked-auction-payments.ts`
- Webhook Handler: `src/app/api/webhooks/paystack-auction/route.ts`
- Payment Schema: `src/lib/db/schema/auction-deposit.ts`
- Payment Service: `src/features/auction-deposit/services/payment.service.ts`

## See Also

- [Payment Webhook Setup Guide](./PAYSTACK_WEBHOOK_SETUP_GUIDE.md)
- [Payment Flow Documentation](./PAYMENT_FLOW_FINAL_EXPLANATION.md)
- [Auction Deposit System](./AUCTION_DEPOSIT_COMPLETE_INTEGRATION.md)
