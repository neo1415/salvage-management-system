# Manual Testing Guide: Finance Payment Approval Fixes

## Test Environment Setup

1. **Login as Finance Officer:**
   - Email: `finance@nem.com`
   - Role: `finance_officer`

2. **Navigate to:** `/finance/payments`

---

## Test 1: Success Modal for Payment Approval

### Steps:
1. Find a pending payment in the list
2. Click "Approve" button
3. Confirm approval in the modal

### Expected Results:
- ✅ Success modal appears (NOT browser alert)
- ✅ Modal shows green checkmark icon
- ✅ Modal shows message: "Payment verified successfully! ₦[amount] released to vendor."
- ✅ Modal can be closed with Escape key
- ✅ Modal can be closed with "OK" button
- ✅ Payment list refreshes automatically
- ✅ Payment status changes to "✅ Verified"

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 2: Success Modal for Payment Rejection

### Steps:
1. Find a pending payment in the list
2. Click "Reject" button
3. Enter rejection reason (min 10 characters)
4. Confirm rejection

### Expected Results:
- ✅ Success modal appears (NOT browser alert)
- ✅ Modal shows green checkmark icon
- ✅ Modal shows message: "Payment rejected successfully."
- ✅ Modal can be closed
- ✅ Payment list refreshes automatically
- ✅ Payment status changes to "❌ Rejected"

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 3: Error Modal for Failed Operations

### Steps:
1. Disconnect internet or use browser dev tools to simulate network error
2. Try to approve a payment
3. Observe error handling

### Expected Results:
- ✅ Error modal appears (NOT browser alert)
- ✅ Modal shows red X icon
- ✅ Modal shows error title
- ✅ Modal shows error details in red box
- ✅ Modal can be closed

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 4: Manual Fund Release Success Modal

### Steps:
1. Find an escrow wallet payment with status "pending" and escrow status "frozen"
2. Click "View Details"
3. In the EscrowPaymentDetails component, click "Manual Release"
4. Confirm the release

### Expected Results:
- ✅ Success modal appears (NOT browser alert)
- ✅ Modal shows message: "Funds released successfully! ₦[amount] transferred to NEM Insurance."
- ✅ Payment status updates to "verified"
- ✅ Escrow status updates to "released"
- ✅ Payment list refreshes

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 5: Finance Officer Email Notification (Success)

### Prerequisites:
- Have a vendor account with all 3 documents signed
- Payment should be escrow_wallet type with frozen funds

### Steps:
1. As vendor, sign the last document (pickup authorization)
2. Wait for automatic fund release to trigger
3. Check finance officer email inbox

### Expected Results:
- ✅ Finance officer receives email within 1 minute
- ✅ Email subject: "✅ Escrow Payment Released - [Auction ID]"
- ✅ Email contains:
  - Payment ID
  - Auction ID
  - Amount (₦[amount])
  - Asset description
  - Timestamp
  - Link to payment dashboard
- ✅ Email has green success styling

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 6: Finance Officer Push Notification (Success)

### Steps:
1. Same as Test 5
2. Check finance officer dashboard notification bell

### Expected Results:
- ✅ Notification appears in notification dropdown
- ✅ Notification type: "payment_success"
- ✅ Notification title: "✅ Escrow Payment Released"
- ✅ Notification message includes amount and auction ID
- ✅ Notification is clickable

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 7: Overdue Detection (Real-Time)

### Setup:
1. Create a test payment with deadline in the past:
   ```sql
   UPDATE payments 
   SET payment_deadline = NOW() - INTERVAL '2 days'
   WHERE id = '[test-payment-id]';
   ```

### Steps:
1. Navigate to `/finance/payments`
2. Check the "Overdue" stat card
3. Click "Overdue" tab

### Expected Results:
- ✅ Overdue count shows "1" (or more)
- ✅ Payment appears in overdue tab
- ✅ Payment status badge shows "🚨 Overdue"
- ✅ Deadline shows in red text
- ✅ Payment is automatically updated to status='overdue' in database

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 8: Overdue Escalation Email (Finance Officer)

### Prerequisites:
- Run the overdue checker cron job manually:
  ```bash
  curl -X POST http://localhost:3000/api/cron/check-overdue-payments \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```

### Steps:
1. Ensure there's at least one overdue payment
2. Run the cron job
3. Check finance officer email inbox

### Expected Results:
- ✅ Finance officer receives email
- ✅ Email subject: "🚨 Payment Overdue - [X] Day(s) - Action Required"
- ✅ Email contains:
  - Payment ID
  - Amount
  - Asset description
  - Vendor details
  - Days overdue (calculated correctly)
  - Recommended actions
  - Link to overdue payments dashboard
- ✅ Email has red warning styling

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 9: Overdue Reminder Email (Vendor)

### Steps:
1. Same as Test 8
2. Check vendor email inbox

### Expected Results:
- ✅ Vendor receives email
- ✅ Email subject: "🚨 URGENT: Payment Overdue - [X] Day(s)"
- ✅ Email contains:
  - Amount due
  - Asset description
  - Original deadline
  - Days overdue
  - Warning about cancellation
  - Instructions to complete payment
  - Link to payment page
  - Support contact info
- ✅ Email has urgent red styling

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 10: Overdue Reminder SMS (Vendor)

### Steps:
1. Same as Test 8
2. Check vendor phone for SMS

### Expected Results:
- ✅ Vendor receives SMS
- ✅ SMS contains:
  - "URGENT" keyword
  - Amount
  - Asset description
  - Days overdue
  - Warning about cancellation
  - Support phone number
- ✅ SMS is under 160 characters (or split appropriately)

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 11: Overdue In-App Notification (Vendor)

### Steps:
1. Login as vendor with overdue payment
2. Check notification bell

### Expected Results:
- ✅ Notification appears
- ✅ Notification type: "payment_reminder"
- ✅ Notification title: "🚨 Payment Overdue"
- ✅ Notification message includes amount and days overdue
- ✅ Notification data includes paymentId, auctionId, daysOverdue

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 12: Cron Job Health Check

### Steps:
1. Navigate to: `GET /api/cron/check-overdue-payments`

### Expected Results:
- ✅ Returns 200 OK
- ✅ Response includes:
  - status: "ok"
  - endpoint: "check-overdue-payments"
  - description
  - schedule: "Every hour (0 * * * *)"

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 13: Cron Job Execution

### Steps:
1. Run cron job:
   ```bash
   curl -X POST http://localhost:3000/api/cron/check-overdue-payments \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

### Expected Results:
- ✅ Returns 200 OK
- ✅ Response includes:
  - success: true
  - message: "Overdue payment check completed"
  - timestamp
- ✅ Console logs show:
  - "🔍 Checking for overdue payments..."
  - "⚠️  Found X overdue payment(s)" (if any)
  - "✅ Overdue payment check completed"

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 14: Cron Job Security

### Steps:
1. Try to run cron job without authorization:
   ```bash
   curl -X POST http://localhost:3000/api/cron/check-overdue-payments
   ```

### Expected Results:
- ✅ Returns 401 Unauthorized
- ✅ Response: { "error": "Unauthorized" }
- ✅ Console logs: "❌ Unauthorized cron job attempt"

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 15: Modal Animations

### Steps:
1. Trigger any success or error modal
2. Observe the animation

### Expected Results:
- ✅ Modal background fades in smoothly
- ✅ Modal content slides up from bottom
- ✅ Animation duration: ~300ms
- ✅ No janky or stuttering animation

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 16: Modal Accessibility

### Steps:
1. Open any modal
2. Press Tab key multiple times
3. Press Escape key

### Expected Results:
- ✅ Focus is trapped within modal
- ✅ Tab cycles through focusable elements
- ✅ Escape key closes modal
- ✅ Focus returns to trigger element after close

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 17: Overdue Count Accuracy

### Setup:
Create test data:
```sql
-- Payment 1: 2 days overdue
UPDATE payments SET payment_deadline = NOW() - INTERVAL '2 days', status = 'pending' WHERE id = 'payment-1';

-- Payment 2: 1 day overdue
UPDATE payments SET payment_deadline = NOW() - INTERVAL '1 day', status = 'pending' WHERE id = 'payment-2';

-- Payment 3: Not overdue yet (deadline tomorrow)
UPDATE payments SET payment_deadline = NOW() + INTERVAL '1 day', status = 'pending' WHERE id = 'payment-3';

-- Payment 4: Already verified (should not count)
UPDATE payments SET payment_deadline = NOW() - INTERVAL '3 days', status = 'verified' WHERE id = 'payment-4';
```

### Steps:
1. Navigate to `/finance/payments`
2. Check overdue count

### Expected Results:
- ✅ Overdue count shows "2"
- ✅ Only payment-1 and payment-2 appear in overdue tab
- ✅ payment-3 does NOT appear (not overdue yet)
- ✅ payment-4 does NOT appear (already verified)

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 18: Days Overdue Calculation

### Setup:
```sql
UPDATE payments SET payment_deadline = NOW() - INTERVAL '5 days', status = 'pending' WHERE id = 'test-payment';
```

### Steps:
1. Run overdue checker
2. Check email sent to finance officer
3. Check email sent to vendor

### Expected Results:
- ✅ Finance officer email shows "Days Overdue: 5 day(s)"
- ✅ Vendor email shows "5 day(s) overdue"
- ✅ Calculation is accurate (not 4 or 6)

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 19: Multiple Finance Officers

### Setup:
Create multiple finance officer accounts:
```sql
INSERT INTO users (email, role, full_name) VALUES
  ('finance1@nem.com', 'finance_officer', 'Finance Officer 1'),
  ('finance2@nem.com', 'finance_officer', 'Finance Officer 2'),
  ('finance3@nem.com', 'finance_officer', 'Finance Officer 3');
```

### Steps:
1. Trigger fund release success notification
2. Check all finance officer inboxes

### Expected Results:
- ✅ All 3 finance officers receive email
- ✅ All 3 finance officers receive push notification
- ✅ Emails are identical except for recipient name

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Test 20: Error Handling in Notifications

### Setup:
1. Temporarily break email service (e.g., invalid SMTP credentials)

### Steps:
1. Trigger fund release
2. Check console logs

### Expected Results:
- ✅ Fund release completes successfully (not blocked by email failure)
- ✅ Console shows error: "❌ Failed to send fund release success notification"
- ✅ Payment status is still updated to 'verified'
- ✅ Escrow status is still updated to 'released'
- ✅ Vendor still receives SMS/push notification

### Actual Results:
- [ ] Pass
- [ ] Fail (describe issue):

---

## Summary

**Total Tests:** 20
**Passed:** ___
**Failed:** ___
**Pass Rate:** ___%

**Critical Issues Found:**
1. 
2. 
3. 

**Minor Issues Found:**
1. 
2. 
3. 

**Recommendations:**
1. 
2. 
3. 

**Tested By:** _______________
**Date:** _______________
**Environment:** _______________
