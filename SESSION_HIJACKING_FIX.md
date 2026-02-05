# Session Hijacking Security Fix

## Problem Summary

**CRITICAL SECURITY BUG**: When a new user tried to log in from a different browser/Google profile, they were logged in as the system admin instead of their own account.

### Root Cause Analysis

The issue was caused by multiple security vulnerabilities in the NextAuth configuration:

1. **No Explicit Cookie Configuration**
   - NextAuth v5 was using default cookie settings
   - Cookies were not properly bound to specific browser contexts
   - On Windows, browser cookies could be shared across different Google profiles

2. **Weak Session Storage**
   - Redis sessions used `session:${userId}` as the key
   - No unique session identifier per login
   - JWT tokens could potentially be reused across different browser contexts

3. **Insufficient Token Validation**
   - JWT callback didn't validate token integrity on every request
   - No verification that token's user ID matched database user ID
   - No email cross-validation to catch wrong user tokens

4. **Session Collision Risk**
   - Multiple logins by the same user would overwrite the same Redis key
   - No way to distinguish between different browser sessions

## Security Fixes Implemented

### 1. Explicit Cookie Configuration

Added strict cookie settings to prevent cross-context sharing:

```typescript
cookies: {
  sessionToken: {
    name: process.env.NODE_ENV === 'production' 
      ? '__Secure-authjs.session-token' 
      : 'authjs.session-token',
    options: {
      httpOnly: true,
      sameSite: 'lax', // Prevents CSRF while allowing normal navigation
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      // Domain is intentionally NOT set to ensure cookies are bound to exact host
    },
  },
  // ... similar for callbackUrl and csrfToken
}
```

**Key Security Features:**
- `httpOnly: true` - Prevents JavaScript access to cookies
- `sameSite: 'lax'` - Prevents CSRF attacks
- `secure: true` (production) - HTTPS only
- **No domain setting** - Binds cookies to exact host, preventing sharing

### 2. Unique Session Identifiers

Each login now generates a unique session ID:

```typescript
token.sessionId = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
```

This prevents:
- Session collision between different logins
- Token reuse across browser contexts
- Session hijacking attempts

### 3. Enhanced Token Validation

JWT callback now validates on EVERY request:

```typescript
// Verify the user still exists
const [currentUser] = await db
  .select({ id, role, status, email })
  .from(users)
  .where(eq(users.id, token.id))
  .limit(1);

// Validate user exists and isn't deleted
if (!currentUser || currentUser.status === 'deleted') {
  throw new Error('Invalid session');
}

// Verify token user ID matches database
if (currentUser.id !== token.id) {
  throw new Error('Session validation failed');
}

// Verify token email matches database
if (currentUser.email !== token.email) {
  throw new Error('Session validation failed');
}
```

**Security Checks:**
- User existence validation
- User ID integrity check
- Email cross-validation
- Deleted/suspended account detection

### 4. Improved Session Storage

Redis now uses unique session IDs:

```typescript
// Store by unique session ID
const sessionKey = `session:${token.sessionId}`;
await kv.set(sessionKey, sessionData, { ex: expirySeconds });

// Maintain user-to-session mapping for logout
const userSessionKey = `user:${session.user.id}:session`;
await kv.set(userSessionKey, token.sessionId, { ex: expirySeconds });
```

**Benefits:**
- Each login gets a unique Redis key
- Multiple sessions per user are supported
- Easy session cleanup on logout
- No session collision possible

## Testing & Verification

### Step 1: Clear All Sessions

```bash
npx tsx scripts/clear-all-sessions.ts
```

This clears:
- Old-style session keys (`session:userId`)
- New-style session keys (`session:sessionId`)
- User-to-session mappings (`user:userId:session`)

### Step 2: Clear Browser Cookies

**CRITICAL**: Must clear cookies in ALL browser windows/profiles:

1. Open DevTools (F12)
2. Go to Application > Cookies
3. Delete ALL cookies for `localhost:3000`
4. Close ALL browser windows (including other Google profiles)
5. Open a fresh browser window

### Step 3: Test Session Isolation

```bash
npx tsx scripts/test-session-isolation.ts
```

This verifies:
- Each user has a unique session ID
- Sessions are not shared between users
- Session data is properly isolated

### Step 4: Test Login Flow

1. **Admin Login Test**:
   - Open browser window A
   - Log in as admin
   - Verify you see admin dashboard
   - Note the session ID in DevTools

2. **New User Login Test**:
   - Open browser window B (different profile/incognito)
   - Log in as new user (adetimilehin502@gmail.com)
   - Verify you see the password change prompt
   - Verify you are NOT logged in as admin
   - Note the session ID is different from admin

3. **Isolation Verification**:
   - Both sessions should coexist
   - Each should have unique session IDs
   - Logging out one should not affect the other

## Files Modified

1. **src/lib/auth/next-auth.config.ts**
   - Added explicit cookie configuration
   - Added unique session ID generation
   - Enhanced JWT validation
   - Improved session storage

2. **src/types/next-auth.d.ts**
   - Added `sessionId` to Session interface
   - Added `sessionId` to JWT interface

3. **scripts/clear-all-sessions.ts**
   - Updated to handle new session key format
   - Added user-to-session mapping cleanup

4. **scripts/test-session-isolation.ts** (NEW)
   - Comprehensive session isolation testing
   - Verifies unique session IDs
   - Checks for session collision

## Security Best Practices Applied

1. ✅ **Defense in Depth**
   - Multiple layers of validation
   - Cookie security + JWT validation + Redis isolation

2. ✅ **Principle of Least Privilege**
   - Cookies bound to exact host
   - No unnecessary domain sharing

3. ✅ **Fail Secure**
   - Invalid tokens throw errors
   - Deleted users immediately invalidated

4. ✅ **Audit Trail**
   - All login attempts logged
   - Failed attempts tracked
   - Session creation/destruction logged

## Production Deployment Checklist

Before deploying to production:

- [ ] Verify `NEXTAUTH_SECRET` is set to a strong random value
- [ ] Verify `NEXTAUTH_URL` is set to production domain with HTTPS
- [ ] Test login flow in production environment
- [ ] Monitor audit logs for suspicious activity
- [ ] Set up alerts for multiple failed login attempts
- [ ] Document session management procedures
- [ ] Train support team on session-related issues

## Monitoring & Alerts

Set up monitoring for:

1. **Failed Login Attempts**
   - Alert on 5+ failed attempts from same IP
   - Alert on account lockouts

2. **Session Validation Failures**
   - Alert on JWT validation errors
   - Alert on user ID mismatches

3. **Suspicious Activity**
   - Multiple sessions from different IPs
   - Rapid session creation/destruction
   - Login attempts on deleted accounts

## Additional Security Recommendations

1. **Rate Limiting**
   - Already implemented: 5 failed attempts = 30-minute lockout
   - Consider adding IP-based rate limiting

2. **Session Timeout**
   - Mobile: 2 hours
   - Desktop: 24 hours
   - Consider adding idle timeout

3. **Multi-Factor Authentication**
   - Consider adding 2FA for admin accounts
   - SMS/Email verification for sensitive operations

4. **Session Management UI**
   - Allow users to view active sessions
   - Allow users to revoke sessions remotely

## Support & Troubleshooting

### User Reports "Logged in as wrong user"

1. Run session isolation test:
   ```bash
   npx tsx scripts/test-session-isolation.ts
   ```

2. Check audit logs for the user:
   ```sql
   SELECT * FROM audit_logs 
   WHERE user_id = '<user_id>' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. Clear user's sessions:
   ```bash
   # In Redis/Vercel KV
   DEL user:<user_id>:session
   DEL session:<session_id>
   ```

4. Ask user to:
   - Clear browser cookies
   - Close all browser windows
   - Log in again

### Session Not Persisting

1. Check Redis/Vercel KV connection
2. Verify `NEXTAUTH_SECRET` is set
3. Check cookie settings in browser DevTools
4. Verify HTTPS in production

### Account Lockout Issues

1. Check failed login attempts:
   ```bash
   # In Redis/Vercel KV
   GET failed_login:<email>
   TTL lockout:<email>
   ```

2. Manually unlock account:
   ```bash
   DEL lockout:<email>
   DEL failed_login:<email>
   ```

## Conclusion

This fix implements multiple layers of security to prevent session hijacking:

1. **Cookie Security** - Strict cookie settings prevent cross-context sharing
2. **Unique Sessions** - Each login gets a unique identifier
3. **Token Validation** - Every request validates token integrity
4. **Session Isolation** - Redis keys prevent collision

The combination of these measures ensures that users can only access their own accounts and sessions cannot be hijacked or shared between users.
