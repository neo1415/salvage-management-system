# Auction Card UX & Vendor Rating System Improvements

## Summary

This document outlines the improvements made to the auction card UI/UX and the implementation of an automatic vendor rating calculation system.

## 1. Auction Card UX Improvements

### Changes Made

#### A. Status Badge Improvements
- **Removed "Ended" badge** for closed auctions (non-winners) - no badge shown at all
- **"Won" badge**: Icon only (Trophy icon, no text)
- **"Closed" badge**: Icon only for most statuses
- **"Payment Due"**: Full text kept (important action required)
- **Active/Extended/Scheduled**: Icon only (Circle or Clock icon)

**Rationale**: Reduces visual clutter and focuses attention on actionable items (Payment Due) while keeping status indicators minimal and clean.

#### B. Image Carousel on Hover/Touch
- **Desktop**: Hover over image cycles through photos
- **Mobile**: Tap image cycles through photos
- **Indicator dots**: Shows which photo is currently displayed (1-3 photos)
- **Automatic photo repetition**: If less than 3 photos, repeats to ensure carousel works

**Rationale**: Allows users to preview multiple photos without leaving the card view, improving decision-making speed.

#### C. Visual Hierarchy Improvements
- **Price moved to bottom**: Now displayed below the image in the card content area
- **Larger price display**: 18px font (was 24px on image overlay)
- **Price color**: Burgundy brand color (#800020) for emphasis
- **Timer kept on image**: Remains on image overlay for urgency
- **Asset name**: Prominent at top of content area

**Rationale**: 
- Price at bottom creates better visual flow (image → name → price → details)
- Separates time-sensitive info (timer on image) from static info (price below)
- Improves scannability - users can quickly compare prices across cards

#### D. Content Structure
```
┌─────────────────────┐
│                     │
│      IMAGE          │ ← Timer overlay (bottom)
│                     │ ← Status badge (top-right, icon only)
│                     │ ← Photo dots (top-left)
├─────────────────────┤
│ Asset Name          │ ← Bold, 2 lines max
│ ₦2.5M Reserve       │ ← Price (large, burgundy)
│ 👁 12 watching      │ ← Engagement metric
└─────────────────────┘
```

### Files Modified
- `src/app/(dashboard)/vendor/auctions/page.tsx`

### Testing
1. Navigate to `/vendor/auctions`
2. Verify status badges show icons only (except "Payment Due")
3. Hover over images (desktop) or tap images (mobile) to cycle photos
4. Check price is displayed at bottom in burgundy color
5. Verify timer remains on image overlay

---

## 2. Automatic Vendor Rating System

### Problem
- Vendor ratings were always 0.0 because there was no mechanism to calculate them
- Manual rating system exists but requires managers/finance to rate after each auction
- No ratings = poor UX on leaderboard and vendor profiles

### Solution
Implemented an **automatic rating calculation system** based on vendor performance metrics.

### Rating Algorithm

**Rating Scale**: 0.0 - 5.0 stars

**Components** (weighted average):

1. **Payment Speed (30% weight)**
   - Excellent (< 6 hours): 5.0
   - Good (6-24 hours): 4.0
   - Average (24-48 hours): 3.0
   - Poor (48-72 hours): 2.0
   - Very Poor (> 72 hours): 1.0

2. **Win Rate (20% weight)**
   - Excellent (> 50%): 5.0
   - Good (30-50%): 4.0
   - Average (15-30%): 3.0
   - Poor (5-15%): 2.0
   - Very Poor (< 5%): 1.0

3. **Bid Activity (15% weight)**
   - Excellent (≥ 50 bids): 5.0
   - Good (20-49 bids): 4.0
   - Average (10-19 bids): 3.0
   - Poor (5-9 bids): 2.0
   - Very Poor (< 5 bids): 1.0

4. **On-Time Pickup (25% weight)**
   - Excellent (100%): 5.0
   - Good (80-99%): 4.0
   - Average (60-79%): 3.0
   - Poor (40-59%): 2.0
   - Very Poor (< 40%): 1.0

5. **Fraud Penalty (10% weight)**
   - 0 flags: 5.0
   - 1 flag: 3.0
   - 2 flags: 1.0
   - 3+ flags: 0.0

**Formula**:
```
Rating = (PaymentSpeed × 0.30) + (WinRate × 0.20) + (Activity × 0.15) + (Pickup × 0.25) + (Fraud × 0.10)
```

### Files Created

1. **Service**: `src/features/vendors/services/auto-rating.service.ts`
   - `calculateAutoRating(vendorId)` - Calculate rating for one vendor
   - `updateVendorRating(vendorId)` - Update rating for one vendor
   - `updateAllVendorRatings()` - Update ratings for all vendors

2. **Cron Job**: `src/app/api/cron/update-vendor-ratings/route.ts`
   - Runs daily at 2:00 AM
   - Recalculates all vendor ratings
   - Protected by CRON_SECRET

3. **Script**: `scripts/update-vendor-ratings.ts`
   - Manual trigger for testing
   - Shows before/after ratings

### Usage

#### Manual Update (Testing)
```bash
# Update all vendor ratings
npx tsx scripts/update-vendor-ratings.ts

# Or via API
curl http://localhost:3000/api/cron/update-vendor-ratings
```

#### Automatic Updates (Production)
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/update-vendor-ratings",
    "schedule": "0 2 * * *"
  }]
}
```

Set environment variable:
```bash
CRON_SECRET=your-secret-key
```

### Integration Points

The auto-rating system uses existing data from:
- `vendors.performanceStats` (totalBids, totalWins, winRate, avgPaymentTimeHours, onTimePickupRate, fraudFlags)
- No new database tables required
- Updates `vendors.rating` column

### Coexistence with Manual Ratings

The system supports **both** automatic and manual ratings:

1. **Automatic ratings** (from performance metrics)
   - Calculated daily via cron job
   - Based on objective performance data
   - Stored in `vendors.rating`

2. **Manual ratings** (from managers/finance)
   - Stored in `ratings` table
   - Include detailed feedback and reviews
   - Can override automatic ratings if needed

**Future Enhancement**: Combine both systems by averaging automatic rating with manual ratings when available.

### Display Changes

#### Leaderboard (`src/app/(dashboard)/vendor/leaderboard/page.tsx`)
- Changed "0.0" display to "N/A" when rating is 0
- Shows calculated rating once cron job runs
- Rating updates daily

#### Vendor Dashboard
- Removed `avgPaymentTimeHours` from vendor-facing displays
- This metric is for admin/manager use only
- Vendors don't need to see their own payment speed

### Benefits

1. **Immediate Value**: Vendors see ratings based on actual performance
2. **Objective**: Algorithm-based, no bias
3. **Transparent**: Clear criteria for improving rating
4. **Automated**: No manual intervention required
5. **Scalable**: Works for any number of vendors

### Testing Checklist

- [ ] Run `npx tsx scripts/update-vendor-ratings.ts`
- [ ] Verify ratings are no longer 0.0 on leaderboard
- [ ] Check vendor dashboard shows rating
- [ ] Verify "N/A" displays for vendors with no activity
- [ ] Test cron job endpoint: `curl http://localhost:3000/api/cron/update-vendor-ratings`
- [ ] Verify ratings update after vendor completes auctions

---

## 3. Questions Answered

### Q: Why is average payment time shown to vendors?
**A**: You're absolutely right! This is an admin/manager metric, not something vendors need to see about themselves. 

**Fixed**: Removed `avgPaymentTimeHours` from vendor-facing displays (leaderboard, vendor dashboard). It's now only shown in admin/manager reports where it's useful for monitoring vendor performance.

### Q: Why is rating 0 for all vendors?
**A**: The rating system required manual rating by managers/finance after each auction, but no one was rating vendors.

**Fixed**: Implemented automatic rating calculation based on performance metrics. Ratings now update daily via cron job.

---

## Next Steps

1. **Deploy cron job** to production (add to vercel.json)
2. **Run initial rating update** to populate all vendor ratings
3. **Monitor rating distribution** to ensure algorithm is fair
4. **Adjust weights** if needed based on business priorities
5. **Add rating trend** (show if rating is improving/declining)
6. **Vendor rating dashboard** showing breakdown of rating components

---

## Files Changed

### Modified
- `src/app/(dashboard)/vendor/auctions/page.tsx` - Auction card UX improvements
- `src/app/(dashboard)/vendor/leaderboard/page.tsx` - Show "N/A" for 0 ratings
- `src/components/vendor/trust-badges.tsx` - Hide payment time badge option

### Created
- `src/features/vendors/services/auto-rating.service.ts` - Auto-rating calculation
- `src/app/api/cron/update-vendor-ratings/route.ts` - Daily cron job
- `scripts/update-vendor-ratings.ts` - Manual trigger script
- `docs/AUCTION_CARD_UX_AND_VENDOR_RATING_IMPROVEMENTS.md` - This document

---

## Conclusion

These improvements address both UX concerns (cleaner auction cards, better visual hierarchy) and functional gaps (vendor ratings). The automatic rating system provides immediate value while maintaining the option for manual ratings when detailed feedback is needed.
