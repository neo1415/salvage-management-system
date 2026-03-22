# Socket.io Quick Start Guide

## Getting Started with Real-Time Features

This guide will help you quickly integrate Socket.io real-time features into your components.

## 1. Start the Server

```bash
# Development mode
npm run dev

# The server will start on http://localhost:3000
# Socket.io will be available at ws://localhost:3000
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║  🚀 NEM Salvage Management System                         ║
║                                                            ║
║  ✅ Next.js server ready                                  ║
║  ✅ Socket.io server ready                                ║
║                                                            ║
║  🌐 Local:    http://localhost:3000                       ║
║  📡 Socket:   ws://localhost:3000                         ║
║                                                            ║
║  Environment: development                                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

## 2. Basic Connection

```tsx
'use client';

import { useSocket } from '@/hooks/use-socket';

export function MyComponent() {
  const { socket, isConnected, error } = useSocket();

  if (error) {
    return <div>Connection error: {error.message}</div>;
  }

  if (!isConnected) {
    return <div>Connecting to real-time server...</div>;
  }

  return <div>✅ Connected!</div>;
}
```

## 3. Watch an Auction

```tsx
'use client';

import { useAuctionWatch } from '@/hooks/use-socket';

export function AuctionWatchingCount({ auctionId }: { auctionId: string }) {
  const { watchingCount } = useAuctionWatch(auctionId);

  return (
    <div className="flex items-center gap-2">
      <span>👁️</span>
      <span>{watchingCount} vendors watching</span>
    </div>
  );
}
```

## 4. Listen to Auction Updates

```tsx
'use client';

import { useAuctionUpdates } from '@/hooks/use-socket';

export function AuctionLiveFeed({ auctionId }: { auctionId: string }) {
  const { auction, latestBid, isExtended, isClosed } = useAuctionUpdates(auctionId);

  return (
    <div>
      {isExtended && (
        <div className="alert alert-warning">
          ⏰ Auction extended by 2 minutes!
        </div>
      )}

      {isClosed && (
        <div className="alert alert-info">
          🔒 Auction closed
        </div>
      )}

      {latestBid && (
        <div className="alert alert-success">
          ✓ New bid: ₦{latestBid.amount.toLocaleString()}
        </div>
      )}

      {auction && (
        <div>
          <p>Current Bid: ₦{auction.currentBid?.toLocaleString()}</p>
          <p>Status: {auction.status}</p>
        </div>
      )}
    </div>
  );
}
```

## 5. Vendor Notifications

```tsx
'use client';

import { useVendorNotifications } from '@/hooks/use-socket';

export function VendorNotificationBanner() {
  const { outbidNotification, wonNotification } = useVendorNotifications();

  return (
    <>
      {outbidNotification && (
        <div className="notification notification-warning">
          <p>You've been outbid!</p>
          <p>New bid: ₦{outbidNotification.newBid.toLocaleString()}</p>
          <a href={`/vendor/auctions/${outbidNotification.auctionId}`}>
            View Auction
          </a>
        </div>
      )}

      {wonNotification && (
        <div className="notification notification-success">
          <p>🎉 Congratulations! You won the auction!</p>
          <p>Amount: ₦{wonNotification.amount.toLocaleString()}</p>
          <a href={`/vendor/payments/${wonNotification.auctionId}`}>
            Proceed to Payment
          </a>
        </div>
      )}
    </>
  );
}
```

## 6. Server-Side Broadcasting

When implementing bidding or auction services, use these functions to broadcast updates:

```typescript
import {
  broadcastNewBid,
  broadcastAuctionUpdate,
  broadcastAuctionExtension,
  notifyVendorOutbid,
} from '@/lib/socket/server';

// After a bid is placed
export async function placeBid(auctionId: string, vendorId: string, amount: number) {
  // ... save bid to database ...

  // Broadcast to all viewers
  await broadcastNewBid(auctionId, {
    id: bid.id,
    amount: bid.amount,
    vendorId: bid.vendorId,
    createdAt: bid.createdAt,
  });

  // Notify previous highest bidder
  if (previousHighestBidder) {
    await notifyVendorOutbid(previousHighestBidder.vendorId, auctionId, amount);
  }

  return bid;
}

// When auction is extended
export async function extendAuction(auctionId: string, newEndTime: Date) {
  // ... update auction in database ...

  // Broadcast extension
  await broadcastAuctionExtension(auctionId, newEndTime);

  return auction;
}
```

## 7. Custom Event Listeners

For advanced use cases, you can listen to custom events:

```tsx
'use client';

import { useSocket } from '@/hooks/use-socket';
import { useEffect } from 'react';

export function CustomEventListener() {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen to custom event
    socket.on('auction:new-bid', (data) => {
      console.log('New bid received:', data);
      // Handle the event
    });

    // Cleanup
    return () => {
      socket.off('auction:new-bid');
    };
  }, [socket, isConnected]);

  return <div>Listening to custom events...</div>;
}
```

## 8. Testing the Connection

### Check Server Status

```bash
curl http://localhost:3000/api/socket
```

Expected response:
```json
{
  "status": "success",
  "data": {
    "initialized": true,
    "connectedUsers": 1,
    "endpoint": "ws://localhost:3000",
    "transports": ["websocket", "polling"]
  }
}
```

### Test in Browser Console

```javascript
// Open browser console and run:
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token-here'
  }
});

socket.on('connect', () => {
  console.log('✅ Connected!');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

// Watch an auction
socket.emit('auction:watch', { auctionId: 'test-auction-id' });

// Listen for updates
socket.on('auction:watching-count', (data) => {
  console.log('Watching count:', data);
});
```

## 9. Common Issues

### Issue: "Authentication token required"
**Solution:** Make sure you're logged in and the session has an `accessToken`.

### Issue: "Socket.io server not initialized"
**Solution:** Make sure you're running the custom server with `npm run dev`, not `npm run dev:next`.

### Issue: Connection keeps disconnecting
**Solution:** Check your JWT token expiry. Mobile tokens expire after 2 hours, desktop after 24 hours.

### Issue: Not receiving updates
**Solution:** Make sure you're in the correct room. Use `socket.emit('auction:watch', { auctionId })` to join.

## 10. Environment Variables

Make sure these are set in your `.env` file:

```env
# Socket.io
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# NextAuth (required for JWT verification)
NEXTAUTH_SECRET=your-secret-key-here

# Server
PORT=3000
HOSTNAME=localhost
NODE_ENV=development
```

## 11. Production Deployment

For production, you'll need to:

1. **Set production URL:**
   ```env
   NEXT_PUBLIC_SOCKET_URL=https://your-domain.com
   ```

2. **Enable HTTPS:**
   Socket.io will automatically use WSS (WebSocket Secure) when served over HTTPS.

3. **Add Redis for scaling:**
   ```typescript
   import { createAdapter } from '@socket.io/redis-adapter';
   io.adapter(createAdapter(pubClient, subClient));
   ```

4. **Configure CORS:**
   Update the CORS settings in `src/lib/socket/server.ts` to match your production domain.

## 12. Performance Tips

1. **Limit event listeners:** Only listen to events you need
2. **Clean up on unmount:** Always remove event listeners in cleanup functions
3. **Use rooms efficiently:** Join only the rooms you need
4. **Throttle updates:** Don't emit events too frequently
5. **Monitor connections:** Track connected users and disconnect inactive ones

## 13. Security Best Practices

1. **Always authenticate:** Never allow unauthenticated connections
2. **Validate events:** Validate all incoming event data
3. **Rate limit:** Implement rate limiting for event emissions
4. **Use rooms:** Don't broadcast to all users, use targeted rooms
5. **Sanitize data:** Sanitize all data before broadcasting

## Need Help?

- 📖 Full documentation: `src/lib/socket/README.md`
- 🐛 Issues: Check the troubleshooting section in README
- 💬 Questions: Ask the development team

---

**Happy coding with real-time features! 🚀**
