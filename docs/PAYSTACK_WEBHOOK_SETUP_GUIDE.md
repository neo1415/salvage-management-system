# Paystack Webhook Setup Guide

## Overview

This guide explains how to configure Paystack webhooks so that auction payments are automatically verified without manual intervention.

## Why Webhooks Are Required

When a user completes a Paystack payment:
1. ✅ Paystack processes the payment
2. ✅ User sees "Payment Successful"
3. ❌ **Your system doesn't know yet**

Without webhooks, payments stay "pending" forever because your system never receives notification from Paystack.

## Setup Instructions

### Production Setup

1. **Login to Paystack Dashboard**
   - Go to: https://dashboard.paystack.com
   - Login with your account

2. **Navigate to Webhooks**
   - Click: Settings (gear icon)
   - Click: Webhooks

3. **Add Webhook URL**
   - Click: "Add Webhook URL"
   - Enter URL: `https://your-production-domain.com/api/webhooks/paystack-auction`
   - Example: `https://nem-insurance.com/api/webhooks/paystack-auction`

4. **Subscribe to Events**
   - Check: `charge.success`
   - Uncheck all other events (optional - they're ignored anyway)

5. **Save**
   - Click: "Save"
   - Paystack will send a test webhook

6. **Verify**
   - Check "Recent Deliveries" tab
   - Should see test webhook with 200 OK response

### Development Setup (Using ngrok)

For local testing, you need to expose your local server to the internet:

1. **Install ngrok**
   ```bash
   # Windows (using Chocolatey)
   choco install ngrok
   
   # Or download from: https://ngrok.com/download
   ```

2. **Start your local server**
   ```bash
   npm run dev
   ```

3. **Expose with ngrok**
   ```bash
   ngrok http 3000
   ```

4. **Copy HTTPS URL**
   - ngrok will show: `https://abc123.ngrok.io`
   - Copy this URL

5. **Add to Paystack Dashboard**
   - Go to: Settings → Webhooks
   - Add URL: `https://abc123.ngrok.io/api/webhooks/paystack-auction`
   - Subscribe to: `charge.success`
   - Save

6. **Test**
   - Make a test payment
   - Watch ngrok console for webhook calls
   - Check your app logs

### Environment Variables

Ensure your `.env` has:
```env
PAYSTACK_SECRET_KEY=sk_live_xxxxx  # For production
# OR
PAYSTACK_SECRET_KEY=sk_test_xxxxx  # For testing
```

**Important:** Paystack uses the SAME secret key for:
- API authentication
- Webhook signature verification

## Testing Webhooks

### Method 1: Simulate Webhook (No Paystack Required)

```bash
npx tsx scripts/simulate-paystack-webhook-auction.ts <auction-id>
```

This simulates a successful Paystack webhook locally.

### Method 2: Test with Real Payment

1. Create a test auction
2. Place winning bid
3. Initiate Paystack payment
4. Complete payment with test card:
   - Card: 4084 0840 8408 4081
   - Expiry: Any future date
   - CVV: 408
   - PIN: 0000
   - OTP: 123456

5. Check webhook logs:
   ```bash
   # In your app console, you should see:
   📥 Paystack webhook received
   Webhook event: charge.success
   Payment reference: PAY-xxx-xxx
   ✅ Processing successful payment...
   ✅ Webhook processed successfully
   ```

### Method 3: Check Paystack Dashboard

1. Go to: Settings → Webhooks
2. Click on your webhook URL
3. View "Recent Deliveries"
4. Check status codes:
   - ✅ 200: Success
   - ❌ 401: Invalid signature (check secret key)
   - ❌ 404: URL not found (check URL)
   - ❌ 500: Server error (check logs)

## Troubleshooting

### Webhook Returns 401 (Unauthorized)

**Cause:** Secret key mismatch

**Fix:**
1. Check `.env` has correct `PAYSTACK_SECRET_KEY`
2. Restart your server
3. Test again

### Webhook Returns 404 (Not Found)

**Cause:** Incorrect URL

**Fix:**
1. Verify URL is: `https://your-domain.com/api/webhooks/paystack-auction`
2. No trailing slash
3. Must be HTTPS (not HTTP)

### Webhook Returns 500 (Server Error)

**Cause:** Bug in webhook handler

**Fix:**
1. Check server logs for error details
2. Common issues:
   - Database connection failed
   - Payment record not found
   - Wallet not found

### No Webhook Attempts Shown

**Cause:** Webhook URL not configured

**Fix:**
1. Go to Paystack Dashboard → Settings → Webhooks
2. Verify webhook URL is added
3. Verify `charge.success` is checked
4. Save and test again

### Payment Still Pending After Webhook

**Cause:** Webhook succeeded but payment not verified

**Fix:**
1. Check webhook logs for errors
2. Run diagnostic:
   ```bash
   npx tsx scripts/diagnose-current-payment-state.ts
   ```
3. Check if payment status is "verified"
4. If not, check for errors in webhook handler

## Security Notes

1. **Always verify signature** - Webhook handler verifies Paystack signature to prevent spoofing
2. **Use HTTPS only** - Paystack requires HTTPS for webhooks
3. **Keep secret key secure** - Never commit to git or expose publicly
4. **Idempotency** - Webhook handler is idempotent (safe to call multiple times)

## Monitoring

### Check Webhook Health

```bash
# View recent webhook attempts
curl https://dashboard.paystack.com/settings/webhooks

# Or check your app logs
tail -f logs/webhook-*.log
```

### Set Up Alerts

Consider setting up alerts for:
- Failed webhook deliveries (>5 in 1 hour)
- Webhook response time >5 seconds
- Webhook signature verification failures

## Next Steps

After setup:
1. ✅ Test with real payment
2. ✅ Monitor webhook deliveries
3. ✅ Set up alerts for failures
4. ✅ Document in deployment guide
