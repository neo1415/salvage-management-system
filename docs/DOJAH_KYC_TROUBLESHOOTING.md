# Dojah KYC Widget Troubleshooting Guide

## Current Issues and Solutions

### Issue 1: DeviceGuard Initialization Failures

**Error Message:**
```
DeviceGuard initialization failed: AbortError: signal is aborted without reason
```

**What is DeviceGuard?**
DeviceGuard is Dojah's anti-fraud and device fingerprinting system that runs before the KYC widget opens. It collects device information to prevent fraud.

**Root Causes:**
1. **Test Credentials Limitations**: Test API keys may have limited DeviceGuard functionality
2. **Browser Compatibility**: Some browsers or privacy settings block device fingerprinting
3. **Network Issues**: DeviceGuard requires stable connection to Dojah servers
4. **HTTPS Required**: DeviceGuard only works on secure connections

**Solutions:**

#### Solution 1: Use Production Credentials (Recommended)
Test credentials have limited functionality. To get production credentials:
1. Go to https://dojah.io/dashboard
2. Complete your business verification
3. Request production API keys
4. Update `.env`:
   ```env
   DOJAH_API_KEY=live_sk_your_production_key
   DOJAH_PUBLIC_KEY=live_pk_your_production_key
   DOJAH_APP_ID=your_production_app_id
   ```

#### Solution 2: Widget Configuration Fix
The widget initialization has been updated to:
- Use `type: 'custom'` consistently
- Add proper error handling for initialization failures
- Allow widget to open even if pre-check camera permission fails

#### Solution 3: Browser Settings
Users should:
- Use Chrome, Edge, or Safari (latest versions)
- Disable strict privacy/tracking protection for your domain
- Allow JavaScript and cookies
- Use HTTPS (not HTTP)

### Issue 2: Camera Permission Denied

**Error Message:**
```
Camera permission denied or unavailable
```

**Root Causes:**
1. Browser blocks camera access in iframes by default
2. Permissions-Policy header not configured correctly
3. User denied permission
4. Camera already in use by another app
5. No camera device available

**Solutions Implemented:**

#### 1. Permissions-Policy Header (✅ Fixed)
Updated `next.config.ts` to allow camera access for Dojah domains:
```typescript
{
  key: 'Permissions-Policy',
  value: 'camera=(self https://widget.dojah.io https://identity.dojah.io), microphone=(self https://widget.dojah.io https://identity.dojah.io), geolocation=(self), payment=(self)',
}
```

#### 2. Content Security Policy (✅ Fixed)
Added Dojah domains to CSP:
```typescript
"frame-src 'self' ... https://widget.dojah.io https://identity.dojah.io https://*.dojah.io"
"connect-src 'self' ... https://widget.dojah.io https://identity.dojah.io https://*.dojah.io"
```

#### 3. Pre-flight Camera Permission Check (✅ Implemented)
Created `src/lib/utils/camera-permissions.ts` with:
- `checkCameraPermission()` - checks current permission state
- `requestCameraPermission()` - triggers browser prompt
- `getCameraPermissionInstructions()` - provides browser-specific help

The KYC page now:
1. Checks camera permission before opening widget
2. Requests permission if needed (triggers browser prompt)
3. Falls back to letting Dojah handle permissions if pre-check fails
4. Shows helpful error messages with browser-specific instructions

### Issue 3: Google Maps API Warning

**Warning Message:**
```
Google Maps JavaScript API has been loaded directly without loading=async
```

**Impact:** Performance warning only, doesn't affect functionality

**Solution:** This is a Dojah internal issue. They load Google Maps for address verification. No action needed on our side.

## Testing Checklist

### Before Testing
- [ ] Ensure you're on HTTPS (not HTTP)
- [ ] Use latest Chrome, Edge, or Safari
- [ ] Close other apps using camera (Zoom, Teams, etc.)
- [ ] Check camera works in other apps
- [ ] Disable strict privacy/tracking protection

### During Testing
1. **Navigate to Tier 2 KYC page**
   - URL: `/vendor/kyc/tier2`
   - Should see "Start Verification" button

2. **Click "Start Verification"**
   - Browser should prompt for camera permission
   - Click "Allow" when prompted
   - Widget should open in modal/iframe

3. **If Camera Permission Fails**
   - Check browser console for errors
   - Try manually enabling camera:
     - Chrome: Click lock icon → Site settings → Camera → Allow
     - Edge: Click lock icon → Permissions → Camera → Allow
     - Safari: Safari menu → Settings → Websites → Camera → Allow
   - Refresh page and try again

4. **Complete Verification**
   - Follow Dojah widget prompts
   - Provide NIN, take selfie, upload documents
   - Wait for processing (30-60 seconds)
   - Should see "Under Review" or "Approved" status

### After Testing
- [ ] Check `/api/kyc/status` returns correct status
- [ ] Verify KYC data saved in database
- [ ] Check Dojah dashboard for verification result
- [ ] Test with different browsers

## Common Error Messages

### "Camera permission denied or unavailable"
**Cause:** Browser blocked camera access
**Fix:** 
1. Click browser's camera icon in address bar
2. Select "Always allow"
3. Refresh page and try again

### "No camera found on your device"
**Cause:** No camera hardware detected
**Fix:** 
- Connect external webcam
- Check camera is enabled in Device Manager (Windows)
- Check camera privacy settings (Windows Settings → Privacy → Camera)

### "Camera is already in use"
**Cause:** Another app is using the camera
**Fix:** Close other apps (Zoom, Teams, Skype, etc.) and try again

### "Verification widget is not ready"
**Cause:** Dojah script failed to load
**Fix:** 
1. Check internet connection
2. Disable ad blockers
3. Refresh page
4. Check browser console for script loading errors

### "KYC service is not configured"
**Cause:** Missing Dojah credentials in `.env`
**Fix:** Ensure these are set:
```env
DOJAH_API_KEY=your_api_key
DOJAH_PUBLIC_KEY=your_public_key
DOJAH_APP_ID=your_app_id
```

## Environment Variables

### Required
```env
DOJAH_API_KEY=test_sk_xxx or live_sk_xxx
DOJAH_PUBLIC_KEY=test_pk_xxx or live_pk_xxx
DOJAH_APP_ID=your_app_id
```

### Optional
```env
DOJAH_WIDGET_ID=your_custom_widget_id  # Only if you have custom widget config
DOJAH_BASE_URL=https://api.dojah.io    # Default, usually not needed
```

### Test vs Production Credentials

| Feature | Test Credentials | Production Credentials |
|---------|-----------------|----------------------|
| DeviceGuard | Limited/Unstable | Full functionality |
| Liveness Check | Mock/Simplified | Real biometric check |
| NIN Verification | Test data only | Real NIN database |
| Document Verification | Basic checks | Full OCR + validation |
| Cost | Free | Charged per verification |
| Reliability | Lower | Higher |

**Recommendation:** Use production credentials for real testing and deployment.

## Browser Compatibility

### Fully Supported
- ✅ Chrome 90+ (Desktop & Mobile)
- ✅ Edge 90+ (Desktop)
- ✅ Safari 14+ (Desktop & iOS)

### Partially Supported
- ⚠️ Firefox 88+ (May have DeviceGuard issues)
- ⚠️ Opera 76+ (May have DeviceGuard issues)

### Not Supported
- ❌ Internet Explorer (any version)
- ❌ Browsers with strict privacy mode enabled
- ❌ Browsers with JavaScript disabled

## Network Requirements

### Required Domains (Must be accessible)
- `https://widget.dojah.io` - Widget script
- `https://identity.dojah.io` - Identity verification iframe
- `https://api.dojah.io` - API calls
- `https://deviceguard.dojah.io` - Device fingerprinting (assumed)

### Firewall Rules
If behind corporate firewall, whitelist:
- `*.dojah.io` (all Dojah subdomains)
- Port 443 (HTTPS)
- WebSocket connections (for real-time updates)

## Debugging Steps

### 1. Check Browser Console
Open DevTools (F12) and look for:
- Red errors (critical issues)
- Yellow warnings (performance issues)
- Network tab: Failed requests to Dojah domains

### 2. Check Network Tab
Filter by "dojah" and verify:
- Widget script loads (200 OK)
- API calls succeed (200 OK)
- No CORS errors
- No 401/403 authentication errors

### 3. Check Application Tab
- Check if camera permission is granted
- Check if cookies are enabled
- Check if localStorage is accessible

### 4. Test Camera Directly
Open browser console and run:
```javascript
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log('Camera works!', stream);
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(err => console.error('Camera failed:', err));
```

### 5. Check Dojah Dashboard
- Log in to https://dojah.io/dashboard
- Check API usage/logs
- Verify credentials are active
- Check for any service outages

## Known Limitations

### Test Environment
1. DeviceGuard may fail intermittently
2. Liveness checks are simplified
3. NIN verification uses test database
4. Some features may be disabled

### Production Environment
1. Costs apply per verification (₦510-630)
2. Requires business verification with Dojah
3. May require additional compliance documentation
4. Subject to Dojah's rate limits

## Support Contacts

### Dojah Support
- Email: support@dojah.io
- Dashboard: https://dojah.io/dashboard
- Documentation: https://docs.dojah.io

### Internal Support
- Check `src/features/kyc/` for implementation details
- Review `docs/` for additional KYC documentation
- Contact development team for code-related issues

## Recent Changes

### 2024-04-17: Camera Permission Improvements
- ✅ Added pre-flight camera permission check
- ✅ Fixed Permissions-Policy header for Dojah domains
- ✅ Improved widget initialization error handling
- ✅ Added fallback to let Dojah handle permissions if pre-check fails
- ✅ Added browser-specific permission instructions

### Files Modified
- `src/app/(dashboard)/vendor/kyc/tier2/page.tsx` - Widget initialization and permission handling
- `src/lib/utils/camera-permissions.ts` - Camera permission utilities (NEW)
- `next.config.ts` - Permissions-Policy and CSP headers
- `docs/DOJAH_KYC_TROUBLESHOOTING.md` - This document (NEW)

## Next Steps

1. **Get Production Credentials**
   - Contact Dojah to upgrade from test to production
   - Update `.env` with production keys
   - Test thoroughly before going live

2. **Monitor DeviceGuard Errors**
   - Track error frequency in production
   - Consider implementing fallback verification method
   - Report persistent issues to Dojah support

3. **Improve User Experience**
   - Add loading states during permission checks
   - Show progress indicators during verification
   - Provide clear error messages and recovery steps
   - Add retry mechanisms for transient failures

4. **Security Hardening**
   - Rotate API keys regularly
   - Monitor for suspicious verification attempts
   - Implement rate limiting on KYC endpoints
   - Add audit logging for all KYC operations
