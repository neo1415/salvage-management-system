# Authentication Module

This module handles user authentication and registration for the Salvage Management System.

## Features

### Standard Registration
- Email/phone + password registration
- Password validation (min 8 chars, 1 uppercase, 1 number, 1 special char)
- Phone number validation (Nigerian format)
- Age verification (18+)
- Terms and conditions acceptance

### OAuth Registration (Google & Facebook)

#### Overview
Users can register using their Google or Facebook accounts for a faster onboarding experience.

#### Flow

**1. OAuth Sign-In**
- User clicks "Sign in with Google" or "Sign in with Facebook"
- NextAuth.js handles OAuth flow with provider
- User authenticates with provider
- Provider returns user profile (email, name, picture)

**2. User Creation**
- If user exists: Update last login and redirect to dashboard
- If new user with phone: Create account with `unverified_tier_0` status
- If new user without phone: Flag `needsPhoneNumber` and redirect to completion page

**3. Phone Number Completion (if needed)**
- User is redirected to `/auth/complete-profile` page
- User provides phone number and date of birth
- System validates phone format and age requirement
- Account is created with `unverified_tier_0` status

#### API Endpoints

**POST /api/auth/oauth/complete**
Complete OAuth registration by providing phone number.

Request:
```json
{
  "phone": "+2348012345678",
  "dateOfBirth": "1990-01-01"
}
```

Response (Success):
```json
{
  "success": true,
  "userId": "user-id",
  "message": "Registration completed successfully. Please verify your phone number."
}
```

Response (Error):
```json
{
  "error": "Phone number already registered"
}
```

#### Configuration

**Environment Variables**
```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook OAuth
FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret
```

**NextAuth Configuration**
OAuth providers are configured in `src/lib/auth/next-auth.config.ts`:
- Google OAuth with offline access
- Facebook OAuth
- Automatic user creation on first sign-in
- Session management with Redis caching

#### Services

**OAuthService** (`src/features/auth/services/oauth.service.ts`)

Methods:
- `handleOAuthRegistration()` - Process OAuth callback and create user
- `completeOAuthRegistration()` - Add phone number to OAuth user
- `getUserByEmail()` - Retrieve user by email

#### User Status

OAuth users are created with:
- Status: `unverified_tier_0`
- Role: `vendor`
- Password: Empty string (no password for OAuth users)
- Phone: From OAuth profile or user input

#### Security

- OAuth tokens are validated by NextAuth.js
- Phone numbers must be unique
- Age verification (18+)
- Audit logging for all OAuth actions
- IP address and device type tracking

#### Audit Logging

OAuth actions are logged:
- `oauth_registration` - New user created via OAuth
- `oauth_login` - Existing user logged in via OAuth
- `oauth_registration_completed` - Phone number added to OAuth user

#### Testing

Unit tests: `tests/unit/auth/oauth.test.ts`
- OAuth profile validation
- Phone number handling
- Provider support (Google, Facebook)
- User data auto-population
- Error handling

Integration tests: `tests/integration/auth/oauth-registration.test.ts`
- API endpoint validation
- Phone number completion flow
- Security checks
- Audit logging

## Usage Examples

### Frontend - OAuth Sign-In Button

```tsx
import { signIn } from 'next-auth/react';

export function OAuthButtons() {
  return (
    <div className="space-y-4">
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        className="w-full px-4 py-2 bg-white border rounded-lg"
      >
        Sign in with Google
      </button>
      
      <button
        onClick={() => signIn('facebook', { callbackUrl: '/dashboard' })}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Sign in with Facebook
      </button>
    </div>
  );
}
```

### Frontend - Complete OAuth Profile

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CompleteOAuthProfile() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const response = await fetch('/api/auth/oauth/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, dateOfBirth }),
    });

    const data = await response.json();

    if (data.success) {
      router.push('/verify-otp');
    } else {
      setError(data.error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="tel"
        placeholder="+2348012345678"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      
      <input
        type="date"
        value={dateOfBirth}
        onChange={(e) => setDateOfBirth(e.target.value)}
        required
      />
      
      {error && <p className="text-red-500">{error}</p>}
      
      <button type="submit">Complete Registration</button>
    </form>
  );
}
```

## Next Steps

After OAuth registration:
1. User verifies phone number via SMS OTP (Task 9)
2. User completes Tier 1 KYC with BVN (Task 16-17)
3. User can start bidding on auctions up to ₦500k

## Related Tasks

- Task 1: Standard vendor registration
- Task 2: OAuth vendor registration ✅
- Task 3: SMS OTP verification
- Task 4: Tier 1 KYC (BVN)
- Task 8: Login (email/phone + password)
- Task 9: OAuth login
