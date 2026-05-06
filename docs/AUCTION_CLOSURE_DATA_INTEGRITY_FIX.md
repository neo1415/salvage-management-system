# Auction Closure Data Integrity Fix

## Problem Summary

When an auction closes, the system should:
1. Create winner record in `auction_winners` table
2. Update `auction.currentBidderId` field
3. Transition auction status to `closed`

However, in some cases, the auction transitions to `closed` status WITHOUT creating the winner record, causing the payment flow to break with a 404 error.

## Root Cause

The `closure.service.ts` calls `auctionClosureService.closeAuction()` (which creates winner records), but wraps it in a try-catch that **swallows errors**:

```typescript
// STEP 3: Handle deposit system logic
try {
  const { auctionClosureService: depositClosureService } = await import('./auction-closure.service');
  const depositResult = await depositClosureService.closeAuction(auctionId);
  
  if (depositResult.success) {
    console.log(`✅ Deposit system closure complete`);
  } else {
    console.warn(`⚠️  Deposit system closure had issues: ${depositResult.error}`);
    // Don't fail the entire closure if deposit logic fails - log for manual review
  }
} catch (error) {
  console.error(`❌ Failed to execute deposit system closure:`, error);
  // Don't fail the entire closure - log for manual review
}

// STEP 4: Update auction status to 'closed' (happens even if above fails!)
await db.update(auctions).set({ status: 'closed' }).where(eq(auctions.id, auctionId));
```

**The Problem**: If `auctionClosureService.closeAuction()` fails, the error is logged but the auction STILL gets marked as `closed`. This leaves the auction in an inconsistent state:
- ✅ Auction status: `closed`
- ❌ Winner record: NOT CREATED
- ❌ `auction.currentBidderId`: NULL

## Impact

When a vendor tries to pay for the auction:
1. They click "Pay Now"
2. UI calls `GET /api/auctions/[id]/payment/calculate`
3. Endpoint checks for active winner record
4. **No winner record found → 404 error**
5. Payment modal shows "Failed to load payment information"

## Immediate Fix (Manual)

For affected auctions, run the fix script:

```bash
npx tsx scripts/fix-auction-closure-data-integrity.ts
```

This script:
1. Updates `auction.currentBidderId` with the winning vendor
2. Creates the missing winner record in `auction_winners` table
3. Preserves deposit information if available

## Permanent Fix (Code Change)

### Option 1: Make Winner Record Creation Critical (RECOMMENDED)

Change the error handling to FAIL the closure if winner record creation fails:

```typescript
// STEP 3: Handle deposit system logic (CRITICAL - must succeed)
try {
  const { auctionClosureService: depositClosureService } = await import('./auction-closure.service');
  const depositResult = await depositClosureService.closeAuction(auctionId);
  
  if (!depositResult.success) {
    throw new Error(`Deposit system closure failed: ${depositResult.error}`);
  }
  
  console.log(`✅ Deposit system closure complete for auction ${auctionId}`);
  console.log(`   - Top bidders: ${depositResult.topBiddersCount} (deposits kept frozen)`);
  console.log(`   - Unfrozen bidders: ${depositResult.unfrozenBiddersCount}`);
} catch (error) {
  console.error(`❌ CRITICAL: Failed to execute deposit system closure for auction ${auctionId}:`, error);
  // FAIL the entire closure - don't mark auction as closed
  throw error;
}

// STEP 4: Update auction status to 'closed' (only if above succeeds)
await db.update(auctions).set({ status: 'closed' }).where(eq(auctions.id, auctionId));
```

### Option 2: Create Winner Record as Fallback

If deposit closure fails, create a basic winner record before marking as closed:

```typescript
// STEP 3: Handle deposit system logic
let depositClosureSucceeded = false;
try {
  const { auctionClosureService: depositClosureService } = await import('./auction-closure.service');
  const depositResult = await depositClosureService.closeAuction(auctionId);
  
  if (depositResult.success) {
    depositClosureSucceeded = true;
    console.log(`✅ Deposit system closure complete`);
  }
} catch (error) {
  console.error(`❌ Failed to execute deposit system closure:`, error);
}

// FALLBACK: If deposit closure failed, create basic winner record
if (!depositClosureSucceeded && auction.currentBidder) {
  console.warn(`⚠️  Creating fallback winner record for auction ${auctionId}`);
  await db.insert(auctionWinners).values({
    auctionId,
    vendorId: auction.currentBidder,
    bidAmount: auction.currentBid,
    depositAmount: '0.00', // Unknown - will be calculated later
    rank: 1,
    status: 'active',
  });
}

// STEP 4: Update auction status to 'closed'
await db.update(auctions).set({ status: 'closed' }).where(eq(auctions.id, auctionId));
```

## Recommendation

**Use Option 1** - Make winner record creation critical. If it fails, the auction should NOT be marked as closed. This ensures data integrity and allows the closure to be retried.

## Prevention

Add a database constraint to ensure `auction_winners` record exists before allowing `auction.status = 'closed'`:

```sql
-- Add check constraint (PostgreSQL)
ALTER TABLE auctions
ADD CONSTRAINT check_closed_has_winner
CHECK (
  status != 'closed' OR 
  currentBidder IS NULL OR 
  EXISTS (
    SELECT 1 FROM auction_winners 
    WHERE auction_id = id AND status = 'active'
  )
);
```

## Testing

After implementing the fix, test:

1. **Normal closure**: Auction closes successfully with winner record
2. **No bids closure**: Auction closes without winner record (expected)
3. **Failed winner creation**: Auction remains in `active` status (not marked as `closed`)
4. **Payment flow**: Winner can access payment modal and complete payment

## Files Modified

- `src/features/auctions/services/closure.service.ts` - Error handling for deposit closure
- `scripts/fix-auction-closure-data-integrity.ts` - Manual fix script for affected auctions

## Related Issues

- Payment modal 404 error
- "Failed to load payment information" error
- Auctions stuck in `closed` status without winner records
