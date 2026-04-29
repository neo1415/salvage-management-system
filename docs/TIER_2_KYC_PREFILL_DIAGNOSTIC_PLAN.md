# Tier 2 KYC Pre-fill Diagnostic Plan

## Current Status

**Date of Birth**: ✅ Working (pre-filled correctly)
**Phone Number**: ❌ Not working (empty in widget)
**BVN**: ❌ Shows "undefined" (not working)

## What We Know

### 1. Database Data Verified
From previous diagnostic script (`scripts/diagnose-kyc-prefill-data.ts`):
- ✅ All vendors have phone numbers in `users.phone` (format: `+234...`)
- ✅ All vendors have encrypted BVN in `vendors.bvnEncrypted`
- ✅ All vendors have DOB in `users.dateOfBirth`

### 2. Official Dojah Documentation
According to [Dojah React SDK docs](https://docs.dojah.io/sdks/react-library):

```javascript
const govData = {
  nin: '',
  bvn: '',
  dl: '',
  mobile: '',  // <-- Phone goes HERE
};

const userData = {
  first_name: '',
  last_name: '',
  dob: '',     // <-- DOB goes HERE (YYYY-MM-DD format)
  email: ''
};
```

### 3. Current Implementation
**Frontend** (`src/app/(dashboard)/vendor/kyc/tier2/page.tsx`):
```typescript
// Build gov_data object
const govData: DojahWidgetOptions['gov_data'] = {};

if (widgetConfig.phone) {
  govData.mobile = widgetConfig.phone;  // ✅ Correct location
}

if (widgetConfig.bvn) {
  govData.bvn = widgetConfig.bvn;       // ✅ Correct location
}

// Build user_data object
const userData: DojahWidgetOptions['user_data'] = {
  first_name: firstName || undefined,
  last_name: lastName || undefined,
  email: user?.email ?? undefined,
};

if (widgetConfig.dob) {
  userData.dob = widgetConfig.dob;      // ✅ Correct location
}
```

**Backend API** (`src/app/api/kyc/widget-config/route.ts`):
```typescript
return NextResponse.json({ 
  appId, 
  publicKey, 
  widgetId: widgetId ?? null,
  phone: session.user.phone ?? undefined,  // From session
  bvn: bvn ?? undefined,                   // Decrypted from vendors.bvnEncrypted
  dob: dob ?? undefined,                   // Formatted from users.dateOfBirth
});
```

## Possible Root Causes

### For Phone Number Issue:
1. **Session.user.phone is undefined**
   - The session might not have the phone number populated
   - Need to verify: `console.log('session.user.phone:', session.user.phone)`

2. **Phone format issue**
   - Dojah might expect phone without `+` prefix
   - Dojah might expect specific format (e.g., `2348012345678` vs `+2348012345678`)

3. **API not returning phone**
   - The API response might not include phone
   - Need to verify actual API response

### For BVN Issue:
1. **Decryption failing silently**
   - `getEncryptionService().decrypt()` might be returning empty string or throwing error
   - Error is caught but not logged properly

2. **BVN not in database**
   - Despite diagnostic showing BVN exists, the specific user might not have it

3. **API not returning BVN**
   - The decrypted BVN might be undefined/null

## Diagnostic Steps

### Step 1: Test API Response
Run the diagnostic script to see what the API is actually returning:

```bash
npx tsx scripts/test-kyc-api-response.ts
```

This will show:
- Raw database data (phone, BVN encrypted, DOB)
- BVN decryption status
- DOB formatting
- Simulated API response
- What would be passed to Dojah widget

### Step 2: Add Frontend Logging
Add console.log to the frontend to see what data is being received:

In `src/app/(dashboard)/vendor/kyc/tier2/page.tsx`, add logging in the `initWidget` function:

```typescript
const initWidget = useCallback(() => {
  if (!widgetConfig || !window.Connect) return;

  // ADD THIS LOGGING
  console.log('=== Dojah Widget Config ===');
  console.log('widgetConfig:', widgetConfig);
  console.log('widgetConfig.phone:', widgetConfig.phone);
  console.log('widgetConfig.bvn:', widgetConfig.bvn);
  console.log('widgetConfig.dob:', widgetConfig.dob);
  console.log('session.user:', session?.user);
  console.log('session.user.phone:', session?.user?.phone);
  
  // ... rest of the code
  
  // ADD THIS LOGGING BEFORE PASSING TO DOJAH
  console.log('=== Passing to Dojah ===');
  console.log('userData:', userData);
  console.log('govData:', govData);
  console.log('options:', options);
}, [widgetConfig, session, pageState]);
```

### Step 3: Check Browser Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to `/vendor/kyc/tier2`
4. Look for the request to `/api/kyc/widget-config`
5. Check the response body - does it include phone, bvn, dob?

### Step 4: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Click "Start Verification"
4. Look for the console.log output from Step 2
5. Verify what values are being passed to Dojah

## Expected Findings

### If API returns phone/BVN but widget doesn't show them:
- **Issue**: Frontend is not passing them correctly to Dojah
- **Fix**: Check the `govData` object construction

### If API doesn't return phone/BVN:
- **Issue**: Backend is not fetching or decrypting correctly
- **Fix**: Check session.user.phone and BVN decryption

### If phone format is wrong:
- **Issue**: Dojah expects different format
- **Fix**: Transform phone format (remove `+`, add country code, etc.)

## Next Steps After Diagnosis

Once we identify the root cause from the diagnostic steps above, we can:

1. **Fix the API** if it's not returning the correct data
2. **Fix the frontend** if it's not passing data correctly to Dojah
3. **Transform the data format** if Dojah expects different format
4. **Add error handling** to show user-friendly messages when data is missing

## Files to Monitor

- `src/app/api/kyc/widget-config/route.ts` - Backend API
- `src/app/(dashboard)/vendor/kyc/tier2/page.tsx` - Frontend page
- `src/lib/db/schema/users.ts` - Users schema
- `src/lib/db/schema/vendors.ts` - Vendors schema
- `src/features/kyc/services/encryption.service.ts` - BVN decryption

## Test User Data

To test with a specific user, you can:

1. Login as a vendor user
2. Check their data in the database:
   ```sql
   SELECT u.phone, u.dateOfBirth, v.bvnEncrypted
   FROM users u
   JOIN vendors v ON v.userId = u.id
   WHERE u.email = 'vendor@example.com';
   ```

3. Verify the data exists before testing the widget

## Success Criteria

✅ Phone number appears in the Dojah widget phone field (immutable)
✅ BVN appears in the Dojah widget BVN field (immutable)
✅ DOB appears in the Dojah widget DOB field (pre-filled)
✅ All three fields are correctly formatted
✅ User cannot edit phone and BVN (immutable fields)
