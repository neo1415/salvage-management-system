# Socket.IO Alternatives for Vercel Deployment

> **Quick guide for implementing real-time features on Vercel without custom server**

## The Problem

Your current implementation uses a custom Node.js server (`server.ts`) with Socket.IO for real-time bidding. This **DOES NOT work on Vercel** because:

- Vercel uses serverless functions (stateless, short-lived)
- No persistent WebSocket connections
- No shared memory between function instances
- 10-second timeout for serverless functions

## Solution Comparison

| Solution | Complexity | Cost | Latency | Best For |
|----------|-----------|------|---------|----------|
| **Polling** | Low | Free | 3-5s | MVP, testing |
| **Pusher** | Low | $0-50/mo | <1s | Production, quick setup |
| **Ably** | Low | $0-30/mo | <1s | Production, global scale |
| **Railway + Socket.IO** | Medium | $5/mo | <1s | Keep existing code |
| **Supabase Realtime** | Medium | Free-$25/mo | <1s | PostgreSQL users |
| **Firebase Realtime DB** | Medium | Free-$25/mo | <1s | Simple data sync |

---

## Option 1: Polling (Quickest Fix)

### Implementation

Replace Socket.IO hooks with polling:

```typescript
// hooks/use-auction-polling.ts
import { useEffect, useState } from 'react';

export function useAuctionPolling(auctionId: string) {
  const [auction, setAuction] = useState(null);
  const [latestBid, setLatestBid] = useState(null);

  useEffect(() => {
    const fetchAuction = async () => {
      const response = await fetch(`/api/auctions/${auctionId}`);
      const data = await response.json();
      
      setAuction(data.auction);
      if (data.latestBid) {
        setLatestBid(data.latestBid);
      }
    };

    // Initial fetch
    fetchAuction();

    // Poll every 3 seconds
    const interval = setInterval(fetchAuction, 3000);

    return () => clearInterval(interval);
  }, [auctionId]);

  return { auction, latestBid };
}
```

### Usage

```tsx
// components/auction-details.tsx
'use client';

import { useAuctionPolling } from '@/hooks/use-auction-polling';

export function AuctionDetails({ auctionId }: { auctionId: string }) {
  const { auction, latestBid } = useAuctionPolling(auctionId);

  return (
    <div>
      <h2>{auction?.title}</h2>
      {latestBid && (
        <p>Latest bid: ₦{latestBid.amount.toLocaleString()}</p>
      )}
    </div>
  );
}
```

### Pros & Cons

**Pros:**
- ✅ Simple to implement
- ✅ No additional services
- ✅ Works on Vercel free tier
- ✅ No code changes to backend

**Cons:**
- ❌ Higher latency (3-5 seconds)
- ❌ More API calls (higher costs at scale)
- ❌ Battery drain on mobile
- ❌ Not truly "real-time"

---

## Option 2: Pusher (Recommended for Production)

### Setup

1. **Create Pusher Account:**
   - Go to https://pusher.com
   - Create new app
   - Get credentials

2. **Install Dependencies:**
   ```bash
   npm install pusher pusher-js
   ```

3. **Add Environment Variables:**
   ```bash
   PUSHER_APP_ID=your-app-id
   PUSHER_KEY=your-key
   PUSHER_SECRET=your-secret
   PUSHER_CLUSTER=us2
   NEXT_PUBLIC_PUSHER_KEY=your-key
   NEXT_PUBLIC_PUSHER_CLUSTER=us2
   ```

### Server-Side Implementation

```typescript
// lib/pusher/server.ts
import Pusher from 'pusher';

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// Broadcast new bid
export async function broadcastNewBid(auctionId: string, bid: any) {
  await pusher.trigger(`auction-${auctionId}`, 'new-bid', {
    bid,
    minimumBid: Number(bid.amount) + 20000,
  });
}

// Broadcast auction update
export async function broadcastAuctionUpdate(auctionId: string, auction: any) {
  await pusher.trigger(`auction-${auctionId}`, 'auction-updated', {
    auction,
  });
}

// Notify vendor outbid
export async function notifyVendorOutbid(vendorId: string, auctionId: string, newBid: number) {
  await pusher.trigger(`vendor-${vendorId}`, 'outbid', {
    auctionId,
    newBid,
  });
}
```

### Client-Side Implementation

```typescript
// hooks/use-pusher.ts
import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;

export function usePusher() {
  const [pusher, setPusher] = useState<Pusher | null>(null);

  useEffect(() => {
    if (!pusherInstance) {
      pusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      });
    }

    setPusher(pusherInstance);

    return () => {
      // Don't disconnect on unmount (shared instance)
    };
  }, []);

  return pusher;
}

// hooks/use-auction-updates.ts
export function useAuctionUpdates(auctionId: string) {
  const pusher = usePusher();
  const [latestBid, setLatestBid] = useState(null);
  const [auction, setAuction] = useState(null);

  useEffect(() => {
    if (!pusher) return;

    const channel = pusher.subscribe(`auction-${auctionId}`);

    channel.bind('new-bid', (data: any) => {
      setLatestBid(data.bid);
    });

    channel.bind('auction-updated', (data: any) => {
      setAuction(data.auction);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [pusher, auctionId]);

  return { latestBid, auction };
}
```

### Migration Steps

1. **Replace Socket.IO server broadcasts:**
   ```typescript
   // Before (Socket.IO)
   import { broadcastNewBid } from '@/lib/socket/server';
   await broadcastNewBid(auctionId, bid);

   // After (Pusher)
   import { broadcastNewBid } from '@/lib/pusher/server';
   await broadcastNewBid(auctionId, bid);
   ```

2. **Replace client-side hooks:**
   ```typescript
   // Before (Socket.IO)
   import { useAuctionUpdates } from '@/hooks/use-socket';

   // After (Pusher)
   import { useAuctionUpdates } from '@/hooks/use-pusher';
   ```

3. **Remove Socket.IO dependencies:**
   ```bash
   npm uninstall socket.io socket.io-client
   ```

4. **Update package.json scripts:**
   ```json
   {
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start"
     }
   }
   ```

### Pricing

- **Free Tier:** 200k messages/day, 100 concurrent connections
- **Startup:** $49/month - 1M messages/day, 500 connections
- **Business:** $299/month - 10M messages/day, 2k connections

---

## Option 3: Railway + Socket.IO (Keep Existing Code)

### Setup

1. **Create Socket.IO Server Repository:**
   ```bash
   mkdir socket-server
   cd socket-server
   npm init -y
   ```

2. **Install Dependencies:**
   ```bash
   npm install express socket.io cors dotenv jsonwebtoken drizzle-orm postgres
   ```

3. **Create Server:**
   ```javascript
   // index.js
   require('dotenv').config();
   const express = require('express');
   const { createServer } = require('http');
   const { Server } = require('socket.io');
   const cors = require('cors');

   const app = express();
   app.use(cors());

   const httpServer = createServer(app);
   const io = new Server(httpServer, {
     cors: {
       origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
       methods: ['GET', 'POST'],
     },
   });

   // Copy Socket.IO logic from src/lib/socket/server.ts
   // Adapt authentication and event handlers

   const PORT = process.env.PORT || 3001;
   httpServer.listen(PORT, () => {
     console.log(`Socket.IO server running on port ${PORT}`);
   });
   ```

4. **Deploy to Railway:**
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli

   # Login
   railway login

   # Initialize project
   railway init

   # Deploy
   railway up
   ```

5. **Update Vercel Environment Variables:**
   ```bash
   NEXT_PUBLIC_SOCKET_URL=https://your-socket-server.railway.app
   ```

6. **Update Client Code:**
   ```typescript
   // hooks/use-socket.ts
   const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
     auth: {
       token: session?.accessToken,
     },
   });
   ```

### Pros & Cons

**Pros:**
- ✅ Keep existing Socket.IO code
- ✅ True real-time (<1s latency)
- ✅ Full control over server
- ✅ Low cost ($5/month)

**Cons:**
- ❌ Additional infrastructure to manage
- ❌ Need to deploy separately
- ❌ More complex setup
- ❌ Need to handle scaling

---

## Option 4: Supabase Realtime

### Setup

1. **Use Supabase for Database:**
   ```bash
   # Already using PostgreSQL, just switch to Supabase
   DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
   ```

2. **Install Supabase Client:**
   ```bash
   npm install @supabase/supabase-js
   ```

3. **Subscribe to Changes:**
   ```typescript
   // hooks/use-auction-realtime.ts
   import { createClient } from '@supabase/supabase-js';

   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   );

   export function useAuctionRealtime(auctionId: string) {
     const [latestBid, setLatestBid] = useState(null);

     useEffect(() => {
       const channel = supabase
         .channel(`auction-${auctionId}`)
         .on(
           'postgres_changes',
           {
             event: 'INSERT',
             schema: 'public',
             table: 'bids',
             filter: `auction_id=eq.${auctionId}`,
           },
           (payload) => {
             setLatestBid(payload.new);
           }
         )
         .subscribe();

       return () => {
         supabase.removeChannel(channel);
       };
     }, [auctionId]);

     return { latestBid };
   }
   ```

### Pros & Cons

**Pros:**
- ✅ Built into Supabase
- ✅ No additional service
- ✅ Database-driven updates
- ✅ Free tier available

**Cons:**
- ❌ Requires Supabase database
- ❌ Limited to database changes
- ❌ Can't broadcast custom events easily

---

## Option 5: Ably

### Setup

1. **Create Ably Account:**
   - Go to https://ably.com
   - Create new app
   - Get API key

2. **Install Dependencies:**
   ```bash
   npm install ably
   ```

3. **Add Environment Variables:**
   ```bash
   ABLY_API_KEY=your-api-key
   NEXT_PUBLIC_ABLY_KEY=your-public-key
   ```

### Server-Side Implementation

```typescript
// lib/ably/server.ts
import Ably from 'ably/promises';

const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

export async function broadcastNewBid(auctionId: string, bid: any) {
  const channel = ably.channels.get(`auction-${auctionId}`);
  await channel.publish('new-bid', {
    bid,
    minimumBid: Number(bid.amount) + 20000,
  });
}
```

### Client-Side Implementation

```typescript
// hooks/use-ably.ts
import { useEffect, useState } from 'react';
import Ably from 'ably/promises';

export function useAuctionUpdates(auctionId: string) {
  const [latestBid, setLatestBid] = useState(null);

  useEffect(() => {
    const ably = new Ably.Realtime(process.env.NEXT_PUBLIC_ABLY_KEY!);
    const channel = ably.channels.get(`auction-${auctionId}`);

    channel.subscribe('new-bid', (message) => {
      setLatestBid(message.data.bid);
    });

    return () => {
      channel.unsubscribe();
      ably.close();
    };
  }, [auctionId]);

  return { latestBid };
}
```

### Pricing

- **Free Tier:** 3M messages/month, 200 concurrent connections
- **Standard:** $29/month - 10M messages/month
- **Pro:** $99/month - 50M messages/month

---

## Recommendation Matrix

### For MVP / Testing
**Use: Polling**
- Quickest to implement
- No additional costs
- Good enough for initial testing

### For Production (Small Scale)
**Use: Pusher or Ably**
- Easy to implement
- Managed service (no infrastructure)
- Free tier sufficient for small apps
- Professional support

### For Production (Large Scale)
**Use: Railway + Socket.IO**
- Keep existing code
- Full control
- Cost-effective at scale
- Can optimize as needed

### For Supabase Users
**Use: Supabase Realtime**
- Already integrated
- No additional service
- Database-driven updates

---

## Migration Checklist

### Before Migration

- [ ] Identify all Socket.IO usage in codebase
- [ ] List all events being broadcast
- [ ] Document client-side hooks
- [ ] Test current functionality

### During Migration

- [ ] Choose alternative solution
- [ ] Set up new service account
- [ ] Add environment variables
- [ ] Implement server-side broadcasts
- [ ] Implement client-side hooks
- [ ] Test in development
- [ ] Test in preview deployment

### After Migration

- [ ] Remove Socket.IO dependencies
- [ ] Remove custom server (`server.ts`)
- [ ] Update package.json scripts
- [ ] Update deployment configuration
- [ ] Test all real-time features
- [ ] Monitor performance
- [ ] Monitor costs

---

## Code Examples Repository

All code examples are available in:
- `examples/polling/` - Polling implementation
- `examples/pusher/` - Pusher implementation
- `examples/railway/` - Railway + Socket.IO
- `examples/supabase/` - Supabase Realtime
- `examples/ably/` - Ably implementation

---

## Need Help?

- **Pusher Docs:** https://pusher.com/docs
- **Ably Docs:** https://ably.com/docs
- **Railway Docs:** https://docs.railway.app
- **Supabase Docs:** https://supabase.com/docs

---

## Final Recommendation

**For your salvage management system:**

1. **Start with Polling** for immediate deployment
2. **Migrate to Pusher** when real-time becomes critical
3. **Consider Railway + Socket.IO** if you need full control

This approach minimizes risk and allows you to deploy quickly while planning for better real-time features later.
