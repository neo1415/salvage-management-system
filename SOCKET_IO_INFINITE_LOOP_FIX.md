# Socket.IO Infinite Loop and Authentication Fix

## New Issues Identified

### 1. Maximum Update Depth Exceeded (Infinite Loop)
**Error**: `Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.`

**Affected Files**:
- `src/hooks/use-socket.ts`
- `src/components/ui/countdown-timer.tsx`

**Root Cause**:
- In `use-socket.ts`: The dependency array included the entire `session` object, which changes on every render
- In `countdown-timer.tsx`: The `onComplete` callback was in the dependency array, causing re-renders

### 2. Socket.IO Authentication Still Failing
**Error**: `Socket.io connection error: Error: Invalid authentication token`

**Possible Causes**:
1. Server not restarted after code changes
2. Old session still in browser
3. Access token not being generated correctly
4. NEXTAUTH_SECRET mismatch

## Fixes Applied

### Fix 1: use-socket.ts Dependency Array
**Changed from**:
```typescript
}, [session, status]);
```

**Changed to**:
```typescript
}, [session?.accessToken, status]);
```

**Why**: Only depend on the specific value we need (`accessToken`), not the entire session object.

### Fix 2: countdown-timer.tsx Callback Dependencies
**Changed from**:
```typescript
}, [calculateTimeRemaining, onComplete]);
```

**Changed to**:
```typescript
}, [calculateTimeRemaining]);
```

**Why**: Remove `onComplete` from dependencies and call it directly when needed.

### Fix 3: Added Access Token Validation
**Added**:
```typescript
// Validate access token format (should be a JWT)
if (!session.accessToken.startsWith('eyJ')) {
  console.error('Invalid access token format. Expected JWT.');
  setError(new Error('Invalid access token format'));
  return;
}
```

**Why**: Catch invalid tokens early before attempting to connect.

## Step-by-Step Troubleshooting

### Step 1: Restart Development Server
```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

**Why**: Code changes to NextAuth config require server restart.

### Step 2: Clear Browser Data
1. Open DevTools (F12)
2. Go to Application tab
3. Clear all:
   - Cookies
   - Local Storage
   - Session Storage
4. Close browser completely
5. Reopen browser

**Why**: Old session tokens may still be cached.

### Step 3: Check Session Token
```bash
# Run the debug script
npx tsx scripts/check-session-token.ts
```

**Expected Output**:
```
✅ Session found
✅ Access token found
✅ Access token is a valid JWT format
✅ JWT payload decoded
✅ Token is not expired
✅ Token signature is valid
🎉 All checks passed!
```

**If you see errors**: Follow the specific guidance in the script output.

### Step 4: Log In Fresh
1. Navigate to `/login`
2. Log in with vendor credentials
3. Open browser console
4. Check for these messages:
   ```
   ✅ Socket.io connected
   ```

### Step 5: Verify Access Token in Browser
```javascript
// In browser console
fetch('/api/auth/session')
  .then(r => r.json())
  .then(data => {
    console.log('Access Token:', data.accessToken);
    console.log('Starts with eyJ?', data.accessToken?.startsWith('eyJ'));
    console.log('VendorId:', data.user.vendorId);
  });
```

**Expected**:
- `accessToken` should start with `eyJ`
- `vendorId` should be a UUID (if user is a vendor)

## Common Issues and Solutions

### Issue 1: "Invalid access token format"
**Symptoms**:
```
Invalid access token format. Expected JWT.
```

**Solution**:
1. Check if `NEXTAUTH_SECRET` is set in `.env`
2. Restart dev server
3. Clear browser cookies
4. Log in again

### Issue 2: "Maximum update depth exceeded"
**Symptoms**:
```
Maximum update depth exceeded
```

**Solution**:
1. Hard refresh page (Ctrl+Shift+R)
2. Clear browser cache
3. Restart dev server

### Issue 3: "Invalid authentication token" (Server-side)
**Symptoms**:
```
Socket.io connection error: Error: Invalid authentication token
```

**Solution**:
1. Verify `NEXTAUTH_SECRET` matches in both client and server
2. Check server logs for JWT verification errors
3. Ensure Socket.IO server is initialized (check for "Socket.io server initialized" in logs)

### Issue 4: VendorId is undefined
**Symptoms**:
```
vendorId: undefined
```

**Solution**:
1. Check if user has a vendor profile:
   ```sql
   SELECT * FROM vendors WHERE user_id = '<your-user-id>';
   ```
2. If no profile exists, complete vendor registration
3. Log out and log in again

## Verification Checklist

- [ ] Dev server restarted
- [ ] Browser cookies cleared
- [ ] Logged in fresh
- [ ] Access token starts with `eyJ`
- [ ] VendorId is present (for vendors)
- [ ] No "Maximum update depth" errors
- [ ] Socket.IO connects successfully
- [ ] No authentication errors in console

## Debug Commands

### Check if Socket.IO server is running
```bash
# In terminal where dev server is running, look for:
✅ Socket.io server initialized
```

### Check session in database
```bash
npx tsx scripts/check-session-token.ts
```

### Decode JWT token manually
```javascript
// In browser console
const token = 'your-access-token-here';
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
```

### Check Socket.IO connection
```javascript
// In browser console
// After navigating to auction page
console.log('Socket connected?', window.io);
```

## Files Modified

1. **src/hooks/use-socket.ts**
   - Fixed dependency array to prevent infinite loop
   - Added access token format validation

2. **src/components/ui/countdown-timer.tsx**
   - Removed callback functions from dependency arrays
   - Prevents infinite re-renders

3. **scripts/check-session-token.ts** (NEW)
   - Debug script to verify session token

## Next Steps

1. ✅ Apply fixes
2. ⏳ Restart dev server
3. ⏳ Clear browser data
4. ⏳ Log in fresh
5. ⏳ Test Socket.IO connection
6. ⏳ Verify no infinite loops

## Success Criteria

✅ No "Maximum update depth" errors
✅ Socket.IO connects without authentication errors
✅ Access token is a valid JWT
✅ VendorId is present in session
✅ Real-time updates work correctly

---

**Status**: ✅ FIXES APPLIED
**Next Action**: Restart server and test
