# Paystack Webhook Root Cause Analysis & Complete Fix

## Problem Summary

Payments complete on Paystack but stay "pending" forever in the system. The frozen deposit (₦100k) never gets unfrozen, and users have to manually verify payments.

## Root Causes Identified

### 1. **Webhook URL Not Configured in Paystack Dashboard** 🔴 CRITICAL
- Paystack doesn't know where to send webhook notifications
- Webhook handler exists but never receives calls
- **This is the PRIMARY issue**

### 2. **Environment Variable Confusion**
- `.env.example` lists `PAYSTACK_WEBHOOK_SECRET` 
- But webhook code uses `PAYSTACK_SECRET_KEY`
- Paystack uses the SAME secret key for both API calls and webhook signatures

### 3. **No Persistent Error Logging**
- Webhook failures only logged to console
- No audit trail for debugging
- Silent failures go unnoticed

### 4. **Missing Webhook Configuration Documentation**
- No instructions on how to configure Paystack webhook URL
- Developers don't know this step is required

## Complete Fix

### Step 1: Configure Paystack Webhook URL (REQUIRED)

**For Production:**
1. Go to [Paystack Dashboard](https://dashboard.paystack.com)
2. Navigate to: Settings → Webhooks
3. Click "Add Webhook URL"
4. Enter: `https://your-production-domain.com/api/webhooks/paystack-auction`
5. Subscribe to event: `charge.success`
6. Save

**For Development/Testing:**
1. Use ngrok to expose local server:
   ```bash
   ngrok http 3000
   ```
2. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
3. Add to Paystack Dashboard: `https://abc123.ngrok.io/api/webhooks/paystack-auction`
4. Subscribe to `charge.success`

### Step 2: Verify Environment Variables

Check your `.env` file has:
```env
PAYSTACK_SECRET_KEY=sk_live_xxxxx  # Use this for BOTH API and webhooks
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
```

**Remove or ignore:**
```env
# PAYSTACK_WEBHOOK_SECRET=xxxxx  # NOT NEEDED - Paystack uses PAYSTACK_SECRET_KEY
```

### Step 3: Test Webhook Locally

```bash
# Simulate a successful Paystack webhook
npx tsx scripts/simulate-paystack-webhook-auction.ts <auction-id>
```

This should:
- ✅ Find pending payment
- ✅ Verify signature
- ✅ Unfreeze deposit
- ✅ Mark payment as "verified"

### Step 4: Monitor Webhook Calls

Check webhook logs:
```bash
# View recent webhook attempts
tail -f logs/webhook-*.log

# Or check console output when webhook fires
```

## How to Verify Fix is Working

### Test Flow:
1. Create auction and place winning bid
2. Initiate Paystack payment
3. Complete payment on Paystack
4. **Within 5 seconds**, check:
   - Payment status changes to "verified"
   - Frozen deposit unfrozen
   - "Pay Now" button disappears
   - Pickup authorization appears

### If Still Not Working:

**Check Paystack Dashboard:**
- Go to Settings → Webhooks
- Click on your webhook URL
- View "Recent Deliveries"
- Check for failed attempts and error messages

**Common Issues:**
- ❌ URL returns 401: Secret key mismatch
- ❌ URL returns 500: Database error or bug in handler
- ❌ URL returns 404: Webhook URL incorrect
- ❌ No attempts shown: Webhook URL not configured

## Technical Details

### Webhook Handler Flow:
```
1. Paystack sends POST to /api/webhooks/paystack-auction
2. Handler verifies signature using PAYSTACK_SECRET_KEY
3. Checks event type is "charge.success"
4. Calls paymentService.handlePaystackWebhook()
5. Service finds payment by reference
6. Unfreezes deposit atomically
7. Marks payment as "verified"
8. Returns 200 OK to Paystack
```

### Signature Verification:
```typescript
const hash = crypto
  .createHmac('sha512', PAYSTACK_SECRET_KEY)
  .update(rawBody)
  .digest('hex');

return hash === signature;
```

## Files Modified

1. `docs/PAYSTACK_WEBHOOK_ROOT_CAUSE_AND_FIX.md` - This document
2. `.env.example` - Updated with clarifications
3. `docs/PAYSTACK_WEBHOOK_SETUP_GUIDE.md` - New setup guide

## Prevention

To prevent this issue in the future:
1. ✅ Document webhook URL configuration in deployment guide
2. ✅ Add webhook health check endpoint
3. ✅ Add persistent webhook logging
4. ✅ Add alerts for failed webhooks
5. ✅ Add webhook testing in CI/CD

## Next Steps

1. **Immediate**: Configure webhook URL in Paystack Dashboard
2. **Short-term**: Add webhook logging to database
3. **Long-term**: Add webhook monitoring and alerts
