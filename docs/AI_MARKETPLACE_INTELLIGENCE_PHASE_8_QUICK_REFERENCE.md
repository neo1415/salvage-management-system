# AI Marketplace Intelligence - Phase 8 Quick Reference

**Phase**: Real-Time Integration  
**Status**: ✅ Complete

---

## Socket.IO Events

### Prediction Updated
```typescript
import { emitPredictionUpdated } from '@/features/intelligence/events';

await emitPredictionUpdated(auctionId, {
  predictedPrice: 500000,
  confidence: 0.85,
  priceRange: { min: 450000, max: 550000 },
  factors: [{ factor: 'Similar auctions', impact: 0.3 }]
}, vendorIds); // optional: target specific vendors
```

### Recommendation New
```typescript
import { emitRecommendationNew } from '@/features/intelligence/events';

await emitRecommendationNew(vendorId, {
  auctionId,
  matchScore: 85,
  reasonCodes: ['Similar to your previous bids'],
  auction: { title, currentBid, endTime }
});
// Rate limited: 5 per day per vendor
```

### Recommendation Closing Soon
```typescript
import { emitRecommendationClosingSoon } from '@/features/intelligence/events';

await emitRecommendationClosingSoon(
  vendorId,
  auctionId,
  45, // minutes remaining
  currentBid,
  matchScore
);
```

### Fraud Alert
```typescript
import { emitFraudAlert } from '@/features/intelligence/events';

await emitFraudAlert(
  alertId,
  'vendor', // or 'case', 'auction', 'user'
  entityId,
  85, // risk score
  ['Duplicate photos detected', 'Suspicious bidding']
);
```

### Schema New Asset Type
```typescript
import { emitSchemaNewAssetType } from '@/features/intelligence/events';

await emitSchemaNewAssetType(
  'furniture',
  new Date(),
  sampleAuctionId,
  true // requires review
);
```

---

## Room Manager

```typescript
import { RoomManager } from '@/features/intelligence/events';

// Join/leave rooms
RoomManager.joinVendorRoom(socketId, vendorId);
RoomManager.leaveVendorRoom(socketId, vendorId);
RoomManager.joinAuctionRoom(socketId, auctionId);
RoomManager.leaveAuctionRoom(socketId, auctionId);
RoomManager.joinAdminRoom(socketId);
RoomManager.leaveAdminRoom(socketId);

// Utilities
const count = RoomManager.getRoomMemberCount('vendor:123');
const rooms = RoomManager.getSocketRooms(socketId);
```

---

## Bid Change Trigger

```typescript
import { handleBidChange, shouldRecalculatePrediction } from '@/features/intelligence/triggers/bid-change-trigger';

// Automatically recalculates if >10% change
await handleBidChange(auctionId, oldBid, newBid);

// Check milestones (5, 10, 20, 50, 100 bids)
if (shouldRecalculatePrediction(auctionId, bidCount)) {
  // Recalculate
}
```

---

## Materialized View Refresh

```typescript
import {
  refreshMaterializedViews,
  refreshVendorBiddingPatterns,
  refreshMarketConditions,
  triggerRefreshOnDataChange
} from '@/features/intelligence/triggers/materialized-view-refresh';

// Refresh all views
await refreshMaterializedViews();

// Refresh specific views
await refreshVendorBiddingPatterns();
await refreshMarketConditions();

// Trigger on data changes (async)
await triggerRefreshOnDataChange('bid'); // or 'auction', 'case'
```

---

## Vendor Profile Cache

```typescript
import { VendorProfileCache } from '@/features/intelligence/cache/vendor-profile-cache';

// Cache profile (1-hour TTL)
await VendorProfileCache.updateVendorProfile(vendorId, {
  vendorId,
  totalBids: 50,
  winRate: 0.35,
  avgBidAmount: 250000,
  preferredCategories: ['vehicle'],
  priceRange: { min: 100000, max: 500000 },
  lastActivity: new Date(),
  segment: 'active_buyer'
});

// Get from cache
const profile = await VendorProfileCache.getVendorProfile(vendorId);

// Invalidate
await VendorProfileCache.invalidateVendorProfile(vendorId);
await VendorProfileCache.invalidateMultipleProfiles([id1, id2]);

// Check cache
const isCached = await VendorProfileCache.isCached(vendorId);
const ttl = await VendorProfileCache.getCacheTTL(vendorId);
```

---

## Notification Rate Limiter

```typescript
import { NotificationRateLimiter } from '@/features/intelligence/rate-limiting/notification-rate-limiter';

// Check if can send (5 per day limit)
const canSend = await NotificationRateLimiter.canSendNotification(vendorId);

if (canSend) {
  await emitRecommendationNew(vendorId, recommendation);
}

// Get counts
const count = await NotificationRateLimiter.getNotificationCount(vendorId);
const remaining = await NotificationRateLimiter.getRemainingNotifications(vendorId);

// Admin override
await NotificationRateLimiter.resetNotificationCount(vendorId);

// Manual increment (testing)
await NotificationRateLimiter.incrementNotificationCount(vendorId);

// Get TTL
const ttl = await NotificationRateLimiter.getCountTTL(vendorId);
```

---

## Room Patterns

| Room Pattern | Purpose | Events |
|--------------|---------|--------|
| `vendor:${vendorId}` | Vendor-specific | `recommendation:new`, `recommendation:closing_soon`, `prediction:updated` |
| `auction:${auctionId}` | Auction-specific | `prediction:updated`, `auction:new-bid`, `auction:closed` |
| `admin` | Admin notifications | `fraud:alert`, `schema:new_asset_type` |

---

## Client-Side Usage

```typescript
import { useSocket } from '@/hooks/use-socket';

function Component() {
  const socket = useSocket();
  
  useEffect(() => {
    // Listen for events
    socket.on('prediction:updated', handlePredictionUpdate);
    socket.on('recommendation:new', handleRecommendation);
    socket.on('fraud:alert', handleFraudAlert);
    
    // Join rooms
    socket.emit('auction:watch', { auctionId });
    
    return () => {
      socket.off('prediction:updated');
      socket.off('recommendation:new');
      socket.off('fraud:alert');
      socket.emit('auction:unwatch', { auctionId });
    };
  }, []);
}
```

---

## Performance

| Operation | Latency | Notes |
|-----------|---------|-------|
| Event emission | < 10ms | Socket.IO broadcast |
| Bid change trigger | < 200ms | Includes prediction recalculation |
| MV refresh (vendor patterns) | ~500ms | CONCURRENT, no locking |
| MV refresh (market conditions) | ~300ms | CONCURRENT, no locking |
| Cache hit | < 5ms | Redis |
| Cache miss | ~50ms | Database query |
| Rate limit check | < 5ms | Redis |

---

## Error Handling

All operations use graceful degradation:
- Event emission failures: Log, don't throw
- Cache failures: Fall back to database
- Rate limit failures: Allow notification
- MV refresh failures: Log, retry on next trigger

---

## Testing

```bash
# Run Socket.IO integration tests
npm test tests/integration/intelligence/events/socket-io.integration.test.ts

# Run real-time updates tests
npm test tests/integration/intelligence/real-time/real-time-updates.test.ts
```

---

## Files

### Event Emitters
- `src/features/intelligence/events/prediction-updated.event.ts`
- `src/features/intelligence/events/recommendation-new.event.ts`
- `src/features/intelligence/events/recommendation-closing-soon.event.ts`
- `src/features/intelligence/events/fraud-alert.event.ts`
- `src/features/intelligence/events/schema-new-asset-type.event.ts`
- `src/features/intelligence/events/room-manager.ts`
- `src/features/intelligence/events/index.ts`

### Triggers
- `src/features/intelligence/triggers/bid-change-trigger.ts`
- `src/features/intelligence/triggers/materialized-view-refresh.ts`

### Cache & Rate Limiting
- `src/features/intelligence/cache/vendor-profile-cache.ts`
- `src/features/intelligence/rate-limiting/notification-rate-limiter.ts`

### Tests
- `tests/integration/intelligence/events/socket-io.integration.test.ts`
- `tests/integration/intelligence/real-time/real-time-updates.test.ts`

---

**Last Updated**: January 2025
