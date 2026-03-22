# Case UI and Pricing Fixes - Complete

## Issues Fixed

### 1. ✅ Salvage Discount Removed (CRITICAL FIX)
**Problem**: The system was applying a 60.5% salvage discount to "Foreign Used (Tokunbo)" items, but the internet search already returns prices for items in that condition. This was double-discounting.

**Example**:
- Market price found: ₦1,122,357
- After salvage discount: ₦679,026 (wrong!)
- Should be: ₦1,122,357 (correct - search already accounts for condition)

**Fix**: Removed the salvage discount logic entirely from `getUniversalMarketValue()` function in `src/features/cases/services/ai-assessment-enhanced.service.ts` (lines 1619-1627).

**Reasoning**: The internet search service already searches for prices based on the item's condition (e.g., "apple iphone 15 pro max 128gb tokunbo price Nigeria"). Applying an additional discount was incorrectly reducing the market value.

---

### 2. ✅ Number Formatting with Commas
**Problem**: Large numbers were displaying without comma separators (e.g., ₦31646835.00 instead of ₦31,646,835.00)

**Fixes Applied**:
1. **Manager Approvals Page** (`src/app/(dashboard)/manager/approvals/page.tsx`):
   - Added number formatting to Asset Details section
   - Numbers >= 1000 now display with commas and currency symbol

2. **Adjuster Case Detail Page** (`src/app/(dashboard)/adjuster/cases/[id]/page.tsx`):
   - Added number formatting to Asset Details section
   - Numbers >= 1000 now display with commas

**Note**: The AI assessment pricing fields (Estimated Salvage Value, Reserve Price, Market Value) were already using `.toLocaleString()` and displaying correctly.

---

### 3. ✅ Submit/Publish Button for Draft Cases
**Problem**: Draft cases had no way to be submitted for approval after being saved.

**Fix**: Added a "Draft Actions" section to the case detail page (`src/app/(dashboard)/adjuster/cases/[id]/page.tsx`) that shows:
- A blue banner indicating the case is a draft
- "Edit Draft" button to continue editing
- "Submit for Approval" button to change status from 'draft' to 'pending_approval'

**Implementation**:
- Button calls PATCH `/api/cases/${caseId}` with `{ status: 'pending_approval' }`
- Includes confirmation dialog before submission
- Redirects to cases list after successful submission

---

### 4. ✅ Photos in Case Tables
**Status**: Already implemented! 

The "My Cases" page (`src/app/(dashboard)/adjuster/cases/page.tsx`) already displays:
- First photo from each case as a preview (lines 226-234)
- Full-width image with rounded corners
- 128px height for consistent display

---

## Files Modified

1. `src/features/cases/services/ai-assessment-enhanced.service.ts`
   - Removed salvage discount logic (lines 1619-1627)

2. `src/app/(dashboard)/manager/approvals/page.tsx`
   - Added number formatting to Asset Details display

3. `src/app/(dashboard)/adjuster/cases/[id]/page.tsx`
   - Added number formatting to Asset Details display
   - Added Draft Actions section with Edit and Submit buttons

---

## Testing Recommendations

1. **Salvage Discount Fix**:
   - Create a new case with "Foreign Used (Tokunbo)" electronics
   - Verify market value matches the internet search result (no discount applied)
   - Check that salvage value is calculated correctly based on damage only

2. **Number Formatting**:
   - View cases with large numbers in Asset Details
   - Verify commas appear in all number displays
   - Check both manager approvals and adjuster case detail pages

3. **Draft Submission**:
   - Save a case as draft
   - Open the draft case detail page
   - Verify "Edit Draft" and "Submit for Approval" buttons appear
   - Click "Submit for Approval" and verify status changes to 'pending_approval'

4. **Photos in Tables**:
   - View "My Cases" page
   - Verify first photo displays for each case
   - Check that photos load correctly and are properly sized

---

## Impact

- **Pricing Accuracy**: Market values now correctly reflect actual market prices without incorrect discounting
- **User Experience**: Numbers are easier to read with proper formatting
- **Workflow**: Adjusters can now submit draft cases for approval
- **Visual Clarity**: Photos help identify cases at a glance

---

## Notes

- The salvage discount function `getSalvageDiscount()` still exists in the codebase but is no longer called for internet search results
- All pricing fields in the AI assessment section were already using proper formatting
- The case list already had photo previews implemented
