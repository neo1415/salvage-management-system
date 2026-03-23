# Mobile Responsiveness Testing Plan

## Task 21.1: Test on Mobile Devices

### Test Environment Setup
- **Devices to Test:**
  - iPhone (Safari) - iOS 15+
  - Android Phone (Chrome) - Android 10+
  - Tablet (iPad/Android) - Various sizes

### Test Cases

#### 1. Mileage Numeric Keyboard
**Requirement:** 9.1, 9.2

**Test Steps:**
1. Open case creation form on mobile device
2. Tap on the mileage input field
3. Verify numeric keyboard appears (not full QWERTY)
4. Enter test value: 50000
5. Verify value is accepted

**Expected Result:**
- ✅ Numeric keyboard with numbers 0-9 appears
- ✅ No alphabetic keys visible
- ✅ Value can be entered smoothly
- ✅ Keyboard dismisses properly

**Status:** ⏳ Pending Manual Test

---

#### 2. Condition Dropdown Touch-Friendliness
**Requirement:** 9.2

**Test Steps:**
1. Open case creation form on mobile device
2. Tap on the condition dropdown
3. Verify dropdown opens with touch-friendly options
4. Select "good" condition
5. Verify selection is registered

**Expected Result:**
- ✅ Dropdown opens on first tap
- ✅ Options are clearly visible and spaced
- ✅ Each option has minimum 44x44px touch target
- ✅ Selection feedback is immediate

**Status:** ⏳ Pending Manual Test

---

#### 3. Price Edit Fields Touch Targets
**Requirement:** 9.3, 9.4

**Test Steps:**
1. Open manager approval page on mobile device
2. Tap "Edit Prices" button
3. Verify all price input fields are easily tappable
4. Measure touch target sizes (use browser dev tools)
5. Try tapping each field

**Expected Result:**
- ✅ All input fields have minimum 44x44px touch target
- ✅ Fields don't overlap or crowd each other
- ✅ Tapping activates the correct field
- ✅ No accidental taps on adjacent elements

**Status:** ⏳ Pending Manual Test

---

#### 4. Edit Mode Button Accessibility
**Requirement:** 9.5

**Test Steps:**
1. Open manager approval page on mobile device
2. Locate "Edit Prices" button
3. Verify button size and position
4. Tap button to enter edit mode
5. Verify "Cancel Edits" and "Approve with Changes" buttons

**Expected Result:**
- ✅ "Edit Prices" button is easily visible
- ✅ Button has minimum 44x44px touch target
- ✅ Button responds to tap immediately
- ✅ Edit mode buttons are clearly labeled
- ✅ All action buttons are accessible

**Status:** ⏳ Pending Manual Test

---

#### 5. Validation Error Readability
**Requirement:** 10.3

**Test Steps:**
1. Open manager approval page on mobile device
2. Enter edit mode
3. Enter invalid price (e.g., salvage > market)
4. Verify error message display
5. Check text size and contrast

**Expected Result:**
- ✅ Error messages are clearly visible
- ✅ Text size is readable (minimum 14px)
- ✅ Error color has sufficient contrast
- ✅ Errors appear near relevant fields
- ✅ Multiple errors don't overlap

**Status:** ⏳ Pending Manual Test

---

## Task 21.2: Test Responsive Layouts

### Test Environment Setup
- **Browsers:**
  - Safari (iOS)
  - Chrome (Android)
  - Chrome DevTools (Desktop simulation)

- **Screen Sizes:**
  - iPhone SE (375px width)
  - iPhone 12/13 (390px width)
  - iPhone 14 Pro Max (430px width)
  - iPad Mini (768px width)
  - iPad Pro (1024px width)
  - Android Phone (360px-414px width)

### Test Cases

#### 1. iPhone (Safari) Layout
**Requirement:** 9.1, 9.4

**Test Steps:**
1. Open app on iPhone with Safari
2. Navigate to case creation form
3. Scroll through entire form
4. Navigate to manager approval page
5. Test edit mode

**Expected Result:**
- ✅ All content fits within viewport
- ✅ No horizontal scrolling required
- ✅ Text is readable without zooming
- ✅ Buttons are accessible
- ✅ Form fields stack vertically

**Status:** ⏳ Pending Manual Test

---

#### 2. Android (Chrome) Layout
**Requirement:** 9.1, 9.4

**Test Steps:**
1. Open app on Android with Chrome
2. Navigate to case creation form
3. Scroll through entire form
4. Navigate to manager approval page
5. Test edit mode

**Expected Result:**
- ✅ All content fits within viewport
- ✅ No horizontal scrolling required
- ✅ Text is readable without zooming
- ✅ Buttons are accessible
- ✅ Form fields stack vertically

**Status:** ⏳ Pending Manual Test

---

#### 3. Tablet Sizes Layout
**Requirement:** 9.1, 9.4

**Test Steps:**
1. Open app on tablet (iPad or Android)
2. Test both portrait and landscape orientations
3. Navigate through case creation and approval flows
4. Verify layout adapts appropriately

**Expected Result:**
- ✅ Layout uses available space efficiently
- ✅ Content doesn't stretch awkwardly
- ✅ Multi-column layouts work in landscape
- ✅ Touch targets remain appropriate size
- ✅ No wasted whitespace

**Status:** ⏳ Pending Manual Test

---

#### 4. Touch Target Verification
**Requirement:** 9.4

**Test Steps:**
1. Use browser dev tools to measure touch targets
2. Check all interactive elements:
   - Input fields
   - Buttons
   - Dropdowns
   - Checkboxes
   - Links
3. Verify minimum 44x44px size

**Expected Result:**
- ✅ All buttons ≥ 44x44px
- ✅ All input fields ≥ 44px height
- ✅ All dropdowns ≥ 44px height
- ✅ Adequate spacing between targets (8px minimum)

**Status:** ⏳ Pending Manual Test

---

## Testing Checklist

### Pre-Test Setup
- [ ] Ensure latest code is deployed to test environment
- [ ] Clear browser cache on all test devices
- [ ] Verify test data is available
- [ ] Document device OS versions

### During Testing
- [ ] Take screenshots of any issues
- [ ] Note device model and OS version for each test
- [ ] Record any performance issues
- [ ] Test in both portrait and landscape modes

### Post-Test
- [ ] Document all findings
- [ ] Create bug tickets for any issues
- [ ] Update this document with test results
- [ ] Share results with team

## Test Results Summary

| Test Case | iPhone | Android | Tablet | Status |
|-----------|--------|---------|--------|--------|
| Numeric Keyboard | ⏳ | ⏳ | ⏳ | Pending |
| Condition Dropdown | ⏳ | ⏳ | ⏳ | Pending |
| Price Edit Fields | ⏳ | ⏳ | ⏳ | Pending |
| Edit Mode Button | ⏳ | ⏳ | ⏳ | Pending |
| Validation Errors | ⏳ | ⏳ | ⏳ | Pending |
| Layout (Portrait) | ⏳ | ⏳ | ⏳ | Pending |
| Layout (Landscape) | ⏳ | ⏳ | ⏳ | Pending |
| Touch Targets | ⏳ | ⏳ | ⏳ | Pending |

## Notes

This is a manual testing plan. Automated mobile testing can be added later using tools like:
- Playwright with mobile emulation
- BrowserStack for real device testing
- Appium for native mobile app testing (if applicable)

For now, manual testing ensures the mobile experience meets requirements before production deployment.
