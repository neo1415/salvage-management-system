# Socket.IO Authentication and toFixed Error Fix

## Issues Fixed

### 1. Socket.IO Authentication Error
**Error**: `Socket.io connection error: Error: Invalid authentication token`

**Root Cause**: 
- The `session.accessToken` was set to `token.jti || token.id`, which is not a valid JWT token that can be verified by the Socket.IO server
- The Socket.IO server's authentication middleware uses `jwt.verify()` to validate the token, which requires a properly signed JWT

**Solution**:
- Generate a proper JWT access token using `jsonwebtoken.sign()` with the same secret as NextAuth
- Include necessary user data in the token payload (userId, role, vendorId, email)
- Set appropriate expiration time (24 hours)

### 2. toFixed Error on Undefined GPS Coordinates
**Error**: `Uncaught TypeError: Cannot read properties of undefined (reading 'toFixed')`

**Root Cause**:
- The code assumed `auction.case.gpsLocation.y` and `auction.case.gpsLocation.x` would always be defined
- Some auction cases may not have GPS coordinates set

**Solution**:
- Added null/undefined checks before calling `toFixed()`
- Display fallback UI when GPS coordinates are not available
- Prevents the entire page from crashing when location data is missing

## Files Modified

### 1. `src/lib/auth/next-auth.config.ts`
**Changes**:
- Added `vendorId` to the user object returned from credentials provider
- Fetch vendorId from vendors table when user logs in (for vendor role)
- Generate proper JWT access token using `jsonwebtoken.sign()`
- Include vendorId in JWT payload for Socket.IO authentication
- Added vendorId to token and session objects

### 2. `src/types/next-auth.d.ts`
**Changes**:
- Added `vendorId?: string` to Session.user interface
- Added `vendorId?: string` to User interface
- Added `vendorId?: string` to JWT interface

### 3. `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`
**Changes**:
- Added null/undefined checks for GPS coordinates before calling `toFixed()`
- Display "Coordinates: Not available" when GPS data is missing
- Display "Location data not available" placeholder instead of map when GPS data is missing

## How Socket.IO Authentication Works Now

### Step 1: User Login
1. User logs in via credentials provider
2. System fetches user data from database
3. If user is a vendor, system fetches vendorId from vendors table
4. User object includes: id, email, name, role, status, phone, dateOfBirth, vendorId

### Step 2: JWT Token Generation
1. NextAuth generates a JWT token with user data
2. A separate access token is generated using `jsonwebtoken.sign()`:
   ```typescript
   jwt.sign(
     {
       sub: user.id,
       role: user.role,
       vendorId: user.vendorId,
       email: user.email,
     },
     process.env.NEXTAUTH_SECRET!,
     { expiresIn: '24h' }
   )
   ```
3. This access token is stored in the session as `session.accessToken`

### Step 3: Socket.IO Connection
1. Client-side hook (`useSocket`) reads `session.accessToken`
2. Socket.IO client sends the access token in the auth handshake:
   ```typescript
   io(socketUrl, {
     auth: {
       token: session.accessToken,
     },
     ...
   })
   ```

### Step 4: Server-Side Authentication
1. Socket.IO server receives the connection request
2. Authentication middleware extracts the token
3. Token is verified using `jwt.verify()` with the same secret:
   ```typescript
   const decoded = verify(token, process.env.NEXTAUTH_SECRET!)
   ```
4. User data is fetched from database to ensure user still exists and is active
5. User data is attached to socket: `socket.data.userId`, `socket.data.role`, `socket.data.vendorId`
6. Connection is established

## Testing the Fix

### 1. Test Socket.IO Authentication
1. Log in as a vendor user
2. Navigate to an auction details page
3. Open browser console
4. Look for: `✅ Socket.io connected` (should appear without errors)
5. Verify no "Invalid authentication token" errors

### 2. Test GPS Coordinates Display
1. Navigate to an auction with GPS coordinates
2. Verify coordinates display correctly: "Coordinates: 6.123456, 3.123456"
3. Verify map loads correctly

### 3. Test Missing GPS Coordinates
1. Navigate to an auction without GPS coordinates (or with null/undefined coordinates)
2. Verify fallback text displays: "Coordinates: Not available"
3. Verify placeholder displays: "Location data not available"
4. Verify page does not crash

## Environment Variables Required

Ensure these environment variables are set in `.env`:

```env
# NextAuth Secret (used for JWT signing and verification)
NEXTAUTH_SECRET=your-secret-key-here

# Socket.IO URL (optional, defaults to current origin)
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

## Debugging Tips

### Socket.IO Connection Issues
1. Check browser console for connection errors
2. Verify `session.accessToken` exists:
   ```typescript
   console.log('Access Token:', session?.accessToken);
   ```
3. Check server logs for authentication errors
4. Verify `NEXTAUTH_SECRET` is set and matches between client and server

### GPS Coordinate Issues
1. Check auction data in database
2. Verify `gps_location` column has valid data
3. Check browser console for toFixed errors
4. Verify GPS coordinates are numbers, not strings

## Additional Notes

### VendorId Lookup
- VendorId is fetched from the `vendors` table using `userId`
- Only users with role='vendor' will have a vendorId
- VendorId is used by Socket.IO to join vendor-specific rooms for notifications

### JWT Token Expiry
- Access tokens expire after 24 hours
- Users will need to re-login after token expiry
- Socket.IO will automatically disconnect when token expires

### Security Considerations
- Access tokens are signed with `NEXTAUTH_SECRET`
- Tokens include user ID, role, and vendorId for authorization
- Socket.IO server validates tokens on every connection
- User data is re-fetched from database to ensure user is still active

## Next Steps

1. Test the fixes in development environment
2. Verify Socket.IO connections work correctly
3. Test with multiple users simultaneously
4. Monitor server logs for any authentication errors
5. Deploy to production when ready

## Related Documentation

- [Socket.IO Quick Start](./SOCKET_IO_QUICK_START.md)
- [Socket.IO Implementation Summary](./SOCKET_IO_IMPLEMENTATION_SUMMARY.md)
- [NextAuth Configuration](./src/lib/auth/README.md)
