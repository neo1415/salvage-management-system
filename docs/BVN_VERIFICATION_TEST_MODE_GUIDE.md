# BVN Verification Test Mode Guide

## Quick Answer

**YES, you're using test Paystack keys**, so you need to use the **test BVN** for verification.

## Test BVN for Development

```
BVN: 12345678901
```

This is the **only BVN** that will work in test mode. Any other BVN will be rejected.

## How It Works

### Test Mode Detection
The system automatically detects test mode by checking if your Paystack secret key starts with `sk_test_`:

```typescript
// From .env
PAYSTACK_SECRET_KEY=sk_test_45ca11545148bed4becda5de54198e677eecbcbf
                    ^^^^^^^^ - This indicates TEST MODE
```

### Test Mode Behavior

**When using test keys (`sk_test_`):**
- ✅ Test BVN `12345678901` → **Always succeeds** (100% match)
- ❌ Real BVN (any other 11-digit number) → **Always fails** with error message

**When using live keys (`sk_live_`):**
- ✅ Real BVN → Verified against Paystack Identity API (costs ₦50 per verification)
- ❌ Test BVN → Will fail (not a real BVN)

## Testing the BVN Verification Flow

### Step 1: Register/Login
Use your test account:
- Phone: `+2348012345678`
- Password: (whatever you set during registration)

### Step 2: Navigate to BVN Verification
After login, you'll be redirected to:
```
http://localhost:3000/vendor/kyc/tier1
```

### Step 3: Enter Test BVN
In the BVN input field, enter:
```
12345678901
```

### Step 4: Submit
Click "Verify My Identity" and the system will:
1. Detect test mode
2. Accept the test BVN
3. Mark your account as Tier 1 verified
4. Redirect you to the dashboard

## What Happens in Test Mode

```typescript
// From src/features/vendors/services/bvn-verification.service.ts

if (isTestMode()) {
  if (request.bvn === TEST_BVN) {
    // ✅ Test BVN accepted
    return {
      success: true,
      verified: true,
      matchScore: 100,
      details: {
        firstName: request.firstName,
        lastName: request.lastName,
        dateOfBirth: request.dateOfBirth,
        phone: request.phone,
      },
    };
  } else {
    // ❌ Real BVN rejected in test mode
    return {
      success: false,
      verified: false,
      matchScore: 0,
      error: `Test mode: Please use test BVN ${TEST_BVN} for testing. Real BVN verification requires production Paystack keys.`,
    };
  }
}
```

## Paystack Official Test Credentials

According to [Paystack documentation](https://docs-v2.paystack.com/docs/identity-verification/validate-customer/), the official test credentials for customer validation are:

```json
{
  "country": "NG",
  "type": "bank_account",
  "account_number": "0111111111",
  "bvn": "222222222221",
  "bank_code": "007",
  "first_name": "Uchenna",
  "last_name": "Okoro"
}
```

**However**, our system uses a simpler test BVN: `12345678901` for easier testing.

## Error Messages You Might See

### If you enter a real BVN in test mode:
```
Test mode: Please use test BVN 12345678901 for testing. 
Real BVN verification requires production Paystack keys.
```

### If you enter an invalid format:
```
Invalid BVN format. BVN must be exactly 11 digits.
```

## Production Mode

When you deploy to production with live Paystack keys:

1. Update `.env` with live keys:
   ```env
   PAYSTACK_SECRET_KEY=sk_live_your_live_key_here
   PAYSTACK_PUBLIC_KEY=pk_live_your_live_key_here
   ```

2. Real BVNs will be verified against Paystack Identity API
3. Test BVN `12345678901` will no longer work
4. Each verification costs ₦50

## Summary

| Environment | Paystack Key | Test BVN Works? | Real BVN Works? | Cost |
|-------------|--------------|-----------------|-----------------|------|
| **Development** | `sk_test_...` | ✅ Yes | ❌ No | Free |
| **Production** | `sk_live_...` | ❌ No | ✅ Yes | ₦50/verification |

## Quick Test Steps

1. **Restart dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Login** with your test account

3. **Enter test BVN**: `12345678901`

4. **Submit** and verify it works

5. **Check dashboard access** - you should now be able to access the vendor dashboard

---

**Status**: Ready for Testing  
**Test BVN**: `12345678901`  
**Mode**: Test (Free)  
**Date**: 2026-04-29
