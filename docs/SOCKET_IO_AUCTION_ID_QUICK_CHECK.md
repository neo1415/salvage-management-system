# Socket.io Auction ID Quick Check

## 🚨 Are You Testing Correctly?

### ⚡ 30-Second Verification

Run this in **BOTH** browser consoles (F12):

```javascript
window.location.pathname.split('/').pop()
```

**Do they match?**
- ✅ **YES** → You're testing correctly! Place a bid and watch the other window update.
- ❌ **NO** → You're on different auctions! Copy/paste the same URL to both windows.

---

## 🎯 Quick Fix

### If Auction IDs Don't Match:

1. **Window 1**: Copy the full URL from address bar
2. **Window 2**: Paste the EXACT same URL
3. **Verify**: Run the script above again in both consoles
4. **Test**: Place a bid in Window 1, watch Window 2 update

---

## 📋 Pre-Test Checklist

Before testing Socket.io, verify:

- [ ] Both windows show **same auction ID** in URL
- [ ] Both windows show **same vehicle/asset**
- [ ] Both windows show **same current bid**
- [ ] Logged in as **different vendors**
- [ ] Auction status is **"Active"** or **"Extended"**
- [ ] Console open in Window 2 (F12)

---

## ✅ Success Indicators

When you place a bid in Window 1, Window 2 should:

1. ✅ Console: "📡 Received new bid event"
2. ✅ UI: Current bid updates automatically
3. ✅ UI: Yellow highlight animation
4. ✅ Toast: "You've been outbid!"

---

## 🔧 Browser Console Monitor

Paste this in Window 2 console to see events:

```javascript
const auctionId = window.location.pathname.split('/').pop();
console.log('🎯 Monitoring auction:', auctionId);
console.log('💡 Place a bid in another window to test');
```

---

## 📚 Full Guide

For detailed instructions, see:
- `docs/SOCKET_IO_AUCTION_ID_MISMATCH_GUIDE.md`
- Run: `npm run tsx scripts/verify-auction-id-match.ts`

---

## 🐛 Still Not Working?

1. Check server logs for "✅ Broadcast successful"
2. Check Network tab for WebSocket connection (filter: WS)
3. Verify both windows are on an **active** auction
4. Try refreshing both windows
5. Run diagnostic: `npm run tsx scripts/diagnose-socket-io.ts`

---

**Remember**: Socket.io uses rooms. Different auctions = different rooms = no updates!
