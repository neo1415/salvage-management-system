# BVN Verification Gate Implementation

## Overview
This document describes the implementation of the BVN verification gate that forces vendors to complete BVN verification before accessing the dashboard.

## Problem Statement
After OTP/phone registration, vendors were being redirected to the BVN verification page without proper authentication, causing them to be redirected back to the login page. The system needed to:
1. Authenticate users properly after OTP verification
2. Check BVN verification status on every login
3. Block dashboard access until BVN is verified
4. Redirect to BVN verification page if not verified

## Solution Architecture

### 1. Session Management
**File**: `src/lib/auth/next-auth.config.ts`

Added `bvnVerified` flag to JWT token and session:
- During initial sign-in, check if vendor has `bvnVerifiedAt` timestamp
- Store `bvnVerified` boolean in JWT token
- Expose `bvnVerified` in session object for middleware access
- Refresh `bvnVerified` flag when session is updated

```typescript
// In jwt callback
if (user.role === 'vendor' && user.vendorId) {
  const [vendor] = await db
    .select({ bvnVerifiedAt: vendors.bvnVerifiedAt })
    .from(vendors)
    .where(eq(vendors.id, user.vendorId))
    .limit(1);
  
  token.bvnVerified = !!vendor?.bvnVerifiedAt;
} else {
  token.bvnVerified = true; // Non-vendors don't need BVN
}

// In session callback
session.user.bvnVerified = token.bvnVerified as boolean;
```

### 2. Middleware Enforcement
**File**: `src/middleware.ts`

Middleware checks BVN verification status for all dashboard routes:
- Runs on all vendor, admin, manager, adjuster, and finance routes
- Excludes KYC routes, auth routes, and API routes
- Redirects unverified vendors to `/vendor/kyc/tier1`
- Preserves original URL in redirect parameter for post-verification redirect

```typescript
if (isDashboardRoute && !isKycRoute && !isAuthRoute && !isApiRoute) {
  const session = await auth();
  
  if (session?.user?.role === 'vendor') {
    const bvnVerified = session.user.bvnVerified;
    
    if (!bvnVerified) {
      const url = new URL('/vendor/kyc/tier1', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }
}
```

### 3. BVN Verification Flow
**File**: `src/app/api/vendors/verify-bvn/route.ts`

After successful BVN verification:
1. Update `vendors.bvnVerifiedAt` timestamp
2. Update `users.status` to `verified_tier_1`
3. Return `refreshSession: true` flag to client
4. Client refreshes session to update `bvnVerified` flag

```typescript
// Update vendor record
await db.update(vendors).set({
  bvnEncrypted: encryptedBVN,
  bvnVerifiedAt: new Date(),
  tier: 'tier1_bvn',
  status: 'approved',
}).where(eq(vendors.id, vendor.id));

// Update user status
await db.update(users).set({
  status: 'verified_tier_1',
}).where(eq(users.id, userId));

// Return with refresh flag
return NextResponse.json({
  success: true,
  refreshSession: true,
  // ...
});
```

### 4. Client-Side Session Refresh
**File**: `src/app/(dashboard)/vendor/kyc/tier1/page.tsx`

After successful verification, refresh the session:
```typescript
if (result.refreshSession) {
  const { update } = await import('next-auth/react');
  await update();
}
```

### 5. Type Definitions
**File**: `src/types/next-auth.d.ts`

Extended NextAuth types to include `bvnVerified`:
```typescript
interface Session {
  user: {
    // ... other fields
    bvnVerified?: boolean;
  };
}

interface JWT {
  // ... other fields
  bvnVerified?: boolean;
}
```

## User Flow

### New User Registration
1. User registers with phone number → OTP sent
2. User verifies OTP → Account created with `status: 'phone_verified_tier_0'`
3. User logs in with credentials → Session created
4. Middleware checks `bvnVerified` → `false`
5. User redirected to `/vendor/kyc/tier1`
6. User completes BVN verification → `bvnVerifiedAt` set, `status: 'verified_tier_1'`
7. Session refreshed → `bvnVerified: true`
8. User redirected to dashboard → Access granted

### Existing User Login
1. User logs in with credentials → Session created
2. Middleware checks `bvnVerified` from session
3. If `true` → Access dashboard
4. If `false` → Redirect to `/vendor/kyc/tier1`

## Database Schema

### Users Table
```sql
status user_status NOT NULL DEFAULT 'unverified_tier_0'
-- Enum: unverified_tier_0, phone_verified_tier_0, verified_tier_1, verified_tier_2, suspended, deleted
```

### Vendors Table
```sql
bvn_verified_at TIMESTAMP NULL
tier vendor_tier NOT NULL DEFAULT 'tier1_bvn'
status vendor_status NOT NULL DEFAULT 'pending'
```

## Security Considerations

1. **BVN Encryption**: BVN is encrypted with AES-256 before storage
2. **Session Validation**: Middleware validates session on every request
3. **Rate Limiting**: BVN verification API has rate limiting (10 attempts per 15 minutes)
4. **Audit Logging**: All BVN verification attempts are logged
5. **HTTPS Only**: BVN verification only works over HTTPS in production

## Testing

### Manual Testing Steps
1. Create new vendor account via registration
2. Verify OTP
3. Login with credentials
4. Confirm redirect to `/vendor/kyc/tier1`
5. Try accessing dashboard routes → Should be blocked
6. Complete BVN verification
7. Confirm redirect to dashboard
8. Logout and login again → Should go directly to dashboard

### Test User
- Phone: +2348012345678 (after cleanup)
- Should be redirected to BVN verification on first login

## Troubleshooting

### Issue: User stuck on BVN page after verification
**Solution**: Check if session was refreshed. Call `update()` from `next-auth/react`.

### Issue: User can access dashboard without BVN
**Solution**: Check middleware matcher config includes the route. Verify session has `bvnVerified` field.

### Issue: Infinite redirect loop
**Solution**: Ensure KYC routes are excluded from middleware check. Verify `isKycRoute` logic.

### Issue: Session not updating after verification
**Solution**: Ensure API returns `refreshSession: true`. Check client calls `update()`.

## Future Enhancements

1. **Tier 2 Verification Gate**: Similar gate for Tier 2 KYC (NIN, biometrics, etc.)
2. **Expiry Handling**: Check if BVN verification has expired (12 months)
3. **Re-verification**: Allow users to update BVN if details change
4. **Admin Override**: Allow admins to manually verify users
5. **Notification**: Send push notification when BVN verification is required

## Related Files
- `src/lib/auth/next-auth.config.ts` - Session management
- `src/middleware.ts` - BVN verification enforcement
- `src/app/api/vendors/verify-bvn/route.ts` - BVN verification API
- `src/app/(dashboard)/vendor/kyc/tier1/page.tsx` - BVN verification UI
- `src/types/next-auth.d.ts` - Type definitions
- `src/lib/db/schema/vendors.ts` - Vendor schema
- `src/lib/db/schema/users.ts` - User schema

## References
- NextAuth.js Documentation: https://next-auth.js.org/
- Next.js Middleware: https://nextjs.org/docs/app/building-your-application/routing/middleware
- Paystack Identity API: https://paystack.com/docs/identity-verification/
