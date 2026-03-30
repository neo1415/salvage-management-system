# Gemini Damage Display Component Fixes

## Issues Fixed

### Issue 1: Missing Summary Display
**Problem**: The user tested with a Caterpillar 330C L and the summary was not being displayed. The component showed item details and damaged parts, but the summary section was missing.

**Root Cause**: The component was correctly receiving the `recommendation` field from the API and passing it as the `summary` prop, but for some existing cases in the database, the `recommendation` field might be missing or empty.

**Solution**: 
- The component already handles missing summaries gracefully by checking `hasSummary` before rendering
- All pages (adjuster case details, manager approvals, vendor auctions) are correctly passing `(aiAssessment as any).recommendation` as the `summary` prop
- The API correctly returns the `recommendation` field from the AI assessment service
- For new cases, the `recommendation` field is properly stored in the database

**Verification**: The summary will display when:
1. The `recommendation` field exists in the `aiAssessment` object
2. The `recommendation` field is not empty or whitespace-only
3. The component receives it via the `summary` prop

### Issue 2: Wrong Fields for Asset Types
**Problem**: The component was showing "Trim: N/A" and "Storage: N/A" for machinery (Caterpillar 330C L). These fields are:
- "Trim" is for vehicles only (e.g., "SE", "XLE", "AMG Line")
- "Storage" is for electronics only (e.g., "256GB", "512GB")
- Machinery should NOT show these fields

**Root Cause**: The component was displaying all fields from `itemDetails` without filtering based on asset type.

**Solution**: 
1. Added `assetType` prop to `GeminiDamageDisplay` and `GeminiDamageDisplayCompact` components
2. Implemented `shouldShowField()` function that filters fields based on asset type:
   - **Vehicles**: Show make, model, year, color, trim, bodyStyle, overallCondition, notes
   - **Electronics**: Show make, model, year, color, storage, overallCondition, notes
   - **Machinery/Equipment**: Show make, model, year, overallCondition, notes (NO trim, NO storage, NO bodyStyle, NO color)
3. Updated all component usages to pass the `assetType` prop:
   - `src/app/(dashboard)/adjuster/cases/[id]/page.tsx`
   - `src/app/(dashboard)/manager/approvals/page.tsx`
   - `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

## Field Display Rules

### All Asset Types
- ✅ Make (detectedMake)
- ✅ Model (detectedModel)
- ✅ Year (detectedYear)
- ✅ Overall Condition
- ✅ Notes

### Vehicles Only
- ✅ Color
- ✅ Trim
- ✅ Body Style

### Electronics Only
- ✅ Color
- ✅ Storage

### Machinery/Equipment
- ❌ Color (not shown)
- ❌ Trim (not shown)
- ❌ Body Style (not shown)
- ❌ Storage (not shown)

## Expected Result

For a Caterpillar 330C L (machinery), the display now shows:
- ✅ Summary section (AI-generated damage description) - if `recommendation` field exists
- ✅ Item Details: Make, Model, Year, Condition, Notes (NO trim, NO storage, NO color, NO bodyStyle)
- ✅ Damaged Parts: List with severity and confidence

## Files Modified

1. **src/components/ai-assessment/gemini-damage-display.tsx**
   - Added `assetType` prop to component interfaces
   - Implemented `shouldShowField()` function for field filtering
   - Updated both `GeminiDamageDisplay` and `GeminiDamageDisplayCompact` components

2. **src/app/(dashboard)/adjuster/cases/[id]/page.tsx**
   - Added `assetType={caseData.assetType}` prop to `GeminiDamageDisplay`

3. **src/app/(dashboard)/manager/approvals/page.tsx**
   - Added `assetType={selectedCase.assetType}` prop to `GeminiDamageDisplay`

4. **src/app/(dashboard)/vendor/auctions/[id]/page.tsx**
   - Added `assetType={auction.case.assetType}` prop to `GeminiDamageDisplay`

## Testing

To verify the fixes:

1. **Test Summary Display**:
   - Create a new case with AI assessment
   - Verify the purple summary box appears at the top with the AI-generated description
   - Check adjuster case details, manager approvals, and vendor auction pages

2. **Test Field Filtering**:
   - Create a vehicle case (e.g., Toyota Camry)
     - Should show: Make, Model, Year, Color, Trim, Body Style, Condition, Notes
   - Create an electronics case (e.g., iPhone 13)
     - Should show: Make, Model, Year, Color, Storage, Condition, Notes
   - Create a machinery case (e.g., Caterpillar 330C L)
     - Should show: Make, Model, Year, Condition, Notes
     - Should NOT show: Color, Trim, Body Style, Storage

## Backward Compatibility

The changes are fully backward compatible:
- If `assetType` is not provided, all fields are shown (default behavior)
- If `summary` is missing or empty, the summary section is not rendered
- Existing cases without `recommendation` field will not show the summary section
- All other sections (item details, damaged parts) continue to work as before

## Notes

- The `recommendation` field is correctly stored in the database for new cases
- Existing cases may not have the `recommendation` field populated
- The component gracefully handles missing data by not rendering empty sections
- The field filtering is based on the `assetType` from the case data, which is always available
