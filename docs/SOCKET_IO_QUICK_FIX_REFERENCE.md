# Socket.IO Quick Fix Reference Card

## 🚨 Problem
- Socket.IO authentication errors
- Page crashes with "Cannot read properties of undefined (reading 'toFixed')"

## ✅ Solution Applied

### 1. Fixed JWT Access Token Generation
**File**: `src/lib/auth/next-auth.config.ts`

**Before**:
```typescript
token.accessToken = token.jti || token.id;
```

**After**:
```typescript
const jwt = require('jsonwebtoken');
token.accessToken = jwt.sign(
  {
    sub: user.id,
    role: user.role,
    vendorId: user.vendorId,
    email: user.email,
  },
  process.env.NEXTAUTH_SECRET!,
  { expiresIn: '24h' }
);
```

### 2. Added VendorId to Session
**Files**: 
- `src/lib/auth/next-auth.config.ts`
- `src/types/next-auth.d.ts`

**Added**:
```typescript
// Fetch vendorId when user logs in
if (user.role === 'vendor') {
  const [vendor] = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.userId, user.id))
    .limit(1);
  
  vendorId = vendor?.id;
}
```

### 3. Fixed GPS Coordinate Display
**Files**: 
- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`
- `src/app/(dashboard)/manager/approvals/page.tsx`

**Before**:
```typescript
{auction.case.gpsLocation.y.toFixed(6)}, {auction.case.gpsLocation.x.toFixed(6)}
```

**After**:
```typescript
{auction.case.gpsLocation?.y !== undefined && auction.case.gpsLocation?.x !== undefined ? (
  <p>Coordinates: {auction.case.gpsLocation.y.toFixed(6)}, {auction.case.gpsLocation.x.toFixed(6)}</p>
) : (
  <p>Coordinates: Not available</p>
)}
```

## 🧪 Quick Test

```bash
# 1. Restart dev server
npm run dev

# 2. Clear browser cache
# Chrome: Ctrl+Shift+Delete
# Firefox: Ctrl+Shift+Delete

# 3. Log in fresh
# Navigate to: http://localhost:3000/login

# 4. Open auction details
# Navigate to: http://localhost:3000/vendor/auctions/[any-auction-id]

# 5. Check console
# Should see: ✅ Socket.io connected
# Should NOT see: ❌ Invalid authentication token
```

## 🔍 Verify Fix

### Check Access Token
```javascript
// In browser console
fetch('/api/auth/session')
  .then(r => r.json())
  .then(data => {
    console.log('Access Token:', data.accessToken);
    console.log('VendorId:', data.user.vendorId);
  });
```

**Expected**:
- `accessToken` starts with `eyJ` (JWT format)
- `vendorId` is a UUID string

### Check Socket.IO Connection
```javascript
// In browser console
// Should see WebSocket connection in Network tab
// Filter by: WS
```

**Expected**:
- Status: 101 Switching Protocols
- No error messages

## 📋 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid authentication token" | Restart server, clear cookies |
| "Cannot read properties of undefined" | Hard refresh (Ctrl+Shift+R) |
| VendorId is undefined | Check vendor profile exists in DB |
| Socket.IO not connecting | Verify custom server running |

## 🔐 Environment Check

```bash
# Verify NEXTAUTH_SECRET is set
echo $NEXTAUTH_SECRET

# If empty, generate one:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📚 Full Documentation

- **Detailed Fix**: [SOCKET_IO_AUTHENTICATION_FIX.md](./SOCKET_IO_AUTHENTICATION_FIX.md)
- **Testing Guide**: [SOCKET_IO_TESTING_GUIDE.md](./SOCKET_IO_TESTING_GUIDE.md)
- **Summary**: [SOCKET_IO_FIX_SUMMARY.md](./SOCKET_IO_FIX_SUMMARY.md)

## ✨ Success Indicators

✅ Console shows: `✅ Socket.io connected`
✅ No authentication errors
✅ GPS coordinates display correctly
✅ Real-time updates working
✅ No JavaScript crashes

---

**Quick Status Check**: Run `npm run dev` → Login → Open auction → Check console for `✅ Socket.io connected`
