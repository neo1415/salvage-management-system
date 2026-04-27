# Vendor Dashboard Fixes Complete

## Issues Fixed

### 1. Registration Banner Price Removal ✅
**Issue**: The registration banner displayed "₦12,500" hardcoded in the text.

**Fix**: Removed the hardcoded price from the banner text in `src/components/vendor/kyc-status-card.tsx`.

**Before**:
```
Pay the one-time registration fee (₦12,500) to unlock Tier 2 KYC and unlimited bidding.
```

**After**:
```
Pay the one-time registration fee to unlock Tier 2 KYC and unlimited bidding.
```

The actual price is still fetched dynamically from the database and displayed on the payment page.

---

### 2. Vendor Statistics Accuracy ✅
**Issue**: Vendor statistics (win rate, total bids, total wins, ratings) appeared to be stuck and not updating.

**Root Cause**: 
- The dashboard API was calculating stats correctly from the database in real-time
- However, stale cache entries were being served to users
- The `performanceStats` JSONB field in the vendors table was not being kept in sync

**Fix**: 
1. Created a script (`scripts/fix-vendor-dashboard-stats.ts`) that:
   - Recalculates all vendor statistics from the actual database tables
   - Updates the `performanceStats` JSONB field in the vendors table
   - Clears all stale Redis cache entries

2. The dashboard API (`src/app/api/dashboard/vendor/route.ts`) already calculates stats fresh from:
   - `bids` table for total bids
   - `auctions` table for total wins (where `currentBidder = vendorId` and `status = 'closed'`)
   - `payments` table for payment timing and pickup rates
   - `vendors` table for ratings

**How Stats Are Calculated**:
- **Total Bids**: Count of all bids placed by the vendor
- **Total Wins**: Count of closed auctions where the vendor is the current bidder
- **Win Rate**: (Total Wins / Total Bids) × 100
- **Rating**: Calculated by the auto-rating service based on multiple factors
- **On-Time Pickup Rate**: Percentage of payments verified within 48 hours

---

## Files Modified

1. `src/components/vendor/kyc-status-card.tsx` - Removed hardcoded price
2. `scripts/fix-vendor-dashboard-stats.ts` - New script to fix stats and clear cache
3. `scripts/check-vendor-stats.ts` - New diagnostic script

---

## Testing

To verify the fixes:

1. **Registration Banner**: 
   - Log in as a Tier 1 vendor who hasn't paid the registration fee
   - Check that the banner no longer shows "₦12,500"

2. **Vendor Statistics**:
   - Log in as any vendor
   - Check the dashboard shows accurate statistics
   - Place a new bid and verify the "Total Bids" count increases
   - Win an auction and verify the "Total Wins" count increases

---

## Running the Fix Script

If you need to refresh vendor statistics in the future:

```bash
npx tsx scripts/fix-vendor-dashboard-stats.ts
```

This will:
- Recalculate all vendor statistics from the database
- Clear stale cache entries
- Update the performanceStats field for all vendors

---

## Cache Behavior

The dashboard uses a 5-minute cache (300 seconds) to improve performance:
- First visit: Stats calculated fresh from database
- Subsequent visits within 5 minutes: Served from cache
- After 5 minutes: Cache expires and stats are recalculated

If you need to force a cache refresh for a specific vendor, you can delete their cache key:
```
dashboard:vendor:{vendorId}
```

---

## Notes

- The dashboard API calculates stats in real-time from the database, so they are always accurate
- The cache is used only for performance optimization
- The `performanceStats` JSONB field is now kept in sync for backup/reporting purposes
- The auto-rating service (`src/features/vendors/services/auto-rating.service.ts`) should be run periodically to update vendor ratings
