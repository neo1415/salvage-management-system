# Payment Verification Cache Staleness Fix

## Problem
After completing Paystack payment for an auction, the UI still showed the "Pay Now" banner instead of the "Payment Complete" banner, even though:
- Payment went through successfully
- Finance dashboard showed the payment
- Wallet showed the debit
- User received email confirmation

## Root Cause
**Service Worker (PWA) Cache Staleness** - Same issue as document signing bug!

The payment service was updating the database correctly:
1. Paystack webhook marks payment as `verified`
2. Database shows `hasVerifiedPayment: true`

BUT the auction API response was being cached by the service worker with `hasVerifiedPayment: false`, and this stale cache was being served to the frontend.

### Evidence from Console Logs
```
workbox Using NetworkFirst to respond to '/api/auctions/50d96c73-21a5-4a20-990d-557ca32283d0'
workbox Using StaleWhileRevalidate to respond to '/_next/static/chunks/...'
```

The service worker was serving cached responses that didn't reflect the payment verification.

## Solution
Added cache invalidation in `payment.service.ts` after payment verification, exactly like we did for document signing:

### 1. Paystack Webhook Handler
```typescript
// In handlePaystackWebhook() after payment verification
await depositNotificationService.sendPaymentConfirmationNotification(paymentInfo);
await this.generatePickupAuthorization(paymentInfo);

// CRITICAL: Invalidate auction cache so UI shows hasVerifiedPayment: true
console.log(`🗑️ Invalidating auction cache...`);
const { cache } = await import('@/lib/redis/client');
await cache.del(`auction:details:${auctionId}`);
console.log(`✅ Auction cache invalidated`);

console.log(`✅ Payment processing complete for auction ${auctionId}`);
```

### 2. Wallet Payment Handler
```typescript
// In processWalletPayment() after payment completion
await depositNotificationService.sendPaymentConfirmationNotification({
  vendorId,
  auctionId,
  amount: finalBid,
});

await this.generatePickupAuthorization({
  vendorId,
  auctionId,
  amount: finalBid,
});

// CRITICAL: Invalidate auction cache so UI shows hasVerifiedPayment: true
console.log(`🗑️ Invalidating auction cache...`);
const { cache } = await import('@/lib/redis/client');
await cache.del(`auction:details:${auctionId}`);
console.log(`✅ Auction cache invalidated`);

return result;
```

## Files Modified
- `src/features/auction-deposit/services/payment.service.ts`
  - Added cache invalidation in `handlePaystackWebhook()` (line ~646)
  - Added cache invalidation in `processWalletPayment()` (line ~327)

## Testing
1. Complete a Paystack payment for an auction
2. Get redirected back with `?payment=success`
3. **Before fix**: UI shows "Pay Now" banner (stale cache)
4. **After fix**: UI immediately shows "Payment Complete" banner (cache invalidated)

## Related Issues
This is the **second occurrence** of this cache staleness pattern:
1. **First**: Document signing status reverting from `awaiting_payment` to `closed`
2. **Second**: Payment verification not showing "Payment Complete" banner

Both were caused by service worker caching and both were fixed by adding cache invalidation after database updates.

## Prevention
**Pattern to follow**: Whenever you update auction status or related data (documents, payments, etc.), ALWAYS invalidate the auction cache:

```typescript
const { cache } = await import('@/lib/redis/client');
await cache.del(`auction:details:${auctionId}`);
```

This ensures the frontend gets fresh data on the next API call.

## User Impact
- **Before**: Users had to manually refresh the page to see payment verification
- **After**: Payment verification shows immediately after Paystack redirect
- **Benefit**: Better UX, no confusion about payment status
