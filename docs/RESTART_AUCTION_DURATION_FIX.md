# Restart Auction Duration Fix

## Problem Summary

When restarting an auction and selecting "1 hour" as the duration, the auction was being created with "3 minutes" instead. This was caused by a type mismatch between the modal component and the auction schedule selector component.

## Root Cause

The `RestartAuctionModal` component was using a custom type definition that did NOT include the `durationHours` property:

```typescript
// OLD - Missing durationHours
interface RestartAuctionModalProps {
  restartSchedule: { mode: 'now' } | { mode: 'scheduled'; startTime: Date };
  onScheduleChange: (schedule: { mode: 'now' } | { mode: 'scheduled'; startTime: Date }) => void;
}
```

However, the `AuctionScheduleSelector` component was correctly calculating and returning `durationHours`:

```typescript
// AuctionScheduleSelector returns this
export interface AuctionScheduleValue {
  mode: 'now' | 'scheduled';
  scheduledTime?: Date;
  durationHours: number;  // ← This was being lost!
}
```

**Result**: When the modal passed the schedule data to the API, the `durationHours` property was missing, causing the API to use the default value (120 hours = 5 days) instead of the user's selection.

## The Fix

### 1. Updated RestartAuctionModal Type (src/components/modals/restart-auction-modal.tsx)

Changed the modal to use the correct `AuctionScheduleValue` type:

```typescript
// NEW - Uses the correct type from AuctionScheduleSelector
import { AuctionScheduleSelector, type AuctionScheduleValue } from '@/components/ui/auction-schedule-selector';

interface RestartAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  restartSchedule: AuctionScheduleValue;  // ← Now includes durationHours
  onScheduleChange: (schedule: AuctionScheduleValue) => void;
  onConfirm: () => void;
  isRestarting: boolean;
}
```

### 2. Updated Bid History Page Initialization (src/app/(dashboard)/bid-history/[auctionId]/page.tsx)

Ensured the initial state includes `durationHours`:

```typescript
// OLD
const [restartSchedule, setRestartSchedule] = useState<AuctionScheduleValue>({ mode: 'now' });

// NEW - Includes default durationHours
const [restartSchedule, setRestartSchedule] = useState<AuctionScheduleValue>({ 
  mode: 'now', 
  durationHours: 120  // Default 5 days
});
```

Also updated the reset logic:

```typescript
// When closing modal or after successful restart
setRestartSchedule({ mode: 'now', durationHours: 120 });
```

### 3. Ensured AuctionScheduleSelector Always Sets durationHours

Updated the mode change handler to always include `durationHours`:

```typescript
const handleModeChange = (mode: 'now' | 'scheduled') => {
  const currentDurationHours = calculateDurationHours(durationValue, durationUnit);
  
  if (mode === 'now') {
    setError('');
    onChange({ 
      mode: 'now',
      durationHours: currentDurationHours,  // ← Always included
    });
  } else {
    // ... scheduled mode logic
  }
};
```

## Data Flow (After Fix)

1. **User selects duration**: "1 hour" in the AuctionScheduleSelector
2. **Component calculates**: `durationHours = 1`
3. **Modal receives**: `{ mode: 'now', durationHours: 1 }`
4. **API receives**: `{ scheduleData: { mode: 'now', durationHours: 1 } }`
5. **API calculates**: `durationMs = 1 * 60 * 60 * 1000` (1 hour in milliseconds)
6. **Auction created**: With correct 1-hour duration

## Testing

To verify the fix:

1. Navigate to a closed auction in bid history
2. Click "Restart Auction"
3. Select "1 hour" as the duration
4. Confirm restart
5. Verify the auction shows "1h" remaining (not "3m")

## Related Files

- `src/components/modals/restart-auction-modal.tsx` - Modal component (type fixed)
- `src/app/(dashboard)/bid-history/[auctionId]/page.tsx` - Page using the modal (initialization fixed)
- `src/components/ui/auction-schedule-selector.tsx` - Duration selector (already correct)
- `src/app/api/auctions/[id]/restart/route.ts` - API endpoint (already correct)

## Previous Related Fixes

This fix builds on the previous work:
- Removed "minutes" option from duration selector (minimum is 1 hour)
- Fixed floating point decimal issue (0.08333...) in input field
- Ensured proper rounding and validation of duration values

## Status

✅ **COMPLETE** - The restart auction duration now correctly reflects the user's selection.
