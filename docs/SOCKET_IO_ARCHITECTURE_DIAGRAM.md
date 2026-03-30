# Socket.io Real-Time Bidding - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         REAL-TIME BIDDING SYSTEM                        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   Vendor A       │         │   Vendor B       │         │   Vendor C       │
│   (Browser 1)    │         │   (Browser 2)    │         │   (Browser 3)    │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         │ WebSocket                  │ WebSocket                  │ Polling
         │ Connection                 │ Connection                 │ Fallback
         │                            │                            │
         └────────────────┬───────────┴────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────────┐
         │         Socket.io Server (server.ts)       │
         │                                            │
         │  • Manages WebSocket connections           │
         │  • Handles room management                 │
         │  • Broadcasts events to rooms              │
         │  • Authenticates via JWT                   │
         └────────────────┬───────────────────────────┘
                          │
         ┌────────────────┴───────────────────────────┐
         │                                            │
         ▼                                            ▼
┌─────────────────────┐                    ┌─────────────────────┐
│  Broadcast Functions│                    │   Polling API       │
│  (socket/server.ts) │                    │   (poll/route.ts)   │
│                     │                    │                     │
│  • broadcastNewBid()│                    │  • GET /poll        │
│  • broadcastUpdate()│                    │  • Rate limiting    │
│  • broadcastClosure()│                   │  • ETag caching     │
└──────────┬──────────┘                    └──────────┬──────────┘
           │                                          │
           │ Called by                                │ Called by
           │                                          │
           ▼                                          ▼
┌─────────────────────┐                    ┌─────────────────────┐
│  Business Logic     │                    │  Client Polling     │
│                     │                    │  (use-socket.ts)    │
│  • bidding.service  │                    │                     │
│  • closure.service  │                    │  • Auto-activates   │
│  • watching.service │                    │  • 3 second interval│
└─────────────────────┘                    └─────────────────────┘
```

## Event Flow Diagram

### Scenario: Vendor B Places Bid

```
┌─────────────┐
│  Vendor B   │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. POST /api/auctions/[id]/bids
       │    { amount: 150000, otp: "123456" }
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    REST API Handler                          │
│                 (src/app/api/auctions/[id]/bids/route.ts)   │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 2. Validate bid and OTP
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                   Bidding Service                            │
│              (src/features/auctions/services/bidding.service.ts) │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 3. Save bid to database
       │ 4. Freeze funds in escrow
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                broadcastNewBid(auctionId, bid)               │
│                  (src/lib/socket/server.ts)                  │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ 5. io.to(`auction:${auctionId}`).emit('auction:new-bid', ...)
       │
       ├─────────────────┬─────────────────┬─────────────────┐
       │                 │                 │                 │
       ▼                 ▼                 ▼                 ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Vendor A │     │ Vendor B │     │ Vendor C │     │ Vendor D │
│ (Window) │     │ (Window) │     │ (Window) │     │ (Window) │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                 │                 │                 │
     │ 6. Receive      │ 6. Receive      │ 6. Receive      │ 6. Polling
     │    WebSocket    │    WebSocket    │    WebSocket    │    detects
     │    event        │    event        │    event        │    change
     │                 │                 │                 │
     ▼                 ▼                 ▼                 ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Update  │     │  Update  │     │  Update  │     │  Update  │
│   UI     │     │   UI     │     │   UI     │     │   UI     │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
  < 100ms           < 100ms           < 100ms          0-3 sec
```

## Room Management

```
┌─────────────────────────────────────────────────────────────┐
│                    Socket.io Rooms                          │
└─────────────────────────────────────────────────────────────┘

auction:abc123          ← All vendors watching auction abc123
  ├─ socket-1 (Vendor A)
  ├─ socket-2 (Vendor B)
  └─ socket-3 (Vendor C)

auction:def456          ← All vendors watching auction def456
  ├─ socket-4 (Vendor D)
  └─ socket-5 (Vendor E)

user:user-123           ← Personal notifications for user-123
  └─ socket-1

vendor:vendor-456       ← Vendor-specific notifications
  └─ socket-2

auctions:all            ← Global auction updates
  ├─ socket-1
  ├─ socket-2
  └─ socket-3
```

## Polling Fallback Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Attempt WebSocket connection
       │
       ▼
┌──────────────────────────────────────────┐
│  WebSocket Connection Successful?        │
└──────┬───────────────────────────────────┘
       │
       ├─── YES ──→ Use WebSocket (real-time)
       │            └─→ Updates < 100ms
       │
       └─── NO ───→ Wait 10 seconds
                    │
                    ▼
           ┌────────────────────────┐
           │ Activate Polling       │
           │ Fallback               │
           └────────┬───────────────┘
                    │
                    │ Poll every 3 seconds
                    │
                    ▼
           ┌────────────────────────┐
           │ GET /api/auctions/     │
           │     [id]/poll          │
           └────────┬───────────────┘
                    │
                    ├─→ 304 Not Modified (no changes)
                    │   └─→ Skip update
                    │
                    ├─→ 200 OK (has changes)
                    │   └─→ Update UI
                    │
                    └─→ 429 Rate Limited
                        └─→ Wait and retry
```

## Connection States

```
┌─────────────────────────────────────────────────────────────┐
│                    Connection States                        │
└─────────────────────────────────────────────────────────────┘

DISCONNECTED
    │
    │ Attempt connection
    │
    ▼
CONNECTING
    │
    ├─── Success ──→ WEBSOCKET CONNECTED ✅
    │                    │
    │                    │ Real-time updates
    │                    │ < 100ms latency
    │                    │
    │                    └─→ If disconnected → RECONNECTING
    │
    └─── Timeout (10s) ──→ POLLING FALLBACK ⚠️
                             │
                             │ Poll every 3 seconds
                             │ 0-3 second latency
                             │
                             └─→ If WebSocket connects → WEBSOCKET CONNECTED
```

## Data Flow

### WebSocket Flow (Primary)
```
Bid Placed
    ↓
Database Updated
    ↓
broadcastNewBid() called
    ↓
Socket.io emits to room
    ↓
All clients in room receive event
    ↓
UI updates instantly (< 100ms)
```

### Polling Flow (Fallback)
```
Client polls every 3 seconds
    ↓
GET /api/auctions/[id]/poll
    ↓
Check ETag (cached?)
    ↓
├─→ YES → Return 304 Not Modified
│          └─→ No update needed
│
└─→ NO → Query database
         └─→ Return current state
             └─→ Client updates UI
```

## Performance Comparison

| Metric              | WebSocket      | Polling        |
|---------------------|----------------|----------------|
| Latency             | < 100ms        | 0-3 seconds    |
| Bandwidth           | ~1KB/update    | ~2KB/poll      |
| Server Load         | Low            | Medium         |
| Scalability         | Requires Redis | Better         |
| Production Support  | Limited        | Universal      |
| User Experience     | Excellent      | Good           |

## Deployment Strategy

### Development (localhost)
- ✅ Use WebSocket (custom server)
- ✅ Real-time updates
- ✅ Best user experience

### Production (Vercel)
- ⚠️ WebSocket not supported
- ✅ Polling fallback activates automatically
- ✅ Updates every 3 seconds
- ✅ Still functional

### Production (Railway/Render/AWS)
- ✅ Use WebSocket (custom server supported)
- ✅ Real-time updates
- ✅ Best user experience

## Monitoring

### Key Metrics to Track

1. **Connection Success Rate**
   - % of clients successfully connecting via WebSocket
   - % falling back to polling

2. **Broadcast Latency**
   - Time from bid placement to client update
   - Target: < 100ms for WebSocket, < 3s for polling

3. **Room Occupancy**
   - Average clients per auction room
   - Peak concurrent connections

4. **Polling Usage**
   - Number of polling requests per minute
   - Rate limit hit rate

### Log Monitoring

**Critical Logs to Watch**:
- ❌ "Socket.io server not initialized" → Server initialization failed
- ❌ "0 clients in room" → Clients not joining rooms
- ⚠️ "Polling fallback activated" → WebSocket unavailable

**Success Logs**:
- ✅ "Socket.io server initialized successfully"
- ✅ "Broadcast successful"
- ✅ "Received new bid event"

## Conclusion

The Socket.io real-time bidding system is now fully functional with:
- Comprehensive debug logging for troubleshooting
- Fixed server initialization
- Complete broadcast coverage
- Automatic polling fallback for production
- Connection status visibility (dev mode)

Vendors can now see real-time bid updates without refreshing. The system gracefully handles WebSocket failures with automatic polling fallback.
