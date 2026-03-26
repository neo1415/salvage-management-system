# Z-Index Strategy Manual Test

## Test Date
[Date to be filled during testing]

## Test Environment
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Desktop Chrome
- [ ] Desktop Firefox

## Z-Index Layering Strategy

The following z-index values have been implemented:

| Component | Z-Index | Purpose |
|-----------|---------|---------|
| Modals | z-50 | Highest priority - overlays everything |
| Hamburger Menu & Mobile Sidebar | z-45 | Navigation - below modals, above offline indicator |
| Offline Indicator | z-40 | Information banner - below navigation |
| Regular Content | z-0 to z-30 | Normal page content |

## Test Cases

### Test 1: Offline Indicator Does Not Block Hamburger Menu
**Priority**: CRITICAL

**Steps**:
1. Open the application on a mobile device or mobile viewport (< 1024px width)
2. Disconnect from the internet (enable airplane mode or disable network)
3. Wait for the offline indicator banner to appear at the top
4. Try to click the hamburger menu button (☰) in the top-left corner

**Expected Result**:
- ✅ Hamburger menu button is clickable
- ✅ Hamburger menu button is NOT blocked by the offline indicator
- ✅ Mobile sidebar opens when hamburger menu is clicked
- ✅ Offline indicator remains visible but does not interfere

**Actual Result**:
[To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 2: Mobile Sidebar Appears Above Offline Indicator
**Priority**: HIGH

**Steps**:
1. Open the application on a mobile device
2. Disconnect from the internet
3. Click the hamburger menu button to open the mobile sidebar

**Expected Result**:
- ✅ Mobile sidebar slides in from the left
- ✅ Mobile sidebar appears above the offline indicator (z-45 > z-40)
- ✅ Offline indicator is still visible at the top
- ✅ Navigation links in the sidebar are clickable

**Actual Result**:
[To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 3: Modals Appear Above Everything
**Priority**: HIGH

**Steps**:
1. Open the application on a mobile device
2. Disconnect from the internet (offline indicator appears)
3. Open the mobile sidebar
4. Navigate to a page with a modal (e.g., Finance Payments page)
5. Open a modal (e.g., payment details modal)

**Expected Result**:
- ✅ Modal appears above everything (z-50)
- ✅ Modal appears above the mobile sidebar (z-50 > z-45)
- ✅ Modal appears above the offline indicator (z-50 > z-40)
- ✅ Modal backdrop covers the entire screen
- ✅ Only the modal is interactive (sidebar and offline indicator are not clickable)

**Actual Result**:
[To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 4: Offline Indicator Dismissal
**Priority**: MEDIUM

**Steps**:
1. Open the application on a mobile device
2. Disconnect from the internet
3. Click the X button on the offline indicator banner
4. Verify the compact badge appears in the top-right corner
5. Click the hamburger menu button

**Expected Result**:
- ✅ Offline indicator banner slides up and disappears
- ✅ Compact offline badge appears in top-right corner (z-40)
- ✅ Hamburger menu button is still accessible
- ✅ Compact badge does not block the hamburger menu
- ✅ Clicking the compact badge re-expands the full banner

**Actual Result**:
[To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 5: Z-Index Layering on Desktop
**Priority**: MEDIUM

**Steps**:
1. Open the application on a desktop browser (> 1024px width)
2. Disconnect from the internet
3. Open a modal (e.g., from Finance Payments page)

**Expected Result**:
- ✅ Desktop sidebar is always visible (not affected by z-index)
- ✅ Offline indicator appears at the top (z-40)
- ✅ Modal appears above everything (z-50)
- ✅ No z-index conflicts on desktop

**Actual Result**:
[To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 6: Multiple Layers Interaction
**Priority**: HIGH

**Steps**:
1. Open the application on a mobile device
2. Disconnect from the internet (offline indicator appears at z-40)
3. Open the mobile sidebar (z-45)
4. From the sidebar, navigate to a page with a modal
5. Open a modal (z-50)
6. Verify the layering order

**Expected Result**:
- ✅ Modal is on top (z-50)
- ✅ Mobile sidebar is below modal but above offline indicator (z-45)
- ✅ Offline indicator is at the bottom of the stack (z-40)
- ✅ Clicking outside the modal closes it
- ✅ After closing modal, sidebar is still visible
- ✅ Offline indicator remains visible throughout

**Actual Result**:
[To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 7: Screen Size Transitions
**Priority**: MEDIUM

**Steps**:
1. Open the application on a desktop browser
2. Disconnect from the internet
3. Resize the browser window from desktop (> 1024px) to mobile (< 1024px)
4. Verify the hamburger menu appears
5. Click the hamburger menu

**Expected Result**:
- ✅ Hamburger menu appears when resizing to mobile
- ✅ Hamburger menu is clickable and not blocked
- ✅ Mobile sidebar opens correctly
- ✅ Z-index layering is correct after resize
- ✅ No visual glitches during transition

**Actual Result**:
[To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 8: iOS Safari Specific Test
**Priority**: HIGH (iOS is a primary target)

**Steps**:
1. Open the application on an iPhone using Safari
2. Disconnect from the internet
3. Test all the above scenarios on iOS Safari specifically

**Expected Result**:
- ✅ All z-index layering works correctly on iOS Safari
- ✅ No iOS-specific rendering issues
- ✅ Touch interactions work correctly
- ✅ Hamburger menu is accessible

**Actual Result**:
[To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

### Test 9: Android Chrome Specific Test
**Priority**: HIGH (Android is a primary target)

**Steps**:
1. Open the application on an Android device using Chrome
2. Disconnect from the internet
3. Test all the above scenarios on Android Chrome specifically

**Expected Result**:
- ✅ All z-index layering works correctly on Android Chrome
- ✅ No Android-specific rendering issues
- ✅ Touch interactions work correctly
- ✅ Hamburger menu is accessible

**Actual Result**:
[To be filled during testing]

**Status**: [ ] Pass [ ] Fail

---

## Summary

### Overall Test Results
- Total Tests: 9
- Passed: [To be filled]
- Failed: [To be filled]
- Pass Rate: [To be filled]%

### Critical Issues Found
[List any critical issues discovered during testing]

### Recommendations
[Any recommendations for improvements or fixes]

### Sign-off
- Tester Name: _______________
- Date: _______________
- Signature: _______________

---

## Technical Implementation Details

### Files Modified
1. `src/components/layout/dashboard-sidebar.tsx`
   - Changed mobile header z-index from z-50 to z-45
   - Changed mobile sidebar z-index from z-50 to z-45

2. `src/app/globals.css`
   - Added custom z-45 utility class

3. `src/components/pwa/offline-indicator.tsx`
   - Already at z-40 (no changes needed)

### Z-Index Strategy Rationale
- **Modals (z-50)**: Highest priority for user interactions that require full attention
- **Navigation (z-45)**: Essential for app navigation, but should be below modals
- **Offline Indicator (z-40)**: Informational, should not block navigation
- **Content (z-0 to z-30)**: Regular page content and dropdowns

This strategy ensures:
1. Users can always access navigation (hamburger menu)
2. Modals properly overlay everything when shown
3. Offline indicator provides information without blocking functionality
4. Clear visual hierarchy for all UI elements
