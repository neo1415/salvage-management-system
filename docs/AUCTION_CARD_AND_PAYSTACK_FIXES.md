# Auction Card and Paystack Integration Fixes

## Summary

Fixed two critical issues affecting the auction system:

1. **Auction Card Machinery Display**: Machinery assets were showing "Salvage Item" instead of actual machinery details
2. **Paystack Integrity Check Errors**: CSP (Content Security Policy) was blocking Paystack checkout scripts

---

## Issue 1: Auction Card Shows "Salvage Item" for Machinery

### Problem
Auction cards were displaying "Salvage Item" for machinery assets instead of showing meaningful names like "Caterpillar CAT 320 Excavator".

### Root Cause
The `getAssetName()` function in multiple files was missing the `case 'machinery':` handler, causing it to fall through to the default case.

### Files Fixed

#### 1. `src/app/(dashboard)/vendor/auctions/page.tsx`
Added machinery case to the auction card component:
```typescript
case 'machinery':
  // Format: "Caterpillar CAT 320 Excavator" or "Caterpillar Excavator"
  name = `${details.brand || ''} ${details.model || ''} ${details.machineryType || ''}`.trim();
  if (!name) {
    name = details.machineryType ? String(details.machineryType) : 'Machinery';
  }
  break;
```

#### 2. `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`
Added machinery case to the auction detail page:
```typescript
case 'machinery':
  const machineryName = `${details.brand || ''} ${details.model || ''} ${details.machineryType || ''}`.trim();
  return machineryName || (details.machineryType ? String(details.machineryType) : 'Machinery');
```

#### 3. `src/app/api/vendor/won-auctions/route.ts`
Added machinery case to the won auctions API:
```typescript
case 'machinery':
  assetName = `${details.brand || ''} ${details.model || ''} ${details.machineryType || ''}`.trim();
  if (!assetName) {
    assetName = details.machineryType ? String(details.machineryType) : 'Machinery';
  }
  break;
```

#### 4. `src/features/auctions/services/auction.service.ts`
Added machinery case to the auction service:
```typescript
case 'machinery':
  const machineryName = `${details.brand || ''} ${details.model || ''} ${details.machineryType || ''}`.trim();
  return machineryName || (details.machineryType ? String(details.machineryType) : 'Machinery');
```

#### 5. `src/features/auctions/services/closure.service.ts`
Added machinery case to the auction closure service:
```typescript
case 'machinery':
  const machineryName = `${details.brand || ''} ${details.model || ''} ${details.machineryType || ''}`.trim();
  return machineryName || (details.machineryType ? String(details.machineryType) : 'Machinery');
```

#### 6. `src/app/api/admin/auctions/[id]/send-notification/route.ts`
Added machinery case to the notification API:
```typescript
case 'machinery':
  assetName = `${assetDetails.brand || ''} ${assetDetails.model || ''} ${assetDetails.machineryType || ''}`.trim();
  if (!assetName) {
    assetName = assetDetails.machineryType || 'Machinery';
  }
  break;
```

### Expected Output
Machinery assets will now display:
- **Full details**: "Caterpillar CAT 320 Excavator"
- **Partial details**: "Caterpillar Excavator" (if model is missing)
- **Type only**: "Excavator" (if brand and model are missing)
- **Fallback**: "Machinery" (if no details available)

---

## Issue 2: Paystack Integrity Check Errors

### Problem
When trying to pay via Paystack, the browser console showed:
```
Failed to find a valid digest in the 'integrity' attribute for resource 
'https://checkout.paystack.com/assets/vendor-CjCsaaRx.js' with computed 
SHA-384 integrity '2opWPbq4LG6GPFTelWx570xOQDtP9SAYbE6yR9n9BcfNhN5jMylV6ZnxrxY+JLnA'. 
The resource has been blocked.
```

### Root Cause
The Content Security Policy (CSP) was not allowing scripts, styles, and connections from `https://checkout.paystack.com`. Paystack's hosted checkout page loads its own scripts with integrity checks, but our CSP was blocking them.

### Files Fixed

#### 1. `src/middleware.ts`
Updated CSP to allow Paystack checkout domain:
```typescript
response.headers.set(
  'Content-Security-Policy',
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.paystack.co https://checkout.paystack.com",
    "style-src 'self' 'unsafe-inline' https://checkout.paystack.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://www.googleapis.com https://nominatim.openstreetmap.org https://api.paystack.co https://api.flutterwave.com https://api.cloudinary.com https://res.cloudinary.com https://checkout.paystack.com",
    "frame-src 'self' https://js.paystack.co https://checkout.flutterwave.com https://www.google.com https://maps.google.com https://www.google.com/maps/embed/ https://checkout.paystack.com",
    "worker-src 'self' blob:",
  ].join('; ')
);
```

#### 2. `next.config.ts`
Updated CSP headers in Next.js config:
```typescript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.paystack.co https://checkout.paystack.com https://checkout.flutterwave.com https://storage.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://checkout.paystack.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.paystack.co https://checkout.paystack.com https://api.flutterwave.com https://api.cloudinary.com https://res.cloudinary.com https://nominatim.openstreetmap.org",
    "frame-src 'self' https://js.paystack.co https://checkout.paystack.com https://checkout.flutterwave.com",
    "media-src 'self' https://res.cloudinary.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://api.paystack.co https://api.flutterwave.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; '),
},
```

### Changes Made
Added `https://checkout.paystack.com` to:
- **script-src**: Allow Paystack checkout scripts to load
- **style-src**: Allow Paystack checkout styles to load
- **connect-src**: Allow API calls to Paystack checkout
- **frame-src**: Allow Paystack checkout to be embedded in iframes

### Expected Result
Paystack payment flow will now work without integrity check errors. The checkout page will load all required scripts and styles successfully.

---

## Testing Instructions

### Test Issue 1: Machinery Asset Names
1. Create a machinery auction with details:
   - Brand: "Caterpillar"
   - Model: "CAT 320"
   - Machinery Type: "Excavator"
2. Navigate to `/vendor/auctions`
3. **Expected**: Card shows "Caterpillar CAT 320 Excavator"
4. **Not**: "Salvage Item" or "MACHINERY"

### Test Issue 2: Paystack Payment
1. Win an auction
2. Navigate to the payment page
3. Click "Pay Now with Paystack"
4. **Expected**: Paystack checkout page loads without errors
5. **Check**: Browser console has no CSP violation errors
6. **Check**: No "integrity" attribute errors

---

## Verification

All files passed TypeScript diagnostics with no errors:
- ✅ `src/app/(dashboard)/vendor/auctions/page.tsx`
- ✅ `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`
- ✅ `src/app/api/vendor/won-auctions/route.ts`
- ✅ `src/features/auctions/services/auction.service.ts`
- ✅ `src/features/auctions/services/closure.service.ts`
- ✅ `src/app/api/admin/auctions/[id]/send-notification/route.ts`
- ✅ `src/middleware.ts`
- ✅ `next.config.ts`

---

## Impact

### Issue 1 Impact
- **Affected**: All machinery auctions across the platform
- **User Experience**: Vendors can now see meaningful machinery names instead of generic "Salvage Item"
- **Locations**: Auction cards, auction details, won auctions, notifications, emails

### Issue 2 Impact
- **Affected**: All Paystack payment flows
- **User Experience**: Payment process now works smoothly without browser blocking scripts
- **Security**: Maintained secure CSP while allowing necessary Paystack resources

---

## Notes

1. **Machinery Asset Structure**: The fix assumes machinery assets have these fields in `assetDetails`:
   - `brand` (string): e.g., "Caterpillar"
   - `model` (string): e.g., "CAT 320"
   - `machineryType` (string): e.g., "Excavator"

2. **Paystack Integration**: The CSP changes only affect the hosted Paystack checkout page. Our server-side integration remains unchanged.

3. **Fallback Behavior**: If machinery details are incomplete, the system gracefully falls back to showing available information or "Machinery" as a last resort.

4. **No Breaking Changes**: These fixes are backward compatible and don't affect existing vehicle, property, or electronics assets.
