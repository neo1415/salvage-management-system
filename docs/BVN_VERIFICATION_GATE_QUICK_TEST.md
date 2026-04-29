# BVN Verification Gate - Quick Test Guide

## Quick Test Steps

### 1. Test New User Registration Flow
```bash
# 1. Register new user
POST /api/auth/register
{
  "email": "testvendor@example.com",
  "phone": "+2348012345679",
  "password": "Test123!@#",
  "fullName": "Test Vendor",
  "dateOfBirth": "1990-01-01",
  "role": "vendor"
}

# 2. Verify OTP
POST /api/otp/verify
{
  "phone": "+2348012345679",
  "otp": "123456"
}

# 3. Login
POST /api/auth/login
{
  "emailOrPhone": "+2348012345679",
  "password": "Test123!@#"
}

# 4. Try to access dashboard
GET /vendor/dashboard
# Expected: Redirect to /vendor/kyc/tier1

# 5. Complete BVN verification
POST /api/vendors/verify-bvn
{
  "bvn": "12345678901"
}

# 6. Access dashboard again
GET /vendor/dashboard
# Expected: Access granted
```

### 2. Test Existing User Login
```bash
# 1. Login with existing unverified vendor
POST /api/auth/login
{
  "emailOrPhone": "+2348012345678",
  "password": "password"
}

# 2. Try to access any dashboard route
GET /vendor/auctions
# Expected: Redirect to /vendor/kyc/tier1

# 3. Complete BVN verification
POST /api/vendors/verify-bvn
{
  "bvn": "12345678901"
}

# 4. Access dashboard
GET /vendor/auctions
# Expected: Access granted
```

### 3. Test Middleware Exclusions
```bash
# These routes should NOT trigger BVN check:

# KYC routes
GET /vendor/kyc/tier1  # ✅ Allowed
GET /vendor/kyc/tier2  # ✅ Allowed

# Auth routes
GET /login             # ✅ Allowed
GET /register          # ✅ Allowed
GET /auth/error        # ✅ Allowed

# API routes
POST /api/vendors/verify-bvn  # ✅ Allowed
GET /api/vendors/profile      # ✅ Allowed
```

### 4. Test Session Refresh
```bash
# 1. Complete BVN verification
POST /api/vendors/verify-bvn
{
  "bvn": "12345678901"
}
# Response should include: "refreshSession": true

# 2. Check session in browser
# Open DevTools → Application → Cookies
# Look for: authjs.session-token

# 3. Verify bvnVerified flag
# In your component:
const { data: session } = useSession();
console.log(session?.user?.bvnVerified); // Should be true
```

## Expected Behavior

### ✅ Correct Behavior
- Unverified vendor redirected to `/vendor/kyc/tier1`
- After BVN verification, session refreshed automatically
- Verified vendor can access all dashboard routes
- Non-vendors (admin, manager, etc.) not affected

### ❌ Incorrect Behavior
- Vendor can access dashboard without BVN verification
- Infinite redirect loop between login and BVN page
- Session not updating after BVN verification
- KYC page itself triggers redirect

## Debugging Commands

### Check User Status
```sql
SELECT id, email, phone, status, role 
FROM users 
WHERE phone = '+2348012345678';
```

### Check Vendor BVN Status
```sql
SELECT v.id, v.user_id, v.bvn_verified_at, v.tier, v.status, u.email
FROM vendors v
JOIN users u ON v.user_id = u.id
WHERE u.phone = '+2348012345678';
```

### Check Session in Redis
```bash
# Using redis-cli
redis-cli
> KEYS session:*
> GET session:<session-id>
```

### Check Middleware Logs
```bash
# In terminal running dev server
# Look for middleware execution logs
[Middleware] Checking BVN verification for vendor...
[Middleware] BVN not verified, redirecting to /vendor/kyc/tier1
```

## Common Issues & Solutions

### Issue 1: User stuck on login page
**Cause**: OTP verification didn't create session
**Solution**: Ensure client calls `signIn()` after OTP verification

### Issue 2: Redirect loop
**Cause**: KYC route not excluded from middleware
**Solution**: Check `isKycRoute` logic in middleware

### Issue 3: Session not refreshing
**Cause**: Client not calling `update()` after verification
**Solution**: Add `await update()` in BVN verification success handler

### Issue 4: Middleware not running
**Cause**: Route not in matcher config
**Solution**: Add route pattern to `config.matcher` in middleware

## Manual Browser Test

1. **Open browser in incognito mode**
2. **Navigate to** `http://localhost:3000/register`
3. **Register new vendor account**
4. **Verify OTP**
5. **Login with credentials**
6. **Observe redirect to** `/vendor/kyc/tier1`
7. **Try to manually navigate to** `/vendor/dashboard`
8. **Observe redirect back to** `/vendor/kyc/tier1`
9. **Complete BVN verification**
10. **Observe redirect to** `/vendor/dashboard`
11. **Logout and login again**
12. **Observe direct access to dashboard** (no redirect)

## Success Criteria

✅ New vendors redirected to BVN page on first login
✅ Dashboard routes blocked until BVN verified
✅ KYC routes accessible without BVN verification
✅ Session updates after successful BVN verification
✅ Verified vendors can access dashboard immediately
✅ Non-vendors not affected by BVN check
✅ No infinite redirect loops
✅ Proper error handling for failed verifications

## Next Steps

After confirming BVN gate works:
1. Test with real Paystack BVN verification
2. Test session expiry and re-authentication
3. Test concurrent sessions (multiple browsers)
4. Test mobile app flow
5. Load test with multiple users
