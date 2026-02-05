# Session Hijacking Fix - Quick Start Guide

## What Was Fixed

The critical security bug where logging in as a new user would result in being logged in as the system admin has been fixed with multiple security enhancements:

1. ✅ **Explicit cookie configuration** - Cookies are now bound to exact host
2. ✅ **Unique session identifiers** - Each login gets a unique session ID
3. ✅ **Enhanced token validation** - Every request validates user identity
4. ✅ **Improved session storage** - Redis uses unique keys per session

## Testing the Fix - Step by Step

### Step 1: Clear All Sessions ✅ DONE

```bash
npx tsx scripts/clear-all-sessions.ts
```

**Status**: ✅ Completed - 2 sessions cleared

### Step 2: Clear Browser Cookies (DO THIS NOW)

**CRITICAL**: You MUST clear cookies in ALL browser windows/profiles:

#### In Chrome/Edge:
1. Press `F12` to open DevTools
2. Click the **Application** tab
3. Expand **Cookies** in the left sidebar
4. Click on `http://localhost:3000`
5. Right-click and select **Clear**
6. **Close ALL browser windows** (including other Google profiles)

#### Alternative Method:
1. Press `Ctrl+Shift+Delete`
2. Select "Cookies and other site data"
3. Choose "All time"
4. Click "Clear data"
5. **Close ALL browser windows**

### Step 3: Test the Fix

#### Test A: Admin Login
1. Open a **fresh** browser window
2. Go to `http://localhost:3000/login`
3. Log in as admin:
   - Email: `adneo502@gmail.com`
   - Password: (your admin password)
4. Verify you see the **Admin Dashboard**
5. Check DevTools > Application > Cookies
6. Note the `authjs.session-token` value

#### Test B: New User Login (Different Browser Context)
1. Open a **different browser profile** or **incognito window**
2. Go to `http://localhost:3000/login`
3. Log in as new user:
   - Email: `adetimilehin502@gmail.com`
   - Password: (the password you set)
4. **Expected Result**: You should see a "Change Password" prompt
5. **NOT Expected**: You should NOT see the admin dashboard
6. Check DevTools > Application > Cookies
7. The `authjs.session-token` should be DIFFERENT from admin's

#### Test C: Verify Session Isolation
Run the test script:
```bash
npx tsx scripts/test-session-isolation.ts
```

**Expected Output**:
- Both users should have different session IDs
- No session collision
- Each user's session data is isolated

## What to Look For

### ✅ Success Indicators:
- New user sees password change prompt (not admin dashboard)
- Each browser window has a different session token
- Session IDs are unique per user
- Logging out one user doesn't affect the other

### ❌ Failure Indicators:
- New user sees admin dashboard
- Same session token in different browser windows
- Session IDs are identical
- Logging out one user logs out both

## If the Issue Persists

### 1. Verify Environment Variables
Check `.env` file:
```bash
NEXTAUTH_SECRET=<should be set to a long random string>
NEXTAUTH_URL=http://localhost:3000
```

### 2. Restart the Development Server
```bash
# Stop the server (Ctrl+C)
# Clear Next.js cache
rmdir /s /q .next
# Start fresh
npm run dev
```

### 3. Check for Cached Cookies
Some browsers cache cookies aggressively:
- Try a completely different browser (Firefox if using Chrome)
- Use incognito/private mode
- Check for browser extensions that might interfere

### 4. Verify Database State
```bash
npx tsx scripts/debug-session-issue.ts
```

This shows:
- All users in the database
- Active sessions in Redis
- User-to-session mappings

## Technical Details

### Cookie Settings
```typescript
{
  httpOnly: true,        // Prevents JavaScript access
  sameSite: 'lax',       // Prevents CSRF
  secure: false,         // true in production (HTTPS)
  domain: undefined      // Binds to exact host
}
```

### Session ID Format
```
{userId}-{timestamp}-{random}
Example: 3a9bae31-145f-49bf-99af-b85c7ad89e4d-1738713600000-x7k2m9p
```

### Redis Keys
```
session:{sessionId}              # Actual session data
user:{userId}:session            # User-to-session mapping
```

## Monitoring

After the fix, monitor for:

1. **Failed Login Attempts**
   - Check audit logs: `SELECT * FROM audit_logs WHERE action_type = 'login_failed'`

2. **Session Validation Errors**
   - Check server logs for "Session validation failed"

3. **Multiple Sessions**
   - Run: `npx tsx scripts/test-session-isolation.ts`

## Support Commands

### Clear a specific user's session:
```typescript
// In a script or API route
await kv.del(`user:${userId}:session`);
```

### Check active sessions:
```bash
npx tsx scripts/test-session-isolation.ts
```

### Clear all sessions:
```bash
npx tsx scripts/clear-all-sessions.ts
```

## Next Steps After Verification

Once you confirm the fix works:

1. ✅ Test with multiple users
2. ✅ Test concurrent logins
3. ✅ Test logout functionality
4. ✅ Test password change flow
5. ✅ Document any remaining issues

## Questions?

If you encounter any issues:

1. Check the detailed documentation: `SESSION_HIJACKING_FIX.md`
2. Run the debug script: `npx tsx scripts/debug-session-issue.ts`
3. Check server logs for error messages
4. Verify all browser cookies are cleared

---

**Remember**: The most common cause of persistent issues is **cached browser cookies**. When in doubt, clear cookies and close ALL browser windows!
