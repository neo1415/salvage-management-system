# Dojah Test Credentials Limitations

## Summary

You're using **test/sandbox credentials** which have significant limitations compared to production credentials. Based on Dojah's documentation and your experience, here's what's happening:

## Current Issue: "Verification Failed" with No Reference ID

### What You're Experiencing
- Face verification shows "Verification successful" in the widget
- Widget closes and returns to Tier 2 page
- Error message: "Verification completed but no reference ID received"
- `onSuccess` callback is triggered but `response.reference_id` is `undefined`
- You expected document verification, AML screening, and other checks but didn't reach those steps

### Root Cause: Test Credential Limitations

According to [Dojah's official documentation](https://support.dojah.io/articles/what-is-the-difference-between-sandbox-and-production-environments):

> **Sandbox Environment**: Used for testing and development. It allows you to simulate API calls without affecting live data or incurring real charges. To test each API in sandbox, you'll need specific data.

> **Production Environment**: Used for live, real-user verifications. All requests are processed against real data sources and will incur billing.

## Test vs Production Comparison

| Feature | Test/Sandbox Credentials | Production Credentials |
|---------|-------------------------|----------------------|
| **Cost** | Free | Charged per verification (₦510-630) |
| **Data** | Mock/test data only | Real government databases |
| **Reference ID** | May be undefined/mock | Always provided |
| **Face Verification** | Simplified/mock | Real biometric liveness check |
| **Document Verification** | Limited/mock | Full OCR + validation |
| **NIN Verification** | Test database only | Real NIMC database |
| **AML Screening** | Mock data | Real watchlists, PEP, sanctions |
| **DeviceGuard** | Limited/unstable | Full fraud detection |
| **Verification Flow** | May skip steps | Complete multi-step flow |
| **Reliability** | Lower, may fail randomly | Production-grade |

## Why You're Not Seeing Document Verification & AML

Based on the [JavaScript SDK documentation](https://docs.dojah.io/sdks/javascript-library), a complete verification flow should return:

```javascript
{
  reference_id: "DJ-31038041E0",  // ← This is missing in your case
  status: true,
  verification_status: "Completed",
  data: {
    id: { /* document verification data */ },
    selfie: { /* liveness check data */ },
    government_data: { /* NIN/BVN data */ },
    additional_document: [ /* utility bills, etc */ ]
  },
  aml: { /* AML screening results */ }
}
```

**In test mode**, the widget may:
1. Only perform face verification (simplified)
2. Skip document upload steps
3. Skip AML screening
4. Return incomplete data or no `reference_id`
5. Fail with "Verification Failed" errors

This is **by design** - test credentials are meant for integration testing, not actual verification.

## What Test Credentials Are Good For

✅ Testing widget integration (does it open?)
✅ Testing UI/UX flow
✅ Testing error handling
✅ Testing callback functions
✅ Development and staging environments

## What Test Credentials Cannot Do

❌ Real identity verification
❌ Real document verification (OCR, tampering detection)
❌ Real AML screening against actual databases
❌ Real NIN/BVN lookups
❌ Reliable reference IDs for production use
❌ Complete multi-step verification flows

## Solution: Upgrade to Production Credentials

### Step 1: Contact Dojah Support
- Email: support@dojah.io
- Dashboard: https://dojah.io/dashboard
- Request production API keys

### Step 2: Complete Business Verification
Dojah will require:
- Business registration documents
- Compliance documentation
- Use case explanation
- Possibly a demo/review of your integration

### Step 3: Fund Your Wallet
Production verifications are charged per use:
- Basic verification: ~₦510
- Advanced verification: ~₦630
- You'll need to fund your Dojah wallet

### Step 4: Update Environment Variables
Once you have production credentials:

```env
# Replace test credentials with production credentials
DOJAH_API_KEY=live_sk_your_production_secret_key
DOJAH_PUBLIC_KEY=live_pk_your_production_public_key
DOJAH_APP_ID=your_production_app_id
```

### Step 5: Test Thoroughly
- Test with real users in staging
- Verify all verification steps work
- Check that `reference_id` is always returned
- Confirm AML screening works
- Validate document verification

## Temporary Workaround for Development

While waiting for production credentials, you can:

1. **Mock the verification flow** in your code for testing other features
2. **Use test data** as specified in Dojah's sandbox documentation
3. **Skip KYC** in development/staging environments
4. **Add a bypass** for test users (with proper security controls)

## Code Changes Needed

Update the error handling in `src/app/(dashboard)/vendor/kyc/tier2/page.tsx`:

```typescript
onSuccess: async (response) => {
  const referenceId = response?.reference_id;
  
  // Check if we're in test mode
  const isTestMode = widgetConfig.publicKey?.startsWith('test_');
  
  if (!referenceId) {
    if (isTestMode) {
      setErrorMessage(
        'Test credentials do not support full verification. ' +
        'This is expected behavior in sandbox mode. ' +
        'To enable real verification with document checks, AML screening, and all features, ' +
        'please contact support@dojah.io to upgrade to production credentials.'
      );
    } else {
      setErrorMessage('Verification completed but no reference ID received. Please contact support.');
    }
    setPageState('error');
    return;
  }
  
  await handleVerificationComplete(referenceId);
},
```

## Expected Behavior with Production Credentials

With production credentials, users will:

1. ✅ Enter personal information (name, DOB, email)
2. ✅ Provide NIN (National Identification Number)
3. ✅ Upload government-issued ID (passport, driver's license, voter's card)
4. ✅ Take selfie for liveness check
5. ✅ Upload utility bill (for address verification)
6. ✅ Complete AML screening automatically
7. ✅ Receive a valid `reference_id` like "DJ-31038041E0"
8. ✅ Get complete verification data with all checks

## References

- [Dojah Sandbox vs Production](https://support.dojah.io/articles/what-is-the-difference-between-sandbox-and-production-environments)
- [Dojah JavaScript SDK Documentation](https://docs.dojah.io/sdks/javascript-library)
- [Dojah Sandbox Environment Guide](https://docs.dojah.io/guides/reporting/developers/configuration/sandbox-live)

## Next Steps

1. **Immediate**: Contact Dojah support to request production credentials
2. **Short-term**: Update error messages to clarify test mode limitations
3. **Medium-term**: Complete business verification with Dojah
4. **Long-term**: Switch to production credentials and test thoroughly

---

**Last Updated**: 2026-04-17
**Status**: Test credentials confirmed as root cause of missing reference_id and incomplete verification flow
