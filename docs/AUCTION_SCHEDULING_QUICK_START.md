# Auction Scheduling Quick Start Guide

## For Salvage Managers

### 1. Approving Cases with Scheduling

When approving a case, you now have two options:

**Option A: Start Now**
- Auction becomes active immediately
- Vendors are notified right away
- Choose duration (default 5 days)

**Option B: Schedule for Later**
- Pick a future date and time
- Auction status will be "scheduled"
- Vendors will be notified when auction starts (via cron job)
- Choose duration (default 5 days)

### 2. Extending Active Auctions

For active or extended auctions:
- Click "Extend Timer" button
- Choose preset (1h, 3h, 6h, 12h, 24h) or custom hours
- Extension is logged in audit trail
- Vendors see updated countdown timer

### 3. Restarting Closed Auctions

For closed auctions:
- Click "Restart Auction" button
- Choose "Start Now" or "Schedule for Later"
- All previous bids are cleared
- Vendors are notified (if starting now)

## For Vendors

### Viewing Auctions

**Scheduled Auctions**:
- Blue "Scheduled" badge
- Countdown shows "Starts in X"
- Cannot bid until auction starts

**Active Auctions**:
- Green "Active" badge
- Countdown shows "Ends in X"
- Can place bids

**Extended Auctions**:
- Orange "Extended" badge
- Countdown shows "Ends in X"
- Timer was manually extended by manager

## Technical Details

### API Endpoints

```bash
# Approve case with scheduling
POST /api/cases/[id]/approve
{
  "action": "approve",
  "scheduleData": {
    "mode": "now" | "scheduled",
    "scheduledTime": "2024-01-15T10:00:00Z",
    "durationHours": 120
  }
}

# Extend auction timer
POST /api/auctions/[id]/extend
{
  "extensionHours": 3
}

# Restart auction
POST /api/auctions/[id]/restart
{
  "scheduleData": {
    "mode": "now" | "scheduled",
    "scheduledTime": "2024-01-15T10:00:00Z",
    "durationHours": 120
  }
}
```

### Cron Job

- **Path**: `/api/cron/start-scheduled-auctions`
- **Schedule**: Every minute (`* * * * *`)
- **Function**: Activates scheduled auctions when their start time arrives

### Database Fields

```sql
-- New fields in auctions table
scheduled_start_time TIMESTAMP
is_scheduled BOOLEAN DEFAULT false
```

## Common Scenarios

### Scenario 1: Immediate Auction
1. Manager approves case
2. Selects "Start Now"
3. Sets duration (e.g., 5 days)
4. Auction becomes active immediately
5. Vendors receive notifications

### Scenario 2: Scheduled Auction
1. Manager approves case
2. Selects "Schedule for Later"
3. Picks date/time (e.g., next Monday 9 AM)
4. Sets duration (e.g., 3 days)
5. Auction status = "scheduled"
6. Cron job activates auction at scheduled time
7. Vendors receive notifications when auction starts

### Scenario 3: Timer Extension
1. Auction is active with 2 hours remaining
2. Manager extends by 6 hours
3. New end time = current end time + 6 hours
4. Vendors see updated countdown
5. Extension logged in audit trail

### Scenario 4: Auction Restart
1. Auction closed with no winner
2. Manager clicks "Restart Auction"
3. Chooses "Start Now" with 5-day duration
4. All bids cleared
5. Auction becomes active
6. Vendors notified

## Troubleshooting

### Scheduled auction not starting
- Check cron job is running in Vercel
- Verify `scheduledStartTime` is in the past
- Check auction status is "scheduled"

### Vendors not receiving notifications
- Verify auction mode is "now" (not "scheduled")
- Check vendor email/phone is valid
- Filter out test vendors (@test.com, @example.com)

### Timer extension not working
- Verify auction status is "active" or "extended"
- Check extension hours is between 1-168
- Ensure user is salvage manager

## Best Practices

1. **Use scheduling for planned auctions** - Schedule auctions during business hours for better vendor participation
2. **Set appropriate durations** - 5 days (120 hours) is standard, adjust based on asset value
3. **Extend timers strategically** - Extend when there's active bidding near the end
4. **Restart with caution** - Only restart if there was a valid reason for no bids
5. **Monitor scheduled auctions** - Check that cron job is activating them on time

## Support

For issues or questions:
- Check audit logs for detailed operation history
- Review cron job logs in Vercel dashboard
- Contact system administrator for technical support
