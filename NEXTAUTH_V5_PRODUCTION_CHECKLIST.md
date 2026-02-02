# NextAuth v5 Production Authentication Checklist

## Quick Diagnosis

Your authentication redirect loop is caused by **changing NEXTAUTH_URL from localhost to production domain**. This invalidates all existing JWT tokens.

## Critical Changes Made

### 1. Middleware Update (`src/middleware.ts`)
```typescript
// Added secureCookie flag for NextAuth v5
const token = await getToken({
  req: request,
  secret: process.env.NEXTAUTH_SECRET,
  secureCookie: process.env.NODE_ENV === 'production', // NEW
});
```

**Why**: NextAuth v5 uses `__Secure-next-auth.session-token` in production (HTTPS) and `next-auth.session-token` in development. The `secureCookie` flag tells `getToken()` which cookie name to look for.

### 2. Enhanced Debug Logging
Added comprehensive logging to see:
- Token presence and content
- Cookie names (including `__Secure-` prefixed ones)
- Environment variables
- Token expiration

## Immediate Action Required

### Deploy to Vercel
```bash
git add .
git commit -m "fix: NextAuth v5 production cookie handling"
git push
```

### Test in Incognito Window
1. Open incognito/private window
2. Go to `https://thevaultlyne.com/login`
3. Login with valid credentials
4. Should redirect to dashboard successfully

**Why incognito?** Ensures no old localhost cookies interfere.

### Check Vercel Logs
```bash
vercel logs --follow
```

Look for `[Middleware Debug]` output after login attempt.

## Expected Debug Output

### Successful Login
```json
{
  "pathname": "/vendor/dashboard",
  "hasToken": true,
  "tokenRole": "vendor",
  "tokenEmail": "user@example.com",
  "tokenExp": 1738627200,
  "currentTime": 1738540800,
  "tokenExpired": false,
  "hasSecret": true,
  "secretLength": 32,
  "nextauthUrl": "https://thevaultlyne.com",
  "nodeEnv": "production",
  "authCookieNames": ["__Secure-next-auth.session-token"],
  "authCookieCount": 1
}
```

### Failed Login (Token Not Found)
```json
{
  "pathname": "/vendor/dashboard",
  "hasToken": false,
  "authCookieNames": [],
  "authCookieCount": 0,
  "nextauthUrl": "https://thevaultlyne.com",
  "nodeEnv": "production"
}
```

## Troubleshooting Guide

### Scenario 1: `hasToken: false` and `authCookieCount: 0`
**Problem**: Cookie not being created at all

**Check**:
1. Is `NEXTAUTH_URL=https://thevaultlyne.com` set in Vercel?
2. Is `NEXTAUTH_SECRET` set in Vercel?
3. Does login API return success? (check `/api/auth/callback/credentials`)

**Solution**:
```bash
# Verify Vercel environment variables
vercel env ls

# Should show:
# NEXTAUTH_URL (Production)
# NEXTAUTH_SECRET (Production)
```

### Scenario 2: `hasToken: false` but `authCookieCount: 1`
**Problem**: Cookie exists but middleware can't read it

**Possible Causes**:
- Cookie name mismatch (wrong prefix)
- `NEXTAUTH_SECRET` mismatch
- Cookie domain mismatch

**Check Cookie Name**:
- Production should have: `__Secure-next-auth.session-token`
- If you see: `next-auth.session-token` (no `__Secure-`), the cookie was created incorrectly

**Solution**:
1. Verify `NEXTAUTH_URL` starts with `https://` (not `http://`)
2. Verify `NODE_ENV=production` in Vercel
3. Clear cookies and login again

### Scenario 3: `hasToken: true` but `tokenExpired: true`
**Problem**: Token expired immediately

**Causes**:
- Server time skew
- Token maxAge too short

**Solution**:
- Check Vercel server time
- Verify token maxAge is 24 hours (86400 seconds)

### Scenario 4: Works in incognito, fails in normal browser
**Problem**: Old localhost cookies interfering

**Solution**:
- Clear all cookies for both `localhost` and `thevaultlyne.com`
- Or wait 24 hours for old cookies to expire
- Inform users to clear cookies or use incognito

## Vercel Environment Variables

### Required Variables
```bash
NEXTAUTH_URL=https://thevaultlyne.com
NEXTAUTH_SECRET=<your-32-character-secret>
NODE_ENV=production  # Usually set automatically by Vercel
```

### Verify Secret
```bash
# Check secret length (should be 32+ characters)
echo -n "your-secret-here" | wc -c
```

**CRITICAL**: The `NEXTAUTH_SECRET` must be:
- At least 32 characters
- The SAME in all environments (dev, staging, prod)
- NEVER changed (changing it invalidates all tokens)

## Cookie Behavior in NextAuth v5

| Environment | Cookie Name | Secure Flag | Domain |
|-------------|-------------|-------------|---------|
| Development (HTTP) | `next-auth.session-token` | No | `localhost` |
| Production (HTTPS) | `__Secure-next-auth.session-token` | Yes | `thevaultlyne.com` |

**Key Point**: The `__Secure-` prefix is automatically added by NextAuth v5 when:
- `NEXTAUTH_URL` starts with `https://`
- `NODE_ENV=production`

## Browser DevTools Check

### Open DevTools (F12)
1. Go to **Application** tab
2. Click **Cookies** → `https://thevaultlyne.com`
3. Look for authentication cookie

### Expected Cookie Properties
```
Name: __Secure-next-auth.session-token
Value: <encrypted-jwt-token>
Domain: thevaultlyne.com
Path: /
Expires: <24-hours-from-now>
HttpOnly: ✓
Secure: ✓
SameSite: Lax
```

### Red Flags
❌ Cookie name is `next-auth.session-token` (missing `__Secure-`)
❌ Secure flag is not checked
❌ Domain is `localhost`
❌ Cookie is expired

## Post-Fix Cleanup

Once authentication is working:

### 1. Remove Debug Logging
Edit `src/middleware.ts` and remove/simplify the console.log:

```typescript
// Remove this entire block after debugging
if (pathname.startsWith('/vendor') || pathname.startsWith('/login')) {
  console.log('[Middleware Debug]', { ... });
}
```

### 2. Verify Production
- Test login/logout flow
- Test role-based redirects
- Test session persistence across page refreshes

### 3. Monitor Logs
- Watch for any authentication errors
- Check for unusual redirect patterns

## Summary

The fix involves:
1. ✅ Added `secureCookie: true` to middleware `getToken()` call
2. ✅ Enhanced debug logging to diagnose issues
3. ✅ Simplified cookie configuration (let NextAuth v5 handle it)
4. ⏳ Deploy and test in incognito window
5. ⏳ Check Vercel logs for debug output
6. ⏳ Remove debug logging after confirmation

## Next Steps

1. **Deploy** these changes to Vercel
2. **Test** in incognito window immediately
3. **Check** Vercel logs for `[Middleware Debug]` output
4. **Report** results:
   - Does incognito work? (Yes/No)
   - What does debug log show?
   - What cookie names appear in DevTools?

---

**Status**: Ready for deployment and testing
**Last Updated**: 2026-02-02
