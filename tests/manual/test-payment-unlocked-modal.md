# Manual Test Plan: Payment Unlocked Modal

## Test Environment Setup

### Prerequisites
1. Running application (dev or staging)
2. Vendor account with login credentials
3. Access to database or admin panel to create test data
4. Browser with localStorage access (Chrome DevTools recommended)

### Test Data Setup

#### Create Test Scenario
1. Create a vendor account (or use existing)
2. Create an auction and have vendor win it
3. Have vendor complete all 3 documents:
   - Bill of Sale
   - Liability Waiver
   - Pickup Authorization
4. Trigger payment unlock (automatic after document completion)
5. Verify `PAYMENT_UNLOCKED` notification is created

## Test Cases

### TC1: Modal Appears on Login

**Objective**: Verify modal appears when vendor logs in with PAYMENT_UNLOCKED notification

**Steps**:
1. Ensure vendor has unread `PAYMENT_UNLOCKED` notification
2. Log out of vendor account
3. Log back in
4. Navigate to vendor dashboard

**Expected Result**:
- ✅ Modal appears automatically
- ✅ Modal shows correct asset description
- ✅ Modal shows correct winning bid amount
- ✅ Modal shows pickup authorization code
- ✅ Modal shows pickup location
- ✅ Modal shows pickup deadline
- ✅ Modal has "View Payment Details" button
- ✅ Modal has "Dismiss" button

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

### TC2: View Payment Details Button

**Objective**: Verify "View Payment Details" button routes correctly and stops modal

**Steps**:
1. Trigger modal (see TC1)
2. Click "View Payment Details" button

**Expected Result**:
- ✅ Routes to `/vendor/payments/{paymentId}`
- ✅ Payment page loads correctly
- ✅ Modal closes
- ✅ Log out and log back in
- ✅ Modal does NOT appear again

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

### TC3: Dismiss Button

**Objective**: Verify "Dismiss" button closes modal but allows reappearance

**Steps**:
1. Trigger modal (see TC1)
2. Click "Dismiss" button
3. Verify modal closes
4. Log out
5. Log back in
6. Navigate to vendor dashboard

**Expected Result**:
- ✅ Modal closes on dismiss
- ✅ Modal reappears on next login
- ✅ localStorage entry created: `payment-unlocked-modal-{paymentId}-dismissed`

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

### TC4: localStorage Persistence

**Objective**: Verify localStorage entries are created and cleared correctly

**Steps**:
1. Open Chrome DevTools → Application → Local Storage
2. Trigger modal (see TC1)
3. Click "Dismiss"
4. Check localStorage for `payment-unlocked-modal-{paymentId}-dismissed`
5. Navigate to payment page
6. Check localStorage for `payment-visited-{paymentId}`
7. Verify dismissal entry is cleared

**Expected Result**:
- ✅ Dismissal entry created with ISO timestamp
- ✅ Visited entry created with value "true"
- ✅ Dismissal entry cleared after visiting payment page

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

### TC5: Multiple Payments

**Objective**: Verify modal handles multiple PAYMENT_UNLOCKED notifications

**Steps**:
1. Create multiple auctions for same vendor
2. Complete documents for all auctions
3. Trigger payment unlock for all
4. Log in to vendor dashboard

**Expected Result**:
- ✅ Modal shows for most recent payment
- ✅ Only one modal appears at a time
- ✅ After handling first payment, modal shows for next payment on next login

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

### TC6: No Notification Scenario

**Objective**: Verify modal doesn't appear when no PAYMENT_UNLOCKED notification exists

**Steps**:
1. Ensure vendor has no unread `PAYMENT_UNLOCKED` notifications
2. Log in to vendor dashboard

**Expected Result**:
- ✅ Modal does NOT appear
- ✅ Dashboard loads normally
- ✅ No console errors

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

### TC7: Error Handling - Payment Not Found

**Objective**: Verify graceful handling when payment details cannot be fetched

**Steps**:
1. Create `PAYMENT_UNLOCKED` notification with invalid paymentId
2. Log in to vendor dashboard

**Expected Result**:
- ✅ Modal does NOT appear
- ✅ Error logged to console
- ✅ Dashboard loads normally
- ✅ No crash or blank screen

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

### TC8: Responsive Design

**Objective**: Verify modal works on mobile devices

**Steps**:
1. Trigger modal (see TC1)
2. Resize browser to mobile width (375px)
3. Test all interactions

**Expected Result**:
- ✅ Modal fits mobile screen
- ✅ All text is readable
- ✅ Buttons are tappable
- ✅ No horizontal scroll
- ✅ Close button accessible

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

### TC9: Notification Marked as Read

**Objective**: Verify notification is marked as read when modal is shown

**Steps**:
1. Verify vendor has unread `PAYMENT_UNLOCKED` notification
2. Log in to vendor dashboard
3. Modal appears
4. Check notification status in database or notifications page

**Expected Result**:
- ✅ Notification marked as read
- ✅ Notification count decreases
- ✅ Notification bell icon updates

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

### TC10: Close Button (X)

**Objective**: Verify close button (X) works same as Dismiss

**Steps**:
1. Trigger modal (see TC1)
2. Click X button in top-right corner
3. Verify modal closes
4. Log out and log back in

**Expected Result**:
- ✅ Modal closes on X click
- ✅ Modal reappears on next login
- ✅ Same behavior as "Dismiss" button

**Actual Result**: _[Fill in during testing]_

**Status**: ⬜ Pass / ⬜ Fail

---

## Browser Compatibility

Test on the following browsers:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Performance Testing

### Load Time
- [ ] Modal appears within 1 second of dashboard load
- [ ] No noticeable lag or delay
- [ ] API calls complete quickly

### Memory Usage
- [ ] No memory leaks after opening/closing modal multiple times
- [ ] localStorage entries don't accumulate excessively

## Accessibility Testing

- [ ] Modal can be closed with Escape key
- [ ] Tab navigation works correctly
- [ ] Screen reader announces modal content
- [ ] Focus trapped within modal when open
- [ ] Focus returns to trigger element on close

## Security Testing

- [ ] Modal only shows for authenticated vendors
- [ ] Cannot access other vendors' payment data
- [ ] localStorage entries are vendor-specific
- [ ] No sensitive data exposed in localStorage
- [ ] API endpoints require authentication

## Edge Cases

### EC1: Rapid Login/Logout
**Steps**: Log in and out rapidly 5 times
**Expected**: Modal appears correctly each time, no crashes

### EC2: Multiple Browser Tabs
**Steps**: Open vendor dashboard in 2 tabs, dismiss modal in one
**Expected**: Modal state syncs across tabs (or doesn't interfere)

### EC3: Expired Payment
**Steps**: Create payment with past deadline, trigger modal
**Expected**: Modal shows with expired deadline warning

### EC4: Missing Pickup Details
**Steps**: Create notification with missing pickupLocation or pickupDeadline
**Expected**: Modal shows with fallback values ("TBD", "N/A")

### EC5: Very Long Asset Description
**Steps**: Create asset with very long description (100+ characters)
**Expected**: Text wraps correctly, no overflow

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC1: Modal Appears | ⬜ | |
| TC2: View Payment Details | ⬜ | |
| TC3: Dismiss Button | ⬜ | |
| TC4: localStorage Persistence | ⬜ | |
| TC5: Multiple Payments | ⬜ | |
| TC6: No Notification | ⬜ | |
| TC7: Error Handling | ⬜ | |
| TC8: Responsive Design | ⬜ | |
| TC9: Notification Read | ⬜ | |
| TC10: Close Button | ⬜ | |

## Issues Found

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| | | | |

## Sign-off

**Tester**: _________________  
**Date**: _________________  
**Overall Status**: ⬜ Pass / ⬜ Fail / ⬜ Pass with Issues

**Notes**:
