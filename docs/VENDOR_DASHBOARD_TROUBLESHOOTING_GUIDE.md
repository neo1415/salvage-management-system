# Vendor Dashboard Troubleshooting Guide

## Issues Reported
1. Registration fee banner shows ₦12,500 instead of ₦20,500
2. Auction card timers don't display

## Root Cause Analysis

### Issue 1: Registration Fee Display

**Status**: ✅ Code is correct, likely browser cache issue

**What We Found**:
- The API endpoint `/api/vendors/registration-fee/status` **IS** returning the correct value (₦20,500)
- The config service is working correctly
- The component code is correct and fetches the dynamic value

**Why It Might Still Show ₦12,500**:
1. **Browser Cache**: The browser cached the old API response
2. **Service Worker Cache**: PWA service worker cached the old response
3. **Component State**: The component loaded before the config was updated

**Fixes Applied**:
1. ✅ Added cache-busting headers to the API endpoint:
   ```typescript
   headers: {
     'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
     'Pragma': 'no-cache',
     'Expires': '0',
   }
   ```

2. ✅ Added console logging to help debug:
   ```typescript
   console.log('🔍 KYC Status Card - API Response:', { kycData, feeData });
   console.log('💰 Registration Fee Amount:', feeData?.data?.feeAmount);
   ```

**How to Verify the Fix**:

1. **Open Browser DevTools** (F12)
2. **Go to Console tab**
3. **Navigate to vendor dashboard** (`/vendor`)
4. **Look for these logs**:
   ```
   🔍 KYC Status Card - API Response: {...}
   💰 Registration Fee Amount: 20500
   ```

5. **Check Network tab**:
   - Find the request to `/api/vendors/registration-fee/status`
   - Check the response body - should show `"feeAmount": 20500`
   - Check response headers - should have `Cache-Control: no-store`

6. **If still showing ₦12,500**:
   - **Hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - **Clear cache**: DevTools → Application → Clear storage → Clear site data
   - **Clear service worker**: DevTools → Application → Service Workers → Unregister
   - **Incognito mode**: Test in a new incognito window

### Issue 2: Auction Card Timers Not Showing

**Status**: ✅ Code is correct, added diagnostic logging

**What We Found**:
- The timer logic is fully implemented in the AuctionCard component
- Timer updates every second
- Timer only shows for active/extended/scheduled auctions
- Timer hides when auction ends or status is closed/awaiting_payment

**Why Timers Might Not Show**:
1. **No Active Auctions**: All auctions are closed/cancelled
2. **Expired Auctions**: Auctions have passed their endTime
3. **Missing endTime**: Auction data doesn't have endTime field
4. **React Not Re-rendering**: Component state not updating

**Fixes Applied**:
1. ✅ Added comprehensive console logging to timer logic:
   ```typescript
   console.log(`⏱️ Auction ${auction.id} - Status: ${auction.status}, Timer: ${timeRemaining}`);
   ```

**How to Verify the Fix**:

1. **Open Browser DevTools** (F12)
2. **Go to Console tab**
3. **Navigate to auctions page** (`/vendor/auctions`)
4. **Look for timer logs** (one per second for each auction):
   ```
   ⏱️ Auction abc123 - Status: active, Timer: 2d 5h 30m, endTime: 2026-04-22T...
   ⏱️ Auction def456 - Status: scheduled, Timer: 1d 12h 45m
   ```

5. **Check what the logs show**:
   - **If you see logs**: Timer logic is running
   - **If timer shows "Ended"**: Auction has expired
   - **If no logs**: No auctions match the criteria (active/extended/scheduled)

6. **Verify auction data**:
   - Open Network tab
   - Find request to `/api/auctions`
   - Check response - each auction should have:
     - `status`: "active", "extended", or "scheduled"
     - `endTime`: Valid ISO date string
     - `scheduledStartTime`: (for scheduled auctions)

7. **Check the DOM**:
   - Right-click on an auction card
   - Inspect element
   - Look for the timer div with class `flex items-center gap-1.5 text-xs font-bold`
   - If it exists but is hidden, check CSS

## Quick Diagnostic Commands

### Check Config Value
```bash
npx tsx scripts/diagnose-vendor-dashboard-issues.ts
```

This will show:
- Current registration fee in database
- What the API returns
- Sample auction data with timer fields

### Check Active Auctions
```sql
SELECT id, status, "startTime", "endTime", "scheduledStartTime"
FROM auctions
WHERE status IN ('active', 'extended', 'scheduled')
LIMIT 5;
```

## Common Solutions

### Solution 1: Clear All Caches
```javascript
// Run in browser console
localStorage.clear();
sessionStorage.clear();
caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
location.reload(true);
```

### Solution 2: Force Component Refresh
Add a refresh button to the vendor dashboard that calls:
```typescript
window.location.reload();
```

### Solution 3: Check for Test Data
The auction page filters out test data:
```typescript
auction.status !== 'cancelled' && 
!auction.case.claimReference.toLowerCase().includes('test') &&
!getAssetNameForFiltering(auction).toLowerCase().includes('test')
```

Make sure your active auctions don't have "test" in the claim reference or asset name.

## Expected Behavior

### Registration Fee Banner
- **Before Payment**: Shows "Pay the one-time registration fee (₦20,500)"
- **After Payment**: Shows "Unlock Premium Auctions — Upgrade to Tier 2"
- **Updates**: Immediately when config changes (after cache clear)

### Auction Card Timer
- **Active Auction**: Shows "Ends in Xd Xh" with green/orange/red color
- **Scheduled Auction**: Shows "Starts in Xd Xh" with blue color
- **Closed Auction**: Timer disappears completely
- **Updates**: Every second while auction is active

## Files Modified

1. `src/app/api/vendors/registration-fee/status/route.ts`
   - Added cache-busting headers

2. `src/components/vendor/kyc-status-card.tsx`
   - Added console logging for debugging

3. `src/app/(dashboard)/vendor/auctions/page.tsx`
   - Added console logging to timer logic

## Next Steps

1. **Test in browser** with DevTools open
2. **Check console logs** to see what values are being received
3. **Hard refresh** if still showing old values
4. **Report findings** with console log screenshots

## Support

If issues persist after following this guide:
1. Take screenshots of browser console logs
2. Take screenshots of Network tab showing API responses
3. Note the exact steps to reproduce
4. Share browser version and device type
