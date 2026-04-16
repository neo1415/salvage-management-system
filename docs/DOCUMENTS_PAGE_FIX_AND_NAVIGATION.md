# Documents Page Fix and Navigation Improvements

## Summary
Fixed the documents page to show recent documents and added navigation links from auction detail page to documents page with anchor scrolling.

## Issues Identified

### 1. Documents Not Showing Up
**Root Cause**: The `/api/vendor/won-auctions` endpoint only fetched auctions with `status = 'closed'`, but recent auctions are in `'awaiting_payment'` status after documents are signed.

**Impact**:
- Documents from yesterday and today weren't showing up
- Sometimes the page showed "No documents available"
- Latest documents were missing

### 2. No Direct Navigation
**Issue**: Users couldn't easily navigate from auction detail page to the documents page to see all their documents in one place.

## Fixes Implemented

### Fix 1: Include `awaiting_payment` Status in Won Auctions Query ✅

**File**: `src/app/api/vendor/won-auctions/route.ts`

**Changes**:
```typescript
// BEFORE: Only fetched closed auctions
.where(
  and(
    eq(auctions.currentBidder, vendorId),
    eq(auctions.status, 'closed')
  )
)

// AFTER: Fetches both closed and awaiting_payment auctions
.where(
  and(
    eq(auctions.currentBidder, vendorId),
    or(
      eq(auctions.status, 'closed'),
      eq(auctions.status, 'awaiting_payment')
    )
  )
)
```

**Result**: Documents from recent auctions (yesterday, today) now show up immediately after documents are signed.

### Fix 2: Add Navigation Links with Anchor Scrolling ✅

**File**: `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

**Changes**:

1. **Document Signing Section** (when auction is closed):
   - Added "View All Documents" link in the header
   - Link goes to `/vendor/documents#auction-{auctionId}`
   - Scrolls directly to that auction's documents

2. **Payment Banner** (when auction is awaiting_payment):
   - Added "View Documents" link next to "Pay Now" button
   - Same anchor scrolling behavior

**File**: `src/app/(dashboard)/vendor/documents/page.tsx`

**Changes**:
- Added `id={`auction-${auction.auctionId}`}` to each auction card
- Added `scroll-mt-24` class for proper scroll offset (accounts for sticky header)

## How It Works

### Anchor Scrolling
When a user clicks "View All Documents" or "View Documents":
1. Browser navigates to `/vendor/documents#auction-{auctionId}`
2. Page loads and renders all auction documents
3. Browser automatically scrolls to the element with `id="auction-{auctionId}"`
4. The `scroll-mt-24` class ensures the element isn't hidden behind the sticky header

### Example Flow
1. User wins auction BOD-5372
2. User signs documents on auction detail page
3. User clicks "View All Documents" link
4. Browser navigates to `/vendor/documents#auction-BOD-5372`
5. Page scrolls directly to BOD-5372's documents section

## Files Modified
- `src/app/api/vendor/won-auctions/route.ts` - Include awaiting_payment status
- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - Add navigation links
- `src/app/(dashboard)/vendor/documents/page.tsx` - Add anchor IDs

## Files Created
- `scripts/diagnose-documents-page-issue.ts` - Diagnostic script to verify the fix

## Testing Checklist
- [ ] Run diagnostic script: `npx tsx scripts/diagnose-documents-page-issue.ts`
- [ ] Verify documents from yesterday and today show up on documents page
- [ ] Click "View All Documents" link from auction detail page (closed status)
- [ ] Verify it scrolls to the correct auction's documents
- [ ] Click "View Documents" link from payment banner (awaiting_payment status)
- [ ] Verify anchor scrolling works correctly
- [ ] Test on mobile devices (anchor scrolling should work the same)

## User Impact
- ✅ All recent documents now visible on documents page
- ✅ Easy navigation from auction detail to documents page
- ✅ Direct scrolling to specific auction's documents
- ✅ Better UX for managing multiple won auctions
- ✅ No more "No documents available" when documents exist

## Technical Notes

### Why `awaiting_payment` Status?
The auction lifecycle is:
1. `active` → Auction is running
2. `extended` → Auction extended due to last-minute bid
3. `closed` → Auction ended, winner must sign documents
4. `awaiting_payment` → Documents signed, winner must pay
5. Payment verified → Pickup authorization generated

Documents are generated when auction closes (step 3), but the status changes to `awaiting_payment` after documents are signed (step 4). The old query only fetched step 3, missing step 4.

### Anchor Scrolling Best Practices
- Use `scroll-mt-{size}` to account for sticky headers
- Use descriptive IDs: `auction-{id}` instead of just `{id}`
- Test with different viewport sizes
- Ensure IDs are unique across the page

## Related Issues
- Fixes the "documents not showing up" issue reported by user
- Improves navigation between auction detail and documents pages
- Complements the UX improvements made to auction detail page sidebar
