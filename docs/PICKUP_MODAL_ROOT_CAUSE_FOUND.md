# Pickup Modal Root Cause - FOUND!

## Problem
Payment webhook works via ngrok, payment IS verified, pickup email IS sent, BUT pickup authorization modal doesn't appear.

## Root Cause Identified

**The PAYMENT_UNLOCKED notification is NEVER created for Paystack payments!**

### Evidence
Ran diagnostic on auction `fb4f456c-ae29-4adf-9539-9a52ddf2457f`:
- ✅ Auction status: `awaiting_payment` 
- ✅ Payment status: `verified`
- ✅ Payment method: `paystack`
- ✅ Payment amount: ₦390,000
- ❌ **NO PAYMENT_UNLOCKED notification exists for this auction**

### Why This Happens

There are TWO payment flows:

#### Flow 1: Escrow Wallet (WORKS)
```
Documents signed → triggerFundReleaseOnDocumentCompletion() 
→ Release funds from escrow → Update payment to verified 
→ CREATE PAYMENT_UNLOCKED NOTIFICATION ✅
→ Modal appears ✅
```

#### Flow 2: Paystack (BROKEN)
```
Paystack webhook → Verify payment → Update payment to verified
→ Send pickup email ✅
→ NO NOTIFICATION CREATED ❌
→ Modal never appears ❌
```

### The Code Gap

**Document Service** (`src/features/documents/services/document.service.ts`):
- Lines 1100-1150: Creates PAYMENT_UNLOCKED notification
- Only called when documents are signed (escrow wallet flow)
- NOT called by Paystack webhook

**Paystack Webhook** (`src/app/api/webhooks/paystack-auction/route.ts`):
- Verifies payment ✅
- Sends pickup email ✅  
- Does NOT create PAYMENT_UNLOCKED notification ❌

## The Fix

Add notification creation to the Paystack webhook handler after payment verification.

### Location
`src/app/api/webhooks/paystack-auction/route.ts`

### What to Add
After payment is verified and pickup email is sent, add:

```typescript
// Create PAYMENT_UNLOCKED notification for modal
const { createNotification } = await import('@/features/notifications/services/notification.service');
await createNotification({
  userId: user.id,
  type: 'PAYMENT_UNLOCKED',
  title: 'Payment Complete!',
  message: `Pickup Authorization Code: ${pickupAuthCode}. Location: ${pickupLocation}. Deadline: ${pickupDeadline}`,
  data: {
    auctionId: auction.id,
    paymentId: payment.id,
    pickupAuthCode,
    pickupLocation,
    pickupDeadline,
  },
});
```

## Testing the Fix

1. Make a Paystack payment via ngrok webhook
2. Run diagnostic: `npx tsx scripts/diagnose-modal-issue.ts <auctionId>`
3. Should see: "✅ Notification found" with correct auction ID
4. Load auction page - modal should appear within 5 seconds
5. Modal should show pickup code, location, and deadline

## Why Email Works But Modal Doesn't

The pickup email is sent directly in the webhook handler:
```typescript
await emailService.sendPaymentConfirmationEmail(...)
```

But the modal requires a PAYMENT_UNLOCKED notification in the database:
```typescript
// Modal checks for this every 5 seconds
const notification = notifications.find(n => 
  n.type === 'PAYMENT_UNLOCKED' && 
  n.data?.auctionId === auctionId
);
```

Without the notification, the modal never triggers.

## Impact

ALL Paystack payments since the webhook was implemented are missing the pickup modal. Users get the email but not the in-app modal experience.

Affected auctions (from recent check):
- fb4f456c... - ₦390,000 - NO notification
- 4eb153b1... - ₦130,000 - NO notification  
- 091f2626... - ₦400,000 - HAS notification (older, different flow?)
- af6e9385... - ₦300,000 - NO notification
- ea06c5e4... - ₦330,000 - NO notification

## Next Steps

1. Fix the Paystack webhook to create notifications
2. Optionally: Create retroactive notifications for existing verified payments
3. Test with new payment via ngrok
4. Verify modal appears correctly

## Files to Modify

1. `src/app/api/webhooks/paystack-auction/route.ts` - Add notification creation
2. Optional: Create script to add notifications for existing payments
