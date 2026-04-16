# Pickup Modal Diagnostic Guide

## Problem
Payment webhook works via ngrok, payment is verified, pickup email is sent, BUT the pickup authorization modal doesn't appear on the auction page.

## Root Cause Analysis

The modal has **5 conditions** that must ALL be true for it to show:

1. ✅ Auction status = `awaiting_payment`
2. ✅ User is authenticated with vendorId
3. ✅ User is the winner (currentBidder matches vendorId)
4. ❌ **PAYMENT_UNLOCKED notification exists** (LIKELY ISSUE)
5. ❌ **localStorage not blocking** (POSSIBLE ISSUE)

## Diagnostic Steps

### Step 1: Run Comprehensive Diagnostic

```bash
npx tsx scripts/diagnose-modal-issue.ts <auctionId>
```

This will check:
- Auction status
- Winner details
- Payment record
- PAYMENT_UNLOCKED notification
- localStorage blockers

### Step 2: Check Browser Console

Open the auction page and look for these logs:

**Good signs:**
```
🔍 Checking for existing payment unlocked notification...
✅ Payment unlocked notification found
✅ Payment unlocked modal triggered from existing notification
```

**Bad signs:**
```
⏸️  Payment page already visited. Skipping modal.
```

### Step 3: Check localStorage

Open browser console and run:
```javascript
// Check if payment page was visited
localStorage.getItem('payment-visited-<paymentId>')

// Check if modal was dismissed
localStorage.getItem('payment-unlocked-modal-<paymentId>-dismissed')

// Clear both if they exist
localStorage.removeItem('payment-visited-<paymentId>')
localStorage.removeItem('payment-unlocked-modal-<paymentId>-dismissed')
```

### Step 4: Check Notification Creation

The notification is created in `src/features/documents/services/document.service.ts` in the `triggerFundReleaseOnDocumentCompletion` function.

Look for these logs:
```
✅ All documents signed for auction <auctionId>. Proceeding with fund release...
🔓 Releasing ₦X from vendor wallet...
✅ Funds released successfully via Paystack
✅ Payment status updated to 'verified'
✅ Payment complete notifications sent to vendor
   - Push: PAYMENT_UNLOCKED notification (triggers modal)
```

If you don't see these logs, fund release didn't complete.

## Common Issues & Fixes

### Issue 1: Notification Never Created

**Symptom:** Diagnostic shows "NO NOTIFICATION FOUND"

**Cause:** Fund release failed or didn't run

**Fix:**
1. Check if all documents are signed (bill_of_sale, liability_waiver)
2. Check if payment record exists with status='verified'
3. Check document service logs for errors
4. Manually trigger fund release if needed

### Issue 2: localStorage Blocking Modal

**Symptom:** Notification exists but modal doesn't show

**Cause:** User visited payment page or dismissed modal before

**Fix:**
```javascript
// Clear localStorage in browser console
localStorage.clear()
// OR specifically:
localStorage.removeItem('payment-visited-<paymentId>')
localStorage.removeItem('payment-unlocked-modal-<paymentId>-dismissed')
```

Then hard refresh (Ctrl+Shift+R)

### Issue 3: Auction Status Wrong

**Symptom:** Auction status is not "awaiting_payment"

**Cause:** Status update failed after document signing

**Fix:**
```sql
-- Check current status
SELECT id, status, "currentBidder", "currentBid" 
FROM auctions 
WHERE id = '<auctionId>';

-- Update if needed
UPDATE auctions 
SET status = 'awaiting_payment', "updatedAt" = NOW()
WHERE id = '<auctionId>';
```

### Issue 4: Polling Not Working

**Symptom:** No console logs every 5 seconds

**Cause:** useEffect dependencies or cleanup issue

**Fix:** Hard refresh the page (Ctrl+Shift+R)

## Testing the Fix

1. **Clear localStorage:**
   ```javascript
   localStorage.clear()
   ```

2. **Hard refresh page:**
   - Windows: Ctrl+Shift+R
   - Mac: Cmd+Shift+R

3. **Watch console for:**
   ```
   🔍 Checking for existing payment unlocked notification...
   ✅ Payment unlocked notification found
   ✅ Payment unlocked modal triggered from existing notification
   ```

4. **Modal should appear within 5 seconds**

## Modal Trigger Flow

```
User loads auction page
  ↓
useEffect runs (checks every 5 seconds)
  ↓
Fetch /api/notifications?unreadOnly=false&limit=50
  ↓
Find PAYMENT_UNLOCKED notification for this auction
  ↓
Check localStorage (payment-visited-<paymentId>)
  ↓
If NOT visited → Show modal
  ↓
User clicks "View Payment Details"
  ↓
Set localStorage('payment-visited-<paymentId>', 'true')
  ↓
Navigate to /vendor/payments/<paymentId>
  ↓
Modal won't show again
```

## Quick Fix Script

If notification exists but modal won't show, run this in browser console:

```javascript
// 1. Clear localStorage
localStorage.clear();

// 2. Force reload
location.reload(true);

// 3. If still not working, check notification manually
fetch('/api/notifications?unreadOnly=false&limit=50')
  .then(r => r.json())
  .then(data => {
    const paymentNotif = data.data.notifications.find(n => 
      n.type === 'PAYMENT_UNLOCKED'
    );
    console.log('PAYMENT_UNLOCKED notification:', paymentNotif);
  });
```

## Files Involved

1. **Modal Component:**
   - `src/components/modals/payment-unlocked-modal.tsx`

2. **Trigger Logic:**
   - `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`
   - Lines 541-616 (checkForExistingPaymentNotification)

3. **Notification Creation:**
   - `src/features/documents/services/document.service.ts`
   - Function: `triggerFundReleaseOnDocumentCompletion`
   - Lines 1100-1150 (notification creation)

4. **Notification Service:**
   - `src/features/notifications/services/notification.service.ts`
   - Function: `createNotification`

## Next Steps

1. Run diagnostic script with actual auction ID
2. Check browser console logs
3. Clear localStorage if needed
4. Verify notification exists in database
5. If notification missing, check fund release logs
6. If all else fails, manually create notification

## Manual Notification Creation (Last Resort)

If you need to manually create the notification:

```typescript
import { createNotification } from '@/features/notifications/services/notification.service';

await createNotification({
  userId: '<userId>',
  type: 'PAYMENT_UNLOCKED',
  title: 'Payment Complete!',
  message: 'Pickup Authorization Code: AUTH-XXXXXXXX',
  data: {
    auctionId: '<auctionId>',
    paymentId: '<paymentId>',
    pickupAuthCode: 'AUTH-XXXXXXXX',
    pickupLocation: 'NEM Insurance Salvage Yard',
    pickupDeadline: '2024-XX-XX',
  },
});
```

## Success Criteria

✅ Diagnostic script shows all checks passing
✅ Browser console shows notification found
✅ Modal appears within 5 seconds of page load
✅ Modal shows correct pickup code and details
✅ Clicking "View Payment Details" navigates correctly
✅ Modal doesn't show again after visiting payment page
