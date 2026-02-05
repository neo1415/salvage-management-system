# Socket.IO Testing Guide - Step by Step

This guide will walk you through testing the Socket.IO authentication fix step by step.

## Prerequisites

1. Ensure your development server is running:
   ```bash
   npm run dev
   ```

2. Ensure you have a vendor user account created and can log in

3. Ensure you have at least one auction in the database

## Step 1: Verify Environment Variables

1. Open `.env` file
2. Verify these variables are set:
   ```env
   NEXTAUTH_SECRET=your-secret-key-here
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3000  # Optional
   ```

3. If `NEXTAUTH_SECRET` is missing, generate one:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## Step 2: Clear Browser Cache and Cookies

1. Open browser DevTools (F12)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Clear all cookies for localhost:3000
4. Clear localStorage and sessionStorage
5. Close and reopen the browser

**Why?** Old session tokens may still be in use, causing authentication errors.

## Step 3: Log In Fresh

1. Navigate to `http://localhost:3000/login`
2. Log in with vendor credentials
3. Open browser console (F12 → Console tab)
4. Look for any errors during login

**Expected**: No errors, successful redirect to vendor dashboard

## Step 4: Check Session Data

1. In browser console, type:
   ```javascript
   fetch('/api/auth/session').then(r => r.json()).then(console.log)
   ```

2. Verify the response includes:
   ```json
   {
     "user": {
       "id": "...",
       "email": "...",
       "role": "vendor",
       "vendorId": "..."
     },
     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "sessionId": "..."
   }
   ```

3. **Important checks**:
   - `accessToken` should be a long JWT string (starts with `eyJ`)
   - `vendorId` should be present (UUID format)
   - `sessionId` should be present

**If accessToken is missing or not a JWT**: The fix didn't apply. Try restarting the dev server.

## Step 5: Navigate to Auction Details Page

1. Go to vendor dashboard: `http://localhost:3000/vendor/dashboard`
2. Click on "Browse Auctions" or navigate to `http://localhost:3000/vendor/auctions`
3. Click on any auction to view details

**Expected**: Auction details page loads without errors

## Step 6: Monitor Socket.IO Connection

1. Keep browser console open
2. Watch for Socket.IO connection messages

**Expected messages** (in order):
```
✅ Socket.io connected
👁️ User <userId> watching auction <auctionId>
```

**Errors to watch for**:
- ❌ `Socket.io connection error: Error: Invalid authentication token`
- ❌ `Uncaught TypeError: Cannot read properties of undefined (reading 'toFixed')`

## Step 7: Test Real-Time Updates

### Test 1: Watching Count
1. Open the auction details page in two different browser windows (or incognito)
2. Log in as different vendor users in each window
3. Navigate to the same auction in both windows
4. Verify the "watching count" increases

**Expected**: Watching count shows "2 watching" or more

### Test 2: Bid Updates (if you have bidding enabled)
1. Place a bid on the auction
2. Verify the bid appears in real-time without page refresh
3. Check the bid history chart updates

**Expected**: New bid appears immediately in the UI

## Step 8: Test GPS Coordinates Display

### Test with Valid GPS Data
1. Find an auction with GPS coordinates in the database
2. Navigate to that auction's details page
3. Scroll to the "Location" section

**Expected**:
- Coordinates display: "Coordinates: 6.123456, 3.123456"
- Google Maps iframe loads and shows the location

### Test with Missing GPS Data
1. Create a test auction without GPS coordinates (or set them to null in database)
2. Navigate to that auction's details page
3. Scroll to the "Location" section

**Expected**:
- Fallback text: "Coordinates: Not available"
- Placeholder: "Location data not available"
- **No JavaScript errors in console**

## Step 9: Test Socket.IO Disconnection

1. With auction details page open, open Network tab in DevTools
2. Filter by "WS" (WebSocket)
3. Find the Socket.IO connection
4. Right-click and "Close connection" (or disable network)

**Expected**:
```
❌ Socket.io disconnected: transport close
```

5. Re-enable network
6. Socket.IO should automatically reconnect:
```
✅ Socket.io connected
```

## Step 10: Test Multiple Tabs

1. Open auction details page in 3 different tabs
2. All tabs should connect to Socket.IO
3. Close one tab
4. Verify watching count decreases in other tabs

**Expected**: Real-time watching count updates across all tabs

## Common Issues and Solutions

### Issue 1: "Invalid authentication token"

**Symptoms**:
```
Socket.io connection error: Error: Invalid authentication token
```

**Solutions**:
1. Verify `NEXTAUTH_SECRET` is set in `.env`
2. Restart the dev server: `Ctrl+C` then `npm run dev`
3. Clear browser cookies and log in again
4. Check that `session.accessToken` is a valid JWT (Step 4)

### Issue 2: "Cannot read properties of undefined (reading 'toFixed')"

**Symptoms**:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'toFixed')
```

**Solutions**:
1. This should be fixed by the code changes
2. Hard refresh the page: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Clear browser cache
4. Verify the fix was applied to `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

### Issue 3: Socket.IO not connecting at all

**Symptoms**:
- No Socket.IO messages in console
- No WebSocket connection in Network tab

**Solutions**:
1. Verify custom server is running (check terminal for "Socket.io server ready")
2. Check if you're using `npm run dev` (should use custom server)
3. Verify `server.ts` exists in project root
4. Check for port conflicts (another app using port 3000)

### Issue 4: VendorId is undefined

**Symptoms**:
```json
{
  "user": {
    "vendorId": undefined
  }
}
```

**Solutions**:
1. Verify user has a vendor profile in the database:
   ```sql
   SELECT * FROM vendors WHERE user_id = '<your-user-id>';
   ```
2. If no vendor profile exists, create one through the registration flow
3. Log out and log in again to refresh the session

## Debugging Commands

### Check if Socket.IO server is running
```bash
# In terminal where dev server is running, look for:
✅ Socket.io server initialized
```

### Check Socket.IO connection in browser
```javascript
// In browser console
window.io
// Should return Socket.IO client library
```

### Decode JWT token
```javascript
// In browser console
const token = 'your-access-token-here';
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
// Should show: { sub, role, vendorId, email, exp, iat }
```

### Check Redis session
```bash
# If using Redis locally
redis-cli
> KEYS session:*
> GET session:<session-id>
```

## Success Criteria

✅ Socket.IO connects without authentication errors
✅ Watching count updates in real-time
✅ GPS coordinates display correctly (or show fallback)
✅ No JavaScript errors in console
✅ Multiple tabs can connect simultaneously
✅ Disconnection and reconnection work smoothly

## Next Steps After Testing

1. If all tests pass, the fix is working correctly
2. Test with multiple users simultaneously
3. Monitor server logs for any errors
4. Consider adding automated tests for Socket.IO
5. Deploy to staging environment for further testing

## Need Help?

If you encounter issues not covered in this guide:

1. Check server logs for detailed error messages
2. Enable Socket.IO debug mode:
   ```javascript
   localStorage.debug = 'socket.io-client:*';
   ```
3. Check the [Socket.IO documentation](https://socket.io/docs/v4/)
4. Review the [SOCKET_IO_AUTHENTICATION_FIX.md](./SOCKET_IO_AUTHENTICATION_FIX.md) document
