# Socket.io Real-Time Bidding - Quick Reference

## 🚀 Quick Start

### Start Development Server
```bash
npm run dev
```

### Test Real-Time Updates
1. Open 2 browser windows to same auction
2. Place bid in Window 1
3. Window 2 updates within 1 second ✅

## 📊 Key Metrics

| Metric              | WebSocket | Polling |
|---------------------|-----------|---------|
| Update Latency      | < 100ms   | 0-3s    |
| Fallback Activation | N/A       | 10s     |
| Poll Interval       | N/A       | 3s      |
| Rate Limit          | N/A       | 2s      |

## 🔍 Debug Logs

### Server Logs (Good)
```
✅ Socket.io server initialized successfully
📢 Broadcasting to room: auction:xyz
   - Clients in room: 2
✅ Broadcast successful
```

### Server Logs (Bad)
```
❌ Socket.io server not initialized
   - Check that initializeSocketServer() was called
```
**Fix**: Check `server.ts` - ensure `io` variable (not `_io`)

### Client Logs (Good)
```
✅ Socket.io connected
   - Transport: websocket
📡 Received new bid event
   - Bid amount: ₦150,000
```

### Client Logs (Fallback)
```
⚠️ Socket.io connection timeout after 10 seconds
🔄 Starting polling fallback
📊 Poll: Auction updated
```

## 🛠️ Troubleshooting

### Problem: Bid updates not showing
**Check**:
1. Server logs: "Clients in room: X" (should be > 0)
2. Client logs: "Joining auction room"
3. Client logs: "Received new bid event"

**Fix**: Ensure `useAuctionWatch()` hook is called

### Problem: "0 clients in room"
**Check**: Client console for "Joining auction room" log

**Fix**: Verify `socket.emit('auction:watch', { auctionId })` is executed

### Problem: Polling not working
**Check**: 
1. Wait full 10 seconds for timeout
2. Check for "Starting polling fallback" log
3. Verify `/api/auctions/[id]/poll` endpoint exists

**Fix**: Ensure `useAuctionUpdates()` hook is called

## 📁 Files Modified

| File | Changes |
|------|---------|
| `src/lib/socket/server.ts` | Added debug logging, error handling |
| `server.ts` | Fixed initialization (`_io` → `io`) |
| `src/features/auctions/services/closure.service.ts` | Added broadcast calls |
| `src/hooks/use-socket.ts` | Added logging, polling fallback |
| `src/app/api/auctions/[id]/poll/route.ts` | NEW - Polling API |
| `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` | Added connection indicator |

## 🧪 Test Commands

### Run Test Script
```bash
npx tsx scripts/test-socket-io-realtime-bidding.ts
```

### Check Diagnostics
```bash
npm run type-check
```

### Manual Test
1. Open: http://localhost:3000/vendor/auctions/[id]
2. Open: http://localhost:3000/vendor/auctions/[id] (2nd window)
3. Place bid in Window 1
4. Verify Window 2 updates

## 🎯 Success Indicators

✅ **Working Correctly**:
- Server logs show "Clients in room: 2"
- Client logs show "Received new bid event"
- Window 2 updates within 1 second
- Connection indicator shows "WebSocket ✅"

❌ **Not Working**:
- Server logs show "Clients in room: 0"
- Client logs show no "Received" messages
- Window 2 doesn't update
- Connection indicator shows "Polling ⚠️" (in dev)

## 🌐 Production Behavior

### Vercel (Current)
- ❌ WebSocket: Not supported
- ✅ Polling: Activates automatically
- ⏱️ Latency: 0-3 seconds

### Railway/Render/AWS (Alternative)
- ✅ WebSocket: Supported
- ✅ Polling: Fallback only
- ⏱️ Latency: < 100ms

## 📞 Support

**Issues?**
1. Check `docs/SOCKET_IO_TESTING_CHECKLIST.md`
2. Review `docs/SOCKET_IO_REALTIME_BIDDING_FIX.md`
3. Run test script
4. Check server and client console logs

**Key Files**:
- Full docs: `docs/SOCKET_IO_REALTIME_BIDDING_FIX.md`
- Testing: `docs/SOCKET_IO_TESTING_CHECKLIST.md`
- Architecture: `docs/SOCKET_IO_ARCHITECTURE_DIAGRAM.md`
- Checklist: `docs/SOCKET_IO_IMPLEMENTATION_CHECKLIST.md`
