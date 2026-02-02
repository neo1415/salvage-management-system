# Vendor Dashboard API

## Overview

The Vendor Dashboard API provides performance statistics, badges, and comparison data for vendors to track their success on the platform.

## Endpoint

```
GET /api/dashboard/vendor
```

## Authentication

Requires authenticated session with `vendor` role.

## Response Format

```typescript
{
  performanceStats: {
    winRate: number;              // Percentage (0-100)
    avgPaymentTimeHours: number;  // Average hours from auction end to payment
    onTimePickupRate: number;     // Percentage (0-100)
    rating: number;               // 5-star rating (0-5)
    leaderboardPosition: number;  // Position on leaderboard
    totalVendors: number;         // Total number of vendors
    totalBids: number;            // Total bids placed
    totalWins: number;            // Total auctions won
  },
  badges: [
    {
      id: string;
      name: string;
      description: string;
      icon: string;
      earned: boolean;
    }
  ],
  comparisons: [
    {
      metric: string;
      currentValue: number;
      previousValue: number;
      change: number;
      trend: 'up' | 'down' | 'neutral';
    }
  ],
  lastUpdated: string;  // ISO 8601 timestamp
}
```

## Performance Stats

### Win Rate
- Calculated as: (Total Wins / Total Bids) × 100
- Represents the percentage of auctions won out of total bids placed

### Average Payment Time
- Calculated as: Average hours between auction end time and payment verification
- Lower is better (target: <6 hours for Fast Payer badge)

### On-Time Pickup Rate
- Calculated as: (Payments verified within 48 hours / Total verified payments) × 100
- Represents reliability in completing transactions on time

### Rating
- 5-star rating from Salvage Managers after successful pickups
- Range: 0.00 to 5.00

### Leaderboard Position
- Position among all vendors based on total wins
- Lower number is better (1 = top vendor)

## Badges

### Available Badges

1. **10 Wins** 🏆
   - Earned: Won 10 or more auctions
   
2. **Top Bidder** ⭐
   - Earned: In top 10 on leaderboard

3. **Fast Payer** ⚡
   - Earned: Average payment time under 6 hours

4. **Verified BVN** ✓
   - Earned: Tier 1 or Tier 2 verification complete

5. **Verified Business** 🏢
   - Earned: Tier 2 full business verification complete

6. **Top Rated** ⭐⭐⭐⭐⭐
   - Earned: Rating of 4.5 stars or higher

## Comparisons

Compares current performance to last month's performance for:
- Win Rate
- Average Payment Time
- Total Bids
- Total Wins

Each comparison includes:
- Current value
- Previous month value
- Change (difference)
- Trend indicator (up/down/neutral)

## Caching

- Dashboard data is cached in Redis for 5 minutes
- Cache key format: `dashboard:vendor:{vendorId}`
- Automatic cache invalidation after 300 seconds

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden - Vendor access required"
}
```

### 404 Not Found
```json
{
  "error": "Vendor profile not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to fetch dashboard data"
}
```

## Requirements

Implements Requirement 32: Vendor Performance Dashboard
- Display win rate (%), average payment time (hours), on-time pickup rate (%), 5-star rating (average), and leaderboard position
- Display badges for achievements
- Show comparison to last month

## Related Files

- `/src/app/(dashboard)/vendor/dashboard/page.tsx` - Dashboard UI
- `/src/lib/db/schema/vendors.ts` - Vendor schema
- `/src/lib/db/schema/bids.ts` - Bids schema
- `/src/lib/db/schema/auctions.ts` - Auctions schema
- `/src/lib/db/schema/payments.ts` - Payments schema
