# Minimum Bid Increment Comprehensive Fix

## Problem
The minimum bid increment was hardcoded to 20,000 in multiple locations, causing the UI to show incorrect next minimum bids (e.g., 180k current bid showing 200k next bid instead of 230k with 50k increment configured).

## Root Cause Analysis
1. **Polling API** - ✅ FIXED - Now uses `config.minimumBidIncrement`
2. **WebSocket Broadcast** - ✅ FIXED - Now uses `config.minimumBidIncrement`
3. **Real-time Auction Card** - ⚠️ PARTIAL - Has fallback to 50k but should use config
4. **Auction Detail Page** - ❌ NOT FIXED - Uses hardcoded fallback
5. **Bid Form Component** - ❌ NOT CHECKED - May have hardcoded values

## Issue with Current Implementation

The polling API and WebSocket are correctly calculating `minimumBid` using the config:

```typescript
// src/app/api/auctions/[id]/poll/route.ts
const config = await configService.getConfig();
const minimumBid = currentBid ? currentBid + config.minimumBidIncrement : null;
```

```typescript
// src/lib/socket/server.ts
const config = await configService.getConfig();
const minimumBid = currentBid + config.minimumBidIncrement;
```

However, the UI components have hardcoded fallbacks:

```typescript
// src/components/auction/real-time-auction-card.tsx (line 147)
minimumBid={minimumBid || currentBid + 50000} // ❌ Hardcoded 50k fallback
```

```typescript
// src/app/(dashboard)/vendor/auctions/[id]/page.tsx
// No minimum bid calculation visible in truncated view - needs investigation
```

## Solution

### 1. Create a Client-Side Config Hook
Create a hook to fetch and cache the system configuration on the client side:

**File: `src/hooks/use-system-config.ts`**
```typescript
import { useState, useEffect } from 'react';

interface SystemConfig {
  minimumBidIncrement: number;
  depositRate: number;
  // ... other config values
}

let cachedConfig: SystemConfig | null = null;
let configPromise: Promise<SystemConfig> | null = null;

export function useSystemConfig() {
  const [config, setConfig] = useState<SystemConfig | null>(cachedConfig);
  const [loading, setLoading] = useState(!cachedConfig);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig);
      setLoading(false);
      return;
    }

    if (!configPromise) {
      configPromise = fetch('/api/config/system')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch config');
          return res.json();
        })
        .then(data => {
          cachedConfig = data.config;
          return cachedConfig!;
        })
        .catch(err => {
          configPromise = null;
          throw err;
        });
    }

    configPromise
      .then(cfg => {
        setConfig(cfg);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { config, loading, error };
}
```

### 2. Create System Config API Endpoint
**File: `src/app/api/config/system/route.ts`**
```typescript
import { NextResponse } from 'next/server';
import { configService } from '@/features/auction-deposit/services/config.service';

export async function GET() {
  try {
    const config = await configService.getConfig();
    
    return NextResponse.json({
      success: true,
      config: {
        minimumBidIncrement: config.minimumBidIncrement,
        depositRate: config.depositRate,
        documentValidityPeriod: config.documentValidityPeriod,
        paymentDeadlineAfterSigning: config.paymentDeadlineAfterSigning,
        graceExtensionDuration: config.graceExtensionDuration,
        // Add other config values as needed
      },
    });
  } catch (error) {
    console.error('Failed to fetch system config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}
```

### 3. Update Real-Time Auction Card
```typescript
// src/components/auction/real-time-auction-card.tsx
import { useSystemConfig } from '@/hooks/use-system-config';

export function RealTimeAuctionCard({ auctionId, initialData }: RealTimeAuctionCardProps) {
  const { config } = useSystemConfig();
  const { watchingCount } = useAuctionWatch(auctionId);
  const { auction, latestBid, isExtended, isClosed } = useAuctionUpdates(auctionId);
  
  const [currentBid, setCurrentBid] = useState(initialData?.currentBid || 0);
  const [minimumBid, setMinimumBid] = useState<number>(0);

  // Update minimum bid when config loads or current bid changes
  useEffect(() => {
    if (config && currentBid) {
      setMinimumBid(currentBid + config.minimumBidIncrement);
    }
  }, [config, currentBid]);

  // Update from socket events
  useEffect(() => {
    if (latestBid) {
      setCurrentBid(latestBid.amount);
      if (latestBid.minimumBid) {
        setMinimumBid(latestBid.minimumBid);
      } else if (config) {
        setMinimumBid(latestBid.amount + config.minimumBidIncrement);
      }
    }
  }, [latestBid, config]);

  // ... rest of component
  
  <BidForm
    auctionId={auctionId}
    currentBid={currentBid}
    minimumBid={minimumBid} // No fallback - use calculated value
    // ... other props
  />
}
```

### 4. Update Auction Detail Page
Similar changes needed in `src/app/(dashboard)/vendor/auctions/[id]/page.tsx`

## Testing Checklist
- [ ] Change minimum bid increment in admin config to 50,000
- [ ] Create a test auction with starting bid 100,000
- [ ] Place bid of 180,000
- [ ] Verify next minimum bid shows 230,000 (not 200,000)
- [ ] Test with WebSocket connection
- [ ] Test with polling fallback (disable WebSocket)
- [ ] Test on mobile devices
- [ ] Test with different config values (20k, 30k, 50k)

## Files to Update
1. ✅ `src/app/api/auctions/[id]/poll/route.ts` - Already fixed
2. ✅ `src/lib/socket/server.ts` - Already fixed
3. ❌ `src/hooks/use-system-config.ts` - CREATE NEW
4. ❌ `src/app/api/config/system/route.ts` - CREATE NEW
5. ❌ `src/components/auction/real-time-auction-card.tsx` - UPDATE
6. ❌ `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - UPDATE
7. ❌ `src/components/auction/bid-form.tsx` - CHECK AND UPDATE IF NEEDED

## Other Hardcoded Config Values to Fix

### Document Validity Period (48 hours)
- `src/lib/cron/pickup-reminders.ts` - Line 40, 72
- `src/lib/db/schema/release-forms.ts` - Line 35 comment
- `src/features/auction-deposit/services/document-integration.service.ts` - Line 206

### Payment Deadline (72 hours)
- `src/lib/cron/payment-deadlines.ts` - Line 153, 212, 222
- `src/lib/db/schema/release-forms.ts` - Line 38 comment
- `src/features/auction-deposit/services/document-integration.service.ts` - Line 206
- `src/components/admin/config-form.tsx` - Line 142

### Grace Extension Duration (24 hours)
- `src/lib/cron/payment-deadlines.ts` - Line 98
- `src/features/auction-deposit/services/payment.service.ts` - Line 435, 1055

### Deposit Rate (10%)
- `src/features/auctions/services/bidding.service.ts` - Line 309, 376, 567 (fallback values)

## Priority
**HIGH** - This directly affects user experience and bidding accuracy. Users are seeing incorrect minimum bids which could lead to confusion and failed bids.

## Status
- Polling API: ✅ Fixed
- WebSocket: ✅ Fixed  
- UI Components: ❌ Not Fixed
- Client Config Hook: ❌ Not Created
- Config API: ❌ Not Created
