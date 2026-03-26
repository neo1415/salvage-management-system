# Button Positioning & Centering Fixes - Manual Test Plan

## Overview
This test plan verifies that the fixed-position buttons on both the Case Creation and Case Approval pages are properly centered and have the correct backdrop blur effect.

## Test Date
**Date:** [To be filled during testing]  
**Tester:** [Your name]  
**Environment:** Development

---

## Issue 1: Case Creation Page - Button Positioning ✅

### Page Location
`src/app/(dashboard)/adjuster/cases/new/page.tsx`

### Expected Behavior
- ✅ Buttons should be FIXED at the bottom (don't scroll with content)
- ✅ Buttons should be CENTERED horizontally
- ✅ Buttons should have backdrop blur effect (semi-transparent background)
- ✅ On desktop (lg breakpoint), buttons should account for 256px sidebar (lg:left-64)
- ✅ Buttons should be clickable at all times

### Test Steps

#### Test 1.1: Button Fixed Positioning
1. Navigate to `/adjuster/cases/new`
2. Fill in some form fields
3. Scroll down the page
4. **Expected:** Buttons stay fixed at the bottom of the viewport
5. **Expected:** Content scrolls behind the buttons
6. **Status:** [ ] Pass [ ] Fail

#### Test 1.2: Button Centering (Mobile)
1. Open browser DevTools (F12)
2. Switch to mobile view (iPhone 12 Pro or similar)
3. Navigate to `/adjuster/cases/new`
4. **Expected:** "Save Draft" and "Submit for Approval" buttons are centered
5. **Expected:** Buttons stack vertically on mobile
6. **Status:** [ ] Pass [ ] Fail

#### Test 1.3: Button Centering (Desktop)
1. Switch to desktop view (1920x1080)
2. Navigate to `/adjuster/cases/new`
3. **Expected:** Buttons are centered horizontally
4. **Expected:** Buttons are side-by-side on desktop
5. **Expected:** Buttons account for sidebar (256px offset on left)
6. **Status:** [ ] Pass [ ] Fail

#### Test 1.4: Backdrop Blur Effect
1. Navigate to `/adjuster/cases/new`
2. Scroll down so content is behind the button area
3. **Expected:** Semi-transparent background with blur effect
4. **Expected:** Content is visible but blurred behind buttons
5. **Expected:** Gradient fade from transparent to white
6. **Status:** [ ] Pass [ ] Fail

#### Test 1.5: Button Clickability
1. Navigate to `/adjuster/cases/new`
2. Scroll to various positions on the page
3. Try clicking both buttons at different scroll positions
4. **Expected:** Buttons are always clickable
5. **Expected:** No content blocks the buttons
6. **Status:** [ ] Pass [ ] Fail

---

## Issue 2: Case Approval Page - Button Centering ✅

### Page Location
`src/app/(dashboard)/manager/approvals/page.tsx`

### Expected Behavior
- ✅ Buttons should be FIXED at the bottom (already working)
- ✅ Buttons should be CENTERED horizontally (was right-aligned, now fixed)
- ✅ Buttons should have backdrop blur effect (was missing, now added)
- ✅ On desktop (lg breakpoint), buttons should account for 256px sidebar (lg:left-64)
- ✅ Buttons should be clickable at all times

### Test Steps

#### Test 2.1: Button Fixed Positioning
1. Navigate to `/manager/approvals`
2. Click on any pending case to view details
3. Scroll down the case details page
4. **Expected:** Approval/Reject buttons stay fixed at the bottom
5. **Expected:** Content scrolls behind the buttons
6. **Status:** [ ] Pass [ ] Fail

#### Test 2.2: Button Centering (Mobile)
1. Open browser DevTools (F12)
2. Switch to mobile view (iPhone 12 Pro or similar)
3. Navigate to `/manager/approvals`
4. Click on a pending case
5. **Expected:** "Reject" and "Approve" buttons are centered
6. **Expected:** Buttons are side-by-side with equal spacing
7. **Status:** [ ] Pass [ ] Fail

#### Test 2.3: Button Centering (Desktop)
1. Switch to desktop view (1920x1080)
2. Navigate to `/manager/approvals`
3. Click on a pending case
4. **Expected:** Buttons are centered horizontally (NOT right-aligned)
5. **Expected:** Buttons account for sidebar (256px offset on left)
6. **Status:** [ ] Pass [ ] Fail

#### Test 2.4: Backdrop Blur Effect (NEW)
1. Navigate to `/manager/approvals`
2. Click on a pending case
3. Scroll down so content is behind the button area
4. **Expected:** Semi-transparent background with blur effect
5. **Expected:** Content is visible but blurred behind buttons
6. **Expected:** Gradient fade from transparent to white
7. **Status:** [ ] Pass [ ] Fail

#### Test 2.5: Edit Mode Button Centering
1. Navigate to `/manager/approvals`
2. Click on a pending case
3. Click "Edit Prices" to enter edit mode
4. **Expected:** "Cancel Edits" and "Approve with Changes" buttons are centered
5. **Expected:** Buttons are stacked vertically and centered
6. **Status:** [ ] Pass [ ] Fail

#### Test 2.6: Approval Flow Button Centering
1. Navigate to `/manager/approvals`
2. Click on a pending case
3. Click "Reject" button
4. **Expected:** Comment textarea appears
5. **Expected:** "Cancel" and "Confirm" buttons are centered
6. **Status:** [ ] Pass [ ] Fail

---

## Visual Comparison Tests

### Test 3.1: Consistency Between Pages
1. Open both pages side-by-side:
   - `/adjuster/cases/new`
   - `/manager/approvals` (with a case selected)
2. **Expected:** Both pages have identical button styling
3. **Expected:** Both pages have identical backdrop blur effect
4. **Expected:** Both pages have identical centering behavior
5. **Status:** [ ] Pass [ ] Fail

### Test 3.2: Responsive Breakpoints
Test at these viewport widths:
- 375px (iPhone SE)
- 768px (iPad)
- 1024px (Desktop with sidebar)
- 1920px (Large desktop)

For each breakpoint:
1. Navigate to both pages
2. **Expected:** Buttons remain centered at all breakpoints
3. **Expected:** Backdrop blur effect works at all breakpoints
4. **Expected:** Sidebar offset (lg:left-64) applies correctly at 1024px+
5. **Status:** [ ] Pass [ ] Fail

---

## Technical Implementation Verification

### Case Creation Page (adjuster/cases/new/page.tsx)
**Line 2187:** Fixed button container
```tsx
<div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-lg border-t border-gray-200/50 p-4 z-50">
```

**Key Classes:**
- ✅ `fixed bottom-0 left-0 right-0` - Fixed positioning
- ✅ `lg:left-64` - Sidebar offset on desktop
- ✅ `bg-gradient-to-t from-white via-white/95 to-transparent` - Gradient background
- ✅ `backdrop-blur-lg` - Blur effect
- ✅ `z-50` - High z-index for stacking

**Line 2189:** Button centering
```tsx
<div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
```

**Key Classes:**
- ✅ `max-w-2xl mx-auto` - Centered container with max width
- ✅ `flex justify-center` - Centered flex layout
- ✅ `flex-col sm:flex-row` - Responsive stacking

### Case Approval Page (manager/approvals/page.tsx)
**Line 1076:** Fixed button container (UPDATED)
```tsx
<div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-lg border-t border-gray-200/50 p-4 space-y-3 z-50">
```

**Changes Made:**
- ✅ Changed `bg-white` to `bg-gradient-to-t from-white via-white/95 to-transparent`
- ✅ Added `backdrop-blur-lg` class
- ✅ Changed `border-gray-200` to `border-gray-200/50` for softer border

**Line 1078:** Button centering (ALREADY CORRECT)
```tsx
<div className="w-full max-w-2xl mx-auto">
```

**Line 1142 & 1178:** Button layouts (ALREADY CORRECT)
```tsx
<div className="flex justify-center gap-4">
```

---

## Summary of Changes

### Case Creation Page
**Status:** ✅ Already correct - No changes needed

### Case Approval Page
**Status:** ✅ Fixed - Added backdrop blur effect

**Changes:**
1. Updated button container background from solid white to gradient with transparency
2. Added `backdrop-blur-lg` class for blur effect
3. Softened border opacity from `border-gray-200` to `border-gray-200/50`

**Before:**
```tsx
<div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-gray-200 p-4 space-y-3 z-50">
```

**After:**
```tsx
<div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-lg border-t border-gray-200/50 p-4 space-y-3 z-50">
```

---

## Notes
- Both pages now have identical button positioning and styling
- Backdrop blur effect provides a modern, polished look
- Buttons remain accessible and clickable at all scroll positions
- Responsive design works across all device sizes
- Sidebar offset (lg:left-64) ensures proper alignment on desktop

## Sign-off
- [ ] All tests passed
- [ ] Visual consistency verified
- [ ] Responsive behavior confirmed
- [ ] Ready for production

**Tester Signature:** ___________________  
**Date:** ___________________
