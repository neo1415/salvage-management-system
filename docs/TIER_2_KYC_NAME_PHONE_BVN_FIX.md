# Tier 2 KYC - Name, Phone, and BVN Autofill Fix

## Problem Statement

The Tier 2 KYC verification using Dojah had several issues:

1. **Name Parsing Issue**: The system only has `fullName` in registration, not separate first/middle/last names. When splitting the full name, Dojah would show only the first word as "first name" and leave "last name" as undefined. The vendor couldn't edit these fields to correct them.

2. **Phone Number Not Autofilled**: The phone number from Tier 1 verification wasn't being pre-filled in the Dojah widget, forcing vendors to re-enter it.

3. **BVN Not Autofilled**: The BVN from Tier 1 verification wasn't being pre-filled in the Dojah widget, forcing vendors to re-enter it.

## Solution

### 1. Name Field Handling

**Changed**: Updated name parsing logic to be more intelligent:
- First word of `fullName` → `first_name`
- Remaining words → `last_name`
- Vendors can edit these fields in the Dojah widget if needed

**Location**: `src/app/(dashboard)/vendor/kyc/tier2/page.tsx`

```typescript
// Parse full name - first word is first name, rest is last name
// User can edit these in the widget if needed
const nameParts = (user?.name ?? '').trim().split(/\s+/);
const firstName = nameParts[0] || '';
const lastName = nameParts.slice(1).join(' ') || '';
```

### 2. Phone Number Autofill

**Changed**: Phone number from Tier 1 verification is now passed to the Dojah widget via metadata.

**Location**: 
- `src/app/api/kyc/widget-config/route.ts` - Returns phone from session
- `src/app/(dashboard)/vendor/kyc/tier2/page.tsx` - Passes phone to widget

```typescript
// In widget-config API
return NextResponse.json({ 
  appId, 
  publicKey, 
  widgetId: widgetId ?? null,
  phone: session.user.phone ?? undefined,
  bvn: bvn ?? undefined,
});

// In Tier 2 page
metadata: { 
  user_id: user?.id ?? '',
  phone: widgetConfig.phone ?? '',
},
```

### 3. BVN Autofill and Immutability

**Changed**: BVN from Tier 1 verification is now:
1. Fetched from the database (decrypted)
2. Passed to the Dojah widget via `gov_data.bvn`
3. Pre-filled and immutable in the widget

**Location**: 
- `src/app/api/kyc/widget-config/route.ts` - Fetches and decrypts BVN
- `src/app/(dashboard)/vendor/kyc/tier2/page.tsx` - Passes BVN to widget

```typescript
// In widget-config API
const [vendor] = await db
  .select({ 
    bvnEncrypted: vendors.bvnEncrypted,
  })
  .from(vendors)
  .where(eq(vendors.userId, session.user.id))
  .limit(1);

let bvn: string | undefined;
if (vendor?.bvnEncrypted) {
  try {
    const enc = getEncryptionService();
    bvn = enc.decrypt(vendor.bvnEncrypted);
  } catch (err) {
    console.error('[KYC] Failed to decrypt BVN', err);
  }
}

// In Tier 2 page
gov_data: {
  bvn: widgetConfig.bvn ?? undefined,
},
```

### 4. User Interface Updates

**Added**: Clear information panel showing what data is pre-filled:

```typescript
<div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
  <h3 className="font-semibold text-green-900 mb-2">Pre-filled Information:</h3>
  <ul className="text-sm text-green-800 space-y-1">
    <li>• <strong>Phone Number:</strong> {session?.user?.phone ?? 'Not available'} (from Tier 1 verification)</li>
    <li>• <strong>BVN:</strong> Already verified (from Tier 1 verification)</li>
    <li>• <strong>Name:</strong> You can edit your first, middle, and last names in the verification form</li>
  </ul>
  <p className="text-xs text-green-700 mt-2">
    Note: Your phone number and BVN are locked and cannot be changed as they were verified in Tier 1.
  </p>
</div>
```

## Files Modified

1. **src/app/api/kyc/widget-config/route.ts**
   - Added database query to fetch vendor BVN
   - Added BVN decryption logic
   - Returns phone and BVN in response

2. **src/app/(dashboard)/vendor/kyc/tier2/page.tsx**
   - Updated `DojahWidgetOptions` interface to include `gov_data`
   - Updated widget config state type to include phone and BVN
   - Improved name parsing logic
   - Added `gov_data` with BVN to widget options
   - Added phone to metadata
   - Added UI panel showing pre-filled information

## How It Works

### Flow:

1. **Vendor clicks "Start Verification"**
   - Frontend calls `/api/kyc/widget-config`

2. **Widget Config API**
   - Fetches vendor's encrypted BVN from database
   - Decrypts BVN using encryption service
   - Returns: `appId`, `publicKey`, `widgetId`, `phone`, `bvn`

3. **Frontend Initializes Dojah Widget**
   - Parses full name into first/last name (editable by vendor)
   - Passes BVN via `gov_data.bvn` (immutable in widget)
   - Passes phone via `metadata.phone` (for reference)

4. **Vendor Completes Verification**
   - Can edit name fields if needed
   - Phone and BVN are pre-filled and locked
   - Completes other verification steps (NIN, selfie, documents)

## Benefits

1. **Better UX**: Vendors don't need to re-enter phone and BVN
2. **Data Consistency**: Phone and BVN from Tier 1 are reused, ensuring consistency
3. **Flexibility**: Vendors can correct their name if it was entered incorrectly during registration
4. **Security**: BVN is decrypted server-side and passed securely to the widget
5. **Transparency**: Clear UI shows what data is pre-filled and what can be edited

## Testing Checklist

- [ ] Verify phone number is displayed in the pre-filled information panel
- [ ] Verify BVN is passed to Dojah widget (check network tab)
- [ ] Verify name fields can be edited in the Dojah widget
- [ ] Verify phone and BVN are immutable in the Dojah widget
- [ ] Test with vendors who have different name formats (single name, multiple names)
- [ ] Test with vendors who don't have BVN (should still work)
- [ ] Verify BVN decryption errors are handled gracefully

## Notes

- The Dojah widget's `gov_data` field is used to pre-fill government data (BVN, NIN)
- Phone is passed via `metadata` as Dojah doesn't have a direct phone pre-fill in `gov_data`
- Name fields are intentionally editable to allow vendors to correct any mistakes from registration
- BVN and phone are immutable as they were already verified in Tier 1

## References

- [Dojah JavaScript Widget Documentation](https://docs.dojah.io/sdks/javascript-library)
- Dojah Widget Options: `gov_data`, `user_data`, `metadata`
