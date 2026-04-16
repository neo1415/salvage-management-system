# Payment Webhook Root Cause Analysis

## Investigation Summary

After thorough investigation, I found MULTIPLE issues preventing the payment webhook from working:

## Issue 1: TypeScript Compilation Errors (FIXED)

**Status**: ✅ FIXED

**Problem**: TypeScript type 'never' errors in `payment.service.ts` lines 616-630

**Root Cause**: TypeScript's control flow analysis couldn't narrow the type of `paymentInfo` variable

**Fix Applied**: Added explicit type guard and const assignment

## Issue 2: Incorrect Before/After Values in Unfreeze Events (PARTIALLY FIXED)

**Status**: ⚠️ PARTIALLY FIXED

**Problem**: Database shows NULL values for `balanceBefore`, `frozenBefore`, `availableBefore`, `availableAfter` fields

**Root Cause**: TWO locations in code had bugs:
1. `processWalletPayment` method - FIXED ✅
2. `handlePaystackWebhook` method - STILL HAS BUG ❌

**Evidence from Database**:
```
Event 1:
  Type: unfreeze
  Amount: ₦100,000
  Balance Before: NULL          ❌ Should have value
  Balance After: 670000.00      ✅ Has value
  Frozen Before: NULL           ❌ Should have value
  Frozen After: 480000.00       ✅ Has value
  Available Before: NULL        ❌ Should have value
  Available After: NULL         ❌ Should have value
```

**Current Code in handlePaystackWebhook** (STILL BUGGY):
```typescript
availableBefore: wallet.availableBalance, // ❌ WRONG - uses wallet object
availableAfter: wallet.availableBalance,  // ❌ WRONG - uses wallet object
```

**Should Be**:
```typescript
availableBefore: wallet.availableBalance, // ✅ CORRECT - available doesn't change during unfreeze
availableAfter: wallet.availableBalance,  // ✅ CORRECT - available doesn't change during unfreeze
```

**WAIT - Actually this is CORRECT!** During unfreeze, only `balance` and `frozen` change. `available` stays the same because:
- Unfreeze: `balance -= deposit`, `frozen -= deposit`, `available` unchanged
- The issue is that `wallet.availableBalance` is a STRING, not parsed to number

## Issue 3: Webhook URL Cannot Be Reached by Paystack (CRITICAL)

**Status**: ❌ NOT FIXED - BLOCKING ISSUE

**Problem**: Paystack webhook URL is set to `http://localhost:3000/api/webhooks/paystack-auction`

**Root Cause**: Paystack servers CANNOT reach localhost URLs

**Evidence**:
- App URL: `http://localhost:3000`
- Webhook URL: `http://localhost:3000/api/webhooks/paystack-auction`
- Paystack is on the internet, cannot reach your local machine

**Impact**: 
- Paystack sends webhook to localhost
- Webhook never reaches your server
- Payment verification never happens
- Deposit never unfreezes
- Pickup authorization never sent
- Money never transferred to finance

**Solutions**:

### Option 1: Use ngrok (RECOMMENDED FOR LOCAL TESTING)
```bash
# Install ngrok
npm install -g ngrok

# Start ngrok tunnel
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update Paystack webhook URL to: https://abc123.ngrok.io/api/webhooks/paystack-auction
```

### Option 2: Deploy to Staging/Production
```bash
# Deploy to Vercel/Heroku/etc
# Update Paystack webhook URL to: https://your-domain.com/api/webhooks/paystack-auction
```

### Option 3: Manual Webhook Simulation (FOR TESTING ONLY)
```bash
# Simulate webhook locally
npx tsx scripts/simulate-paystack-webhook-auction.ts <auction-id>
```

## Issue 4: Auctions Stuck in "awaiting_payment" Status

**Status**: ❌ NOT INVESTIGATED YET

**Problem**: Even after payment is verified, auctions remain in "awaiting_payment" status

**Evidence from Database**:
```
Auction: af6e9385...
Status: awaiting_payment  ❌ Should be "closed" or "payment_verified"
Payment: verified         ✅ Payment is verified
Deposit: unfrozen         ✅ Deposit is unfrozen
```

**Possible Causes**:
1. Auction status not being updated after payment verification
2. Missing code to transition auction from "awaiting_payment" to next status
3. Document generation not triggering status change

**Needs Investigation**: Check auction closure service and payment verification flow

## Issue 5: Fund Release to Finance Not Happening

**Status**: ⚠️ CODE EXISTS BUT NOT TESTED

**Problem**: Money not being transferred to finance officer after payment

**Code Added**:
```typescript
const { triggerFundReleaseOnDocumentCompletion } = await import('@/features/documents/services/document.service');
await triggerFundReleaseOnDocumentCompletion(
  confirmedPayment.auctionId,
  confirmedPayment.vendorId,
  'system'
);
```

**Status**: Code is in place but cannot be tested until webhook URL issue is fixed

## Issue 6: Pickup Authorization Not Being Sent

**Status**: ⚠️ CODE EXISTS BUT NOT TESTED

**Problem**: Vendor not receiving pickup code after payment

**Code Added**:
```typescript
await this.generatePickupAuthorization(confirmedPayment);
```

**Status**: Code is in place but cannot be tested until webhook URL issue is fixed

## Current State Summary

| Issue | Status | Blocking? |
|-------|--------|-----------|
| TypeScript errors | ✅ Fixed | No |
| Before/after values | ⚠️ Needs verification | No |
| Webhook URL unreachable | ❌ Not fixed | **YES** |
| Auction status stuck | ❌ Not investigated | Yes |
| Fund release | ⚠️ Code exists, untested | Unknown |
| Pickup authorization | ⚠️ Code exists, untested | Unknown |

## CRITICAL BLOCKER

**The webhook URL issue is the CRITICAL BLOCKER preventing everything from working.**

Paystack cannot reach `http://localhost:3000`. This means:
- ❌ Webhook never executes
- ❌ Payment never verified automatically
- ❌ Deposit never unfrozen automatically
- ❌ Pickup authorization never sent
- ❌ Fund release never triggered
- ❌ All the "fixes" never run

## Immediate Action Required

1. **Set up ngrok** to expose localhost to internet
2. **Update Paystack webhook URL** in dashboard
3. **Test complete payment flow** with real Paystack payment
4. **Verify webhook execution** in server logs
5. **Check auction status** after payment
6. **Verify fund release** to finance dashboard
7. **Confirm pickup authorization** sent to vendor

## Testing Checklist

- [ ] Set up ngrok tunnel
- [ ] Update Paystack webhook URL
- [ ] Make test payment
- [ ] Check server logs for webhook execution
- [ ] Verify payment status changes to "verified"
- [ ] Verify deposit unfreezes with correct before/after values
- [ ] Verify auction status changes from "awaiting_payment"
- [ ] Verify pickup authorization sent (SMS, email, push, in-app)
- [ ] Verify money transferred to finance dashboard
- [ ] Verify real-time UI updates

## Files Modified

- `src/features/auction-deposit/services/payment.service.ts` - Fixed TypeScript errors, added fund release and pickup authorization
- `scripts/clear-stuck-pending-payments.ts` - New script to clear stuck payments
- `scripts/test-webhook-endpoint.ts` - New script to test webhook endpoint
- `scripts/check-paystack-webhook-config.ts` - New script to check Paystack configuration

## Next Steps

1. User needs to set up ngrok or deploy to staging
2. Update Paystack webhook URL
3. Test complete flow with real payment
4. Investigate auction status issue if it persists
5. Verify all notifications are sent
6. Verify fund release works correctly
