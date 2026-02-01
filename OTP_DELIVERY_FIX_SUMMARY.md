# OTP Delivery Fix Summary

## Issue
Users registering successfully but not receiving OTP via SMS or email for phone verification.

## Root Cause Analysis
1. **Duplicate variable declaration** - `result` variable was declared twice in the Termii API call, causing a compilation error
2. **Incorrect email service method signature** - `sendOTPEmail` requires 4 parameters (email, fullName, otpCode, expiryMinutes) but only 2 were being passed
3. **Missing user context** - The OTP service wasn't receiving the user's fullName needed for email personalization

## Changes Made

### 1. Fixed OTP Service (`src/features/auth/services/otp.service.ts`)
- **Removed duplicate `result` variable declaration** in Termii API call
- **Updated `sendOTP` method signature** to accept `fullName` parameter:
  ```typescript
  async sendOTP(
    phone: string,
    ipAddress: string,
    deviceType: 'mobile' | 'desktop' | 'tablet',
    email?: string,
    fullName?: string  // Added this parameter
  )
  ```
- **Fixed email service call** to pass all required parameters:
  ```typescript
  await emailService.sendOTPEmail(email, fullName, otp, 5);
  ```
- **Added condition** to only send email if both email AND fullName are provided

### 2. Updated Registration Route (`src/app/api/auth/register/route.ts`)
- **Pass fullName to OTP service**:
  ```typescript
  const otpResult = await otpService.sendOTP(
    validatedInput.phone, 
    ipAddress, 
    deviceType,
    validatedInput.email,
    validatedInput.fullName  // Now passing fullName
  );
  ```

### 3. Updated Resend OTP Route (`src/app/api/auth/resend-otp/route.ts`)
- **Fetch user details from database** when phone number is provided
- **Extract email and fullName** from session or database
- **Pass email and fullName to OTP service** for backup email delivery

## Testing Steps

### 1. Test Registration Flow
```bash
# Start the server
npm run dev

# Register a new user through the UI
# Check console logs for:
# - "✅ SMS sent successfully to +234... via Termii"
# - "📱 Termii API Response: {...}"
# - "✅ OTP email sent successfully to ..."
```

### 2. Check OTP in Redis
```bash
# Check if OTP was stored in Redis
npx tsx scripts/check-otp-status.ts +2348141252812

# Expected output:
# ✅ OTP found in Redis!
# 📋 OTP Details:
#    OTP Code: 123456
#    Attempts: 0/3
#    Remaining Attempts: 3
```

### 3. Check Termii API Response
Look for the full Termii API response in the console logs:
```json
📱 Termii API Response: {
  "message_id": "...",
  "message": "Successfully Sent",
  "balance": ...,
  "user": "..."
}
```

### 4. Check Email Inbox
- Check if OTP email was received
- Email should contain:
  - User's full name
  - 6-digit OTP code
  - 5-minute expiry notice

## Expected Behavior

### SMS Delivery (Primary)
1. OTP is generated and stored in Redis
2. SMS is sent via Termii API with sender ID "NEMSAL"
3. Console logs show Termii API response
4. User receives SMS within 1-2 minutes

### Email Delivery (Backup)
1. If email and fullName are provided
2. OTP email is sent via Resend
3. Console logs show email sent successfully
4. User receives email within seconds

## Diagnostic Tools

### Check OTP Status
```bash
npx tsx scripts/check-otp-status.ts +2348141252812
```

### Check Termii Status
```bash
npx tsx scripts/check-termii-status.ts
```

### Send Test SMS
```bash
npx tsx scripts/send-test-sms.ts +2348141252812
```

## Next Steps

1. **Test registration** with a new user
2. **Monitor console logs** for Termii API response
3. **Check Redis** to confirm OTP is stored
4. **Verify SMS delivery** on actual phone
5. **Check email inbox** for backup OTP email

## Notes

- Sender ID "NEMSAL" is approved and active on Termii
- SMS channel is set to 'generic' (correct for approved sender ID)
- OTP is stored in Redis BEFORE sending SMS (ensures availability even if SMS fails)
- Email backup only sends if both email AND fullName are provided
- OTP expires after 5 minutes
- Maximum 3 verification attempts allowed
- Rate limit: 3 OTP requests per 30 minutes per phone number

## Files Modified
- `src/features/auth/services/otp.service.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/resend-otp/route.ts`
- `OTP_DELIVERY_FIX_SUMMARY.md` (this file)
