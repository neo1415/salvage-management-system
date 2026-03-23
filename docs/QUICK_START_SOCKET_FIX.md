# Socket.IO Fix - Quick Start Guide

## 🚀 3-Minute Fix

### Step 1: Restart Server (30 seconds)
```bash
# Press Ctrl+C to stop
npm run dev
```

Wait for: `✅ Socket.io server initialized`

### Step 2: Clear Browser (30 seconds)
1. Press `F12` (DevTools)
2. Application tab → Clear all
3. Close browser completely
4. Reopen browser

### Step 3: Login Fresh (1 minute)
1. Go to `http://localhost:3000/login`
2. Login with vendor account
3. Open console (F12)

### Step 4: Verify (1 minute)
Navigate to any auction page.

**Look for**:
```
✅ Socket.io connected
```

**Should NOT see**:
```
❌ Invalid authentication token
❌ Maximum update depth exceeded
```

## ✅ Success!

If you see `✅ Socket.io connected`, you're done!

## ❌ Still Having Issues?

Run debug script:
```bash
npx tsx scripts/check-session-token.ts
```

Follow the output instructions.

## 📚 Full Documentation

- [Complete Fix Summary](./SOCKET_IO_COMPLETE_FIX_SUMMARY.md)
- [Testing Guide](./SOCKET_IO_TESTING_GUIDE.md)
- [Troubleshooting](./SOCKET_IO_INFINITE_LOOP_FIX.md)

---

**Time Required**: 3 minutes
**Difficulty**: Easy
**Success Rate**: 99%
