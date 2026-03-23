# Socket.io Real-Time Communication

This directory contains the Socket.io server implementation for real-time bidding and auction updates.

## Overview

The Socket.io server provides real-time WebSocket communication for:
- Live auction updates
- Real-time bid broadcasting (<2 seconds latency)
- Auction watching count tracking
- Vendor notifications (outbid alerts, win notifications)
- Auction auto-extension notifications

## Architecture

### Server Components

1. **server.ts** - Socket.io server initialization and configuration
   - Authentication middleware
   - Event handlers
   - Room management
   - Broadcasting functions

2. **Custom Server (root/server.ts)** - Next.js + Socket.io integration
   - HTTP server creation
   - Socket.io attachment
   - Graceful shutdown handling

3. **API Route (/api/socket)** - Socket.io status endpoint
   - Connection information
   - Health checks

### Client Components

1. **use-socket.ts** - React hooks for Socket.io
   - `useSocket()` - Main connection hook
   - `useAuctionWatch()` - Auction watching hook
   - `useAuctionUpdates()` - Auction updates hook
   - `useVendorNotifications()` - Vendor notifications hook

## Events

### Client → Server Events

```typescript
// Watch an auction
socket.emit('auction:watch', { auctionId: string });

// Unwatch an auction
socket.emit('auction:unwatch', { auctionId: string });

// Subscribe to all auctions
socket.emit('subscribe:auctions', { filters?: AuctionFilters });

// Unsubscribe from auctions
socket.emit('unsubscribe:auctions');
```

### Server → Client Events

```typescript
// Auction updated
socket.on('auction:updated', (data: { auctionId: string; auction: Auction }) => {});

// New bid placed
socket.on('auction:new-bid', (data: { auctionId: string; bid: Bid }) => {});

// Auction extended
socket.on('auction:extended', (data: { auctionId: string; newEndTime: Date }) => {});

// Auction closed
socket.on('auction:closed', (data: { auctionId: string; winnerId: string }) => {});

// Watching count updated
socket.on('auction:watching-count', (data: { auctionId: string; count: number }) => {});

// Vendor outbid
socket.on('vendor:outbid', (data: { auctionId: string; newBid: number }) => {});

// Vendor won auction
socket.on('vendor:won', (data: { auctionId: string; amount: number }) => {});

// New notification
socket.on('notification:new', (data: { notification: Notification }) => {});
```

## Authentication

Socket.io connections require JWT authentication:

```typescript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token',
  },
});
```

The authentication middleware:
1. Extracts JWT token from `auth.token` or `Authorization` header
2. Verifies token using `NEXTAUTH_SECRET`
3. Fetches user from database
4. Checks user status (not suspended/deleted)
5. Attaches user data to socket

## Room Management

### User Rooms
- `user:{userId}` - User-specific notifications
- `vendor:{vendorId}` - Vendor-specific notifications

### Auction Rooms
- `auction:{auctionId}` - Auction-specific updates
- `auctions:all` - All auction updates
- `auctions:type:{assetType}` - Filtered by asset type

## Broadcasting Functions

### Server-Side Broadcasting

```typescript
import {
  broadcastNewBid,
  broadcastAuctionUpdate,
  broadcastAuctionExtension,
  broadcastAuctionClosure,
  notifyVendorOutbid,
  notifyVendorWon,
  sendNotificationToUser,
} from '@/lib/socket/server';

// Broadcast new bid to all auction viewers
await broadcastNewBid(auctionId, bid);

// Broadcast auction update
await broadcastAuctionUpdate(auctionId, auction);

// Broadcast auction extension
await broadcastAuctionExtension(auctionId, newEndTime);

// Broadcast auction closure
await broadcastAuctionClosure(auctionId, winnerId);

// Notify vendor they've been outbid
await notifyVendorOutbid(vendorId, auctionId, newBid);

// Notify vendor they won
await notifyVendorWon(vendorId, auctionId, amount);

// Send notification to user
await sendNotificationToUser(userId, notification);
```

## Client Usage

### Basic Connection

```tsx
'use client';

import { useSocket } from '@/hooks/use-socket';

export function MyComponent() {
  const { socket, isConnected, error } = useSocket();

  if (error) {
    return <div>Connection error: {error.message}</div>;
  }

  if (!isConnected) {
    return <div>Connecting...</div>;
  }

  return <div>Connected!</div>;
}
```

### Watch Auction

```tsx
'use client';

import { useAuctionWatch } from '@/hooks/use-socket';

export function AuctionCard({ auctionId }: { auctionId: string }) {
  const { watchingCount } = useAuctionWatch(auctionId);

  return (
    <div>
      <p>{watchingCount} vendors watching</p>
    </div>
  );
}
```

### Listen to Auction Updates

```tsx
'use client';

import { useAuctionUpdates } from '@/hooks/use-socket';

export function AuctionDetails({ auctionId }: { auctionId: string }) {
  const { auction, latestBid, isExtended, isClosed } = useAuctionUpdates(auctionId);

  return (
    <div>
      {isExtended && <div className="alert">Auction extended by 2 minutes!</div>}
      {isClosed && <div className="alert">Auction closed!</div>}
      {latestBid && <div>Latest bid: ₦{latestBid.amount.toLocaleString()}</div>}
    </div>
  );
}
```

### Vendor Notifications

```tsx
'use client';

import { useVendorNotifications } from '@/hooks/use-socket';

export function VendorNotifications() {
  const { outbidNotification, wonNotification } = useVendorNotifications();

  return (
    <>
      {outbidNotification && (
        <div className="notification">
          You've been outbid! New bid: ₦{outbidNotification.newBid.toLocaleString()}
        </div>
      )}
      {wonNotification && (
        <div className="notification success">
          Congratulations! You won the auction for ₦{wonNotification.amount.toLocaleString()}
        </div>
      )}
    </>
  );
}
```

## Running the Server

### Development

```bash
# Install dependencies
npm install

# Run custom server with Socket.io
npm run dev
```

### Production

```bash
# Build Next.js app
npm run build

# Start production server with Socket.io
npm start
```

### Package.json Scripts

Update your `package.json`:

```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server.ts"
  }
}
```

## Environment Variables

```env
# Socket.io Configuration
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Server Configuration
PORT=3000
HOSTNAME=localhost
NODE_ENV=development
```

## Performance Considerations

### Latency Requirements
- Real-time bid updates: <2 seconds (Requirement 18.8)
- Outbid notifications: <5 seconds (Requirement 19.4)
- Watching count updates: Real-time

### Scalability
- Current implementation uses in-memory storage for watching counts
- For production with multiple servers, use Redis for:
  - Watching count tracking
  - Socket.io adapter (socket.io-redis)
  - Session storage

### Redis Integration (Production)

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

## Error Handling

### Connection Errors
- Automatic reconnection with exponential backoff
- Max 5 reconnection attempts
- Reconnection delay: 1s - 5s

### Authentication Errors
- Invalid token: Connection rejected
- Suspended/deleted user: Connection rejected
- Missing token: Connection rejected

### Event Errors
- Logged to console
- Emitted to client via `connect_error` event

## Testing

### Unit Tests
```bash
npm run test:unit -- src/lib/socket
```

### Integration Tests
```bash
npm run test:integration -- tests/integration/socket
```

### Manual Testing
1. Open browser console
2. Connect to Socket.io server
3. Watch auction
4. Place bid via REST API
5. Verify real-time update received

## Security

### Authentication
- JWT token required for all connections
- Token verified on connection
- User status checked (not suspended/deleted)

### Authorization
- Users can only watch auctions they have access to
- Vendors can only receive notifications for their own account
- Bid placement requires REST API (not via Socket.io)

### Rate Limiting
- Connection rate limiting (future enhancement)
- Event rate limiting (future enhancement)

## Monitoring

### Metrics to Track
- Connected users count
- Messages per second
- Average latency
- Error rate
- Reconnection rate

### Health Check
```bash
curl http://localhost:3000/api/socket
```

Response:
```json
{
  "status": "success",
  "data": {
    "initialized": true,
    "connectedUsers": 42,
    "endpoint": "ws://localhost:3000",
    "transports": ["websocket", "polling"]
  }
}
```

## Troubleshooting

### Connection Issues
1. Check JWT token is valid
2. Verify `NEXTAUTH_SECRET` matches
3. Check user status in database
4. Verify Socket.io server is running

### Broadcasting Issues
1. Check Socket.io server is initialized
2. Verify room names are correct
3. Check user is in correct room
4. Verify event names match

### Performance Issues
1. Monitor connected users count
2. Check for memory leaks
3. Implement Redis adapter for scaling
4. Add rate limiting

## Requirements Validation

This implementation satisfies:
- ✅ Requirement 16: Mobile auction browsing with real-time updates
- ✅ Requirement 17: Live countdown timers
- ✅ Requirement 18: Bid placement with real-time broadcasting (<2s)
- ✅ Requirement 19: Outbid push notifications (<5s)
- ✅ Requirement 20: Vendors watching count
- ✅ Requirement 21: Auto-extend auctions with notifications
- ✅ NFR1.1: Real-time bid updates <1s latency

## Future Enhancements

1. **Redis Integration** - For distributed systems
2. **Rate Limiting** - Prevent abuse
3. **Message Queue** - For reliable delivery
4. **Analytics** - Track usage patterns
5. **Load Balancing** - Multiple Socket.io servers
6. **Compression** - Reduce bandwidth usage
7. **Binary Protocol** - Faster than JSON
