# OAuth Phone Verification Flow Implementation

## Overview
Implemented a complete OAuth registration flow that requires phone number verification via OTP, matching the standard registration process.

## Flow Diagram

```
User clicks "Sign in with Google"
         ↓
Google OAuth authentication
         ↓
Callback to /api/auth/callback/google
         ↓
Check if user exists in database
         ↓
    ┌────┴────┐
    │         │
 EXISTS    NEW USER
    │         │
    │         ↓
    │    Store temp data in Redis
    │         ↓
    │    Throw custom error with email
    │         ↓
    │    Redirect to /auth/error
    │         ↓
    │    Detect OAuthRegistration error
    │         ↓
    │    Redirect to /auth/complete-oauth?email=...
    │         ↓
    │    User enters phone number
    │         ↓
    │    POST /api/auth/oauth/complete
    │         ↓
    │    Generate & send OTP
    │         ↓
    │    Redirect to /verify-otp?type=oauth&email=...&phone=...
    │         ↓
    │    User enters OTP
    │         ↓
    │    POST /api/auth/verify-otp (with type=oauth)
    │         ↓
    │    Create user account in database
    │         ↓
    │    Clean up temp Redis data
    │         ↓
    │    Redirect to /login with success message
    │         ↓
    │    User signs in with Google again
    │         ↓
    └─────────┤
              ↓
         Allow login
              ↓
         Redirect to dashboard
```

## Files Created/Modified

### New Files
1. **src/app/(auth)/complete-oauth/page.tsx**
   - Phone number collection page for OAuth users
   - Validates phone format
   - Submits to OAuth completion API

2. **src/app/api/auth/oauth/complete/route.ts**
   - Handles phone number submission
   - Validates phone isn't already registered
   - Stores phone with OAuth temp data in Redis
   - Generates and sends OTP

3. **src/app/(auth)/error/page.tsx**
   - Custom error handler for NextAuth
   - Detects OAuth registration errors
   - Redirects to appropriate completion page

### Modified Files
1. **src/lib/auth/next-auth.config.ts**
   - Modified `signIn` callback to detect new OAuth users
   - Stores temporary OAuth data in Redis (15 min expiry)
   - Throws custom error to trigger redirect flow
   - Updated error page configuration

2. **src/app/api/auth/verify-otp/route.ts**
   - Added OAuth completion support
   - Creates user account after OTP verification
   - Handles `type=oauth` parameter
   - Creates audit log for OAuth registration
   - Cleans up temporary Redis data

3. **src/app/(auth)/verify-otp/page.tsx**
   - Added support for OAuth completion flow
   - Accepts `email` and `type` query parameters
   - Redirects to login after OAuth completion
   - Shows appropriate success message

4. **src/types/next-auth.d.ts**
   - Added `needsPhoneNumber` to Session, User, and JWT types

## Redis Keys Used

- `oauth_temp:{email}` - Temporary OAuth data (15 min TTL)
  ```json
  {
    "email": "user@example.com",
    "name": "User Name",
    "provider": "google",
    "providerId": "123456789",
    "picture": "https://...",
    "phone": "+2348012345678",
    "createdAt": 1234567890
  }
  ```

## Security Features

1. **Temporary Data Expiry**: OAuth temp data expires after 15 minutes
2. **Phone Validation**: Validates phone format before sending OTP
3. **Duplicate Prevention**: Checks if phone/email already registered
4. **OTP Verification**: Requires OTP verification before account creation
5. **Audit Logging**: Logs OAuth registration completion
6. **Session Prevention**: No session created until OTP verified

## Testing the Flow

1. **First Time OAuth User**:
   ```
   1. Click "Sign in with Google" on /login
   2. Authenticate with Google
   3. Get redirected to /auth/complete-oauth
   4. Enter phone number
   5. Get redirected to /verify-otp
   6. Enter OTP code
   7. Account created
   8. Redirected to /login
   9. Sign in with Google again
   10. Successfully logged in
   ```

2. **Existing OAuth User**:
   ```
   1. Click "Sign in with Google" on /login
   2. Authenticate with Google
   3. Directly logged in and redirected to dashboard
   ```

## Error Handling

- **Expired OAuth Session**: Shows error if temp data expired (>15 min)
- **Phone Already Registered**: Prevents duplicate phone numbers
- **Email Already Registered**: Shouldn't happen, but handled
- **Invalid Phone Format**: Validates before sending OTP
- **OTP Verification Failed**: Shows error, allows retry
- **Network Errors**: Graceful error messages

## Next Steps

1. Test the complete flow with Google OAuth
2. Add Facebook OAuth support (same flow)
3. Consider adding phone number to Google OAuth scope request
4. Add rate limiting to prevent abuse
5. Add analytics tracking for conversion funnel

## Notes

- Users must complete phone verification to create account
- No partial accounts created in database
- Temporary data automatically cleaned up
- Flow matches standard registration UX
- Existing users bypass phone verification
