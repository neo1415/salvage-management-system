# Object.entries() Null/Undefined Fix - Manual Test Plan

## Bug Description
**Error:** `TypeError: Cannot convert undefined or null to object at Object.entries (<anonymous>)`

**Root Cause:** Multiple pages were calling `Object.entries()` on `assetDetails` without checking if it was null or undefined first. When cases don't have asset details or the data is missing, this causes a runtime error.

## Files Fixed
1. `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - Line 938
2. `src/app/(dashboard)/manager/approvals/page.tsx` - Line 987
3. `src/app/(dashboard)/adjuster/cases/[id]/page.tsx` - Line 436

## Fix Applied
Added null/undefined checks before calling `Object.entries()`:

```typescript
// Before (BROKEN):
{Object.entries(auction.case.assetDetails).map(([key, value]) => (
  // ...
))}

// After (FIXED):
{auction.case.assetDetails && typeof auction.case.assetDetails === 'object' && Object.entries(auction.case.assetDetails).map(([key, value]) => (
  // ...
))}
```

## Test Cases

### Test 1: Vendor Auctions Page with Null Asset Details
**Endpoint:** `/vendor/auctions/[id]`

**Steps:**
1. Log in as a vendor
2. Navigate to an auction detail page where the case has null or missing `assetDetails`
3. Verify the page loads without errors
4. Verify the "Specifications" section is hidden when `assetDetails` is null
5. Verify the page displays correctly when `assetDetails` exists

**Expected Result:**
- No `TypeError: Cannot convert undefined or null to object` error
- Page loads successfully
- Specifications section only shows when data exists

### Test 2: Manager Approvals Page with Null Asset Details
**Endpoint:** `/manager/approvals`

**Steps:**
1. Log in as a manager
2. Click on a case to view details in the modal
3. Select a case that has null or missing `assetDetails`
4. Verify the modal opens without errors
5. Verify the "Asset Details" section handles null data gracefully

**Expected Result:**
- No `TypeError` in console
- Modal opens successfully
- Asset details section only shows when data exists

### Test 3: Adjuster Cases Page with Null Asset Details
**Endpoint:** `/adjuster/cases/[id]`

**Steps:**
1. Log in as an adjuster
2. Navigate to a case detail page
3. View a case that has null or missing `assetDetails`
4. Verify the page loads without errors
5. Verify the asset details section handles null data gracefully

**Expected Result:**
- No `TypeError` in console
- Page loads successfully
- Asset details only display when data exists

### Test 4: Vendor Settings Transactions - Bid History
**Endpoint:** `/vendor/settings/transactions?type=bids`

**Steps:**
1. Log in as a vendor
2. Navigate to Settings > Transactions
3. Click on "Bid History" tab
4. Verify the transaction list loads without errors
5. Check browser console for any errors

**Expected Result:**
- No `TypeError: Cannot convert undefined or null to object` error
- Bid history displays correctly
- All bid transactions show proper descriptions

## Edge Cases to Test

### Edge Case 1: Empty Asset Details Object
- Case with `assetDetails: {}`
- Should display specifications section but with no items

### Edge Case 2: Null Asset Details
- Case with `assetDetails: null`
- Should hide specifications section completely

### Edge Case 3: Undefined Asset Details
- Case where `assetDetails` field is missing
- Should hide specifications section completely

### Edge Case 4: Asset Details with Some Null Values
- Case with `assetDetails: { make: "Toyota", model: null, year: 2020 }`
- Should display only non-null values

## Verification Checklist
- [ ] No console errors when viewing auctions with null assetDetails
- [ ] No console errors when viewing manager approvals with null assetDetails
- [ ] No console errors when viewing adjuster cases with null assetDetails
- [ ] Specifications/Asset Details sections are hidden when data is null
- [ ] Specifications/Asset Details sections display correctly when data exists
- [ ] Bid history page loads without errors
- [ ] All pages pass TypeScript compilation
- [ ] All pages pass linting

## Related Issues
- Bid History API Error: `/api/vendor/settings/transactions?type=bids`
- Frontend pages calling `Object.entries()` on potentially null data

## Status
✅ **FIXED** - All Object.entries() calls now have proper null/undefined checks
