# Socket.io Visual Testing Guide

## 🎯 Step-by-Step Visual Guide

This guide provides visual examples of how to test Socket.io real-time bidding correctly.

---

## 📸 Step 1: Open First Window

### What to Do:
1. Navigate to `/vendor/auctions`
2. Click on any **Active** auction
3. Note the URL in the address bar

### Visual Example:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🌐 http://localhost:3000/vendor/auctions/a7a0ed18-1f75-4ec3... │ ← Copy this!
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ← Back                                    🟢 Active            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │              [Photo of 2019 Toyota Camry]              │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  2019 Toyota Camry                                              │
│  Claim Reference: CLM-2024-001                                  │
│                                                                 │
│  Current Bid: ₦70,000                                           │
│  Minimum Bid: ₦90,000                                           │
│  Time Remaining: 02:45:30                                       │
│                                                                 │
│  [Place Bid]  [Watch Auction]                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**✅ Action**: Copy the full URL from the address bar

---

## 📸 Step 2: Open Second Window

### What to Do:
1. Open a new browser window (or incognito mode)
2. **Paste the EXACT same URL** from Step 1
3. Log in as a **different vendor**

### Visual Example:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🌐 http://localhost:3000/vendor/auctions/a7a0ed18-1f75-4ec3... │ ← Same URL!
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ← Back                                    🟢 Active            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │              [Photo of 2019 Toyota Camry]              │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  2019 Toyota Camry                                              │
│  Claim Reference: CLM-2024-001                                  │
│                                                                 │
│  Current Bid: ₦70,000                                           │
│  Minimum Bid: ₦90,000                                           │
│  Time Remaining: 02:45:30                                       │
│                                                                 │
│  [Place Bid]  [Watch Auction]                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**✅ Action**: Verify both windows show the same vehicle and details

---

## 📸 Step 3: Verify Auction IDs Match

### What to Do:
1. Press **F12** in both windows to open DevTools
2. Go to **Console** tab
3. Run the verification script

### Visual Example:

#### Window 1 Console:
```
┌─────────────────────────────────────────────────────────────────┐
│ Console  │  Network  │  Sources  │  Performance  │  Memory     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ > const auctionId = window.location.pathname.split('/').pop(); │
│ > console.log('🎯 Current Auction ID:', auctionId);            │
│                                                                 │
│ 🎯 Current Auction ID: a7a0ed18-1f75-4ec3-8a8a-a9b99247d4d3    │
│ 📋 Copy this ID and compare with other window                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Window 2 Console:
```
┌─────────────────────────────────────────────────────────────────┐
│ Console  │  Network  │  Sources  │  Performance  │  Memory     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ > const auctionId = window.location.pathname.split('/').pop(); │
│ > console.log('🎯 Current Auction ID:', auctionId);            │
│                                                                 │
│ 🎯 Current Auction ID: a7a0ed18-1f75-4ec3-8a8a-a9b99247d4d3    │
│ 📋 Copy this ID and compare with other window                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**✅ Result**: Both show `a7a0ed18-1f75-4ec3-8a8a-a9b99247d4d3` - IDs match!

---

## 📸 Step 4: Place a Bid

### What to Do:
1. Keep Window 2 console open
2. In Window 1, click **[Place Bid]**
3. Enter bid amount (e.g., ₦90,000)
4. Click **Submit**

### Visual Example:

#### Window 1 (Placing Bid):
```
┌─────────────────────────────────────────────────────────────────┐
│                     Place Your Bid                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Current Bid: ₦70,000                                           │
│  Minimum Bid: ₦90,000                                           │
│                                                                 │
│  Your Bid Amount:                                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ₦ 90,000                                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Cancel]  [Submit Bid] ← Click here                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**✅ Action**: Submit the bid in Window 1

---

## 📸 Step 5: Watch Window 2 Update

### What to See:
1. Console shows "📡 Received new bid event"
2. UI updates automatically (no refresh!)
3. Toast notification appears
4. Yellow highlight animation on bid amount

### Visual Example:

#### Window 2 Console (After Bid):
```
┌─────────────────────────────────────────────────────────────────┐
│ Console  │  Network  │  Sources  │  Performance  │  Memory     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ✅ Socket.io connected                                          │
│    - Transport: websocket                                       │
│    - Socket ID: abc123xyz                                       │
│                                                                 │
│ 👁️  Joining auction room: auction:a7a0ed18-1f75-4ec3-8a8a...   │
│                                                                 │
│ 📡 Received new bid event for a7a0ed18-1f75-4ec3-8a8a...       │
│    - Bid amount: ₦90,000                                        │
│    - Vendor ID: vendor-123                                      │
│                                                                 │
│ ✅ Auction state updated                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Window 2 UI (After Bid):
```
┌─────────────────────────────────────────────────────────────────┐
│ 🌐 http://localhost:3000/vendor/auctions/a7a0ed18-1f75-4ec3... │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ← Back                                    🟢 Active            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │              [Photo of 2019 Toyota Camry]              │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  2019 Toyota Camry                                              │
│  Claim Reference: CLM-2024-001                                  │
│                                                                 │
│  Current Bid: ₦90,000 ✨ ← Updated automatically!               │
│  Minimum Bid: ₦110,000                                          │
│  Time Remaining: 02:45:25                                       │
│                                                                 │
│  [Place Bid]  [Watch Auction]                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 🔔 You've been outbid!                                  │  │
│  │ New bid: ₦90,000. Place a higher bid to stay in lead.  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**✅ Success**: Window 2 updated without refreshing!

---

## ❌ Common Mistake: Different Auctions

### What NOT to Do:

#### Window 1:
```
┌─────────────────────────────────────────────────────────────────┐
│ 🌐 http://localhost:3000/vendor/auctions/a7a0ed18-1f75-4ec3... │
├─────────────────────────────────────────────────────────────────┤
│  2019 Toyota Camry                                              │
│  Current Bid: ₦70,000                                           │
└─────────────────────────────────────────────────────────────────┘
```

#### Window 2 (WRONG - Different Auction):
```
┌─────────────────────────────────────────────────────────────────┐
│ 🌐 http://localhost:3000/vendor/auctions/a46c4199-da09-4946... │ ← Different!
├─────────────────────────────────────────────────────────────────┤
│  2020 Honda Accord                                              │
│  Current Bid: ₦50,000                                           │
└─────────────────────────────────────────────────────────────────┘
```

**❌ Result**: Window 2 won't update because it's on a different auction!

---

## 🔍 How to Check WebSocket Connection

### What to Do:
1. Open DevTools (F12)
2. Go to **Network** tab
3. Filter by **WS** (WebSocket)
4. Look for "socket.io" connection

### Visual Example:

```
┌─────────────────────────────────────────────────────────────────┐
│ Network  │  Console  │  Sources  │  Performance  │  Memory     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Filter: [WS] ← Click here                                       │
│                                                                 │
│ Name                    Status    Type        Size    Time      │
│ ─────────────────────────────────────────────────────────────  │
│ socket.io/?EIO=4...    101       websocket   -       -         │ ← Look for this!
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ Headers  │  Preview  │  Response  │  Timing  │  WS      │   │
│ ├─────────────────────────────────────────────────────────┤   │
│ │                                                         │   │
│ │ Messages:                                               │   │
│ │                                                         │   │
│ │ ↑ 42["auction:watch",{"auctionId":"a7a0ed18..."}]      │   │
│ │ ↓ 42["auction:new-bid",{"auctionId":"a7a0ed18...",...}]│   │
│ │ ↓ 42["auction:updated",{"auctionId":"a7a0ed18...",...}]│   │
│ │                                                         │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**✅ What to Look For**:
- Status: `101 Switching Protocols`
- Type: `websocket`
- Messages showing `auction:new-bid` events

---

## 🎯 Quick Verification Checklist

Use this checklist before testing:

```
┌─────────────────────────────────────────────────────────────────┐
│                  Pre-Test Verification                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  □ Both windows show SAME auction ID in URL                     │
│  □ Both windows show SAME vehicle/asset                         │
│  □ Both windows show SAME current bid                           │
│  □ Both windows show SAME photos                                │
│  □ Logged in as DIFFERENT vendors                               │
│  □ Auction status is "Active" or "Extended"                     │
│  □ Console open in Window 2 (F12)                               │
│  □ WebSocket connection visible in Network tab                  │
│                                                                 │
│  If all checked: ✅ Ready to test!                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎉 Success Indicators

### You'll Know It's Working When:

1. **Console Shows Events**:
   ```
   📡 Received new bid event for a7a0ed18...
      - Bid amount: ₦90,000
   ```

2. **UI Updates Automatically**:
   - Current bid changes from ₦70,000 → ₦90,000
   - No page refresh needed!

3. **Visual Feedback**:
   - Yellow highlight animation on bid amount
   - "New Bid!" indicator appears

4. **Toast Notification**:
   ```
   ┌─────────────────────────────────────────┐
   │ 🔔 You've been outbid!                  │
   │ New bid: ₦90,000. Place a higher bid.  │
   └─────────────────────────────────────────┘
   ```

5. **Server Logs**:
   ```
   ✅ Broadcast successful for auction a7a0ed18...
   ```

---

## 🐛 Troubleshooting Visual Guide

### Issue: No WebSocket Connection

**What You See**:
```
┌─────────────────────────────────────────────────────────────────┐
│ Network  │  Console  │  Sources  │  Performance  │  Memory     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Filter: [WS]                                                    │
│                                                                 │
│ No WebSocket connections found                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Solutions**:
1. Check if server is running (`npm run dev`)
2. Refresh the page
3. Check firewall/proxy settings
4. Look for errors in console

---

### Issue: Events Not Appearing

**What You See**:
```
┌─────────────────────────────────────────────────────────────────┐
│ Console  │  Network  │  Sources  │  Performance  │  Memory     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ✅ Socket.io connected                                          │
│    - Transport: websocket                                       │
│                                                                 │
│ 👁️  Joining auction room: auction:a7a0ed18...                  │
│                                                                 │
│ (No new events after placing bid)                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Solutions**:
1. Verify auction IDs match (run verification script)
2. Check server logs for broadcast messages
3. Try refreshing both windows
4. Check if auction is still active

---

## 📚 Additional Resources

- **Full Guide**: `docs/SOCKET_IO_AUCTION_ID_MISMATCH_GUIDE.md`
- **Quick Check**: `docs/SOCKET_IO_AUCTION_ID_QUICK_CHECK.md`
- **Diagnostic Script**: `npm run socket:verify-auction-id`
- **Troubleshooting**: `npm run socket:diagnose`

---

## 💡 Pro Tips

### Tip 1: Use Incognito Mode
Open Window 2 in incognito mode to easily log in as a different vendor without logging out of Window 1.

### Tip 2: Bookmark the Auction
Bookmark an active auction URL to quickly open it in multiple windows for testing.

### Tip 3: Keep Console Open
Always keep the console open in Window 2 to see real-time events as they happen.

### Tip 4: Test with 3+ Windows
Try opening 3 or more windows on the same auction to see how Socket.io scales.

### Tip 5: Monitor Server Logs
Keep an eye on server logs to see broadcast messages and verify Socket.io is working server-side.

---

**Created by**: Kiro AI  
**Date**: 2025-01-XX  
**Purpose**: Visual guide for testing Socket.io real-time bidding correctly
