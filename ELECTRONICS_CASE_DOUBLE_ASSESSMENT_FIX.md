# Electronics Case Double Assessment Fix

## Problem

When creating an electronics case (iPhone 12 Pro Max), the system was running AI assessment **twice**:

1. **First assessment** (correct): During photo upload in the UI
   - Received proper item info: `{type: 'electronics', brand: 'apple', model: 'iphone 12 pro max', storageCapacity: '128gb', condition: 'Foreign Used (Tokunbo)'}`
   - Result: ₦554,178 market value, ₦166,253 salvage value ✅

2. **Second assessment** (wrong): During case submission in `createCase()`
   - Received NO item info: `{type: 'unknown', details: undefined}`
   - Result: ₦3,000,000 generic fallback pricing ❌

The second assessment "hijacked" the first one, replacing the correct values with garbage.

## Root Cause

In `src/features/cases/services/case.service.ts`, the `createCase()` function was only building `vehicleInfo` for vehicles:

```typescript
// OLD CODE - Only handled vehicles
if (input.assetType === 'vehicle' && input.assetDetails) {
  const details = input.assetDetails as VehicleDetails;
  vehicleInfo = { make: details.make, model: details.model, ... };
}

aiAssessment = await assessDamageEnhanced({
  photos: photoUrls,
  vehicleInfo  // ← undefined for electronics!
});
```

For electronics, appliances, and other asset types, `vehicleInfo` was undefined, causing the AI service to fall back to generic pricing.

## Solution

Updated `createCase()` to build `universalItemInfo` for ALL asset types:

```typescript
// NEW CODE - Handles all asset types
let universalItemInfo: UniversalItemInfo | undefined;

if (input.assetType === 'vehicle' && input.assetDetails) {
  const details = input.assetDetails as VehicleDetails;
  universalItemInfo = {
    type: 'vehicle',
    make: details.make,
    model: details.model,
    year: details.year,
    mileage: details.mileage,
    condition: mapQualityToUniversalCondition(details.condition),
    age: details.year ? new Date().getFullYear() - details.year : undefined,
  };
} else if (input.assetType === 'electronics' && input.assetDetails) {
  const details = input.assetDetails as ElectronicsDetails;
  universalItemInfo = {
    type: 'electronics',
    brand: details.brand,
    model: details.model,
    storageCapacity: details.storage,
    condition: details.condition || 'Nigerian Used',
  };
} else if (input.assetType === 'appliance' && input.assetDetails) {
  // ... similar for appliances
}

aiAssessment = await assessDamageEnhanced({
  photos: photoUrls,
  vehicleInfo,
  universalItemInfo,  // ← Now includes electronics!
});
```

## Changes Made

1. **Updated `ElectronicsDetails` interface** to include missing fields:
   - Added `model`, `storage`, `color`, `condition`

2. **Added `ApplianceDetails` interface** for appliance support

3. **Updated `AssetDetails` union type** to include `ApplianceDetails`

4. **Added condition mapping** using `mapQualityToUniversalCondition()`:
   - Converts quality tiers ('excellent', 'good', 'fair', 'poor') to universal conditions ('Brand New', 'Foreign Used (Tokunbo)', etc.)

5. **Exported `UniversalItemInfo` and `VehicleInfo`** from ai-assessment-enhanced.service.ts

6. **Added `mapQualityToUniversalCondition()` function** in condition-mapping.service.ts

## Testing

Run the test script to verify the fix:

```bash
npx tsx scripts/test-electronics-case-fix.ts
```

Expected result: AI assessment should receive proper item info and NOT use the ₦3,000,000 fallback.

## Impact

- Electronics cases will now get accurate market pricing
- Appliance cases will also benefit from this fix
- No more "hijacked" assessments with generic fallback pricing
- The second AI assessment during case creation will now have proper context
