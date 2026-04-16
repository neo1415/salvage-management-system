# Paystack Payment Silent Failure - Debug Guide

## Issue
Payment button shows "Processing" then stops and returns to normal with no errors in logs.

## Changes Made

### 1. Enhanced Frontend Logging (`payment-options.tsx`)
Added detailed console logs to track:
- When payment is initiated
- API response status and data
- Error responses with full details

### 2. Enhanced API Route Error Handling (`payment/paystack/route.ts`)
- Returns detailed error messages instead of generic ones
- Includes error stack traces in response
- Logs error details to console

### 3. Enhanced Payment Service Logging (`payment.service.ts`)
Added comprehensive logging for:
- Paystack initialization parameters
- Request payload sent to Paystack API
- Paystack API response status and data
- Response structure validation

## How to Debug

### Step 1: Open Browser Console
1. Open the auction page where you're trying to pay
2. Open browser DevTools (F12)
3. Go to Console tab
4. Clear any existing logs

### Step 2: Attempt Payment
1. Click "Pay with Paystack" button
2. Watch the console for logs in this order:

```
Initiating Paystack payment for auction: [auction-id]
Paystack API response status: [200 or 500]
Paystack API response ok: [true or false]
Paystack API response data: {...}
```

### Step 3: Check Server Logs
Look for these logs in your terminal:

```
Paystack initialization details: {
  remainingAmount: 20000,
  amountInKobo: 2000000,
  hasSecretKey: true,
  appUrl: 'http://localhost:3000',
  email: '[vendor-email]',
  reference: 'PAY-[auction-id]-[timestamp]'
}

Paystack API request payload: {...}
Paystack API response status: [200 or error]
Paystack API success response: {...}
```

### Step 4: Identify the Issue

#### If you see "PAYSTACK_SECRET_KEY not configured"
- Check `.env` file has `PAYSTACK_SECRET_KEY=sk_test_...`
- Restart your dev server after adding the key

#### If you see "Paystack initialization failed: [error]"
- Check the Paystack API error message
- Common issues:
  - Invalid API key
  - Invalid email format
  - Amount too small (minimum ₦100)
  - Invalid reference format

#### If you see "Invalid response from Paystack: missing authorization_url"
- Paystack API returned success but wrong structure
- Check Paystack API response in logs
- May indicate API version mismatch

#### If you see "No authorization_url in response"
- Frontend received response but missing URL
- Check API route response structure
- Verify `authorization_url` field exists

#### If logs stop at "Initiating Paystack payment"
- Network request failed
- Check browser Network tab for failed requests
- May be CORS or network connectivity issue

## Expected Flow

### Success Flow:
1. Frontend: "Initiating Paystack payment for auction: [id]"
2. Backend: "Paystack initialization details: {...}"
3. Backend: "Paystack API request payload: {...}"
4. Backend: "Paystack API response status: 200"
5. Backend: "Paystack API success response: {...}"
6. Frontend: "Paystack API response status: 200"
7. Frontend: "Paystack API response ok: true"
8. Frontend: "Paystack response: { authorization_url: '...', ... }"
9. Modal opens with Paystack payment page

### Error Flow:
1. Frontend: "Initiating Paystack payment for auction: [id]"
2. Backend: "Paystack initialization details: {...}"
3. Backend: "Paystack API error response: {...}"
4. Backend: "Paystack initialization error: Error: [message]"
5. Frontend: "Paystack API response status: 500"
6. Frontend: "Paystack API response ok: false"
7. Frontend: "Paystack error response: { error: '...' }"
8. Alert shows error message

## Common Issues & Solutions

### Issue: Silent Failure (No Logs)
**Cause**: JavaScript error before logging starts
**Solution**: Check browser console for uncaught errors

### Issue: "Processing" Stuck
**Cause**: `setProcessing(false)` not called in finally block
**Solution**: Already fixed - finally block ensures it's always called

### Issue: Paystack API Returns 401
**Cause**: Invalid or expired API key
**Solution**: 
- Verify `PAYSTACK_SECRET_KEY` in `.env`
- Get new key from Paystack dashboard
- Ensure using test key for development

### Issue: Amount Too Small
**Cause**: Paystack minimum is ₦100 (10,000 kobo)
**Solution**: Ensure `remainingAmount >= 100`

### Issue: Invalid Email
**Cause**: User email is null or invalid format
**Solution**: Check user record has valid email

## Testing Checklist

- [ ] Browser console shows "Initiating Paystack payment"
- [ ] Server logs show "Paystack initialization details"
- [ ] Server logs show "Paystack API request payload"
- [ ] Server logs show "Paystack API response status: 200"
- [ ] Frontend shows "Paystack API response status: 200"
- [ ] Frontend shows "Paystack response" with authorization_url
- [ ] Modal opens with Paystack payment page
- [ ] No errors in browser console
- [ ] No errors in server logs

## Quick Test Script

Run this script to test Paystack integration without using the UI:

```bash
npx tsx scripts/test-paystack-payment-flow.ts
```

This will:
1. Find an auction with an active winner
2. Validate all requirements (email, amount, etc.)
3. Make an actual API call to Paystack
4. Show the exact response from Paystack

If this script succeeds but the UI fails, the issue is in the frontend/API route.
If this script fails, the issue is with Paystack configuration or data.

## Next Steps

After running the test:
1. Copy all console logs (browser + server)
2. Share the logs to identify the exact failure point
3. We'll fix the specific issue based on where it fails

## Environment Variables to Verify

```bash
# Required for Paystack
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Files Modified

1. `src/components/vendor/payment-options.tsx` - Enhanced frontend logging
2. `src/app/api/auctions/[id]/payment/paystack/route.ts` - Enhanced error handling
3. `src/features/auction-deposit/services/payment.service.ts` - Enhanced service logging
