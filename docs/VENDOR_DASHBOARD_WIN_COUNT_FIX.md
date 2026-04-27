# Vendor Dashboard Win Count Fix

## Issue Summary

Vendor statistics (win counts) were stuck and not updating for the past 2+ weeks. The win count remained at 11 despite vendors winning additional auctions.

## Root Cause

The system has two ways of tracking auction winners:

1. **Legacy System**: `auctions.currentBidder` field (used for old auctions)
2. **New Deposit System**: `auction_winners` table with `rank=1` (used for new auctions since deposit system was implemented)

Both the vendor dashboard API and leaderboard API were only counting wins from the legacy system using `auctions.currentBidder`, completely missing wins from the new deposit system.

## Impact

Vendors who won auctions after the deposit system was implemented were not seeing their win counts increase. For example:
- "The Vendor" had 11 legacy wins + 11 deposit wins = **22 total wins** (was showing only 11)
- "Master" had 11 legacy wins + 6 deposit wins = **17 total wins** (was showing only 11)

This affected:
- Win Rate calculation
- Total Wins display
- Leaderboard rankings
- Badge eligibility (e.g., "10 Wins" badge)

## Solution

**This is a PERMANENT fix** - no scripts need to be run after each auction.

Updated both the vendor dashboard API and leaderboard API to count wins from **both systems** automatically on every request:

### Files Modified

1. **`src/app/api/dashboard/vendor/route.ts`**
   - Added import for `auctionWinners` table
   - Modified `calculatePerformanceStats()` to count wins from both legacy and deposit systems
   - Updated leaderboard position calculation to use combined win counts
   - Updated comparison calculations for last month's wins

2. **`src/app/api/leaderboard/route.ts`**
   - Updated SQL query to count wins from both `auctions.currentBidder` and `auction_winners` table
   - Removed 30-day date filter to show all-time wins (matching dashboard)
   - Changed from FILTER syntax to CASE WHEN for better compatibility
   - Ensures leaderboard rankings match dashboard exactly

### Implementation Details

**Dashboard API (Drizzle ORM):**
```typescript
// Legacy wins: auctions where vendor is currentBidder and status is closed
const legacyWinsResult = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(auctions)
  .where(
    and(
      eq(auctions.currentBidder, vendorId),
      eq(auctions.status, 'closed')
    )
  );

// New deposit system wins: auction_winners where vendor has rank=1
const depositWinsResult = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(auctionWinners)
  .where(
    and(
      eq(auctionWinners.vendorId, vendorId),
      eq(auctionWinners.rank, 1)
    )
  );

// Total wins is the sum of both systems
const totalWins = legacyWins + depositWins;
```

**Leaderboard API (Raw SQL):**
```sql
SELECT 
  v.id,
  v.business_name,
  -- Count wins from both systems
  (
    COUNT(DISTINCT CASE WHEN a.current_bidder = v.id AND a.status = 'closed' THEN a.id END) +
    COUNT(DISTINCT CASE WHEN aw.rank = 1 THEN aw.auction_id END)
  ) as auctions_won
FROM vendors v
LEFT JOIN bids b ON v.id = b.vendor_id
LEFT JOIN auctions a ON b.auction_id = a.id
LEFT JOIN auction_winners aw ON v.id = aw.vendor_id
GROUP BY v.id, v.business_name
ORDER BY auctions_won DESC
```

## How It Works

Every time a vendor visits their dashboard or views the leaderboard:
1. The API automatically queries both the legacy `auctions` table and the new `auction_winners` table
2. Counts wins from both sources
3. Adds them together for the total
4. Caches the result for 5 minutes

**No manual intervention needed** - the system automatically tracks wins from both old and new auctions.

## Verification

Created verification script: `scripts/verify-vendor-win-count-fix.ts`

Results:
- Total vendors with wins: 10
- Total legacy wins: 32
- Total deposit system wins: 17
- Total wins (combined): 49

## Cache Clearing (One-Time)

Created cache clearing script: `scripts/clear-vendor-dashboard-cache.ts`

This was run once to clear cache for all 275 vendors so they could see updated win counts immediately without waiting for the 5-minute cache expiration. **This does not need to be run again.**

## Testing

To verify the fix:

1. **Run verification script**:
   ```bash
   npx tsx scripts/verify-vendor-win-count-fix.ts
   ```

2. **Check vendor dashboard**:
   - Login as a vendor who has won recent auctions
   - Navigate to vendor dashboard
   - Verify win count shows correct total (legacy + deposit wins)

3. **Check leaderboard**:
   - View leaderboard page
   - Verify rankings match dashboard win counts

## Related Files

- `src/app/api/dashboard/vendor/route.ts` - Main dashboard API (counts wins on every request)
- `src/app/api/leaderboard/route.ts` - Leaderboard API (counts wins on every request)
- `src/lib/db/schema/auctions.ts` - Auctions schema (legacy currentBidder field)
- `src/lib/db/schema/auction-deposit.ts` - Auction winners table (new deposit system)
- `src/features/auctions/services/auction-closure.service.ts` - Records winners in auction_winners table

## Status

✅ **PERMANENTLY FIXED** - Vendor dashboard and leaderboard now automatically count wins from both legacy and deposit systems on every request.

## Notes

- The fix is backward compatible - it counts wins from both old and new systems
- No database migration required
- No scripts need to be run after auctions close
- Cache automatically expires after 5 minutes
- Leaderboard now shows all-time wins (matching dashboard) instead of last 30 days
