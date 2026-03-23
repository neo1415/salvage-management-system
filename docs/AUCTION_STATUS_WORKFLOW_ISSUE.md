# Auction Status Workflow Issue

## Problem Identified

Currently, auctions are marked as `status='closed'` immediately when the auction timer ends, even though the payment hasn't been approved by Finance yet. This causes them to appear in the "Completed" tab prematurely.

## Current Flow (INCORRECT)
1. Auction timer ends
2. Cron job runs `auctionClosureService.closeAuction()`
3. Auction status → `'closed'` ✅
4. Payment record created with `status='pending'`
5. Auction appears in "Completed" tab ❌ (TOO EARLY!)
6. Finance approves payment later
7. Payment status → `'verified'`

## Correct Flow (SHOULD BE)
1. Auction timer ends
2. Cron job runs
3. Auction status → `'pending_payment'` or `'awaiting_payment'` ✅
4. Payment record created with `status='pending'`
5. Auction does NOT appear in "Completed" tab ✅
6. Finance approves payment
7. Payment status → `'verified'`
8. Auction status → `'closed'` ✅
9. NOW auction appears in "Completed" tab ✅

## Solution Options

### Option 1: Add New Auction Status
Add a new status to the auctions table:
- `'pending_payment'` - Auction ended, waiting for payment verification
- Only mark as `'closed'` after Finance approves

### Option 2: Use Payment Status for Filtering
Keep auction as `'closed'`, but filter "Completed" tab to only show auctions where:
- `auction.status = 'closed'` AND
- `payment.status = 'verified'`

### Option 3: Add Completion Timestamp
Add `completedAt` field that only gets set when payment is verified.
Filter "Completed" tab by `completedAt IS NOT NULL`

## Recommended Solution
**Option 2** is simplest and doesn't require schema changes:
- Update `/api/auctions` route for `tab='completed'`
- Join with payments table
- Filter: `auction.status='closed' AND payment.status='verified'`

## Files to Update
1. `src/app/api/auctions/route.ts` - Update "completed" tab logic
2. `src/lib/db/schema/auctions.ts` - Consider adding new status (if Option 1)
3. `src/features/payments/services/escrow.service.ts` - Update auction status when payment verified

## Related Issues Fixed This Session
1. ✅ Fixed auction closure bug - now correctly sets `paymentMethod='escrow_wallet'` when funds are frozen
2. ✅ Fixed Next.js image hostname configuration for external URLs
3. ✅ Added SSL verification bypass for development mode

## Next Steps
1. Decide on solution approach (Option 1, 2, or 3)
2. Implement the chosen solution
3. Test that "Completed" tab only shows fully paid auctions
4. Verify "My Bids" and "Won" tabs still work correctly
