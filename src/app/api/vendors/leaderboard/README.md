# Vendor Leaderboard API

## Overview

The Vendor Leaderboard API provides a monthly ranking of the top 10 vendors based on their performance metrics. The leaderboard is updated weekly (every Monday) and cached in Redis for optimal performance.

## Endpoints

### GET /api/vendors/leaderboard

Returns the current vendor leaderboard.

**Response:**
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "vendorId": "uuid",
      "vendorName": "John Doe",
      "businessName": "Doe Enterprises",
      "tier": "tier2_full",
      "totalBids": 50,
      "wins": 25,
      "totalSpent": "5000000.00",
      "onTimePickupRate": 95,
      "rating": "4.8"
    }
  ],
  "lastUpdated": "2024-01-15T00:00:00.000Z",
  "nextUpdate": "2024-01-22T00:00:00.000Z"
}
```

**Metrics:**
- `totalBids`: Total number of bids placed by the vendor
- `wins`: Total number of auctions won
- `totalSpent`: Total amount spent on won auctions (in Naira)
- `onTimePickupRate`: Percentage of on-time pickups (0-100)
- `rating`: Average vendor rating (0-5)

**Caching:**
- Cached for 7 days (until next Monday)
- Cache key: `leaderboard:monthly`

### POST /api/vendors/leaderboard/refresh

Manually refreshes the leaderboard (admin only).

**Response:**
```json
{
  "message": "Leaderboard refreshed successfully",
  "leaderboard": [...],
  "lastUpdated": "2024-01-15T00:00:00.000Z",
  "nextUpdate": "2024-01-22T00:00:00.000Z"
}
```

## Cron Job

The leaderboard is automatically updated every Monday at midnight UTC via a cron job.

**Endpoint:** `/api/cron/leaderboard-update`

**Schedule:** `0 0 * * 1` (Every Monday at 00:00 UTC)

**Configuration (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/cron/leaderboard-update",
      "schedule": "0 0 * * 1"
    }
  ]
}
```

**Authentication:**
The cron endpoint requires a `CRON_SECRET` environment variable for authentication:
```
Authorization: Bearer <CRON_SECRET>
```

## Ranking Logic

Vendors are ranked by **total wins** (descending order). The query:
1. Fetches all approved vendors
2. Orders by `performanceStats.totalWins` (descending)
3. Limits to top 10
4. Calculates `totalSpent` from closed auctions in the current month

## Performance Stats

The leaderboard uses the `performanceStats` JSONB field from the `vendors` table:
```typescript
{
  totalBids: number;
  totalWins: number;
  winRate: number;
  avgPaymentTimeHours: number;
  onTimePickupRate: number;
  fraudFlags: number;
}
```

These stats are updated in real-time as vendors participate in auctions.

## Cache Management

**Cache Key:** `leaderboard:monthly`

**TTL:** 7 days (604,800 seconds)

**Invalidation:**
- Automatic: Every Monday via cron job
- Manual: POST to `/api/vendors/leaderboard/refresh`

## Requirements

**Requirement 23:** Vendor Leaderboard
- Show Top 10 vendors monthly
- Display metrics: total bids, wins, total spent, on-time pickup rate
- Highlight current vendor's position if in Top 10
- Show trophy icons for Top 3
- Update weekly (every Monday)
- Log activity 'Leaderboard viewed'

**Enterprise Standards Section 6:** API Design
- RESTful endpoints
- Proper error handling
- Response caching
- Performance optimization

## Testing

**Unit Tests:** `tests/unit/vendors/leaderboard.test.ts`
- Cache hit/miss scenarios
- Error handling
- Timestamp generation

**Integration Tests:** `tests/integration/vendors/leaderboard.test.ts`
- End-to-end leaderboard calculation
- Database queries
- Cache management
- Ranking logic

## Usage Example

```typescript
// Fetch leaderboard
const response = await fetch('/api/vendors/leaderboard');
const data = await response.json();

console.log(`Top vendor: ${data.leaderboard[0].vendorName}`);
console.log(`Total wins: ${data.leaderboard[0].wins}`);
console.log(`Next update: ${data.nextUpdate}`);

// Manually refresh (admin only)
const refreshResponse = await fetch('/api/vendors/leaderboard/refresh', {
  method: 'POST',
});
const refreshData = await refreshResponse.json();
console.log(refreshData.message);
```

## Environment Variables

```env
# Required for cron job authentication
CRON_SECRET=your-secret-key

# Required for Redis caching
KV_REST_API_URL=your-vercel-kv-url
KV_REST_API_TOKEN=your-vercel-kv-token
KV_REST_API_READ_ONLY_TOKEN=your-vercel-kv-read-only-token

# Required for internal API calls
NEXT_PUBLIC_APP_URL=https://your-app-url.com
```

## Future Enhancements

1. **Multiple Leaderboards:**
   - Weekly leaderboard
   - All-time leaderboard
   - Category-specific leaderboards (by asset type)

2. **Additional Metrics:**
   - Average bid amount
   - Response time to auctions
   - Customer satisfaction score

3. **Vendor Notifications:**
   - Push notification when entering Top 10
   - Email notification for position changes

4. **Historical Data:**
   - Track leaderboard position over time
   - Show trend indicators (↑ ↓)

## Troubleshooting

**Issue:** Leaderboard not updating
- Check cron job logs in Vercel dashboard
- Verify `CRON_SECRET` is set correctly
- Manually trigger refresh via POST endpoint

**Issue:** Stale data
- Clear Redis cache: `await cache.del('leaderboard:monthly')`
- Trigger manual refresh

**Issue:** Missing vendors
- Verify vendor status is 'approved'
- Check `performanceStats` data is populated
- Ensure vendors have participated in auctions
