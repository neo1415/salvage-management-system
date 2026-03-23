# Manual Test Plan: Comprehensive Document & Payment Flow Fixes

## Test Environment Setup

### Prerequisites
1. ✅ Development server running (`npm run dev`)
2. ✅ Database seeded with test data
3. ✅ Test accounts created:
   - Salvage Manager account
   - Vendor account (Tier 1 or Tier 2)
   - Finance Officer account
4. ✅ Test auction created with bids
5. ✅ Vendor has sufficient escrow wallet balance

### Test Data Requirements
- **Test Auction:** Active auction with at least 1 bid
- **Test Vendor:** Vendor with escrow wallet balance ≥ current bid
- **Test Case:** Salvage case with photos, GPS location, and AI assessment

---

## TEST 1: Manual Auction End Generates Documents

### Objective
Verify that clicking "End Auction" button generates all 3 documents automatically.

### Steps
1. Log in as **Salvage Manager**
2. Navigate to **Bidding History** page
3. Find an **active auction** with bids
4. Click **"End Auction"** button
5. Confirm the action

### Expected Results
- ✅ Auction status changes to "Closed"
- ✅ Success message: "Auction ended successfully. Documents generated and winner notified."
- ✅ 3 documents generated:
  - Bill of Sale
  - Release & Waiver of Liability
  - Pickup Authorization
- ✅ Payment record created
- ✅ Winner receives SMS notification
- ✅ Winner receives email notification
- ✅ Winner receives push notification
- ✅ Audit log entry created

### Verification
1. Log in as **winning vendor**
2. Navigate to **Documents** page
3. Verify 3 documents are listed
4. Check SMS inbox for notification
5. Check email inbox for notification
6. Check in-app notifications

### Pass Criteria
- All 3 documents generated ✅
- All notifications sent ✅
- No errors in console ✅

---

## TEST 2: Documents Persist on Page Reload

### Objective
Verify that documents don't disappear when auction details page is reloaded.

### Steps
1. Log in as **winning vendor**
2. Navigate to **Auctions** → **My Auctions**
3. Click on a **closed auction** you won
4. Verify documents are displayed
5. **Reload the page** (F5 or Ctrl+R)
6. Wait for page to load

### Expected Results
- ✅ Documents remain visible after reload
- ✅ Document status (signed/pending) is correct
- ✅ No console errors
- ✅ No flickering or layout shifts

### Verification
1. Check browser console for errors
2. Verify document count matches before/after reload
3. Verify document status matches before/after reload

### Pass Criteria
- Documents persist after reload ✅
- No console errors ✅
- No visual glitches ✅

---

## TEST 3: Documents Displayed as Cards in Row Layout

### Objective
Verify that documents are displayed as cards in a responsive grid layout.

### Steps
1. Log in as **winning vendor**
2. Navigate to closed auction details page
3. Scroll to document section
4. Test on different screen sizes:
   - **Desktop** (1920x1080)
   - **Tablet** (768x1024)
   - **Mobile** (375x667)

### Expected Results

#### Desktop (≥1024px)
- ✅ 3 columns of cards
- ✅ Cards have equal width
- ✅ Cards have hover effects

#### Tablet (768px - 1023px)
- ✅ 2 columns of cards
- ✅ Cards stack properly

#### Mobile (<768px)
- ✅ 1 column (vertical stack)
- ✅ Cards are full width
- ✅ Buttons are full width

### Card Content Verification
Each card should display:
- ✅ Status icon (green checkmark or yellow warning)
- ✅ Document title
- ✅ Signed date (if signed)
- ✅ Action button (Sign Now or Download)

### Pass Criteria
- Responsive layout works on all screen sizes ✅
- Cards are visually appealing ✅
- All card content is visible ✅

---

## TEST 4: Payment Unlocked Modal Appears After All Documents Signed

### Objective
Verify that payment unlocked modal appears immediately after signing the last document.

### Steps
1. Log in as **winning vendor**
2. Navigate to closed auction details page
3. Sign **first document** (Bill of Sale)
   - Click "Sign Now"
   - Draw signature
   - Click "Submit"
4. Sign **second document** (Liability Waiver)
   - Click "Sign Now"
   - Draw signature
   - Click "Submit"
5. Sign **third document** (Pickup Authorization)
   - Click "Sign Now"
   - Draw signature
   - Click "Submit"
6. Wait for modal to appear

### Expected Results
- ✅ After signing 1st document: No modal, progress shows 1/3
- ✅ After signing 2nd document: No modal, progress shows 2/3
- ✅ After signing 3rd document: **Payment unlocked modal appears**
- ✅ Modal displays:
  - Asset description
  - Winning bid amount
  - Pickup Authorization Code
  - Pickup location
  - Pickup deadline
  - "View Payment Details" button
  - "Dismiss" button

### Modal Interaction
1. Click **"View Payment Details"** button
   - ✅ Redirects to `/vendor/payments/{paymentId}`
   - ✅ Modal closes
   - ✅ Payment page loads

2. Go back to auction details page
3. Reload page
4. Modal should **NOT** appear (payment page visited)

5. Clear localStorage: `localStorage.clear()`
6. Reload page
7. Modal should **appear again**

### Pass Criteria
- Modal appears after signing last document ✅
- Modal displays correct information ✅
- "View Payment Details" button works ✅
- Modal doesn't appear after visiting payment page ✅

---

## TEST 5: Payment Unlocked Modal Persists Across Sessions

### Objective
Verify that payment unlocked modal appears on every login until payment page is visited.

### Steps
1. Complete TEST 4 (sign all 3 documents)
2. **Dismiss** the modal (don't click "View Payment Details")
3. **Log out**
4. **Log in** again as the same vendor
5. Navigate to auction details page

### Expected Results
- ✅ Modal appears again after login
- ✅ Modal shows same pickup details
- ✅ Modal persists until payment page is visited

### Verification
1. Dismiss modal multiple times
2. Log out and log in
3. Modal should keep appearing
4. Click "View Payment Details"
5. Log out and log in
6. Modal should **NOT** appear

### Pass Criteria
- Modal persists across sessions ✅
- Modal stops appearing after payment page visited ✅

---

## TEST 6: Backward Compatibility - Existing Auctions Trigger Modal

### Objective
Verify that existing auctions with all documents signed trigger the payment unlocked modal.

### Setup
1. Create a test auction
2. End the auction (winner determined)
3. Manually generate 3 documents via Finance Officer
4. Manually sign all 3 documents
5. Manually verify payment via Finance Officer
6. **Do NOT create PAYMENT_UNLOCKED notification** (simulate old data)

### Steps
1. Log in as **winning vendor**
2. Navigate to auction details page
3. Wait for page to load

### Expected Results
- ✅ Backward compatibility check runs
- ✅ Detects all documents are signed
- ✅ Detects payment is verified
- ✅ Detects no PAYMENT_UNLOCKED notification exists
- ✅ Creates PAYMENT_UNLOCKED notification via API
- ✅ Modal appears with pickup details

### Console Logs to Verify
```
🔍 Checking for payment unlocked notification (backward compatibility)...
⚠️  No payment unlocked notification found. This is a backward compatibility case.
🔧 Backward compatibility: Creating payment unlocked notification...
✅ Payment unlocked notification created successfully
✅ Payment unlocked modal triggered (backward compatibility)
```

### Pass Criteria
- Backward compatibility check runs ✅
- Notification created for existing auction ✅
- Modal appears ✅

---

## TEST 7: Consistent Terminology - "Pickup Authorization Code"

### Objective
Verify that all messages use "Pickup Authorization Code" terminology.

### Steps
1. Complete TEST 4 (sign all 3 documents)
2. Check all notification channels

### Expected Results

#### SMS Message
```
✅ Payment complete! Pickup Authorization Code: AUTH-XXXXXXXX. 
Location: NEM Insurance Salvage Yard. Deadline: DD/MM/YYYY. Bring valid ID.
```

#### Email Subject
```
Payment Confirmation - Pickup Authorization Code Included
```

#### Email Body
- ✅ Uses "Pickup Authorization Code" (not "pickup code" or "authorization code")

#### Push Notification
```
Payment Complete!
Pickup Authorization Code: AUTH-XXXXXXXX. Location: NEM Insurance Salvage Yard. Deadline: DD/MM/YYYY
```

#### Modal
- ✅ Section header: "Pickup Authorization"
- ✅ Label: "Authorization Code"
- ✅ Code displayed: AUTH-XXXXXXXX

### Pass Criteria
- All messages use "Pickup Authorization Code" ✅
- No inconsistent terminology ✅

---

## TEST 8: Error Handling - Document Generation Failure

### Objective
Verify that system handles document generation failures gracefully.

### Steps
1. Simulate document generation failure (disconnect Cloudinary)
2. Log in as **Salvage Manager**
3. End an auction manually

### Expected Results
- ✅ Auction closes successfully
- ✅ Error logged in console
- ✅ Finance Officer receives alert email
- ✅ Audit log entry created with error details

### Pass Criteria
- System doesn't crash ✅
- Error is logged ✅
- Finance Officer is notified ✅

---

## TEST 9: Error Handling - Fund Release Failure

### Objective
Verify that system handles fund release failures gracefully.

### Steps
1. Simulate Paystack API failure
2. Sign all 3 documents

### Expected Results
- ✅ Documents signed successfully
- ✅ Error logged in console
- ✅ Finance Officer receives alert email
- ✅ Vendor can retry via Finance Officer dashboard

### Pass Criteria
- System doesn't crash ✅
- Error is logged ✅
- Finance Officer is notified ✅

---

## TEST 10: Performance - Page Load Time

### Objective
Verify that auction details page loads quickly with documents.

### Steps
1. Log in as **winning vendor**
2. Navigate to auction details page
3. Measure page load time

### Expected Results
- ✅ Initial page load: < 2 seconds
- ✅ Document fetch: < 1 second
- ✅ No unnecessary re-renders
- ✅ No console warnings

### Tools
- Chrome DevTools → Network tab
- Chrome DevTools → Performance tab
- React DevTools → Profiler

### Pass Criteria
- Page loads in < 3 seconds total ✅
- No performance warnings ✅

---

## Regression Testing

### Areas to Test
1. ✅ Auction bidding still works
2. ✅ Auction watching still works
3. ✅ Auction countdown timer still works
4. ✅ Auction auto-extension still works
5. ✅ Document signing still works
6. ✅ Document download still works
7. ✅ Payment verification still works
8. ✅ Pickup confirmation still works

---

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| TEST 1: Manual Auction End | ⏳ Pending | |
| TEST 2: Documents Persist | ⏳ Pending | |
| TEST 3: Card Layout | ⏳ Pending | |
| TEST 4: Modal Appears | ⏳ Pending | |
| TEST 5: Modal Persists | ⏳ Pending | |
| TEST 6: Backward Compatibility | ⏳ Pending | |
| TEST 7: Consistent Terminology | ⏳ Pending | |
| TEST 8: Document Error Handling | ⏳ Pending | |
| TEST 9: Fund Release Error Handling | ⏳ Pending | |
| TEST 10: Performance | ⏳ Pending | |

---

## Sign-Off

### Tester Information
- **Tester Name:** _________________
- **Test Date:** _________________
- **Environment:** _________________
- **Browser:** _________________
- **Device:** _________________

### Test Results
- **Total Tests:** 10
- **Passed:** _____
- **Failed:** _____
- **Blocked:** _____

### Overall Status
- [ ] ✅ All tests passed - Ready for production
- [ ] ⚠️ Some tests failed - Needs fixes
- [ ] ❌ Critical failures - Not ready

### Comments
_____________________________________________
_____________________________________________
_____________________________________________

### Approval
- **Approved By:** _________________
- **Date:** _________________
- **Signature:** _________________
