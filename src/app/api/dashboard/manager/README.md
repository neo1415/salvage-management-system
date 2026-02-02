# Manager Dashboard API

## Overview

The Manager Dashboard API provides real-time KPIs and charts data for Salvage Managers to monitor platform performance on mobile PWA dashboards.

## Endpoint

```
GET /api/dashboard/manager
```

## Authentication

Requires authentication with `salvage_manager` role.

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dateRange` | number | 30 | Number of days for recovery rate trend (7, 30, 60, 90) |
| `assetType` | string | null | Filter by asset type: `vehicle`, `property`, `electronics` |

## Response Format

```typescript
{
  kpis: {
    activeAuctions: number;           // Count of active auctions
    totalBidsToday: number;           // Total bids placed today
    averageRecoveryRate: number;      // Average recovery rate % (last 30 days)
    casesPendingApproval: number;     // Count of cases awaiting approval
  },
  charts: {
    recoveryRateTrend: [              // Recovery rate trend over time
      {
        date: string;                 // Date in YYYY-MM-DD format
        recoveryRate: number;         // Recovery rate % for that date
        totalCases: number;           // Number of cases closed that date
      }
    ],
    topVendors: [                     // Top 5 vendors by bid volume
      {
        vendorId: string;
        vendorName: string;
        totalBids: number;
        totalWins: number;
        totalSpent: number;           // Total amount spent in ₦
      }
    ],
    paymentStatusBreakdown: [         // Payment status distribution
      {
        status: string;               // 'pending', 'verified', 'rejected', 'overdue'
        count: number;
        percentage: number;           // Percentage of total
      }
    ]
  },
  lastUpdated: string;                // ISO timestamp of data generation
}
```

## Example Requests

### Get default dashboard data (30 days, all asset types)

```bash
GET /api/dashboard/manager
```

### Get dashboard data for last 7 days

```bash
GET /api/dashboard/manager?dateRange=7
```

### Get dashboard data filtered by vehicle asset type

```bash
GET /api/dashboard/manager?assetType=vehicle
```

### Get dashboard data for last 60 days, vehicles only

```bash
GET /api/dashboard/manager?dateRange=60&assetType=vehicle
```

## Caching

- Dashboard data is cached in Redis with a 5-minute TTL (300 seconds)
- Cache key format: `dashboard:manager:{dateRange}:{assetType}`
- Auto-refresh recommended: every 30 seconds on the client side

## Performance

- Target response time: <500ms (95th percentile)
- Target mobile load time: <2 seconds
- Cached responses: <50ms

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Unauthorized"
}
```

User is not authenticated.

### 403 Forbidden

```json
{
  "error": "Forbidden - Salvage Manager access required"
}
```

User is authenticated but does not have `salvage_manager` role.

### 500 Internal Server Error

```json
{
  "error": "Failed to fetch dashboard data"
}
```

Server error occurred while fetching dashboard data.

## Requirements

Implements **Requirement 31: Manager Real-Time Dashboard**

- Calculate KPIs: active auctions count, total bids today, average recovery rate, cases pending approval count
- Generate charts data: recovery rate trend (last 30 days), top 5 vendors by volume, payment status breakdown
- Cache dashboard data in Redis (5-minute TTL)
- Auto-refresh every 30 seconds
- Support filtering by date range and asset type

## Usage Example

```typescript
// Client-side usage
async function fetchManagerDashboard(dateRange = 30, assetType = null) {
  const params = new URLSearchParams();
  params.append('dateRange', dateRange.toString());
  if (assetType) {
    params.append('assetType', assetType);
  }

  const response = await fetch(`/api/dashboard/manager?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }

  return await response.json();
}

// Auto-refresh every 30 seconds
setInterval(async () => {
  const data = await fetchManagerDashboard();
  updateDashboardUI(data);
}, 30000);
```

## Related Files

- API Route: `src/app/api/dashboard/manager/route.ts`
- Unit Tests: `tests/unit/dashboard/manager-dashboard-logic.test.ts`
- Integration Tests: `tests/integration/dashboard/manager-dashboard.test.ts`
- UI Component: `src/app/(dashboard)/manager/dashboard/page.tsx` (Task 59)

## Notes

- Recovery rate is calculated as: `(soldPrice / marketValue) * 100`
- Top vendors are sorted by total bid count (not total spent)
- Payment status breakdown shows distribution across all payment statuses
- All monetary values are in Nigerian Naira (₦)
