# Pay Now Button Implementation - Complete

## Overview
Added prominent "Pay Now" buttons as fallback options for vendors when the auction status is `'awaiting_payment'`. This provides better error recovery if the automatic PaymentOptions modal doesn't appear.

## Changes Made

### 1. Updated Auction Status Type
**File:** `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

Added `'awaiting_payment'` to the auction status type:
```typescript
status: 'scheduled' | 'active' | 'extended' | 'closed' | 'awaiting_payment' | 'cancelled';
```

### 2. Added Prominent Payment Banner (Top of Page)
**Location:** Main content area, above PaymentOptions component

Features:
- Gradient burgundy banner with white text
- Large "Pay Now" button that scrolls to payment section
- Shows payment status: "All documents signed! Complete your payment to unlock pickup authorization"
- Highly visible with icon and clear call-to-action

### 3. Added Pay Now Button in Right Column
**Location:** Sticky sidebar, replaces "Place Bid" button when status is `'awaiting_payment'`

Features:
- Animated pulse effect to draw attention
- Gradient burgundy background
- Payment icon
- Scrolls to payment section when clicked
- Only visible to the winning vendor

### 4. Added ID to PaymentOptions Section
**Purpose:** Enable smooth scrolling from Pay Now buttons

```typescript
<div id="payment-options-section">
  <PaymentOptions ... />
</div>
```

## User Experience Flow

### When Documents Are All Signed:

1. **Auction status updates to `'awaiting_payment'`** (handled by document.service.ts line 442)
2. **Vendor sees TWO prominent "Pay Now" buttons:**
   - Top banner: Full-width gradient banner with payment info
   - Right sidebar: Animated button in the sticky action panel
3. **Clicking either button:**
   - Smoothly scrolls to the PaymentOptions component
   - Vendor can choose payment method (wallet, paystack, or hybrid)
4. **PaymentOptions component shows:**
   - Payment breakdown
   - Available payment methods
   - Clear action buttons

## Error Recovery

If the PaymentOptions modal doesn't appear automatically:
- Vendor can click "Pay Now" button in banner (most visible)
- Vendor can click "Pay Now" button in sidebar (always accessible)
- Both buttons scroll to the payment section
- No need to refresh or navigate away

## Technical Details

### Status Flow:
1. `'closed'` → Documents pending signature
2. All documents signed → Status updates to `'awaiting_payment'`
3. Payment completed → Status updates to next phase

### Conditional Rendering:
```typescript
{auction.status === 'awaiting_payment' && 
 session?.user?.vendorId && 
 auction.currentBidder === session.user.vendorId && (
  // Show Pay Now buttons and PaymentOptions
)}
```

### Scroll Behavior:
```typescript
const paymentSection = document.getElementById('payment-options-section');
if (paymentSection) {
  paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

## Verification

### Database Schema:
- ✅ `'awaiting_payment'` exists in `auction_status` enum (added via migration)
- ✅ Schema file updated: `src/lib/db/schema/auctions.ts`

### Document Service:
- ✅ Updates status to `'awaiting_payment'` after all docs signed
- ✅ Sends notification to vendor
- ✅ File: `src/features/documents/services/document.service.ts` (line 442)

### API Route:
- ✅ Auto-payment removed from document sign route
- ✅ File: `src/app/api/auctions/[id]/documents/sign/route.ts`

## Testing Checklist

- [ ] Create auction and win it
- [ ] Sign all documents
- [ ] Verify status changes to `'awaiting_payment'`
- [ ] Verify TWO "Pay Now" buttons appear
- [ ] Click top banner "Pay Now" button → scrolls to payment section
- [ ] Click sidebar "Pay Now" button → scrolls to payment section
- [ ] Verify PaymentOptions component is visible
- [ ] Complete payment with wallet/paystack/hybrid
- [ ] Verify payment processes correctly

## Related Files

### Modified:
- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - Added Pay Now buttons and updated type

### Referenced (No Changes):
- `src/components/vendor/payment-options.tsx` - Payment method selection component
- `src/lib/db/schema/auctions.ts` - Auction status enum
- `src/features/documents/services/document.service.ts` - Status update logic
- `src/app/api/auctions/[id]/documents/sign/route.ts` - Document signing API

## Summary

The Pay Now button implementation provides multiple fallback options for vendors to access the payment flow. With two prominent buttons (banner and sidebar), vendors can easily find and trigger the payment process even if automatic modal display fails. The smooth scrolling behavior ensures a seamless user experience.
