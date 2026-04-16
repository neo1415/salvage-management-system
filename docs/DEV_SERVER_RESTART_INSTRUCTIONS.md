# Dev Server Restart Instructions - CRITICAL

## 🚨 Why You Need to Restart NOW

Your code changes are NOT being picked up by the dev server. Evidence:

1. **Payment webhook**: Deposit events show NULL values (old code running)
2. **Auction closure UI**: Status not updating (Socket.IO hooks not reloaded)
3. **TypeScript fixes**: Applied but not executing

---

## ✅ What Was Fixed

### Payment Webhook Issues
- ✅ TypeScript type 'never' errors fixed
- ✅ Deposit event before/after values fixed (no more NULLs)
- ✅ Pickup authorization generation added
- ✅ Fund release to finance added
- ✅ Real-time UI updates added

### Auction Closure UI Issues
- ✅ Socket.IO event handler updated to set `status: 'closed'`
- ✅ Auction state updates immediately on closure

---

## 🔧 How to Restart (Choose One)

### Option 1: Simple Restart (Recommended)
```bash
# In your terminal where dev server is running:
# 1. Press Ctrl+C to stop
# 2. Wait for it to fully stop
# 3. Run:
npm run dev
```

### Option 2: Full Clean Restart (If Option 1 Doesn't Work)
```bash
# Stop dev server (Ctrl+C)
# Then run:
rm -rf .next
npm run dev
```

### Option 3: Nuclear Option (If Nothing Else Works)
```bash
# Stop dev server (Ctrl+C)
# Then run:
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

---

## 🧪 How to Verify It Worked

### 1. Check Terminal Output
After restart, you should see:
```
✓ Ready in X.Xs
○ Compiling /api/webhooks/paystack ...
✓ Compiled /api/webhooks/paystack in X.Xs
```

### 2. Test Payment Flow
1. Go to auction page
2. Initialize Paystack payment
3. Complete payment on Paystack
4. Check server logs for:
   ```
   📥 Paystack webhook received
   🎯 Routing to auction payment handler
   💰 Triggering fund release to finance
   🎫 Generating pickup authorization
   ✅ Fund release completed
   ```

### 3. Check Database
```bash
npx tsx scripts/diagnose-webhook-execution.ts <auction-id>
```

Should show:
- ✅ Balance Before: NOT NULL
- ✅ Frozen Before: NOT NULL
- ✅ Available Before: NOT NULL
- ✅ Available After: NOT NULL

### 4. Test Auction Closure UI
1. End auction early from manager dashboard
2. Check browser console for:
   ```
   📡 Received auction closure for xxx
   ✅ Auction state updated to 'closed'
   ```
3. UI should update WITHOUT page refresh

---

## ⚠️ Common Mistakes

### ❌ DON'T: Just refresh the browser
- This doesn't reload server-side code
- Only reloads client-side React components

### ❌ DON'T: Assume hot-reload worked
- Next.js hot-reload is unreliable for:
  - Service files
  - Database transaction logic
  - TypeScript type changes
  - Import statement changes

### ✅ DO: Actually restart the dev server
- Stop it completely (Ctrl+C)
- Wait for it to fully stop
- Start it again (npm run dev)

---

## 🎯 What to Test After Restart

### Test 1: Payment Webhook
1. Initialize new Paystack payment
2. Complete payment on Paystack
3. Verify:
   - ✅ Payment verified
   - ✅ Deposit unfrozen with complete before/after values
   - ✅ Pickup authorization sent (SMS, email, push, in-app)
   - ✅ Money transferred to finance dashboard

### Test 2: Auction Closure UI
1. End auction early from manager dashboard
2. Verify:
   - ✅ UI updates to "closed" WITHOUT page refresh
   - ✅ Documents generated notification appears
   - ✅ Browser console shows Socket.IO events

### Test 3: Real-Time Updates
1. Open auction page in two browser tabs
2. Place bid in one tab
3. Verify:
   - ✅ Other tab updates WITHOUT page refresh
   - ✅ Bid count updates
   - ✅ Current bid updates

---

## 📞 If Issues Persist

If you restart and issues still occur:

1. **Share server logs**:
   - Copy the terminal output during webhook execution
   - Look for errors or warnings

2. **Share diagnostic output**:
   ```bash
   npx tsx scripts/diagnose-webhook-execution.ts <auction-id>
   ```

3. **Share browser console**:
   - Open DevTools (F12)
   - Go to Console tab
   - Copy any errors or Socket.IO messages

4. **Confirm restart**:
   - Did you see "✓ Ready in X.Xs" in terminal?
   - Did you see compilation messages?
   - Did you wait for it to fully stop before restarting?

---

## 🎉 Expected Results

After restart, everything should work:

### Payment Flow
```
User completes Paystack payment
  ↓
Webhook called
  ↓
Deposit unfrozen (with complete before/after values)
  ↓
Pickup authorization generated and sent
  ↓
Money transferred to finance
  ↓
UI updates in real-time
```

### Auction Closure Flow
```
Manager ends auction early
  ↓
Backend closes auction
  ↓
Socket.IO broadcasts closure event
  ↓
Client receives event
  ↓
UI updates to "closed" WITHOUT page refresh
  ↓
Documents generated notification appears
```

---

## 🚀 Quick Checklist

- [ ] Stop dev server (Ctrl+C)
- [ ] Wait for it to fully stop
- [ ] Run `npm run dev`
- [ ] Wait for "✓ Ready" message
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Test payment flow
- [ ] Test auction closure UI
- [ ] Verify deposit events have no NULLs
- [ ] Verify pickup authorization sent
- [ ] Verify money transferred to finance

---

**Remember**: The fixes are already in the code. You just need to restart the dev server so the NEW code executes!
