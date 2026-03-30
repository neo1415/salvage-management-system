# Real-Time UI Updates - Quick Reference

## 🚀 Quick Start

### Test Real-Time Updates
1. Start dev server: `npm run dev`
2. Open auction in 2 browser windows
3. Place bid in Window 1
4. Window 2 updates instantly ✅

## 📊 Visual Feedback Summary

| Event | Visual Feedback | Duration |
|-------|----------------|----------|
| New Bid | Yellow highlight + bounce animation | 2 seconds |
| Extension | Orange gradient banner | 5 seconds |
| Closure | Blue loading banner with progress | Until complete |
| Connection | Green/yellow indicator badge | Always visible |

## 🎨 UI Components

### New Bid Animation
```tsx
// Yellow highlight on bid amount
<div className="scale-110 bg-yellow-100 rounded-lg p-2">
  ₦{currentBid.toLocaleString()}
</div>

// Bounce indicator
<div className="animate-bounce text-green-600">
  <svg>...</svg>
  <span>New Bid!</span>
</div>
```

### Extension Banner
```tsx
// Orange gradient with pulse
<div className="bg-gradient-to-r from-orange-500 to-yellow-500 
                animate-pulse">
  ⏰ Auction Extended by 2 Minutes!
</div>
```

### Real-Time Indicator
```tsx
// WebSocket (green)
<div className="text-green-600 bg-green-50">
  <span className="w-2 h-2 bg-green-500 animate-pulse"></span>
  Live updates active
</div>

// Polling (yellow)
<div className="text-yellow-600 bg-yellow-50">
  <span className="w-2 h-2 bg-yellow-500 animate-pulse"></span>
  Updates every 3 seconds
</div>
```

## 🔧 Hooks Used

```tsx
// Real-time updates
const { 
  auction,              // Full auction object
  latestBid,           // Most recent bid
  isExtended,          // Extension flag
  isClosed,            // Closure flag
  usingPolling,        // Fallback indicator
  isClosing,           // Closing state
  documentsGenerating, // Doc generation
  generatedDocuments,  // Generated docs
} = useAuctionUpdates(auctionId);

// Watching count
const { watchingCount } = useAuctionWatch(auctionId);
```

## 🧪 Testing

### Automated Test
```bash
npx tsx scripts/test-realtime-ui-updates.ts
```

### Manual Test Checklist
- [ ] New bid shows yellow highlight
- [ ] "New Bid!" indicator bounces
- [ ] Toast notification appears
- [ ] Extension banner shows (orange)
- [ ] Real-time indicator displays
- [ ] Closure banner shows progress
- [ ] Watching count updates

## 🎯 Success Indicators

✅ **Working Correctly:**
- Bid updates within 1 second (WebSocket) or 3 seconds (polling)
- Yellow highlight animation appears
- Toast notifications show
- Extension banner appears when bid in last 5 minutes
- Real-time indicator shows connection status

❌ **Not Working:**
- No visual feedback on new bids
- No extension notification
- No real-time indicator
- Updates require page refresh

## 🐛 Troubleshooting

### No Updates
**Check:** Browser console for Socket.io logs
**Fix:** Verify `useAuctionUpdates()` is called

### No Animation
**Check:** React DevTools for `showNewBidAnimation` state
**Fix:** Verify `latestBid` is updating

### No Extension Banner
**Check:** `auction.extensionCount` is incrementing
**Fix:** Ensure bid was placed in last 5 minutes

### Polling Not Working
**Check:** Wait 10 seconds for timeout
**Fix:** Verify `/api/auctions/[id]/poll` endpoint exists

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` | Main auction page with UI updates |
| `src/hooks/use-socket.ts` | Socket.io hooks |
| `src/app/api/auctions/[id]/poll/route.ts` | Polling fallback API |
| `docs/REALTIME_UI_UPDATES_IMPLEMENTATION.md` | Full documentation |

## 🌐 Production Behavior

### Vercel (Current)
- ❌ WebSocket: Not supported
- ✅ Polling: Activates automatically
- ⏱️ Latency: 0-3 seconds
- 🟡 Indicator: "Updates every 3 seconds"

### Railway/Render (Alternative)
- ✅ WebSocket: Supported
- ✅ Polling: Fallback only
- ⏱️ Latency: < 100ms
- 🟢 Indicator: "Live updates active"

## 📞 Support

**Full Documentation:**
- `docs/REALTIME_UI_UPDATES_IMPLEMENTATION.md`
- `docs/SOCKET_IO_REALTIME_BIDDING_FIX.md`
- `docs/SOCKET_IO_QUICK_REFERENCE.md`

**Test Script:**
- `scripts/test-realtime-ui-updates.ts`

**Manual Testing:**
1. Open 2 browser windows
2. Place bid in Window 1
3. Verify Window 2 updates instantly
4. Check for visual feedback

