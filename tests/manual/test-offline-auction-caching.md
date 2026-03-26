# Manual Test: Offline Auction Caching (Task 5.4)

## Test Date
2024-03-25

## Feature
Offline-first auction list pages with caching support

## Test Scope
- Vendor auction list page (`/vendor/auctions`)
- Admin auction management page (`/admin/auctions`)

## Prerequisites
- User logged in as vendor or admin
- Active internet connection initially
- Browser DevTools open (Network tab)

---

## Test Case 1: Online Auction Viewing & Caching

### Steps
1. Navigate to `/vendor/auctions` (as vendor) or `/admin/auctions` (as admin)
2. Wait for auctions to load
3. Observe the page loads successfully
4. Open IndexedDB in DevTools (Application > Storage > IndexedDB)
5. Check for `cachedAuctions` store

### Expected Results
- ✅ Auctions display correctly
- ✅ No offline indicator shown
- ✅ Refresh button is enabled and functional
- ✅ Auctions are cached in IndexedDB
- ✅ Each cached auction has `cachedAt` and `expiresAt` timestamps

---

## Test Case 2: Offline Viewing with Cached Data

### Steps
1. With auctions already cached (from Test Case 1)
2. Open DevTools Network tab
3. Set network to "Offline" mode
4. Refresh the page or navigate away and back
5. Observe the page behavior

### Expected Results
- ✅ Offline indicator banner appears at top
- ✅ Blue banner shows "Viewing cached data. Last updated: X"
- ✅ Cached auctions display correctly
- ✅ Refresh button is disabled with gray styling
- ✅ Hover tooltip says "Cannot refresh while offline"
- ✅ All auction data (images, prices, timers) visible

---

## Test Case 3: Cache Miss (No Cached Data Offline)

### Steps
1. Clear IndexedDB (Application > Storage > IndexedDB > Delete database)
2. Ensure network is still "Offline"
3. Navigate to `/vendor/auctions` or `/admin/auctions`
4. Observe the page behavior

### Expected Results
- ✅ Offline indicator banner appears
- ✅ Yellow warning banner shows "No cached data available"
- ✅ Empty state with WiFi-off icon displayed
- ✅ Message: "No cached data available. Please connect to the internet to view auctions."
- ✅ No error thrown in console

---

## Test Case 4: Reconnection & Refresh

### Steps
1. With cached data displayed offline
2. Set network back to "Online" in DevTools
3. Observe the offline indicator disappears
4. Click the "Refresh" button
5. Wait for data to reload

### Expected Results
- ✅ Offline indicator dismisses automatically
- ✅ Blue "cached data" banner disappears
- ✅ Refresh button becomes enabled
- ✅ Fresh data loads from API
- ✅ Cache is updated with new data
- ✅ "Last updated" timestamp updates

---

## Test Case 5: Manual Refresh Button

### Steps
1. While online, view auction list
2. Click the "Refresh" button
3. Observe the button state during refresh

### Expected Results
- ✅ Button shows "Refreshing..." text
- ✅ RefreshCw icon spins during refresh
- ✅ Button is disabled during refresh
- ✅ Fresh data loads successfully
- ✅ Button returns to normal "Refresh" state

---

## Test Case 6: Pull-to-Refresh (Mobile)

### Steps
1. Open page on mobile device or mobile emulation
2. While online, pull down from top of page
3. Observe refresh behavior

### Expected Results
- ✅ Pull-to-refresh indicator appears
- ✅ Data refreshes successfully
- ✅ Indicator dismisses after refresh
- ✅ Works only when online

---

## Test Case 7: Cache Expiry (24 Hours)

### Steps
1. View cached auctions
2. In DevTools, modify `expiresAt` timestamp in IndexedDB to past date
3. Go offline
4. Refresh page

### Expected Results
- ✅ Expired cache is cleared automatically
- ✅ Shows "No cached data available" message
- ✅ Auto-cleanup removes old entries

---

## Test Case 8: Offline Indicator Dismissal

### Steps
1. Go offline with cached data
2. Observe offline indicator banner
3. Click the "X" close button
4. Observe the compact badge appears

### Expected Results
- ✅ Banner slides up and dismisses
- ✅ Compact WiFi-off badge appears in top-right
- ✅ Badge shows pending count if applicable
- ✅ Clicking badge re-expands full banner
- ✅ Dismissal state persists in sessionStorage

---

## Test Case 9: Admin Auction Management Offline

### Steps
1. As admin, view `/admin/auctions` online
2. Cache loads with closed auctions
3. Go offline
4. Try to generate documents for an auction

### Expected Results
- ✅ Cached auctions display correctly
- ✅ Offline indicator shows
- ✅ "Last updated" timestamp visible
- ✅ Document generation buttons still visible
- ✅ Attempting to generate docs shows appropriate error (requires online)

---

## Test Case 10: Filter Persistence with Caching

### Steps
1. Apply filters (asset type, price range, location)
2. Wait for filtered results
3. Go offline
4. Refresh page

### Expected Results
- ✅ Filters persist in URL
- ✅ Cached data respects filters
- ✅ Filter chips display correctly
- ✅ Can clear filters while offline
- ✅ Filtered cached data displays

---

## Performance Checks

### Metrics to Verify
- ✅ Initial load < 2s on 3G
- ✅ Offline load < 500ms (from cache)
- ✅ Cache write < 100ms per auction
- ✅ No memory leaks after multiple offline/online cycles
- ✅ IndexedDB size reasonable (< 50MB for 1000 auctions)

---

## Browser Compatibility

Test on:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (iOS/macOS)
- ✅ Mobile browsers (Chrome Mobile, Safari Mobile)

---

## Known Limitations

1. **Infinite scroll removed**: All cached auctions load at once (no pagination offline)
2. **Cache size**: Limited by browser IndexedDB quota (~50MB typical)
3. **24-hour expiry**: Cached data expires after 24 hours
4. **No partial updates**: Full refresh required, no delta sync

---

## Acceptance Criteria Verification

- ✅ **Auctions cached when viewed online**: Verified in IndexedDB
- ✅ **Cached auctions available offline**: Displays from cache when offline
- ✅ **"Last updated" timestamp shown**: Blue banner shows relative time
- ✅ **Cache expires after 24 hours**: Auto-cleanup implemented
- ✅ **Auto-cleanup of old cache**: Expired entries removed automatically

---

## Issues Found

_Document any issues discovered during testing_

| Issue | Severity | Description | Status |
|-------|----------|-------------|--------|
| - | - | - | - |

---

## Test Result

**Status**: ⬜ Not Started / 🟡 In Progress / ✅ Passed / ❌ Failed

**Tested By**: _________________

**Notes**:
_Add any additional observations or comments_

