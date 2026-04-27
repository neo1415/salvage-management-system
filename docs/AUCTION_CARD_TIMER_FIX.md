# Auction Card Timer Fix

## Issue
The auction card timers were not displaying on the cards even though the timer logic was implemented. The timer was being calculated but not rendered in the UI.

## Root Cause
The `AuctionCard` component had a `useEffect` hook that calculated the timer values (`timeRemaining`, `timerColor`, `timerLabel`) but there was no JSX element to display these values on the card.

## Fix Applied

### Added Timer Display
Added a timer display element between the price and watching count sections:

```tsx
{/* Timer - Only show for active and scheduled auctions */}
{(auction.status === 'active' || auction.status === 'extended' || auction.status === 'scheduled') && timeRemaining && timeRemaining !== 'Ended' && (
  <div className="flex items-center gap-1.5 mb-2">
    <Clock className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
    <span className="text-xs text-gray-600">
      {timerLabel && <span className="font-medium">{timerLabel}: </span>}
      <span className={`font-bold ${timerColor}`}>{timeRemaining}</span>
    </span>
  </div>
)}
```

### Timer Behavior

**For Scheduled Auctions:**
- Shows "Starts in: Xd Xh" or "Starts in: Xh Xm" or "Starts in: Xm"
- Timer counts down to when the auction will become active
- Color: Blue (`text-blue-600`)
- Icon: Clock icon in the top-right badge

**For Active Auctions:**
- Shows "Ends in: Xd Xh" or "Ends in: Xh Xm" or "Ends in: Xm"
- Timer counts down to when the auction will end
- Color: 
  - Green (`text-[#388e3c]`) if more than 1 day remaining
  - Orange (`text-[#f57c00]`) if 1-24 hours remaining
  - Red (`text-[#d32f2f]`) if less than 1 hour remaining
- Icon: Green circle in the top-right badge

**For Extended Auctions:**
- Same as active auctions
- Icon: Orange circle in the top-right badge

**For Closed/Awaiting Payment Auctions:**
- No timer displayed (as requested)
- Shows "Won" badge if user is the winner

## Timer Logic

The timer updates every second and handles:

1. **Scheduled Auctions**: Counts down to `scheduledStartTime`
2. **Active/Extended Auctions**: Counts down to `endTime`
3. **Closed/Awaiting Payment**: No timer shown
4. **Expired**: Shows "Ended" (but this is filtered out by the condition)

## Visual Design

- Compact design with Clock icon
- Color-coded based on urgency
- Shows label ("Starts in" or "Ends in") for clarity
- Only displays for auctions that are active or scheduled
- Hidden for expired auctions (no clutter)

## Files Modified

- `src/app/(dashboard)/vendor/auctions/page.tsx` - Added timer display to AuctionCard component

## Testing

Test the following scenarios:

1. **Scheduled Auction**: Should show "Starts in: X" with blue color
2. **Active Auction (>1 day)**: Should show "Ends in: X" with green color
3. **Active Auction (1-24 hours)**: Should show "Ends in: X" with orange color
4. **Active Auction (<1 hour)**: Should show "Ends in: X" with red color
5. **Closed Auction**: Should NOT show any timer
6. **Awaiting Payment**: Should NOT show any timer

## Summary

✅ Timer now displays on auction cards for active and scheduled auctions
✅ No timer shown for expired/closed auctions (clean UI)
✅ Color-coded based on urgency (green → orange → red)
✅ Scheduled auctions show countdown to start time
✅ Active auctions show countdown to end time
