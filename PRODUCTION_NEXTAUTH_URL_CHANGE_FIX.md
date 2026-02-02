# Production Authentication Fix - NEXTAUTH_URL Change (NextAuth v5)

## Problem Summary
After changing `NEXTAUTH_URL` from `http://localhost:3000` to `https://thevaultlyne.com`, users experience a redirect loop:
1. Login succeeds (POST to `/api/auth/callback/credentials` returns 200)
2. Redirect to `/vendor/dashboard` (307)
3. Middleware redirects back to `/login`
4. Loop continues

## Root Cause
**JWT tokens are domain-specific in NextAuth.** When you change `NEXTAUTH_URL`, all existing JWT tokens become invalid because:
- Tokens are signed with the domain as part of the payload
- Old tokens from `localhost` cannot be validated for `thevaultlyne.com`
- Cookies may still contain old tokens from previous domain
- **NextAuth v5 uses `__Secure-` prefix for cookies in production** (HTTPS)

## Changes Made

### 1. Enhanced Middleware Debug Logging
Added comprehensive logging to `src/middleware.ts` to diagnose token issues:
- Token presence and content
- Token expiration status
- Cookie information (including `__Secure-` prefixed cookies)
- Environment variable verification
- All cookie names for debugging

### 2. NextAuth v5 Cookie Handling
Updated `src/middleware.ts` to properly handle NextAuth v5 cookies:
- Added `secureCookie: true` for production
- This tells `getToken()` to look for `__Secure-next-auth.session-token` in production
- In development, it looks for `next-auth.session-token`

### 3. Simplified Cookie Configuration
Removed explicit cookie configuration from `src/lib/auth/next-auth.config.ts`:
- Let NextAuth v5 handle cookies automatically based on `NEXTAUTH_URL`
- In production with HTTPS, it automatically uses `__Secure-` prefix
- Prevents domain mismatch issues

## Verification Steps

### Step 1: Check Vercel Environment Variables
Verify these are correctly set in Vercel dashboard:

```bash
NEXTAUTH_URL=https://thevaultlyne.com
NEXTAUTH_SECRET=<your-secret-here>
```

**CRITICAL**: `NEXTAUTH_SECRET` must be:
- At least 32 characters long
- The SAME value in all environments (dev, staging, prod)
- Never changed (changing it invalidates all tokens)

### Step 2: Test in Incognito/Private Window
1. Open a new incognito/private browser window
2. Go to `https://thevaultlyne.com/login`
3. Login with valid credentials
4. Check if redirect to dashboard works

**Why incognito?** It ensures no old cookies from localhost are present.

### Step 3: Check Vercel Logs
After testing in incognito, check Vercel logs for `[Middleware Debug]` output:

```bash
vercel logs <your-deployment-url> --follow
```

Look for:
```json
{
  "pathname": "/vendor/dashboard",
  "hasToken": true/false,
  "tokenRole": "vendor",
  "tokenExp": 1234567890,
  "currentTime": 1234567890,
  "tokenExpired": false,
  "authCookieCount": 1
}
```

### Step 4: Verify Cookie Settings
In browser DevTools (F12) → Application → Cookies → `https://thevaultlyne.com`:
- **Production**: Should see `__Secure-next-auth.session-token` cookie
- **Development**: Should see `next-auth.session-token` cookie
- Domain should be `thevaultlyne.com` (no leading dot)
- Secure flag should be checked (✓) in production
- SameSite should be `Lax`
- HttpOnly should be checked (✓)

**Important**: If you see `next-auth.session-token` (without `__Secure-` prefix) in production, the cookie was created incorrectly.

## Expected Outcomes

### If Incognito Works ✅
**Problem**: Old cookies from localhost
**Solution**: Users need to clear cookies or wait for them to expire

### If Incognito Fails ❌
Check Vercel logs for these issues:

#### Issue 1: `hasToken: false`
**Cause**: Token not being created or stored
**Check**:
- Is `NEXTAUTH_SECRET` set correctly?
- Are cookies being set? (check `authCookieCount`)
- Is login API returning success?

#### Issue 2: `tokenExpired: true`
**Cause**: Token expired immediately
**Check**:
- Server time vs client time (clock skew)
- Token maxAge configuration

#### Issue 3: `hasSecret: false`
**Cause**: `NEXTAUTH_SECRET` not available in middleware
**Solution**: Redeploy after setting environment variable

## Common Issues & Solutions

### Issue: "Invalid credentials" on every login
**Cause**: `NEXTAUTH_SECRET` mismatch between login API and middleware
**Solution**: Verify secret is identical in all Vercel environment variables

### Issue: Cookies not being set
**Cause**: Domain mismatch or secure flag issues
**Solution**: 
- Ensure `NEXTAUTH_URL` matches exactly (including https://)
- Verify `NODE_ENV=production` is set in Vercel
- Check that cookies use `__Secure-` prefix in production

### Issue: Token expires immediately
**Cause**: Server time misconfiguration
**Solution**: Check Vercel server time is correct

### Issue: Middleware can't read token but cookie exists
**Cause**: Cookie name mismatch (NextAuth v5 uses `__Secure-` prefix in production)
**Solution**: 
- Ensure `secureCookie: true` is set in `getToken()` call
- Clear all cookies and login again
- Verify `NEXTAUTH_URL` starts with `https://`

### Issue: Old localhost cookies interfering
**Cause**: Browser has cookies from both localhost and production
**Solution**: 
- Clear all cookies for both localhost and production domain
- Test in incognito window
- Or wait for old cookies to expire (24 hours)

## Deployment Checklist

- [ ] Set `NEXTAUTH_URL=https://thevaultlyne.com` in Vercel
- [ ] Set `NEXTAUTH_SECRET` (same as dev) in Vercel
- [ ] Purge Vercel cache
- [ ] Deploy changes to middleware and NextAuth config
- [ ] Test in incognito window
- [ ] Check Vercel logs for debug output
- [ ] Remove debug logging after fix confirmed

## Next Steps

1. **Deploy these changes** to Vercel
2. **Test in incognito window** immediately after deployment
3. **Check Vercel logs** for `[Middleware Debug]` output
4. **Report back** with:
   - Does incognito work? (Yes/No)
   - What does the debug log show?
   - What cookies are present in DevTools?

## Cleanup After Fix

Once authentication is working, remove debug logging from `src/middleware.ts`:
- Remove the enhanced console.log statement
- Keep only essential error logging

---

**Status**: Changes deployed, awaiting test results
**Last Updated**: 2026-02-02
