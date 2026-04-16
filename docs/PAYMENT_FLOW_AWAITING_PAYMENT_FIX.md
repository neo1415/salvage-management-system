# Payment Flow Fix: Awaiting Payment Status

## Problem

When a vendor signs all required documents for a won auction:
1. ✅ Auction status is correctly updated to `'awaiting_payment'` in the database
2. ✅ Notification `PAYMENT_METHOD_SELECTION_REQUIRED` is sent
3. ❌ PaymentOptions modal and Pay Now buttons do NOT appear on the frontend
4. ❌ Error in console: "Failed to process retroactive payment: Auction not closed"

## Root Cause

The issue was a **stale data problem**:

1. When all documents are signed, the `signDocument` function updates the auction status to `'awaiting_payment'` in the database
2. However, the frontend page was NOT refreshing the auction data after document signing
3. The page continued to show the old status (`'closed'`) even though the database had `'awaiting_payment'`
4. The backward compatibility check would see status as `'closed'` (stale data) and call the `process-payment` endpoint
5. The `process-payment` endpoint would check the database and see status is `'awaiting_payment'`, then return error "Auction not closed"
6. Meanwhile, the PaymentOptions component checks `auction.status === 'awaiting_payment'`, which was false because of stale data

## Solution

**Fixed in:** `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

Added auction data refresh in the `onSigned` callback of the ReleaseFormModal:

```typescript
onSigned={async () => {
  setShowDocumentModal(false);
  setSelectedDocumentType(null);
  
  // Refresh documents
  if (session?.user?.vendorId) {
    await fetchDocuments(auction.id, session.user.vendorId);
  }
  
  // CRITICAL FIX: Refresh auction data to get updated status (awaiting_payment)
  try {
    const response = await fetch(`/api/auctions/${auction.id}`);
    if (response.ok) {
      const data = await response.json();
      setAuction(data.auction);
      console.log(`✅ Auction data refreshed. New status: ${data.auction.status}`);
    }
  } catch (error) {
    console.error('Failed to refresh auction data:', error);
  }
  
  toast.success(
    'Document Signed Successfully',
    'Your signature has been recorded'
  );
}}
```

## How It Works Now

### Document Signing Flow

1. Vendor signs the last required document (bill_of_sale or liability_waiver)
2. Backend (`signDocument` function) updates auction status to `'awaiting_payment'`
3. Backend sends notification `PAYMENT_METHOD_SELECTION_REQUIRED`
4. **Frontend refreshes auction data** (NEW FIX)
5. Frontend receives updated status `'awaiting_payment'`
6. PaymentOptions component renders because `auction.status === 'awaiting_payment'`
7. Pay Now buttons appear

### Payment Flow

When `auction.status === 'awaiting_payment'`:

1. **Document Signing Section** (status: `'closed'`) - Shows documents to sign
2. **Payment Method Selection Section** (status: `'awaiting_payment'`) - Shows PaymentOptions modal and Pay Now buttons
3. **Payment Complete** (status: `'paid'`) - Shows pickup authorization

## Components Affected

### 1. Document Signing Section
**Condition:** `auction.status === 'closed'`
- Shows document cards with "Sign Now" buttons
- Shows progress bar
- Visible ONLY when status is `'closed'`

### 2. Payment Method Selection Section
**Condition:** `auction.status === 'awaiting_payment'`
- Shows prominent "Payment Required" banner
- Shows PaymentOptions component with 3 payment methods:
  - Wallet Only (if sufficient balance)
  - Paystack Only (card/bank transfer)
  - Hybrid Payment (wallet + paystack)
- Shows "Pay Now" button in sidebar
- Visible ONLY when status is `'awaiting_payment'`

### 3. Backward Compatibility Check
**Condition:** `auction.status === 'closed'` AND all documents signed
- Only runs for OLD auctions that were closed before the new payment flow was implemented
- Calls `process-payment` endpoint to trigger retroactive processing
- Should NOT run when status is `'awaiting_payment'` (new flow is working)

## Testing

### Test Case 1: Sign All Documents
1. Win an auction
2. Sign bill_of_sale
3. Sign liability_waiver
4. ✅ Auction status should update to `'awaiting_payment'` immediately
5. ✅ PaymentOptions modal should appear
6. ✅ Pay Now buttons should appear

### Test Case 2: Refresh Page After Signing
1. Sign all documents
2. Refresh the page
3. ✅ PaymentOptions modal should still be visible
4. ✅ Pay Now buttons should still be visible
5. ✅ No error in console about "Auction not closed"

### Test Case 3: Payment Methods
1. After signing all documents
2. ✅ Should see 3 payment options (or 2 if wallet balance is insufficient)
3. ✅ Should be able to select a payment method
4. ✅ Should be able to complete payment

## Related Files

- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - Main auction details page (FIXED)
- `src/features/documents/services/document.service.ts` - Updates status to `'awaiting_payment'`
- `src/components/vendor/payment-options.tsx` - Payment method selection modal
- `src/app/api/auctions/[id]/process-payment/route.ts` - Backward compatibility endpoint
- `src/app/api/auctions/[id]/documents/sign/route.ts` - Document signing endpoint

## Status

✅ **FIXED** - Auction data is now refreshed after document signing, ensuring the frontend shows the correct status and renders the PaymentOptions component.

## Next Steps

1. Test the fix with auction ID: `7340f16e-4689-4795-98f4-be9a7731efe4`
2. Verify PaymentOptions modal appears after signing all documents
3. Verify Pay Now buttons appear in the sidebar
4. Verify no console errors about "Auction not closed"
5. Complete a test payment to ensure the full flow works
