# Auction Services

This directory contains services for managing auctions in the Salvage Management System.

## Services

### 1. Auction Service (`auction.service.ts`)

Handles auction creation and management.

**Key Features:**
- Auto-creates auctions when salvage cases are approved
- Sets auction duration to 5 days
- Notifies matching vendors via SMS and Email
- Creates audit log entries

**Usage:**
```typescript
import { auctionService } from '@/features/auctions/services/auction.service';

const result = await auctionService.createAuction({
  caseId: 'case-123',
  createdBy: 'manager-456',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
});
```

### 2. Bidding Service (`bidding.service.ts`)

Handles bid placement and validation.

**Key Features:**
- Validates bid amounts against minimum increment
- Verifies OTP for bid confirmation
- Checks vendor tier limits (Tier 1: ≤₦500k, Tier 2: unlimited)
- Broadcasts bids via Socket.io in real-time
- Sends outbid notifications

**Usage:**
```typescript
import { biddingService } from '@/features/auctions/services/bidding.service';

const result = await biddingService.placeBid({
  auctionId: 'auction-123',
  vendorId: 'vendor-456',
  amount: 510000,
  otp: '123456',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
});
```

### 3. Auto-Extension Service (`auto-extend.service.ts`)

Handles automatic auction extensions to prevent sniping.

**Key Features:**
- Extends auction by 2 minutes when bid placed in final 5 minutes
- Unlimited extensions until no bids for 5 consecutive minutes
- Broadcasts extension notifications via Socket.io
- Sends SMS and push notifications to all bidders

**Usage:**
```typescript
import { autoExtendService } from '@/features/auctions/services/auto-extend.service';

const result = await autoExtendService.checkAndExtend({
  auctionId: 'auction-123',
  bidPlacedAt: new Date(),
});
```

### 4. Auction Closure Service (`closure.service.ts`)

Handles automatic auction closure at end time.

**Key Features:**
- Closes expired auctions automatically
- Identifies winning bidder
- Generates payment invoice with 24-hour deadline
- Sends winner notifications via SMS, Email, and Push
- Creates audit log entries
- Updates auction and case status

**Usage:**
```typescript
import { auctionClosureService } from '@/features/auctions/services/closure.service';

// Close a single auction
const result = await auctionClosureService.closeAuction('auction-123');

// Close all expired auctions (called by cron job)
const batchResult = await auctionClosureService.closeExpiredAuctions();
```

**Cron Job Setup:**

The auction closure service should be called periodically by a cron job. Add this to your `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/auction-closure",
    "schedule": "*/5 * * * *"
  }]
}
```

This runs the closure check every 5 minutes.

**Environment Variables:**

```env
# Required for cron job authentication
CRON_SECRET=your-secret-key-here

# Required for notifications
NEXT_PUBLIC_APP_URL=https://salvage.nem-insurance.com
```

**API Endpoint:**

```
GET /api/cron/auction-closure
Authorization: Bearer {CRON_SECRET}
```

**Response:**
```json
{
  "success": true,
  "message": "Auction closure completed",
  "result": {
    "totalProcessed": 5,
    "successful": 5,
    "failed": 0,
    "timestamp": "2024-01-06T12:00:00.000Z"
  }
}
```

## Architecture

All auction services follow Clean Architecture principles:

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (API Routes, React Components)         │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Application Layer               │
│     (Auction Services)                  │
│  - auction.service.ts                   │
│  - bidding.service.ts                   │
│  - auto-extend.service.ts               │
│  - closure.service.ts                   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Domain Layer                    │
│  (Entities, Business Rules)             │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Infrastructure Layer               │
│  (Database, External APIs, Cache)       │
└─────────────────────────────────────────┘
```

## Testing

All services have comprehensive unit tests:

```bash
# Run all auction service tests
npm run test:unit -- tests/unit/auctions --run

# Run specific service tests
npm run test:unit -- tests/unit/auctions/auction-closure.test.ts --run
```

## Requirements Mapping

- **Requirement 15**: Mobile Case Approval → `auction.service.ts`
- **Requirement 18**: Bid Placement with OTP → `bidding.service.ts`
- **Requirement 21**: Auto-Extend Auctions → `auto-extend.service.ts`
- **Requirement 24**: Paystack Instant Payment → `closure.service.ts`

## Audit Logging

All auction services create comprehensive audit logs:

- `AUCTION_CREATED` - When auction is created
- `BID_PLACED` - When bid is placed
- `AUCTION_EXTENDED` - When auction is extended
- `AUCTION_CLOSED` - When auction is closed
- `NOTIFICATION_SENT` - When notifications are sent

## Error Handling

All services follow consistent error handling patterns:

1. **Validation Errors**: Return `{ success: false, error: 'message' }`
2. **Database Errors**: Log error and throw exception
3. **External API Errors**: Log error and continue (for notifications)
4. **Audit Logging**: Never throw exceptions from audit logging

## Performance Considerations

- **Caching**: Auction data is cached in Redis for 5 minutes
- **Real-time Updates**: Socket.io broadcasts are throttled to prevent spam
- **Batch Processing**: Closure service processes auctions in batches
- **Async Notifications**: Notifications are sent asynchronously to avoid blocking

## Security

- **OTP Verification**: All bids require OTP verification
- **Tier Limits**: Vendor tier limits are enforced
- **Cron Authentication**: Cron endpoints require secret token
- **Audit Trails**: All actions are logged with IP and device info

## Monitoring

Key metrics to monitor:

- Auction closure success rate
- Average time to close auction
- Notification delivery rate
- Bid placement latency
- Extension frequency

## Future Enhancements

- [ ] Add support for reserve price not met scenarios
- [ ] Implement auction cancellation workflow
- [ ] Add support for auction rescheduling
- [ ] Implement bid retraction with penalties
- [ ] Add support for proxy bidding
