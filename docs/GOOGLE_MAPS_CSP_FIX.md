# Google Maps CSP Error Fix

**Date**: 2026-04-20  
**Status**: ✅ Fixed  
**Priority**: High

## Problem

When opening auction details, case details, case approvals, or bid history pages, the following CSP (Content Security Policy) errors appeared in the browser console:

```
Framing 'https://www.google.com/' violates the following Content Security Policy directive: 
"frame-src 'self' https://js.paystack.co https://checkout.paystack.com https://*.paystack.com 
https://checkout.flutterwave.com https://widget.dojah.io https://identity.dojah.io https://*.dojah.io 
https://res.cloudinary.com https://*.cloudinary.com". The request has been blocked.

Unsafe attempt to load URL https://www.google.com/maps/embed/v1/place?key=AIzaSyBpNs3iZUa16V03YfhypvmXgkxbKXcmKkM&q=...
from frame with URL chrome-error://chromewebdata/. Domains, protocols and ports must match.
```

### Impact
- Google Maps embeds were blocked on all pages
- Location maps couldn't be displayed
- Poor user experience when viewing case/auction locations

## Root Cause

The Content Security Policy (CSP) `frame-src` directive in `next.config.ts` was missing Google Maps domains. The CSP was only allowing:
- Paystack domains
- Flutterwave domains
- Dojah domains
- Cloudinary domains

But NOT Google Maps domains, which are needed for embedded maps.

## Solution

Added Google Maps domains to the `frame-src` CSP directive in `next.config.ts`:

```typescript
"frame-src 'self' 
  https://js.paystack.co 
  https://checkout.paystack.com 
  https://*.paystack.com 
  https://checkout.flutterwave.com 
  https://widget.dojah.io 
  https://identity.dojah.io 
  https://*.dojah.io 
  https://res.cloudinary.com 
  https://*.cloudinary.com 
  https://www.google.com           // ✅ Added
  https://maps.google.com          // ✅ Added
  https://maps.googleapis.com      // ✅ Added
  https://*.google.com"            // ✅ Added (wildcard for all Google subdomains)
```

### Domains Added
1. `https://www.google.com` - Main Google domain
2. `https://maps.google.com` - Google Maps domain
3. `https://maps.googleapis.com` - Google Maps API domain
4. `https://*.google.com` - Wildcard for all Google subdomains

## Testing

After the fix, verify:

1. Open any auction detail page
2. Open any case detail page
3. Open case approvals page
4. Open bid history page
5. Check browser console - NO CSP errors
6. Verify Google Maps embeds load correctly

## Files Modified

- `next.config.ts` - Updated CSP `frame-src` directive

## Related Issues

This fix resolves CSP violations for:
- Google Maps embeds
- Location displays on auction/case pages
- Any other Google iframe content

## Security Note

Adding Google domains to `frame-src` is safe because:
- We're only allowing Google's official domains
- We're using the wildcard `*.google.com` which is standard practice
- Google Maps is a trusted service
- The CSP still blocks all other unauthorized domains

## Deployment

After deploying this fix:
1. Clear browser cache
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. Verify maps load without errors

## Prevention

When adding new iframe content in the future:
1. Check the domain of the content
2. Add the domain to `frame-src` in `next.config.ts`
3. Test in browser console for CSP errors
4. Document the change

## Related Documentation

- [Content Security Policy (CSP) - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Google Maps Embed API](https://developers.google.com/maps/documentation/embed/get-started)
