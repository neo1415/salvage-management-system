# Manual Test: PAYMENT_UNLOCKED Notification Routing

## Purpose
Verify that PAYMENT_UNLOCKED notifications route to payment page instead of auction details page.

## Prerequisites
- Access to vendor account
- Completed auction with escrow payment
- All 3 documents signed (to trigger PAYMENT_UNLOCKED notification)

---

## Test Case 1: New Notification with paymentId

### Setup
1. Log in as vendor
2. Win an auction
3. Make escrow payment
4. Sign all 3 documents (liability_waiver, bill_of_sale, pickup_authorization)
5. Wait for PAYMENT_UNLOCKED notification

### Test Steps
1. Open browser console (F12)
2. Click the bell icon (top-right) to open notification dropdown
3. Click the PAYMENT_UNLOCKED notification
4. Observe console logs
5. Check URL in address bar

### Expected Results
✅ Console shows: `Routing to payment page with paymentId: <uuid>`  
✅ URL is: `/vendor/payments/<paymentId>`  
✅ Payment details page loads with:
   - Payment amount
   - Pickup authorization code
   - Pickup location
   - Pickup deadline
   - Document links
✅ No additional routing occurs  
✅ No console errors  

### Actual Results
- [ ] Console log: _______________
- [ ] URL: _______________
- [ ] Page loaded correctly: Yes / No
- [ ] Any errors: _______________

---

## Test Case 2: Notification from Full Page

### Setup
Same as Test Case 1

### Test Steps
1. Navigate to `/notifications` page
2. Find the PAYMENT_UNLOCKED notification
3. Open browser console (F12)
4. Click the notification
5. Observe console logs
6. Check URL in address bar

### Expected Results
✅ Console shows: `Routing to payment page with paymentId: <uuid>`  
✅ URL is: `/vendor/payments/<paymentId>`  
✅ Payment details page loads correctly  
✅ No additional routing occurs  
✅ No console errors  

### Actual Results
- [ ] Console log: _______________
- [ ] URL: _______________
- [ ] Page loaded correctly: Yes / No
- [ ] Any errors: _______________

---

## Test Case 3: Old Notification without paymentId (Fallback)

### Setup
1. Find an old PAYMENT_UNLOCKED notification (created before this fix)
2. Or manually create one using database:
```sql
INSERT INTO notifications (user_id, type, title, message, data, read)
VALUES (
  '<vendor-user-id>',
  'PAYMENT_UNLOCKED',
  'Payment Complete!',
  'Test old notification',
  '{"auctionId": "<auction-id>"}',  -- No paymentId!
  false
);
```

### Test Steps
1. Open browser console (F12)
2. Click the old PAYMENT_UNLOCKED notification
3. Observe console logs
4. Check URL in address bar

### Expected Results
✅ Console shows: `Querying payment by auctionId: <uuid>`  
✅ Console shows: `Found payment, routing to: <paymentId>`  
✅ URL is: `/vendor/payments/<paymentId>`  
✅ Payment details page loads correctly  
✅ No console errors  

### Actual Results
- [ ] Console log 1: _______________
- [ ] Console log 2: _______________
- [ ] URL: _______________
- [ ] Page loaded correctly: Yes / No
- [ ] Any errors: _______________

---

## Test Case 4: Fallback to Auction Details (Payment Not Found)

### Setup
1. Create PAYMENT_UNLOCKED notification with auctionId but no paymentId
2. Delete the payment record from database (or use non-existent auctionId)

### Test Steps
1. Open browser console (F12)
2. Click the notification
3. Observe console logs
4. Check URL in address bar

### Expected Results
✅ Console shows: `Querying payment by auctionId: <uuid>`  
✅ Console shows: `Payment not found, falling back to auction details`  
✅ URL is: `/vendor/auctions/<auctionId>`  
✅ Auction details page loads correctly  
✅ No console errors  

### Actual Results
- [ ] Console log 1: _______________
- [ ] Console log 2: _______________
- [ ] URL: _______________
- [ ] Page loaded correctly: Yes / No
- [ ] Any errors: _______________

---

## Test Case 5: Other Notification Types (Regression)

### Setup
Create notifications of other types:
- outbid
- auction_won
- auction_lost
- payment_reminder

### Test Steps
1. Click each notification type
2. Verify correct routing

### Expected Results
✅ outbid → `/vendor/auctions/<auctionId>`  
✅ auction_won → `/vendor/auctions/<auctionId>`  
✅ auction_lost → `/vendor/auctions/<auctionId>`  
✅ payment_reminder → `/finance/payments` (for finance officer)  

### Actual Results
- [ ] outbid routing: _______________
- [ ] auction_won routing: _______________
- [ ] auction_lost routing: _______________
- [ ] payment_reminder routing: _______________

---

## Test Case 6: Finance Officer payment_reminder

### Setup
1. Log in as finance officer
2. Create payment_reminder notification with vendorId in data

### Test Steps
1. Click the payment_reminder notification
2. Check URL in address bar

### Expected Results
✅ URL is: `/finance/payments`  
✅ Finance payments page loads correctly  
✅ No console errors  

### Actual Results
- [ ] URL: _______________
- [ ] Page loaded correctly: Yes / No
- [ ] Any errors: _______________

---

## Browser Compatibility

Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)

---

## Mobile Testing

Test on mobile devices:
- [ ] iOS Safari
- [ ] Android Chrome

---

## Sign-Off

### Tester Information
- Name: _______________
- Date: _______________
- Environment: Development / Staging / Production

### Test Results Summary
- [ ] All test cases passed
- [ ] Some test cases failed (list below)
- [ ] Ready for production deployment

### Issues Found
1. _______________
2. _______________
3. _______________

### Notes
_______________
_______________
_______________

---

## Quick Debug Commands

### Check notification data in database
```sql
SELECT id, type, title, data, created_at
FROM notifications
WHERE type = 'PAYMENT_UNLOCKED'
ORDER BY created_at DESC
LIMIT 10;
```

### Check payment data
```sql
SELECT id, auction_id, vendor_id, amount, status, escrow_status
FROM payments
WHERE auction_id = '<auction-id>';
```

### Create test notification with paymentId
```sql
INSERT INTO notifications (user_id, type, title, message, data, read)
VALUES (
  '<vendor-user-id>',
  'PAYMENT_UNLOCKED',
  'Payment Complete!',
  'Test notification with paymentId',
  '{"auctionId": "<auction-id>", "paymentId": "<payment-id>", "pickupAuthCode": "AUTH-TEST123"}',
  false
);
```

### Create test notification without paymentId
```sql
INSERT INTO notifications (user_id, type, title, message, data, read)
VALUES (
  '<vendor-user-id>',
  'PAYMENT_UNLOCKED',
  'Payment Complete!',
  'Test old notification without paymentId',
  '{"auctionId": "<auction-id>"}',
  false
);
```

---

## Automated Test (Future)

Consider creating an automated E2E test:
```typescript
// tests/e2e/payment-unlocked-routing.spec.ts
test('PAYMENT_UNLOCKED notification routes to payment page', async ({ page }) => {
  // Setup: Create notification with paymentId
  // Click notification
  // Assert URL is /vendor/payments/{paymentId}
  // Assert page content is correct
});
```
