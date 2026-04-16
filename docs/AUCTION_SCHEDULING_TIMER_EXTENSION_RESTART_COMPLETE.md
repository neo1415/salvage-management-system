# Auction Scheduling, Timer Extension, and Restart Features - COMPLETE ✅

## Overview

Successfully implemented three major auction management features for salvage managers:

1. **Auction Scheduling** - Schedule auctions to start now or at a future date/time with custom duration
2. **Timer Extension** - Manually extend active auction timers
3. **Auction Restart** - Restart closed auctions with new scheduling options

## Implementation Summary

### 1. Database Schema Updates

**File**: `src/lib/db/schema/auctions.ts`

Added new fields to the auctions table:
- `scheduledStartTime: timestamp` - When the auction is scheduled to start
- `isScheduled: boolean` - Whether the auction is scheduled for future start

**Migration**: `src/lib/db/migrations/0027_add_auction_scheduling.sql`
- Successfully created and applied
- Adds new columns with proper defaults
- Updates existing auctions to set `isScheduled = false`

### 2. Auction Scheduling Component

**File**: `src/components/ui/auction-schedule-selector.tsx`

Features:
- Two modes: "Start Now" and "Schedule for Later"
- Duration selector (1-720 hours, default 120 hours/5 days)
- Date/time picker for scheduled auctions
- Validation to prevent past dates
- Clean, modern UI with proper accessibility

**Usage**:
```tsx
<AuctionScheduleSelector
  onScheduleChange={(data) => {
    console.log(data);
    // {
    //   mode: 'now' | 'scheduled',
    //   scheduledTime?: Date,
    //   durationHours: number
    // }
  }}
/>
```

### 3. Timer Extension Component

**File**: `src/components/manager/auction-timer-extension.tsx`

Features:
- Preset extension options (1h, 3h, 6h, 12h, 24h)
- Custom extension input (1-168 hours)
- Real-time validation
- Success/error feedback
- Audit trail logging

**Usage**:
```tsx
<AuctionTimerExtension
  auctionId="auction-uuid"
  currentEndTime={new Date()}
  onExtensionSuccess={() => {
    // Refresh auction data
  }}
/>
```

### 4. API Routes

#### Case Approval with Scheduling
**File**: `src/app/api/cases/[id]/approve/route.ts`

**Request Body**:
```json
{
  "action": "approve",
  "comment": "Optional comment",
  "priceOverrides": { /* optional */ },
  "scheduleData": {
    "mode": "now" | "scheduled",
    "scheduledTime": "2024-01-15T10:00:00Z", // required if mode=scheduled
    "durationHours": 120 // optional, default 120 (5 days)
  }
}
```

**Behavior**:
- **"Start Now" mode**: Creates auction with `status='active'`, starts immediately
- **"Schedule for Later" mode**: Creates auction with `status='scheduled'`, waits for cron job
- Duration applies to both modes
- Vendors are notified ONLY when mode='now' (not for scheduled auctions)

#### Timer Extension
**File**: `src/app/api/auctions/[id]/extend/route.ts`

**Request Body**:
```json
{
  "extensionHours": 3
}
```

**Response**:
```json
{
  "success": true,
  "message": "Auction timer extended by 3 hours",
  "data": {
    "auction": {
      "id": "uuid",
      "previousEndTime": "2024-01-10T15:00:00Z",
      "newEndTime": "2024-01-10T18:00:00Z",
      "extensionCount": 1
    }
  }
}
```

#### Auction Restart
**File**: `src/app/api/auctions/[id]/restart/route.ts`

**Request Body**:
```json
{
  "scheduleData": {
    "mode": "now" | "scheduled",
    "scheduledTime": "2024-01-15T10:00:00Z", // required if mode=scheduled
    "durationHours": 120 // optional, default 120
  }
}
```

**Behavior**:
- Deletes all existing bids
- Resets auction with new schedule
- Updates case status accordingly
- Notifies vendors ONLY when mode='now'

#### Cron Job - Start Scheduled Auctions
**File**: `src/app/api/cron/start-scheduled-auctions/route.ts`

**Schedule**: Every minute (`* * * * *`)

**Behavior**:
- Finds auctions with `status='scheduled'` and `scheduledStartTime <= now`
- Updates status to `active`
- Updates case status to `active_auction`
- Notifies matching vendors
- Logs audit trail

**Vercel Configuration**: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/start-scheduled-auctions",
      "schedule": "* * * * *"
    }
  ]
}
```

### 5. UI Integration

#### Manager Approval Page
**File**: `src/app/(dashboard)/manager/approvals/page.tsx`

- Integrated `AuctionScheduleSelector` into approval modal
- Passes schedule data to approval API
- Shows success message with scheduling details

#### Bid History Detail Page
**File**: `src/app/(dashboard)/bid-history/[auctionId]/page.tsx`

- Integrated `AuctionTimerExtension` component
- Shows for salvage managers only
- Only visible for active/extended auctions
- Refreshes auction data after extension

#### Vendor Auctions Page
**File**: `src/app/(dashboard)/vendor/auctions/page.tsx`

**Countdown Timer Updates**:
- Shows "Starts in X" for scheduled auctions (blue color)
- Shows "Ends in X" for active auctions (green/orange/red based on urgency)
- Blue "Scheduled" badge for scheduled auctions
- Real-time countdown updates every second

**Auction Interface**:
```typescript
interface Auction {
  // ... other fields
  status: 'scheduled' | 'active' | 'extended' | 'closed' | 'cancelled';
  scheduledStartTime?: string;
  isScheduled?: boolean;
}
```

## Key Design Decisions

### 1. Cron Job Usage
- Cron jobs are ONLY for scheduled auctions (mode='scheduled')
- "Start Now" mode creates active auctions immediately - no cron job needed
- This reduces unnecessary processing and improves performance

### 2. Duration Selector
- Present in BOTH "Start Now" and "Schedule for Later" modes
- Default: 120 hours (5 days)
- Range: 1-720 hours (1 hour to 30 days)
- Allows flexible auction durations

### 3. Vendor Notifications
- Sent immediately when mode='now' (approval or restart)
- NOT sent for scheduled auctions (sent by cron job when auction starts)
- Filters out test vendors to save email quota

### 4. Status Management
- `scheduled` → Auction waiting to start
- `active` → Auction currently running
- `extended` → Auction timer was extended
- `closed` → Auction ended
- Case status: `approved` (scheduled) or `active_auction` (active)

## Testing Checklist

### Manual Testing

- [x] Approve case with "Start Now" → Auction active immediately
- [x] Approve case with "Schedule for Later" → Auction status='scheduled'
- [x] Restart auction with "Start Now" → Auction active immediately
- [x] Restart auction with "Schedule for Later" → Auction status='scheduled'
- [x] Scheduled auction countdown shows "Starts in X" in vendor cards
- [x] Active auction countdown shows "Ends in X" in vendor cards
- [x] Timer extension works for active auctions
- [x] Cron job activates scheduled auctions at correct time
- [x] Vendors notified only for "Start Now" mode
- [x] Duration selector works for both modes

### API Testing

```bash
# Test case approval with scheduling
curl -X POST http://localhost:3000/api/cases/[id]/approve \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "scheduleData": {
      "mode": "scheduled",
      "scheduledTime": "2024-01-15T10:00:00Z",
      "durationHours": 72
    }
  }'

# Test timer extension
curl -X POST http://localhost:3000/api/auctions/[id]/extend \
  -H "Content-Type: application/json" \
  -d '{"extensionHours": 3}'

# Test auction restart
curl -X POST http://localhost:3000/api/auctions/[id]/restart \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleData": {
      "mode": "now",
      "durationHours": 120
    }
  }'

# Test cron job (manual trigger)
curl -X GET http://localhost:3000/api/cron/start-scheduled-auctions
```

## Files Modified/Created

### Created
- `src/lib/db/migrations/0027_add_auction_scheduling.sql`
- `src/components/ui/auction-schedule-selector.tsx`
- `src/components/manager/auction-timer-extension.tsx`
- `src/app/api/auctions/[id]/extend/route.ts`
- `src/app/api/auctions/[id]/restart/route.ts`
- `src/app/api/cron/start-scheduled-auctions/route.ts`
- `docs/AUCTION_SCHEDULING_CLARIFICATION.md`
- `docs/AUCTION_SCHEDULING_AND_TIMER_MANAGEMENT_COMPLETE.md`

### Modified
- `src/lib/db/schema/auctions.ts` - Added scheduling fields
- `src/app/api/cases/[id]/approve/route.ts` - Added scheduling support
- `src/app/(dashboard)/manager/approvals/page.tsx` - Integrated scheduler
- `src/app/(dashboard)/bid-history/[auctionId]/page.tsx` - Added timer extension
- `src/app/(dashboard)/vendor/auctions/page.tsx` - Updated countdown timer
- `vercel.json` - Added cron job configuration

## Production Deployment Notes

1. **Database Migration**: Run migration `0027_add_auction_scheduling.sql` before deployment
2. **Vercel Cron Jobs**: Ensure cron jobs are enabled in Vercel project settings
3. **Environment Variables**: No new variables required
4. **Monitoring**: Watch cron job logs for scheduled auction activation
5. **Rollback Plan**: Migration can be rolled back by dropping new columns

## Future Enhancements

1. **Recurring Auctions**: Schedule auctions to repeat weekly/monthly
2. **Bulk Scheduling**: Schedule multiple auctions at once
3. **Timezone Support**: Allow managers to specify timezone for scheduling
4. **Notification Preferences**: Let vendors choose when to be notified
5. **Auto-Extension**: Automatically extend auctions with last-minute bids
6. **Calendar View**: Visual calendar for scheduled auctions

## Success Metrics

- ✅ Auction scheduling working for both approval and restart
- ✅ Timer extension functional with audit trail
- ✅ Countdown timers show correct labels ("Starts in" vs "Ends in")
- ✅ Cron job activates scheduled auctions on time
- ✅ Vendor notifications sent only when appropriate
- ✅ Duration selector works for all scenarios
- ✅ All API endpoints tested and working
- ✅ UI components integrated and functional

## Conclusion

All three features are now fully implemented and tested:
1. **Auction Scheduling** - Managers can schedule auctions with custom durations
2. **Timer Extension** - Managers can extend active auction timers
3. **Auction Restart** - Managers can restart closed auctions with new schedules

The implementation follows best practices with proper validation, error handling, audit logging, and user notifications. The system is production-ready and can be deployed to Vercel with cron job support.
