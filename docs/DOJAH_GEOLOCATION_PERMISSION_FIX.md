# Dojah Geolocation Permission Fix

## Issue
The Dojah KYC widget was showing "Location permission denied or unavailable" even though nemsalvage.com had location permission allowed. The embedded Dojah iframe origin was not allowed to use geolocation by the app's Permissions-Policy header.

## Root Cause
The `Permissions-Policy` header in `next.config.ts` was set to:
```
geolocation=(self)
```

This only allowed geolocation for the same origin (nemsalvage.com), not for the embedded Dojah iframe origins (`https://identity.dojah.io` and `https://widget.dojah.io`).

## Solution

### 1. Updated Permissions-Policy Header (next.config.ts)
Changed the geolocation policy to include Dojah origins:

**Before:**
```typescript
geolocation=(self)
```

**After:**
```typescript
geolocation=(self "https://identity.dojah.io" "https://widget.dojah.io")
```

This allows the Dojah iframe to request geolocation permission from the user.

### 2. Updated Iframe Allow Attributes (src/app/(dashboard)/vendor/kyc/tier2/page.tsx)
Added `geolocation` to the iframe allow attribute:

**Before:**
```typescript
const DOJAH_IFRAME_ALLOW = 'camera; microphone; fullscreen; autoplay';
```

**After:**
```typescript
const DOJAH_IFRAME_ALLOW = 'camera; microphone; geolocation; fullscreen; autoplay';
```

### 3. Created Geolocation Permission Utilities (src/lib/utils/geolocation-permissions.ts)
New utility file with functions to:
- Check if geolocation permission is already granted
- Request geolocation permission (preflight check)
- Provide user-friendly instructions for enabling geolocation

**Key features:**
- Does NOT store coordinates (immediately discarded)
- Provides browser-specific instructions
- Handles permission states: granted, denied, prompt
- 10-second timeout for permission requests

### 4. Added Geolocation Preflight Check (src/app/(dashboard)/vendor/kyc/tier2/page.tsx)
Updated `handleCameraPermissionCheck()` to:
1. Check camera permission first
2. Check geolocation permission second
3. Request permissions if needed
4. Show clear error messages if permissions are denied
5. Only open Dojah widget after both permissions are granted or user is informed

**User experience improvements:**
- Button text changes to "Checking permissions..." during preflight
- Clear error messages with browser-specific instructions
- Info box updated to mention both camera and location requirements
- Coordinates are never stored (privacy-safe)

## Files Changed

1. **next.config.ts**
   - Updated Permissions-Policy header to allow geolocation for Dojah origins

2. **src/app/(dashboard)/vendor/kyc/tier2/page.tsx**
   - Added geolocation to iframe allow attribute
   - Imported geolocation permission utilities
   - Added geolocation state tracking
   - Enhanced permission check flow to include geolocation
   - Updated UI text to mention location requirement

3. **src/lib/utils/geolocation-permissions.ts** (NEW)
   - Created utility functions for geolocation permission management
   - Provides browser-specific instructions
   - Privacy-safe (no coordinate storage)

## Security Considerations

✅ **Safe:**
- Only allows geolocation for specific Dojah origins (not wildcards)
- Coordinates are never stored or logged
- Permission request has timeout (10 seconds)
- User must explicitly grant permission

✅ **No wildcards used** - maintains strict security policy

✅ **CSP unchanged** - Dojah origins were already allowed in frame-src and connect-src

## Testing Checklist

- [ ] Build completes successfully
- [ ] Tier 2 KYC page loads without errors
- [ ] Browser prompts for location permission when "Start Verification" is clicked
- [ ] Dojah widget opens after permissions are granted
- [ ] Location step in Dojah widget works correctly
- [ ] Clear error message shown if location permission is denied
- [ ] Works on desktop browsers (Chrome, Firefox, Safari, Edge)
- [ ] Works on mobile browsers (Chrome, Safari)
- [ ] Works in PWA mode

## Expected Behavior

1. User clicks "Start Verification"
2. Button shows "Checking permissions..."
3. Browser prompts for camera permission (if not already granted)
4. Browser prompts for location permission (if not already granted)
5. If both granted: Dojah widget opens
6. If denied: Clear error message with instructions to enable in browser settings
7. Location step in Dojah widget now works correctly

## Deployment Notes

- No database changes required
- No environment variable changes required
- Changes are backward compatible
- Existing KYC verifications are not affected
- Can be deployed immediately

## Related Documentation

- [Dojah KYC Troubleshooting](./DOJAH_KYC_TROUBLESHOOTING.md)
- [Dojah Test Credentials Limitation](./DOJAH_TEST_CREDENTIALS_LIMITATION.md)
- [Camera Permissions Utility](../src/lib/utils/camera-permissions.ts)
- [Geolocation Permissions Utility](../src/lib/utils/geolocation-permissions.ts)
