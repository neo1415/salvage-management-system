# Manual Test Plan: UI/UX Remaining Fixes (Tasks 4.5, 4.7, 4.9)

**Date**: 2025-01-20  
**Tester**: [Your Name]  
**Environment**: [Development/Staging/Production]

---

## Test 1: Location Filter with Autocomplete (Task 4.5)

### Prerequisites
- Navigate to `/vendor/auctions`
- Ensure database has multiple locations (Lagos, Abuja, etc.)

### Test Cases

#### TC1.1: Basic Autocomplete Functionality
**Steps**:
1. Click on "Filters" button
2. Locate "Location" input field
3. Type "lag" (lowercase)
4. Observe dropdown suggestions

**Expected**:
- Dropdown appears after typing 2+ characters
- Shows locations containing "lag" (e.g., "Lagos", "Ikoyi, Lagos")
- Case-insensitive matching works
- Max 10 suggestions shown

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC1.2: Select Suggestion
**Steps**:
1. Type "ab" in location field
2. Click on "Abuja" from suggestions
3. Observe filter chip and results

**Expected**:
- Input populated with "Abuja"
- Dropdown closes
- Filter chip shows "Location: Abuja"
- Auction results filtered to Abuja only

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC1.3: Clear Location Filter
**Steps**:
1. Enter location "Lagos"
2. Click X button in input field
3. Observe results

**Expected**:
- Input cleared
- Filter chip removed
- All auctions shown again

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC1.4: Combine with Other Filters
**Steps**:
1. Select asset type "Vehicle"
2. Enter location "Lagos"
3. Set price range 100,000 - 500,000
4. Observe results

**Expected**:
- All filters applied with AND logic
- Shows only vehicles in Lagos within price range
- Filter chips show all active filters

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC1.5: No Results Found
**Steps**:
1. Type "xyz123" in location field
2. Observe dropdown

**Expected**:
- Dropdown shows "No locations found"
- No suggestions displayed

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC1.6: Debounce Behavior
**Steps**:
1. Type "l" then quickly "a" then "g"
2. Observe network tab

**Expected**:
- Only one API call made after 300ms delay
- No API call for single character "l"

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

---

## Test 2: Specific Asset Names in Auction Cards (Task 4.7)

### Prerequisites
- Navigate to `/vendor/auctions`
- Ensure database has various asset types with details

### Test Cases

#### TC2.1: Vehicle Asset Name
**Steps**:
1. Find auction with vehicle asset type
2. Check assetDetails has year, make, model
3. Observe card title

**Expected**:
- Shows "2015 Toyota Camry" format
- Not just "Vehicle"

**Result**: [ ] Pass [ ] Fail  
**Asset Name Shown**: _______________

#### TC2.2: Vehicle with Missing Year
**Steps**:
1. Find vehicle without year in assetDetails
2. Observe card title

**Expected**:
- Shows "Toyota Camry" (without year)
- Gracefully handles missing data

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC2.3: Electronics Asset Name
**Steps**:
1. Find auction with electronics asset type
2. Check assetDetails has brand and model
3. Observe card title

**Expected**:
- Shows "Samsung Galaxy S21" format
- Not just "Electronics"

**Result**: [ ] Pass [ ] Fail  
**Asset Name Shown**: _______________

#### TC2.4: Property Asset Name
**Steps**:
1. Find auction with property asset type
2. Check assetDetails has propertyType
3. Observe card title

**Expected**:
- Shows "Commercial Property" or specific type
- Not just "Property"

**Result**: [ ] Pass [ ] Fail  
**Asset Name Shown**: _______________

#### TC2.5: Fallback to Claim Reference
**Steps**:
1. Find auction with empty assetDetails
2. Observe card title

**Expected**:
- Shows "vehicle - CLM-2024-001" format
- Uses assetType and claimReference

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC2.6: Long Name Truncation
**Steps**:
1. Find auction with very long asset name (>50 chars)
2. Observe card title

**Expected**:
- Name truncated at 50 characters
- Ends with "..." ellipsis
- No overflow or layout break

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

---

## Test 3: Notification Dropdown Alignment (Task 4.9)

### Prerequisites
- Login as any user
- Ensure you have some notifications

### Test Cases

#### TC3.1: Desktop Dropdown Position
**Steps**:
1. On desktop (>640px width)
2. Click bell icon in header
3. Observe dropdown position

**Expected**:
- Dropdown appears below bell icon
- Right-aligned with bell
- 8px gap between bell and dropdown
- Width: 384px
- Fully visible, not cut off

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC3.2: Desktop Scrollable Content
**Steps**:
1. Have 10+ notifications
2. Open dropdown
3. Scroll through notifications

**Expected**:
- Max height: 384px
- Scrollbar appears
- Smooth scrolling
- Header and footer stay fixed

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC3.3: Mobile Bottom Sheet (< 640px)
**Steps**:
1. Resize browser to mobile width (<640px)
2. Click bell icon
3. Observe dropdown

**Expected**:
- Dropdown slides up from bottom
- Full width (edge to edge)
- Bottom corners not rounded
- Close button (X) visible in header

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC3.4: Mobile Close Button
**Steps**:
1. On mobile view
2. Open notifications
3. Click X button in header

**Expected**:
- Dropdown closes
- Returns to main view
- No visual glitches

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC3.5: Mobile Scrollable Content
**Steps**:
1. On mobile with 10+ notifications
2. Open dropdown
3. Scroll through notifications

**Expected**:
- Max height: 60vh
- Scrollable content area
- Header and footer visible
- Smooth scrolling

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC3.6: Click Outside to Close
**Steps**:
1. Open notification dropdown
2. Click anywhere outside dropdown
3. Observe behavior

**Expected**:
- Dropdown closes
- Works on both desktop and mobile

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

#### TC3.7: Responsive Width Transition
**Steps**:
1. Open dropdown on desktop
2. Resize window to mobile width
3. Observe dropdown behavior

**Expected**:
- Dropdown repositions smoothly
- No layout breaks
- Switches from absolute to fixed positioning

**Result**: [ ] Pass [ ] Fail  
**Notes**: _______________

---

## Cross-Browser Testing

Test on multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Accessibility Testing

- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Screen reader announces location suggestions
- [ ] ARIA labels present and correct
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG standards

---

## Performance Testing

- [ ] Location autocomplete responds within 500ms
- [ ] No lag when typing in location field
- [ ] Dropdown animations smooth (60fps)
- [ ] No memory leaks on repeated open/close

---

## Summary

**Total Test Cases**: 19  
**Passed**: ___  
**Failed**: ___  
**Blocked**: ___  

**Critical Issues Found**: _______________

**Recommendations**: _______________

---

**Test Completed By**: _______________  
**Date**: _______________  
**Sign-off**: _______________
