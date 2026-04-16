# Client-Side Auction Polling System

## Overview

This document describes the client-side polling mechanism that replaces cron jobs for scheduled auction activation. This solution works in both local development and production environments without requiring any server-side cron configuration.

## Problem Solved

**Previous Issues:**
- Scheduled auctions didn't become active at their exact scheduled time
- They waited for a cron job to check (which runs every minute at best)
- Vercel free tier has limited cron jobs (once per day)
- Local dev doesn't have cron jobs at all
- Example: User scheduled auction for 2:30 PM, it's now 2:47 PM but still showing as "scheduled"

**New Solution:**
- Client-side polling checks every 20 seconds
- Activates auctions within 20-30 seconds of their scheduled time
- Works in local dev and production
- No cron job configuration needed
- Scales with user activity (more users = more frequent checks)

## Architecture

### 1. API Route: `/api/auctions/check-and-activate-scheduled`

**Location:** `src/app/api/auctions/check-and-activate-scheduled/route.ts`

**Purpose:** Server endpoint that checks for and activates scheduled auctions

**Features:**
- Finds scheduled auctions where `scheduledStartTime <= now`
- Updates auction status to 'active'
- Updates case status to 'active_auction'
- Notifies matching vendors via SMS and email
- Returns list of activated auctions
- Logs audit trail

**Request:**
```typescript
POST /api/auctions/check-and-activate-scheduled
Content-Type: application/json
```

**Response:**
```typescript
{
  success: true,
  activated: [
    {
      auctionId: "uuid",
      caseReference: "DHY-3828",
      assetType: "vehicle",
      notifiedVendors: 15
    }
  ],
  count: 1,
  timestamp: "2026-04-06T14:00:10.922Z"
}
```

### 2. React Hook: `useScheduledAuctionChecker`

**Location:** `src/hooks/use-scheduled-auction-checker.ts`

**Purpose:** Client-side polling hook that checks for scheduled auctions

**Features:**
- Polls every 20 seconds (configurable)
- Only runs when component is mounted
- Pauses when browser tab is not visible (Page Visibility API)
- Automatically resumes when tab becomes visible
- Prevents concurrent checks
- Handles errors gracefully (silent failures)
- Calls callback when auctions are activated

**Usage:**
```typescript
import { useScheduledAuctionChecker } from '@/hooks/use-scheduled-auction-checker';

function AuctionPage() {
  const handleRefresh = async () => {
    // Refresh auction list
  };

  useScheduledAuctionChecker({
    onAuctionsActivated: (activated) => {
      console.log(`✅ ${activated.length} auction(s) activated`);
      handleRefresh();
    },
    intervalMs: 20000, // 20 seconds
    enabled: true,
  });

  // ... rest of component
}
```

**Options:**
- `onAuctionsActivated`: Callback fired when auctions are activated
- `intervalMs`: Polling interval in milliseconds (default: 20000)
- `enabled`: Whether to enable polling (default: true)

### 3. Integration Points

**Vendor Auctions Page:**
- `src/app/(dashboard)/vendor/auctions/page.tsx`
- Polls every 20 seconds when online
- Refreshes auction list when auctions are activated
- Pauses polling when offline

**Future Integration Points:**
- Manager approvals page (if needed)
- Bid history page (if needed)
- Any page that displays scheduled auctions

## How It Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Opens Auction Page                                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ useScheduledAuctionChecker Hook Initializes                  │
│ - Starts polling every 20 seconds                            │
│ - Checks immediately on mount                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Every 20 Seconds (if tab is visible):                        │
│ POST /api/auctions/check-and-activate-scheduled              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ API Checks Database:                                          │
│ - Find auctions where status='scheduled'                     │
│ - AND scheduledStartTime <= now                              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌─────────────────────────────────────┐
│ No Auctions     │  │ Auctions Found                       │
│ Return empty    │  │ For each auction:                    │
└─────────────────┘  │ 1. Update status to 'active'         │
                     │ 2. Update case status                │
                     │ 3. Notify vendors                    │
                     │ 4. Log audit trail                   │
                     └─────────────┬───────────────────────┘
                                   │
                                   ▼
                     ┌─────────────────────────────────────┐
                     │ Return activated auctions list       │
                     └─────────────┬───────────────────────┘
                                   │
                                   ▼
                     ┌─────────────────────────────────────┐
                     │ Hook calls onAuctionsActivated       │
                     │ Component refreshes auction list     │
                     └─────────────────────────────────────┘
```

### Timing Example

**Scenario:** Auction scheduled for 2:30 PM

| Time    | Event                                      |
|---------|-------------------------------------------|
| 2:29:40 | Last poll - auction still scheduled       |
| 2:30:00 | Scheduled start time arrives              |
| 2:30:00 | Next poll - API activates auction         |
| 2:30:01 | Vendors notified via SMS/email            |
| 2:30:01 | UI refreshes, auction now shows as active |

**Result:** Auction activated within 20 seconds of scheduled time

## Benefits

### 1. No Cron Job Dependency
- Works in local development without any setup
- No Vercel cron configuration needed
- No server-side scheduling required

### 2. Faster Activation
- Checks every 20 seconds (vs. 1 minute for cron)
- Activates within 20-30 seconds of scheduled time
- Better user experience

### 3. Scales with Activity
- More active users = more frequent checks
- Distributed polling across all connected clients
- No single point of failure

### 4. Graceful Degradation
- Pauses when tab is not visible (saves resources)
- Handles errors silently (no user disruption)
- Prevents concurrent checks

### 5. Easy to Test
- Works immediately in local dev
- No need to wait for cron schedule
- Can test with any scheduled auction

## Performance Considerations

### Network Traffic
- Each poll is a lightweight POST request
- Only returns data when auctions are activated
- Typical response: ~100 bytes (empty) or ~500 bytes (with data)

**Calculation:**
- 100 active users × 3 polls/minute = 300 requests/minute
- 300 requests × 100 bytes = 30 KB/minute
- 30 KB × 60 minutes = 1.8 MB/hour
- **Impact: Negligible**

### Server Load
- Query is indexed (status + scheduledStartTime)
- Typically returns 0-5 auctions
- Activation logic only runs when needed
- **Impact: Minimal**

### Database Load
- Single indexed query per poll
- No writes unless auctions need activation
- Efficient query plan
- **Impact: Negligible**

## Configuration

### Polling Interval

Default: 20 seconds

To change:
```typescript
useScheduledAuctionChecker({
  intervalMs: 30000, // 30 seconds
  // ... other options
});
```

**Recommendations:**
- 10-20 seconds: High-frequency (more responsive)
- 20-30 seconds: Balanced (recommended)
- 30-60 seconds: Low-frequency (less responsive)

### Enable/Disable Polling

```typescript
const isOffline = useOffline();

useScheduledAuctionChecker({
  enabled: !isOffline, // Only poll when online
  // ... other options
});
```

## Testing

### Local Development

1. Create a scheduled auction with start time in 1-2 minutes
2. Open vendor auctions page
3. Wait for scheduled time to pass
4. Within 20 seconds, auction should activate
5. Check console for activation logs

### Production

1. Schedule an auction for a specific time
2. Monitor server logs around scheduled time
3. Verify auction activates within 20-30 seconds
4. Confirm vendors receive notifications

### Manual Testing Script

Run the activation script to test immediately:

```bash
npx tsx scripts/fix-auction-scheduling-issues.ts
```

This script:
- Finds all scheduled auctions with past start times
- Activates them immediately
- Notifies vendors
- Useful for fixing stuck auctions

## Monitoring

### Client-Side Logs

```typescript
// Success
console.log(`✅ Activated ${count} scheduled auction(s)`);

// Debug (silent)
console.debug('[Polling] Failed to check scheduled auctions:', error);
```

### Server-Side Logs

```typescript
// Found auctions
console.log(`[Polling] Found ${count} auctions to activate`);

// Activating
console.log(`[Polling] Activating auction ${id} for case ${ref}`);

// Notifying
console.log(`[Polling] Notifying ${count} vendors for auction ${id}`);

// Success
console.log(`[Polling] Successfully activated auction ${id}, notified ${count} vendors`);
```

## Migration from Cron Jobs

### Before (Cron Job)

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/start-scheduled-auctions",
    "schedule": "* * * * *"
  }]
}
```

**Issues:**
- Requires Vercel Pro plan for frequent crons
- Doesn't work in local dev
- Fixed 1-minute interval
- Single point of failure

### After (Client Polling)

```typescript
// src/app/(dashboard)/vendor/auctions/page.tsx
useScheduledAuctionChecker({
  onAuctionsActivated: handleRefresh,
  intervalMs: 20000,
});
```

**Benefits:**
- Works everywhere (local + production)
- Faster activation (20 seconds)
- Distributed across clients
- No configuration needed

### Transition Plan

1. ✅ Create new API route
2. ✅ Create React hook
3. ✅ Integrate into vendor auctions page
4. ✅ Run activation script to fix existing auctions
5. ⏳ Monitor for 1 week
6. ⏳ Remove cron job configuration (optional)

**Note:** You can keep the cron job as a backup if desired. The polling system will handle most cases, and the cron job will catch any edge cases.

## Troubleshooting

### Auction Not Activating

**Check:**
1. Is the scheduled time in the past?
2. Is the auction status 'scheduled'?
3. Is the user's browser tab visible?
4. Check browser console for errors
5. Check server logs for API errors

**Fix:**
```bash
# Run manual activation script
npx tsx scripts/fix-auction-scheduling-issues.ts
```

### Polling Not Running

**Check:**
1. Is the component mounted?
2. Is `enabled` prop set to true?
3. Is the browser tab visible?
4. Check browser console for errors

**Debug:**
```typescript
useScheduledAuctionChecker({
  onAuctionsActivated: (auctions) => {
    console.log('Activated:', auctions); // Should log when auctions activate
  },
  enabled: true, // Ensure enabled
});
```

### Too Many Requests

**Solution:**
Increase polling interval:
```typescript
useScheduledAuctionChecker({
  intervalMs: 30000, // 30 seconds instead of 20
});
```

## Future Enhancements

### 1. WebSocket Integration
- Real-time push notifications when auctions activate
- Eliminates polling entirely
- More efficient for high-traffic scenarios

### 2. Smart Polling
- Increase frequency when scheduled auctions are near
- Decrease frequency when no scheduled auctions exist
- Adaptive based on auction schedule

### 3. Service Worker
- Background polling even when tab is not visible
- Better offline support
- Push notifications

### 4. Analytics
- Track activation latency
- Monitor polling efficiency
- Identify optimization opportunities

## Summary

The client-side polling system provides a robust, scalable solution for scheduled auction activation that works in all environments without requiring cron job configuration. It activates auctions within 20-30 seconds of their scheduled time and gracefully handles errors and offline scenarios.

**Key Takeaways:**
- ✅ No cron jobs needed
- ✅ Works in local dev
- ✅ Faster activation (20s vs 60s)
- ✅ Scales with user activity
- ✅ Easy to test and monitor
- ✅ Graceful degradation

**Status:** ✅ Implemented and Active
