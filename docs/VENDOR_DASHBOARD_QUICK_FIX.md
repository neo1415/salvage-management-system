# Vendor Dashboard Quick Fix Guide

## 🚨 Problem
- Registration fee shows ₦12,500 instead of ₦20,500
- Auction timers don't appear on cards

## ✅ Solution Applied

### What I Did
1. Added cache-busting headers to prevent browser caching
2. Added diagnostic console logs to help debug
3. Verified the API returns correct values (₦20,500)

### What You Need to Do

#### Step 1: Open Browser DevTools
Press `F12` or right-click → Inspect

#### Step 2: Clear Everything
1. Go to **Application** tab
2. Click **Clear storage**
3. Click **Clear site data**
4. Close DevTools

#### Step 3: Hard Refresh
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

#### Step 4: Check Console
1. Open DevTools again (F12)
2. Go to **Console** tab
3. Navigate to vendor dashboard
4. Look for these logs:

**For Registration Fee:**
```
🔍 KYC Status Card - API Response: {...}
💰 Registration Fee Amount: 20500
```

**For Auction Timers:**
```
⏱️ Auction abc123 - Status: active, Timer: 2d 5h 30m
⏱️ Auction def456 - Status: scheduled, Timer: 1d 12h
```

## 🔍 What the Logs Tell You

### Registration Fee Logs

| Log Shows | Meaning | Action |
|-----------|---------|--------|
| `feeAmount: 20500` | ✅ Correct value | Should display ₦20,500 |
| `feeAmount: 12500` | ❌ Old cached value | Clear cache again |
| No logs | ❌ Component not loading | Check for errors |

### Timer Logs

| Log Shows | Meaning | Action |
|-----------|---------|--------|
| `Timer: 2d 5h 30m` | ✅ Timer working | Should display on card |
| `Timer: Ended` | ⚠️ Auction expired | Timer correctly hidden |
| `Status: closed` | ⚠️ Auction closed | Timer correctly hidden |
| No logs | ❌ No active auctions | Create test auction |

## 🧪 Test the Fix

### Test Registration Fee
1. Go to `/vendor` (vendor dashboard)
2. Look at the banner at the top
3. Should say: "Pay the one-time registration fee (₦20,500)"

### Test Auction Timers
1. Go to `/vendor/auctions`
2. Look at auction cards
3. Should see timer below price (if auction is active)
4. Format: "Ends in 2d 5h" with clock icon

## 🐛 Still Not Working?

### Try Incognito Mode
1. Open new incognito/private window
2. Login again
3. Check if values are correct
4. If YES → Cache issue, clear more aggressively
5. If NO → Report with console logs

### Nuclear Option: Clear Everything
Run this in browser console:
```javascript
localStorage.clear();
sessionStorage.clear();
caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister()));
location.reload(true);
```

## 📊 Diagnostic Script

Run this to verify backend is correct:
```bash
npx tsx scripts/diagnose-vendor-dashboard-issues.ts
```

Should show:
```
✅ Config Service returned:
   Registration Fee: ₦20,500
   Type: number
   Raw value: 20500
```

## 📸 What to Screenshot

If still broken, send screenshots of:
1. **Console tab** - showing the logs (or lack of logs)
2. **Network tab** - showing `/api/vendors/registration-fee/status` response
3. **The actual page** - showing what you see

## ⚡ Quick Checklist

- [ ] Cleared browser cache
- [ ] Hard refreshed (Ctrl+Shift+R)
- [ ] Opened DevTools console
- [ ] Checked for console logs
- [ ] Verified API response in Network tab
- [ ] Tried incognito mode
- [ ] Ran diagnostic script

## 🎯 Expected Results

After following these steps:
- ✅ Registration fee banner shows ₦20,500
- ✅ Auction cards show countdown timers
- ✅ Console logs appear every second
- ✅ Network tab shows correct API responses

## 📞 Need Help?

Share:
1. Console log screenshots
2. Network tab screenshots
3. Browser version
4. Steps you tried
