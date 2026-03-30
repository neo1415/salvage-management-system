# Socket.io Real-Time Bidding - Testing Checklist

## Quick Test (5 minutes)

### Prerequisites
- [ ] Development server running (`npm run dev`)
- [ ] 2 browser windows open (Chrome + Firefox recommended)
- [ ] Both windows logged in as different vendors
- [ ] Both windows on same auction page

### Test Steps

1. **Check Server Logs**
   - [ ] See "Socket.io server initialized successfully"
   - [ ] See "Socket.io server stored and accessible"
   - [ ] No errors about "io is null/undefined"

2. **Check Client Connections (Both Windows)**
   - [ ] Open browser console (F12)
   - [ ] See "✅ Socket.io connected"
   - [ ] See "Transport: websocket" (or "polling")
   - [ ] See "👁️ Joining auction room: auction:xyz"

3. **Test Real-Time Bid Updates**
   - [ ] Place bid in Window 1
   - [ ] Window 2 updates within 1 second
   - [ ] Window 2 console shows "📡 Received new bid event"
   - [ ] Server logs show "📢 Broadcasting to room: auction:xyz"
   - [ ] Server logs show "Clients in room: 2"

4. **Test Auction Closure**
   - [ ] Wait for auction to end (or manually close via cron)
   - [ ] Both windows show "⚫ Closed" status
   - [ ] Server logs show "📢 Broadcasted auction closure"
   - [ ] Client consoles show "📡 Received auction closure"

5. **Test Polling Fallback** (Optional)
   - [ ] Disable network in DevTools
   - [ ] Wait 10 seconds
   - [ ] See "⚠️ Socket.io connection timeout"
   - [ ] See "🔄 Starting polling fallback"
   - [ ] Re-enable network
   - [ ] See "✅ WebSocket connected - stopping polling"

## Expected Results

### ✅ Success Indicators

**Server Logs**:
```
✅ Socket.io server initialized successfully
✅ User connected: user-123 (vendor)
👁️ User user-123 watching auction auction-xyz
🔔 broadcastNewBid() called for auction auction-xyz
📢 Broadcasting to room: auction:auction-xyz
   - Clients in room: 2
✅ Broadcast successful
```

**Client Logs (Window 1 - Bidder)**:
```
✅ Socket.io connected
   - Transport: websocket
👁️ Joining auction room: auction:auction-xyz
```

**Client Logs (Window 2 - Viewer)**:
```
✅ Socket.io connected
   - Transport: websocket
👁️ Joining auction room: auction:auction-xyz
📡 Received new bid event for auction-xyz
   - Bid amount: ₦150,000
✅ Auction state updated
```

### ❌ Failure Indicators

**Server Logs**:
```
❌ Socket.io server not initialized - cannot broadcast bid
   - This means io is null/undefined
   - Check that initializeSocketServer() was called in server.ts
```
→ **Fix**: Check `server.ts` - ensure `io` variable is not prefixed with `_`

**Client Logs**:
```
❌ Socket.io connection error: Error: xhr poll error
   - Error message: ...
```
→ **Fix**: Check server is running and CORS is configured correctly

**Client Logs**:
```
⚠️ Socket.io connection timeout after 10 seconds
   - Polling fallback will be used if available
```
→ **Expected**: This is normal if WebSocket can't connect (e.g., on Vercel)

## Common Issues

### Issue 1: "0 clients in room"
**Symptoms**: Server logs show "Clients in room: 0" when broadcasting
**Cause**: Clients not joining rooms properly
**Fix**: 
1. Check client console for "Joining auction room" log
2. Verify `useAuctionWatch()` hook is being called
3. Check that `socket.emit('auction:watch', { auctionId })` is executed

### Issue 2: Bid updates not showing
**Symptoms**: Window 2 doesn't update when Window 1 places bid
**Cause**: Broadcast not reaching clients
**Fix**:
1. Check server logs for "Broadcasting to room" message
2. Verify "Clients in room" > 0
3. Check client console for "Received new bid event"
4. Verify `useAuctionUpdates()` hook is being called

### Issue 3: Polling not activating
**Symptoms**: No polling after WebSocket fails
**Cause**: Timeout not triggering or polling logic not running
**Fix**:
1. Wait full 10 seconds for timeout
2. Check console for "Starting polling fallback" message
3. Verify `/api/auctions/[id]/poll` endpoint exists

### Issue 4: Rate limiting errors
**Symptoms**: 429 Too Many Requests from polling API
**Cause**: Polling too frequently (< 2 seconds between requests)
**Fix**: This is expected behavior. Polling interval is 3 seconds, rate limit is 2 seconds. Should not occur in normal operation.

## Performance Benchmarks

### WebSocket Performance
- **Connection Time**: < 1 second
- **Broadcast Latency**: < 100ms
- **Update Frequency**: Real-time (instant)
- **Bandwidth**: ~1KB per update

### Polling Performance
- **Connection Time**: N/A (uses existing HTTP)
- **Poll Latency**: 0-3 seconds (depends on timing)
- **Update Frequency**: Every 3 seconds
- **Bandwidth**: ~2KB per poll (with ETag: ~200 bytes)

## Development vs Production

### Development (localhost)
- ✅ WebSocket works perfectly
- ✅ Custom server with Socket.io
- ✅ Real-time updates (< 100ms latency)
- ✅ Connection indicator shows "WebSocket ✅"

### Production (Vercel)
- ❌ WebSocket not supported (custom server required)
- ✅ Polling fallback activates automatically
- ⚠️ Updates every 3 seconds (not real-time)
- ⚠️ Connection indicator shows "Polling ⚠️"

### Production (Alternative Platforms)
If deployed to Railway, Render, or AWS EC2:
- ✅ WebSocket works (custom server supported)
- ✅ Real-time updates
- ✅ Connection indicator shows "WebSocket ✅"

## Quick Debugging Commands

### Check if Socket.io server is running
```bash
curl http://localhost:3000/socket.io/
```
Expected: `{"code":0,"message":"Transport unknown"}`

### Check polling API
```bash
curl http://localhost:3000/api/auctions/test-auction-123/poll
```
Expected: `{"error":"Unauthorized"}` (need auth token)

### Check Redis connection
```bash
# In Node.js console
const { redis } = require('./src/lib/redis/client');
redis.ping().then(console.log); // Should print "PONG"
```

### Monitor Socket.io rooms
Add this to `server.ts` for debugging:
```typescript
setInterval(() => {
  if (io) {
    const rooms = io.sockets.adapter.rooms;
    console.log('Active rooms:', Array.from(rooms.keys()));
  }
}, 10000); // Log every 10 seconds
```

## Summary

This checklist ensures the Socket.io real-time bidding system is working correctly. Follow the Quick Test steps to verify functionality in under 5 minutes. Use the troubleshooting section if issues arise.

**Key Success Metric**: Window 2 updates within 1 second (WebSocket) or 3 seconds (polling) when Window 1 places a bid.
