# BVN Verification Test Mode Guide

## Issue
When testing BVN verification with Paystack test API keys, real BVNs cannot be verified. You'll see the error:
```
Test mode: Please use test BVN 12345678901 for testing. Real BVN verification requires production Paystack keys.
```

## Why This Happens
Paystack's test API keys (`sk_test_...`) do not have access to the real BVN database. They only work with the test BVN: `12345678901`

## Solutions

### Option 1: Use Test BVN (Recommended for Development)
Use the test BVN `12345678901` when testing the Tier 1 KYC flow in development:

1. Navigate to `/vendor/kyc/tier1`
2. Enter BVN: `12345678901`
3. Click "Verify My Identity"
4. The system will automatically approve the verification

**Benefits:**
- Works immediately without any configuration
- No cost per verification
- Perfect for testing the UI and flow

### Option 2: Use Production Paystack Keys
If you need to test with real BVNs, you must use production Paystack keys:

1. Get your production keys from [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developers)
2. Update `.env`:
   ```env
   PAYSTACK_SECRET_KEY=sk_live_your_production_key_here
   PAYSTACK_PUBLIC_KEY=pk_live_your_production_key_here
   ```
3. Restart your development server
4. Now you can verify real BVNs

**Important Notes:**
- Each BVN verification costs ₦50
- You need a funded Paystack account
- Only use production keys when absolutely necessary

### Option 3: Mock Mode (For UI Testing Only)
If you just want to test the UI without actual verification, you can temporarily modify the API to always return success:

**Not recommended for production testing!**

## Test BVN Details
```
BVN: 12345678901
```

When you use this test BVN, the system will:
- Accept any name you provide
- Accept any date of birth
- Accept any phone number
- Always return 100% match score
- Auto-approve to Tier 1

## Current Configuration
Your current `.env` has:
```env
PAYSTACK_SECRET_KEY=sk_test_45ca11545148bed4becda5de54198e677eecbcbf
```

This is a **test key**, so only the test BVN `12345678901` will work.

## Testing Checklist

### With Test BVN (Development)
- [ ] Navigate to `/vendor/kyc/tier1`
- [ ] Verify profile information is displayed
- [ ] Enter BVN: `12345678901`
- [ ] Click "Verify My Identity"
- [ ] Verify success message appears
- [ ] Verify redirect to dashboard after 3 seconds
- [ ] Check user status is updated to `verified_tier_1`

### With Real BVN (Production)
- [ ] Switch to production Paystack keys
- [ ] Ensure Paystack account is funded
- [ ] Test with a real BVN
- [ ] Verify name matching works correctly
- [ ] Verify date of birth matching works
- [ ] Verify phone number matching works
- [ ] Test mismatch scenarios

## Error Messages

### Test Mode Error
```
Test mode: Please use test BVN 12345678901 for testing. Real BVN verification requires production Paystack keys.
```
**Solution:** Use test BVN `12345678901` or switch to production keys

### Configuration Error
```
BVN Service Unavailable - Configuration Error
```
**Solution:** Check that `PAYSTACK_SECRET_KEY` is set in `.env`

### API Error
```
Paystack API error: 401 Unauthorized
```
**Solution:** Check that your Paystack key is valid and not expired

### Network Error
```
BVN Service Unavailable
```
**Solution:** Check your internet connection and Paystack API status

## Paystack BVN API Documentation
- [Paystack Identity Verification](https://paystack.com/docs/identity-verification/resolve-bvn)
- [Paystack Test Mode](https://paystack.com/docs/payments/test-payments)
- Cost: ₦50 per verification (production only)

## Next Steps
1. For development: Use test BVN `12345678901`
2. For production: Get production Paystack keys and fund your account
3. Test the complete flow end-to-end
4. Verify email and SMS notifications are sent

## Support
If you continue to have issues:
1. Check the server logs for detailed error messages
2. Verify your Paystack account is active
3. Contact Paystack support if API issues persist
