# Paystack Webhook Auction Payment Fix

## Problem

You have TWO Paystack webhook endpoints:
1. `/api/webhooks/paystack` - ✅ Configured, works for wallet funding
2. `/api/webhooks/paystack-auction` - ❌ NOT configured, auction payments fail

When you complete an auction payment via Paystack:
- Paystack sends webhook to `/api/webhooks/paystack` (the only one configured)
- That handler doesn't know how to process auction payments
- Auction payment stays "pending" forever
- Frozen deposit never unfreezes

## Solution (Choose One)

### Option A: Add Second Webhook URL (Recommended)

Add the auction webhook URL to your Paystack Dashboard:

1. Go to: https://dashboard.paystack.com/settings/webhooks
2. You should see existing webhook: `https://nemsalvage.com/api/webhooks/paystack`
3. Click "Add Webhook URL"
4. Enter: `https://nemsalvage.com/api/webhooks/paystack-auction`
5. Subscribe to: `charge.success`
6. Save

Now you'll have TWO webhooks:
- `https://nemsalvage.com/api/webhooks/paystack` → Wallet funding
- `https://nemsalvage.com/api/webhooks/paystack-auction` → Auction payments

### Option B: Unified Webhook Handler (Better Long-term)

Create a single webhook that routes to the correct handler based on payment reference:

1. Keep only `/api/webhooks/paystack` configured in Paystack
2. Modify it to detect auction payments and route accordingly
3. See implementation below

## Implementation: Unified Webhook

This approach uses a single webhook URL that intelligently routes to the correct handler.


## What I Fixed

Modified `/api/webhooks/paystack/route.ts` to be a **unified webhook handler** that:

1. Receives ALL Paystack webhooks (already configured at `https://nemsalvage.com/api/webhooks/paystack`)
2. Verifies signature (security)
3. Checks payment reference pattern:
   - If starts with `PAY-` or `PAY_` → Routes to auction payment handler
   - Otherwise → Routes to wallet funding handler
4. Processes payment and returns success

## How It Works

```
Paystack Payment Complete
         ↓
Webhook sent to: https://nemsalvage.com/api/webhooks/paystack
         ↓
Unified Handler checks reference:
         ↓
    ┌────────────────┐
    │  Reference?    │
    └────────────────┘
         ↓         ↓
    PAY-xxx    WF-xxx
         ↓         ↓
   Auction    Wallet
   Handler    Handler
         ↓         ↓
    Unfreeze   Credit
    Deposit    Wallet
```

## Testing

### Test Auction Payment:
1. Create auction and place winning bid
2. Initiate Paystack payment (₦30k)
3. Complete payment with test card
4. Check console logs:
   ```
   📥 Paystack webhook received (unified handler)
   Webhook event: charge.success
   Payment reference: PAY-260582d5-xxx
   🎯 Routing to auction payment handler
   ✅ Auction payment processed successfully
   ```
5. Verify:
   - Payment status: "verified"
   - Frozen deposit: Unfrozen
   - "Pay Now" button: Disappeared

### Test Wallet Funding:
1. Go to wallet page
2. Click "Fund Wallet"
3. Complete Paystack payment
4. Check console logs:
   ```
   📥 Paystack webhook received (unified handler)
   Webhook event: charge.success
   Payment reference: WF-xxx
   💰 Routing to wallet funding handler
   ✅ Wallet funding processed successfully
   ```
5. Verify wallet balance increased

## Benefits

✅ Single webhook URL to maintain
✅ No need to configure second webhook in Paystack
✅ Automatic routing based on payment type
✅ Works for both local and production
✅ Backward compatible with existing wallet funding

## No Action Required

The fix is already applied! Your existing webhook configuration at `https://nemsalvage.com/api/webhooks/paystack` will now handle BOTH wallet funding AND auction payments automatically.

Just restart your server and test an auction payment.
