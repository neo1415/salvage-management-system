# OTP Resend and Email Backup Fix

## Issues Fixed

### Issue 1: Email Backup OTP Not Sent on Resend
**Problem**: When users clicked "Resend Code", they only received SMS OTP via Termii, but no email backup was sent.

**Root Cause**: The `/api/otp/resend` endpoint was calling `otpService.sendOTP()` without passing the `email` and `fullName` parameters, which are required for email backup delivery.

**Fix**: Modified `/api/otp/resend` route to:
1. Query the database for the user's email and fullName using their phone number
2. Pass these parameters to `otpService.sendOTP()` for email backup delivery
3. Handle errors gracefully (email backup is optional, SMS is primary)

**Files Modified**:
- `src/app/api/otp/resend/route.ts`

### Issue 2: Wrong Success Message After Resend
**Problem**: After clicking "Resend Code", the UI showed "Phone Verified Successfully!" instead of "OTP Resent Successfully!"

**Root Cause**: The component was using a single `success` state for both OTP verification success and resend success, causing confusion.

**Fix**: 
1. Added separate `resendSuccess` state to differentiate between verification and resend
2. Show blue "OTP Resent Successfully!" message after resend
3. Show green "Phone Verified Successfully!" message only after actual verification
4. Updated message to mention both phone and email: "Check your phone and email for the new verification code."

**Files Modified**:
- `src/app/(auth)/verify-otp/page.tsx`

## Technical Details

### Email Backup Flow

The OTP service now supports email backup in two scenarios:

1. **During Registration** (Initial OTP Send):
   - User doesn't exist yet
   - Only SMS is sent via Termii
   - Email backup NOT available (no user record)

2. **After Registration** (Resend OTP):
   - User exists in database
   - SMS sent via Termii (primary)
   - Email sent as backup (secondary)
   - Both channels deliver the same OTP code

### OTP Service Parameters

```typescript
await otpService.sendOTP(
  phone,           // Required: Phone number in international format
  ipAddress,       // Required: For rate limiting and fraud detection
  deviceType,      // Required: 'mobile' | 'desktop' | 'tablet'
  email,           // Optional: For email backup (if user exists)
  fullName,        // Optional: For email personalization (if user exists)
  context,         // Optional: 'authentication' | 'bidding' (default: 'authentication')
  auctionId        // Optional: For bidding context rate limiting
);
```

### UI States

| State | Trigger | Message | Color |
|-------|---------|---------|-------|
| `success` | OTP verified successfully | "Phone Verified Successfully!" | Green |
| `resendSuccess` | OTP resent successfully | "OTP Resent Successfully!" | Blue |
| `error` | Verification or resend failed | Error message | Red |

## Testing

### Test Scenario 1: Resend OTP for Existing User
1. Register a new user with phone +2347061818715
2. Complete phone verification
3. Try to verify OTP again (simulate expired OTP)
4. Click "Resend Code"
5. **Expected**:
   - SMS sent via Termii ✅
   - Email sent to danieloyeniyi@thevaultlyne.com ✅
   - Blue success message: "OTP Resent Successfully!" ✅
   - Message mentions both phone and email ✅

### Test Scenario 2: Initial Registration OTP
1. Register a new user
2. **Expected**:
   - SMS sent via Termii ✅
   - Email NOT sent (user doesn't exist yet) ✅
   - Redirect to OTP verification page ✅

### Test Scenario 3: OTP Verification Success
1. Enter correct OTP
2. **Expected**:
   - Green success message: "Phone Verified Successfully!" ✅
   - Redirect to BVN verification or login ✅

## Diagnostic Script

Created `scripts/diagnose-otp-resend-issue.ts` to help debug OTP issues:

```bash
npx tsx scripts/diagnose-otp-resend-issue.ts
```

**Checks**:
1. User exists with phone number
2. OTP is stored in Redis
3. User email and fullName are available for backup
4. Identifies if this is registration or existing user flow

## Environment Variables

Ensure these are configured in `.env`:

```env
# Termii SMS API (Primary OTP Delivery)
TERMII_API_KEY=your_termii_api_key
TERMII_SENDER_ID=NEMSAL

# Email Service (Backup OTP Delivery)
# Configure your email service credentials
```

## Security Considerations

1. **Rate Limiting**: 
   - Resend OTP: 3 attempts per 15 minutes per phone number
   - Verify OTP: 10 attempts per 15 minutes per IP address

2. **OTP Expiry**: 5 minutes

3. **Max Verification Attempts**: 3 attempts per OTP

4. **Fraud Monitoring**: Tracks suspicious patterns (>20 OTP requests from same IP+phone in 1 hour)

## User Experience Improvements

1. **Dual Channel Delivery**: Users receive OTP via both SMS and email (if available)
2. **Clear Messaging**: Different success messages for resend vs verification
3. **Visual Distinction**: Blue for resend, green for verification
4. **Helpful Instructions**: Message explicitly mentions checking both phone and email

## Related Files

- `src/app/api/otp/verify/route.ts` - OTP verification endpoint
- `src/app/api/otp/resend/route.ts` - OTP resend endpoint (FIXED)
- `src/app/(auth)/verify-otp/page.tsx` - OTP verification UI (FIXED)
- `src/features/auth/services/otp.service.ts` - OTP service with email backup
- `src/features/notifications/services/email.service.ts` - Email delivery service
- `scripts/diagnose-otp-resend-issue.ts` - Diagnostic tool (NEW)

## Summary

✅ Email backup OTP now sent on resend
✅ Correct success messages for resend vs verification
✅ Diagnostic script for troubleshooting
✅ Comprehensive documentation
✅ Maintains backward compatibility
✅ Graceful fallback if email fails (SMS is primary)
