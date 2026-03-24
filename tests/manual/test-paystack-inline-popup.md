# Manual Test: Paystack Inline Popup Integration

## Test Objective
Verify that Paystack inline popup works without SRI errors and completes payments successfully.

## Prerequisites
- Dev server running with updated `.env` file
- Test vendor account with pending payment
- Paystack test mode enabled

## Test Steps

### 1. Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### 2. Navigate to Payment Page
1. Login as a vendor
2. Go to a pending payment (or create one by winning an auction)
3. URL should be: `/vendor/payments/[payment-id]`

### 3. Test Inline Popup
1. Click "Pay Now with Paystack" button
2. **Expected**: Popup opens on the same page (no redirect)
3. **Expected**: No SRI errors in console
4. **Expected**: Paystack payment form loads inside popup

### 4. Complete Test Payment
Use Paystack test cards:

**Success Card:**
- Card Number: `4084084084084081`
- CVV: `408`
- Expiry: Any future date (e.g., `12/25`)
- PIN: `0000`
- OTP: `123456`

**Steps:**
1. Enter card details
2. Click "Pay"
3. Enter PIN when prompted
4. Enter OTP when prompted
5. **Expected**: Payment successful message
6. **Expected**: Redirect to verification page

### 5. Test Cancellation
1. Click "Pay Now with Paystack" again
2. Click the X or close button on popup
3. **Expected**: Popup closes
4. **Expected**: Error message: "Payment cancelled. You can try again when ready."

### 6. Verify Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. **Expected**: No SRI errors
4. **Expected**: No "Failed to find a valid digest" errors
5. **Expected**: Only normal Paystack logs

### 7. Test Different Browsers
Repeat steps 3-6 in:
- Chrome
- Firefox
- Edge
- Safari (if on Mac)

## Expected Results

✅ Popup opens without redirect
✅ No SRI integrity errors
✅ Payment form loads correctly
✅ Test payment completes successfully
✅ Cancellation works properly
✅ Works in all browsers
✅ Works with browser extensions enabled

## Failure Scenarios

### If Popup Doesn't Open
- Check console for "Paystack SDK not loaded" error
- Verify `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` is in `.env`
- Restart dev server
- Clear browser cache

### If Payment Fails
- Verify using correct test card
- Check Paystack dashboard for transaction
- Check webhook logs
- Verify secret key is correct

### If SRI Errors Still Appear
- This should NOT happen with inline popup
- If it does, the Paystack SDK itself has issues
- Contact Paystack support

## Comparison: Before vs After

### Before (Hosted Checkout)
- ❌ Redirects to checkout.paystack.com
- ❌ SRI errors block scripts
- ❌ Payment fails
- ❌ User frustrated

### After (Inline Popup)
- ✅ Popup opens on your domain
- ✅ No SRI errors
- ✅ Payment completes
- ✅ Better UX

## Notes
- Inline popup is the recommended integration method
- More secure (user never leaves your domain)
- Better UX (no page reload)
- Works with all browsers and extensions
- Same webhook handling as before

## Test Status
- [ ] Popup opens successfully
- [ ] No SRI errors in console
- [ ] Test payment completes
- [ ] Cancellation works
- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] Tested in Edge
- [ ] Webhook receives payment
- [ ] Payment status updates correctly
