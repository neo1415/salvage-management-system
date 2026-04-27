# Vendor Registration Fee Dynamic Display Fix

## Issue
The vendor dashboard was displaying a hardcoded registration fee of ₦12,500 instead of fetching the dynamic value from the admin configuration system.

**Location**: Vendor Dashboard → "Complete Your Registration" banner

**User Report**: "in the vendor dashbard ..the registration fee number there is still sing hardcoded values instead of the actual configuration values"

## Root Cause
The `KYCStatusCard` component (`src/components/vendor/kyc-status-card.tsx`) had a hardcoded value in the JSX:
```tsx
Pay the one-time registration fee (₦12,500) to unlock Tier 2 KYC and unlimited bidding.
```

## Solution

### Changes Made

**File**: `src/components/vendor/kyc-status-card.tsx`

1. **Added state for registration fee amount**:
```tsx
const [registrationFeeAmount, setRegistrationFeeAmount] = useState<number>(12500); // Default fallback
```

2. **Updated useEffect to fetch dynamic fee amount**:
```tsx
useEffect(() => {
  Promise.all([
    fetch('/api/kyc/status').then((r) => r.ok ? r.json() : null),
    fetch('/api/vendors/registration-fee/status').then((r) => r.ok ? r.json() : null),
  ])
    .then(([kycData, feeData]) => {
      setKycStatus(kycData);
      setRegistrationFeePaid(feeData?.data?.paid ?? false);
      setRegistrationFeeAmount(feeData?.data?.feeAmount ?? 12500); // Fetch dynamic amount
      setLoading(false);
    })
    .catch(() => setLoading(false));
}, []);
```

3. **Updated JSX to use dynamic value**:
```tsx
Pay the one-time registration fee (₦{registrationFeeAmount.toLocaleString()}) to unlock Tier 2 KYC and unlimited bidding.
```

## How It Works

### Data Flow
1. Component mounts and fetches `/api/vendors/registration-fee/status`
2. API endpoint calls `configService.getConfig()` to get current registration fee from admin configuration
3. API returns `feeAmount` in the response
4. Component stores the amount in state and displays it with proper formatting

### API Endpoint
**Endpoint**: `GET /api/vendors/registration-fee/status`

**Response**:
```json
{
  "success": true,
  "data": {
    "paid": false,
    "amount": null,
    "paidAt": null,
    "reference": null,
    "feeAmount": 12500  // ← Dynamic value from config
  }
}
```

### Configuration Source
The registration fee is fetched from:
- **Primary**: Admin configuration system (`configService.getConfig().registrationFee`)
- **Fallback**: Environment variable `REGISTRATION_FEE_AMOUNT` or default 12500

### Admin Configuration
Admins can update the registration fee via:
- **UI**: Admin Dashboard → Configuration → Vendor Registration Fee
- **API**: `PUT /api/admin/config` with `registrationFee` field

## Testing

### Manual Testing Steps
1. **Verify dynamic display**:
   - Login as a Tier 1 vendor who hasn't paid registration fee
   - Navigate to vendor dashboard
   - Verify the banner shows the correct fee amount from configuration

2. **Test configuration changes**:
   - Login as admin
   - Navigate to Admin → Configuration
   - Change the "Vendor Registration Fee" value (e.g., to ₦15,000)
   - Save configuration
   - Login as Tier 1 vendor
   - Verify dashboard shows updated amount (₦15,000)

3. **Test fallback behavior**:
   - If config service fails, component should display default ₦12,500
   - No errors should be thrown

### Expected Behavior
- ✅ Registration fee displays current configured amount
- ✅ Amount updates when admin changes configuration
- ✅ Proper number formatting with thousands separator (e.g., ₦12,500)
- ✅ Fallback to default if API fails
- ✅ No TypeScript errors
- ✅ No console errors

## Related Files
- `src/components/vendor/kyc-status-card.tsx` - Component displaying the fee
- `src/app/api/vendors/registration-fee/status/route.ts` - API endpoint
- `src/features/vendors/services/registration-fee.service.ts` - Service layer
- `src/features/auction-deposit/services/config.service.ts` - Configuration service
- `src/components/admin/config-form.tsx` - Admin configuration UI

## Impact
- **User-facing**: Vendors now see the correct, up-to-date registration fee amount
- **Admin**: Can change registration fee without code changes
- **System**: Consistent fee display across all vendor touchpoints

## Status
✅ **COMPLETE** - Registration fee now displays dynamic value from configuration

## Next Steps
None required. The fix is complete and ready for testing.
