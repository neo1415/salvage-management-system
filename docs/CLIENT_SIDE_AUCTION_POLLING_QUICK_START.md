# Client-Side Auction Polling - Quick Start

## What Is This?

A client-side polling system that automatically activates scheduled auctions at their scheduled time. **No cron jobs needed!**

## Why?

**Problem:**
- Scheduled auctions didn't activate on time
- Waited for cron job (every 1 minute)
- Vercel free tier limits cron jobs
- Local dev has no cron jobs

**Solution:**
- Client polls every 20 seconds
- Activates within 20-30 seconds
- Works everywhere (local + production)

## How It Works

```
User Opens Page → Hook Starts Polling (every 20s)
                        ↓
                  API Checks Database
                        ↓
              Scheduled Time Passed?
                   ↙        ↘
                 No         Yes
                 ↓           ↓
            Do Nothing   Activate Auction
                         Notify Vendors
                         Refresh UI
```

## Quick Integration

### 1. Import the Hook

```typescript
import { useScheduledAuctionChecker } from '@/hooks/use-scheduled-auction-checker';
```

### 2. Use in Component

```typescript
function AuctionPage() {
  const handleRefresh = async () => {
    // Your refresh logic
  };

  useScheduledAuctionChecker({
    onAuctionsActivated: (activated) => {
      console.log(`✅ ${activated.length} auction(s) activated`);
      handleRefresh();
    },
    intervalMs: 20000, // 20 seconds
    enabled: true,
  });

  return (
    // Your component JSX
  );
}
```

### 3. Done!

That's it. The hook will:
- ✅ Poll every 20 seconds
- ✅ Activate scheduled auctions
- ✅ Call your callback
- ✅ Pause when tab is hidden
- ✅ Resume when tab is visible

## Testing

### Test Locally

1. Create a scheduled auction (start time in 2 minutes)
2. Open vendor auctions page
3. Wait for scheduled time
4. Within 20 seconds, auction activates
5. Check console: `✅ 1 auction(s) activated`

### Fix Stuck Auctions

```bash
npx tsx scripts/fix-auction-scheduling-issues.ts
```

This activates all past scheduled auctions immediately.

## Configuration

### Change Polling Interval

```typescript
useScheduledAuctionChecker({
  intervalMs: 30000, // 30 seconds
});
```

### Disable When Offline

```typescript
const isOffline = useOffline();

useScheduledAuctionChecker({
  enabled: !isOffline,
});
```

## API Endpoint

**Endpoint:** `POST /api/auctions/check-and-activate-scheduled`

**Response:**
```json
{
  "success": true,
  "activated": [
    {
      "auctionId": "uuid",
      "caseReference": "DHY-3828",
      "assetType": "vehicle",
      "notifiedVendors": 15
    }
  ],
  "count": 1,
  "timestamp": "2026-04-06T14:00:10.922Z"
}
```

## Current Integration

✅ **Vendor Auctions Page**
- `src/app/(dashboard)/vendor/auctions/page.tsx`
- Polls every 20 seconds when online
- Refreshes list when auctions activate

## Performance

- **Network:** ~100 bytes per poll (negligible)
- **Server Load:** Single indexed query (minimal)
- **Database:** No writes unless activation needed
- **Impact:** Negligible with 100+ concurrent users

## Monitoring

### Client Logs
```typescript
✅ Activated 1 scheduled auction(s)
```

### Server Logs
```typescript
[Polling] Found 1 auctions to activate
[Polling] Activating auction abc-123 for case DHY-3828
[Polling] Notifying 15 vendors for auction abc-123
[Polling] Successfully activated auction abc-123, notified 15 vendors
```

## Troubleshooting

### Auction Not Activating?

1. Check scheduled time is in the past
2. Check auction status is 'scheduled'
3. Check browser tab is visible
4. Run manual script: `npx tsx scripts/fix-auction-scheduling-issues.ts`

### Polling Not Running?

1. Check component is mounted
2. Check `enabled` prop is true
3. Check browser console for errors

## Files

- **API Route:** `src/app/api/auctions/check-and-activate-scheduled/route.ts`
- **Hook:** `src/hooks/use-scheduled-auction-checker.ts`
- **Integration:** `src/app/(dashboard)/vendor/auctions/page.tsx`
- **Script:** `scripts/fix-auction-scheduling-issues.ts`
- **Docs:** `docs/CLIENT_SIDE_AUCTION_POLLING.md`

## Summary

✅ **No cron jobs needed**
✅ **Works in local dev**
✅ **Activates within 20 seconds**
✅ **Easy to integrate**
✅ **Graceful error handling**

**Status:** ✅ Implemented and Active
