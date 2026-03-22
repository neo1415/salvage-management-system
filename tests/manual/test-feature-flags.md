# Manual Testing Guide: Feature Flags System

## Overview
This guide provides step-by-step instructions for manually testing the feature flag system for gradual rollout.

## Prerequisites
- Application running locally or in test environment
- Access to browser developer tools
- Multiple browser tabs for cross-tab sync testing

## Test Cases

### Test 1: Feature Flag Settings Page Access

**Objective**: Verify users can access the feature flag settings page

**Steps**:
1. Navigate to `/settings/feature-flags`
2. Verify the page loads without errors
3. Verify the page displays "Feature Flags" heading
4. Verify all three feature flags are listed:
   - Modern faceted filter UI
   - Reduced verbosity card design
   - Lucide React icons

**Expected Result**:
- Page loads successfully
- All feature flags are visible
- Each flag shows its description and current state

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 2: Feature Flag Opt-In

**Objective**: Verify users can opt-in to a feature flag

**Steps**:
1. Navigate to `/settings/feature-flags`
2. Find the "Modern faceted filter UI" flag
3. Click to expand the flag details
4. Click the "Opt In" button
5. Verify the status changes to "Enabled"
6. Verify "User override: Enabled" is displayed
7. Navigate to `/adjuster/cases`
8. Verify modern filter UI is displayed

**Expected Result**:
- Opt-in button works correctly
- Status updates immediately
- Override is shown
- Feature is enabled on the cases page

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 3: Feature Flag Opt-Out

**Objective**: Verify users can opt-out of a feature flag

**Steps**:
1. Navigate to `/settings/feature-flags`
2. Find the "Modern faceted filter UI" flag
3. Click to expand the flag details
4. Click the "Opt Out" button
5. Verify the status changes to "Disabled"
6. Verify "User override: Disabled" is displayed
7. Navigate to `/adjuster/cases`
8. Verify legacy filter UI is displayed (if fallback exists)

**Expected Result**:
- Opt-out button works correctly
- Status updates immediately
- Override is shown
- Feature is disabled on the cases page

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 4: Clear Feature Flag Override

**Objective**: Verify users can clear their override and use default rollout

**Steps**:
1. Navigate to `/settings/feature-flags`
2. Opt-in to "Modern faceted filter UI"
3. Verify "User override: Enabled" is displayed
4. Click the "Reset" button
5. Verify the override is cleared
6. Verify the status shows default rollout percentage
7. Refresh the page
8. Verify the override remains cleared

**Expected Result**:
- Reset button works correctly
- Override is cleared
- Default rollout is used
- State persists after refresh

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 5: localStorage Persistence

**Objective**: Verify feature flag overrides persist across sessions

**Steps**:
1. Navigate to `/settings/feature-flags`
2. Opt-in to "Modern faceted filter UI"
3. Open browser developer tools
4. Go to Application/Storage > Local Storage
5. Verify `feature-flags-overrides` key exists
6. Verify the value contains `{"modern-filters":true}`
7. Close the browser tab
8. Open a new tab and navigate to `/settings/feature-flags`
9. Verify the opt-in is still active

**Expected Result**:
- Override is saved to localStorage
- Override persists after closing tab
- Override is restored on new session

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 6: Cross-Tab Synchronization

**Objective**: Verify feature flag changes sync across browser tabs

**Steps**:
1. Open two browser tabs
2. Navigate both to `/settings/feature-flags`
3. In Tab 1, opt-in to "Modern faceted filter UI"
4. Switch to Tab 2
5. Verify the flag status updates automatically
6. In Tab 2, opt-out of the flag
7. Switch to Tab 1
8. Verify the flag status updates automatically

**Expected Result**:
- Changes in one tab sync to other tabs
- No page refresh required
- Sync happens within 1 second

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 7: Feature Flag in Component

**Objective**: Verify feature flags work correctly in components

**Steps**:
1. Navigate to `/adjuster/cases`
2. Open browser developer tools console
3. Run: `localStorage.setItem('feature-flags-overrides', '{"modern-filters":false}')`
4. Refresh the page
5. Verify legacy filter UI is displayed (if fallback exists)
6. Run: `localStorage.setItem('feature-flags-overrides', '{"modern-filters":true}')`
7. Refresh the page
8. Verify modern filter UI is displayed

**Expected Result**:
- Feature flag controls which UI is displayed
- Changes take effect after refresh
- No errors in console

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 8: Multiple Feature Flags

**Objective**: Verify multiple feature flags can be controlled independently

**Steps**:
1. Navigate to `/settings/feature-flags`
2. Opt-in to "Modern faceted filter UI"
3. Opt-out of "Reduced verbosity card design"
4. Leave "Lucide React icons" at default
5. Verify all three flags show correct states
6. Open browser developer tools
7. Check localStorage for `feature-flags-overrides`
8. Verify it contains both overrides

**Expected Result**:
- Multiple flags can be controlled independently
- Each flag maintains its own state
- localStorage contains all overrides

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 9: Percentage-Based Rollout

**Objective**: Verify percentage-based rollout works consistently

**Steps**:
1. Open browser developer tools console
2. Run: `localStorage.clear()`
3. Run the following code:
```javascript
import { isFeatureEnabled } from '@/lib/feature-flags';

const userId1 = 'test-user-1';
const userId2 = 'test-user-2';

// Check multiple times for same user
const result1a = isFeatureEnabled('modern-filters', userId1);
const result1b = isFeatureEnabled('modern-filters', userId1);
const result1c = isFeatureEnabled('modern-filters', userId1);

console.log('User 1 results:', result1a, result1b, result1c);
console.log('All same?', result1a === result1b && result1b === result1c);

// Check for different user
const result2 = isFeatureEnabled('modern-filters', userId2);
console.log('User 2 result:', result2);
```

**Expected Result**:
- Same user ID always gets same result
- Different user IDs may get different results
- Results are deterministic (not random)

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 10: Error Handling

**Objective**: Verify system handles errors gracefully

**Steps**:
1. Open browser developer tools console
2. Run: `localStorage.setItem('feature-flags-overrides', 'invalid-json')`
3. Navigate to `/settings/feature-flags`
4. Verify page loads without errors
5. Verify feature flags show default states
6. Try to opt-in to a flag
7. Verify it works correctly
8. Check localStorage
9. Verify corrupted data was replaced with valid JSON

**Expected Result**:
- Corrupted localStorage data doesn't break the app
- System falls back to default states
- New overrides work correctly
- No console errors

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 11: UI State Indicators

**Objective**: Verify UI correctly shows feature flag states

**Steps**:
1. Navigate to `/settings/feature-flags`
2. For each feature flag, verify:
   - Green dot when enabled
   - Gray dot when disabled
   - "User override" text when override exists
   - "Rollout: X%" text when no override
   - Opt-in button disabled when already opted in
   - Opt-out button disabled when already opted out
   - Reset button only visible when override exists

**Expected Result**:
- All visual indicators are correct
- Buttons are enabled/disabled appropriately
- Text accurately reflects current state

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

### Test 12: Mobile Responsiveness

**Objective**: Verify feature flag settings work on mobile devices

**Steps**:
1. Open browser developer tools
2. Enable device emulation (mobile view)
3. Navigate to `/settings/feature-flags`
4. Verify layout is responsive
5. Verify all buttons are tappable (44x44px minimum)
6. Try expanding/collapsing flags
7. Try opting in/out of flags
8. Verify all functionality works on mobile

**Expected Result**:
- Layout adapts to mobile screen
- All touch targets are large enough
- All functionality works correctly
- No horizontal scrolling required

**Status**: [ ] Pass [ ] Fail

**Notes**:
_______________________________________________

---

## Test Summary

**Total Tests**: 12
**Passed**: ___
**Failed**: ___
**Blocked**: ___

**Overall Status**: [ ] Pass [ ] Fail

**Tester Name**: _______________
**Test Date**: _______________
**Environment**: _______________

## Issues Found

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| 1       |             |          |        |
| 2       |             |          |        |
| 3       |             |          |        |

## Additional Notes

_______________________________________________
_______________________________________________
_______________________________________________
