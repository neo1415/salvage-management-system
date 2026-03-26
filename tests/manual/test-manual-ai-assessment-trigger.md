# Manual AI Assessment Trigger - Test Plan

## Overview
This test plan validates the manual AI assessment trigger implementation for the case creation page, including rate limiting and improved UX.

## Test Date
**Date:** [To be filled during testing]  
**Tester:** [To be filled during testing]  
**Environment:** Development/Staging

---

## Test Cases

### 1. Auto-Trigger Removal ✅

**Objective:** Verify AI assessment no longer auto-triggers when uploading photos

**Steps:**
1. Navigate to `/adjuster/cases/new`
2. Select an asset type (e.g., Vehicle)
3. Fill in required details (Make, Model, Year)
4. Upload 3 photos

**Expected Result:**
- ✅ Photos upload successfully
- ✅ NO automatic AI assessment runs
- ✅ "Analyze Photos" button appears
- ✅ No loading indicators appear automatically

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 2. Manual "Analyze Photos" Button ✅

**Objective:** Verify the manual analyze button works correctly

**Steps:**
1. Upload 3-10 photos with required item details filled
2. Observe the "Analyze Photos" button
3. Click the button

**Expected Result:**
- ✅ Button shows "Analyze X Photos" (where X = photo count)
- ✅ Button is enabled when 3-10 photos present
- ✅ Button shows loading state during analysis
- ✅ Button uses ModernButton component with primary variant
- ✅ AI assessment runs and completes successfully

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 3. Button Disabled States ✅

**Objective:** Verify button is disabled when conditions aren't met

**Test 3.1: Less than 3 photos**
1. Upload only 1-2 photos
2. Observe button state

**Expected Result:**
- ✅ Button does not appear
- ✅ Warning message: "Upload at least 3 photos to analyze"
- ✅ Shows current photo count

**Test 3.2: Missing item details**
1. Upload 3 photos
2. Don't fill required fields (e.g., Make/Model/Year for vehicles)

**Expected Result:**
- ✅ Button does not appear
- ✅ Blue info box shows: "Item details required"
- ✅ Specific message for asset type (e.g., "Please fill in Make, Model, and Year to analyze")

**Test 3.3: During analysis**
1. Click "Analyze Photos"
2. Observe button during processing

**Expected Result:**
- ✅ Button shows loading spinner
- ✅ Button is disabled
- ✅ Button text shows "Analyzing..."

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 4. Re-Analysis Feature ✅

**Objective:** Verify users can re-analyze after initial analysis

**Steps:**
1. Complete initial AI analysis
2. Delete 1 photo
3. Upload 2 new photos
4. Observe button text
5. Click button to re-analyze

**Expected Result:**
- ✅ After initial analysis: Success message "Analysis complete! You can add/remove photos and re-analyze"
- ✅ Button text changes to "Re-Analyze X Photos"
- ✅ Previous AI results are cleared
- ✅ New analysis runs successfully
- ✅ New results replace old results

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 5. Client-Side Rate Limiting ✅

**Objective:** Verify client-side rate limiting (5 requests per minute)

**Steps:**
1. Upload 3 photos with required details
2. Click "Analyze Photos" 5 times rapidly (wait for each to complete)
3. Try to click a 6th time within 1 minute

**Expected Result:**
- ✅ First 5 requests succeed
- ✅ 6th request shows error: "⚠️ Analysis limit reached. Please wait [X] seconds before analyzing again."
- ✅ Error shows in red box above button
- ✅ Button is disabled
- ✅ Wait time countdown is accurate
- ✅ After wait time expires, button becomes enabled again

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 6. Server-Side Rate Limiting ✅

**Objective:** Verify server-side rate limiting (5 requests per minute per user)

**Steps:**
1. Open browser DevTools Network tab
2. Upload 3 photos with required details
3. Click "Analyze Photos" 5 times rapidly
4. Try a 6th request within 1 minute

**Expected Result:**
- ✅ First 5 requests return 200 OK
- ✅ 6th request returns 429 Too Many Requests
- ✅ Response includes:
  - `error: "Too many analysis requests"`
  - `message: "Please try again in [X] seconds."`
  - `retryAfter: [number]`
- ✅ Response headers include:
  - `Retry-After: [seconds]`
  - `X-RateLimit-Limit: 5`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset: [ISO timestamp]`

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 7. UI/UX Messages ✅

**Objective:** Verify all helper messages display correctly

**Test 7.1: Less than 3 photos**
**Expected:** "Upload at least 3 photos to analyze" + "You have X photo(s) uploaded"

**Test 7.2: Ready to analyze**
**Expected:** "Ready to analyze X photos with AI"

**Test 7.3: During analysis**
**Expected:** 
- Search progress indicator with stages
- "Analyzing photos..." with progress bar

**Test 7.4: After analysis**
**Expected:** "✓ Analysis complete! You can add/remove photos and re-analyze"

**Test 7.5: Missing item details**
**Expected:** Blue info box with specific requirements for asset type

**Test 7.6: Offline mode**
**Expected:** Yellow warning box: "You're offline - AI assessment will run automatically when connection is restored"

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 8. Button Placement ✅

**Objective:** Verify button is placed correctly in the UI

**Steps:**
1. Navigate through the form
2. Upload photos
3. Observe button location

**Expected Result:**
- ✅ Button appears below photo grid
- ✅ Button appears above AI results section
- ✅ Button is full-width on mobile
- ✅ Button is properly centered
- ✅ Proper spacing above and below button

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 9. Mobile Responsiveness ✅

**Objective:** Verify button works well on mobile devices

**Steps:**
1. Open page on mobile device or use DevTools mobile emulation
2. Upload photos
3. Test button interaction

**Expected Result:**
- ✅ Button is easily tappable (min 44px height)
- ✅ Button text is readable
- ✅ Loading state is clear
- ✅ Error messages are readable
- ✅ No layout issues or overflow

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 10. Integration with Existing Flow ✅

**Objective:** Verify manual trigger doesn't break existing functionality

**Steps:**
1. Complete entire case creation flow with manual AI trigger
2. Submit case for approval

**Expected Result:**
- ✅ AI assessment results are saved correctly
- ✅ Market value is auto-filled from AI results
- ✅ All AI data (severity, confidence, labels, etc.) is preserved
- ✅ Case submission works normally
- ✅ No console errors

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 11. Offline Behavior ✅

**Objective:** Verify behavior when offline

**Steps:**
1. Go offline (disable network in DevTools)
2. Upload photos
3. Observe UI

**Expected Result:**
- ✅ "Analyze Photos" button does NOT appear
- ✅ Yellow warning box appears: "You're offline"
- ✅ Message: "AI assessment will run automatically when connection is restored"
- ✅ Photos can still be uploaded
- ✅ Form can be saved as draft

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

### 12. Rate Limit Reset ✅

**Objective:** Verify rate limit resets after 1 minute

**Steps:**
1. Trigger rate limit (5 requests)
2. Wait for the displayed countdown to reach 0
3. Try analyzing again

**Expected Result:**
- ✅ After wait time expires, error message disappears
- ✅ Button becomes enabled
- ✅ New analysis request succeeds
- ✅ Rate limit counter resets

**Actual Result:** [To be filled]

**Status:** [ ] Pass [ ] Fail

---

## Summary

**Total Test Cases:** 12  
**Passed:** [ ]  
**Failed:** [ ]  
**Blocked:** [ ]  

## Issues Found

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| 1 | | | |
| 2 | | | |

## Notes

[Add any additional observations or comments here]

---

## Sign-off

**Tester Signature:** ___________________  
**Date:** ___________________  
**Approved By:** ___________________  
**Date:** ___________________
