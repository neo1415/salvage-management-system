# Auction Scheduling & Restart Clarification

## Overview
This document clarifies how auction scheduling and restart work, addressing the confusion about cron jobs.

## How It Works

### 1. Case Approval with Scheduling
When a salvage manager approves a case, they can choose:

**Option A: Start Now**
- `mode: 'now'`
- Auction status: `active` immediately
- Auction starts right away
- Vendors notified immediately
- Duration: Manager picks (default 120 hours/5 days)
- **NO CRON JOB NEEDED** - auction is active immediately

**Option B: Schedule for Later**
- `mode: 'scheduled'`
- Auction status: `scheduled` (not active yet)
- Auction starts at specified date/time
- Vendors NOT notified yet (will be notified when auction starts)
- Duration: Manager picks (default 120 hours/5 days)
- **CRON JOB NEEDED** - to activate auction at scheduled time

### 2. Auction Restart
When a salvage manager restarts a closed auction, they can choose:

**Option A: Start Now**
- `mode: 'now'`
- Auction status: `active` immediately
- All previous bids cleared
- Auction starts right away
- Vendors notified immediately
- Duration: Manager picks (default 120 hours/5 days)
- **NO CRON JOB NEEDED** - auction is active immediately

**Option B: Schedule for Later**
- `mode: 'scheduled'`
- Auction status: `scheduled` (not active yet)
- All previous bids cleared
- Auction starts at specified date/time
- Vendors NOT notified yet (will be notified when auction starts)
- Duration: Manager picks (default 120 hours/5 days)
- **CRON JOB NEEDED** - to activate auction at scheduled time

## Cron Job Purpose

The cron job (`/api/cron/start-scheduled-auctions`) is ONLY for:
- Activating auctions with status `scheduled` when their `scheduledStartTime` arrives
- Changing status from `scheduled` to `active`
- Notifying vendors when auction becomes active
- Runs every minute to check for auctions ready to start

## Database Fields

```typescript
{
  status: 'scheduled' | 'active' | 'extended' | 'closed' | 'cancelled',
  startTime: Date,              // When auction actually starts (or started)
  endTime: Date,                // When auction ends (startTime + duration)
  scheduledStartTime: Date | null,  // Future time when scheduled auction should start
  isScheduled: boolean,         // True if auction is scheduled for future
}
```

## Vendor Experience

### For Active Auctions
- Shows countdown timer: "Ends in 2d 5h"
- Can place bids immediately
- Real-time updates

### For Scheduled Auctions
- Shows countdown to start: "Starts in 1d 3h"
- Cannot place bids yet
- Badge: "Scheduled"
- Vendors can "watch" the auction to get notified when it starts

## Implementation Status

✅ Database schema with `scheduledStartTime` and `isScheduled`
✅ Migration completed
✅ Approval API handles both modes
✅ Restart API handles both modes
✅ Cron job to activate scheduled auctions
✅ Duration selector in both approval and restart flows

🔄 TODO:
- Add countdown timer for scheduled auctions in vendor auction cards
- Show "Starts in X" instead of "Ends in X" for scheduled auctions
- Add visual indicator (badge) for scheduled auctions

## Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/start-scheduled-auctions",
    "schedule": "* * * * *"
  }]
}
```

This runs every minute to check for auctions ready to start.
