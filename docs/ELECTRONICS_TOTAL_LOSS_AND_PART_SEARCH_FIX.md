# Electronics Total Loss and Part Search Fix

## Issues Fixed

### Issue 1: Generic Part Search Prefix
**Problem**: Electronics part searches were using "generic" as the brand prefix instead of the actual brand name.

**Example**:
- Before: `"generic front screen/LCD assembly body part price Nigeria"`
- After: `"Infinix front screen/LCD assembly body part price Nigeria"`

**Root Cause**: The `buildPartPriceQuery` function in `query-builder.service.ts` was setting `vehicleMake: 'generic'` for all non-vehicle items.

**Fix**: Modified the function to use the actual brand for electronics, appliances, and watches:
```typescript
vehicleMake: item.type === 'vehicle' ? item.make : 
  (item.type === 'electronics' || item.type === 'appliance' || item.type === 'watch' ? 
    (item as any).brand : 'generic')
```

### Issue 2: Overly Aggressive Total Loss Determination
**Problem**: Gemini was marking devices with repairable screen damage as "total loss".

**Example**:
- Device: Infinix Smart 7 Plus
- Market Value: ₦102,854
- Screen Replacement Cost: ₦30,533 (30% of market value)
- Result: Marked as total loss (incorrect)

**Root Cause**: The Gemini prompt had unclear criteria for total loss determination, leading to overly conservative assessments.

**Fix**: Updated the electronics prompt with clearer, more conservative criteria:

**Total Loss TRUE only if**:
- Device is bent or structurally compromised (frame damage affecting functionality)
- Water damage with visible corrosion on internal components
- Multiple critical components damaged (screen + motherboard + housing)
- Repair cost would exceed 70% of device replacement cost
- Device is completely non-functional with no possibility of repair

**Total Loss FALSE if**:
- Only screen damage (even if severe) - screens are replaceable
- Only cosmetic damage (scratches, dents, housing cracks)
- Single component damage (only screen OR only housing OR only camera)
- Device is still functional or can be made functional with part replacement
- Repair cost is less than 70% of device replacement cost

**Key Principle**: A cracked or shattered screen alone does NOT constitute a total loss. Screens are standard replaceable parts.

## Impact

### Before Fix
```
🔍 Searching for electronics part price: front screen/LCD assembly for Infinix Smart 7 plus
Query: "generic front screen/LCD assembly body part price Nigeria"
Result: ₦30,533 (from generic phone parts)
Total Loss: true (incorrect - screen is repairable)
Salvage Value: ₦30,856 (capped at 30% due to total loss flag)
```

### After Fix
```
🔍 Searching for electronics part price: front screen/LCD assembly for Infinix Smart 7 plus
Query: "Infinix front screen/LCD assembly body part price Nigeria"
Result: ₦30,533 (from Infinix-specific parts)
Total Loss: false (correct - screen is repairable)
Salvage Value: ₦72,321 (market value - repair cost)
```

## Testing

To test the fix:
1. Create a case for an electronic device with screen damage
2. Verify the part search query includes the brand name (not "generic")
3. Verify total loss is only set for truly unrepairable devices
4. Verify salvage value is calculated correctly based on repair costs

## Files Modified

1. `src/features/internet-search/services/query-builder.service.ts`
   - Fixed `buildPartPriceQuery` to use brand for electronics/appliances/watches

2. `src/lib/integrations/gemini-damage-detection.ts`
   - Updated electronics prompt with clearer total loss criteria
   - Added explicit guidance that screen damage alone is not total loss

## Related Issues

- Electronics damage assessment was using generic damage categories instead of specific parts (fixed in previous commit)
- Part price searches were not finding brand-specific prices
- Total loss determination was too aggressive for repairable damage
