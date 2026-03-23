# Manual Test: Auction Expiry Refresh Fix

## Test Environment Setup

1. **Start development server**:
   ```bash
   npm run dev
   ```

2. **Open browser console** (F12 or Cmd+Option+I)

3. **Enable verbose logging**:
   - Console should show all logs
   - Filter by "auction" or "expiry" if needed

## Test Case 1: Refresh Expired Auction (CRITICAL)

**This is the bug the user reported!**

### Setup
1. Find an active auction in the database that has already expired
2. Or wait for an active auction to expire naturally

### Steps
1. Navigate to the auction detail page: `/vendor/auctions/[id]`
2. Verify the page shows:
   - Status: "🟢 Active" (incorrect)
   - Time Remaining: "Expired"
3. **Press F5 or Cmd+R to refresh the page**
4. Watch the console logs

### Expected Console Output
```
🚀 Starting expiry check for auction [id]
🔍 Checking auction [id] expiry: { now: '...', endTime: '...', hasExpired: true, status: 'active' }
⏰ Auction [id] has expired! Calling API to close...
📡 API response for auction [id]: { success: true, closed: true, ... }
✅ Auction [id] successfully closed by API
🔔 Triggering onAuctionClosed callback
🎯 Auction expired and closed! Refreshing data...
```

### Expected Page Behavior
- Status badge changes to: "⚫ Closed"
- Time Remaining shows: "Expired"
- If you won the auction:
  - Documents section appears
  - Shows: "🎉 Congratulations! You Won This Auction"
  - Shows document cards (Bill of Sale, Liability Waiver, Pickup Authorization)
- Toast notification: "Auction Closed - This auction has ended"

### Pass Criteria
✅ Status changes from "🟢 Active" to "⚫ Closed"
✅ Documents appear (if winner)
✅ Console shows all expected logs
✅ No errors in console
✅ No duplicate API calls

### Fail Criteria
❌ Status stays "🟢 Active"
❌ No console logs appear
❌ Errors in console
❌ Documents don't appear
❌ Multiple API calls to `/api/auctions/check-expired`

---

## Test Case 2: Stay on Page When Auction Expires

### Setup
1. Find an active auction that expires in < 2 minutes
2. Navigate to the auction detail page

### Steps
1. Stay on the page without refreshing
2. Wait for countdown to reach "Expired"
3. Wait up to 10 seconds (polling interval)
4. Watch the console logs

### Expected Console Output
```
🚀 Starting expiry check for auction [id]
🔍 Checking auction [id] expiry: { now: '...', endTime: '...', hasExpired: false, status: 'active' }
[... 10 seconds later ...]
🔍 Checking auction [id] expiry: { now: '...', endTime: '...', hasExpired: true, status: 'active' }
⏰ Auction [id] has expired! Calling API to close...
📡 API response for auction [id]: { success: true, closed: true, ... }
✅ Auction [id] successfully closed by API
🔔 Triggering onAuctionClosed callback
🎯 Auction expired and closed! Refreshing data...
🧹 Cleaning up interval for auction [id]
```

### Expected Page Behavior
- Countdown reaches "Expired"
- Within 10 seconds, status changes to "⚫ Closed"
- Documents appear (if winner)
- Toast notification appears

### Pass Criteria
✅ Auction closes within 10 seconds of expiry
✅ Status updates automatically
✅ Documents appear (if winner)
✅ Polling stops after closure

---

## Test Case 3: Already Closed Auction

### Setup
1. Find a closed auction in the database
2. Navigate to the auction detail page

### Steps
1. Open the page
2. Watch the console logs

### Expected Console Output
```
⏸️  Hook disabled or auction already closed
```

### Expected Page Behavior
- Status shows: "⚫ Closed"
- Documents appear (if winner)
- No API calls to `/api/auctions/check-expired`

### Pass Criteria
✅ Hook is disabled
✅ No unnecessary API calls
✅ Page shows closed status immediately

---

## Test Case 4: Multiple Rapid Refreshes

### Setup
1. Find an expired auction (status still 'active' in DB)

### Steps
1. Navigate to the auction detail page
2. Refresh the page 5 times rapidly (F5, F5, F5, F5, F5)
3. Watch the console logs
4. Check Network tab for API calls

### Expected Behavior
- First refresh: Closes the auction
- Subsequent refreshes: Show closed status immediately
- Only ONE API call to `/api/auctions/check-expired`
- No errors

### Pass Criteria
✅ Only one closure API call
✅ No duplicate closures
✅ No errors
✅ Page shows correct status on all refreshes

---

## Test Case 5: Network Error Handling

### Setup
1. Find an expired auction
2. Open browser DevTools > Network tab
3. Enable "Offline" mode

### Steps
1. Navigate to the auction detail page
2. Refresh the page
3. Watch the console logs

### Expected Console Output
```
🚀 Starting expiry check for auction [id]
🔍 Checking auction [id] expiry: { now: '...', endTime: '...', hasExpired: true, status: 'active' }
⏰ Auction [id] has expired! Calling API to close...
❌ Error checking auction expiry: Failed to fetch
```

### Expected Page Behavior
- Status stays "🟢 Active"
- Error is logged but doesn't crash the page
- Hook continues polling (will retry in 10 seconds)

### Pass Criteria
✅ Error is caught and logged
✅ Page doesn't crash
✅ Hook continues polling

---

## Test Case 6: Winner Document Flow

### Setup
1. Create a test auction that expires soon
2. Place a winning bid
3. Wait for auction to expire

### Steps
1. Stay on the auction detail page
2. Wait for auction to expire
3. Wait for closure (within 10 seconds)
4. Verify documents appear

### Expected Behavior
1. Auction closes automatically
2. Documents section appears:
   - "🎉 Congratulations! You Won This Auction"
   - 3 document cards (Bill of Sale, Liability Waiver, Pickup Authorization)
   - All documents show "Signature required"
   - Progress bar shows 0%
3. Click "Sign Now" on Bill of Sale
4. Sign the document
5. Document status changes to "Signed"
6. Progress bar updates to 33%
7. Repeat for other documents
8. When all signed, see: "✅ All documents signed! Payment is being processed automatically."

### Pass Criteria
✅ Documents appear after closure
✅ All 3 documents are present
✅ Can sign documents
✅ Progress bar updates
✅ Payment processing message appears

---

## Debugging Tips

### If Hook Doesn't Trigger

1. **Check if hook is enabled**:
   - Look for: `⏸️  Hook disabled or auction already closed`
   - If disabled, check auction status in DB

2. **Check auction end time**:
   - Look for: `🔍 Checking auction ... expiry: { ... }`
   - Verify `hasExpired: true`

3. **Check API response**:
   - Look for: `📡 API response for auction ...`
   - Verify `closed: true`

4. **Check callback**:
   - Look for: `🔔 Triggering onAuctionClosed callback`
   - Look for: `🎯 Auction expired and closed! Refreshing data...`

### If Documents Don't Appear

1. **Check if you're the winner**:
   - Look at auction `currentBidder` in DB
   - Compare with your `vendorId`

2. **Check document generation**:
   - Look for errors in server logs
   - Check `documents` table in DB

3. **Check document fetch**:
   - Look for: `📄 Fetching documents for auction ...`
   - Look for: `✅ Loaded X documents`

### Common Issues

**Issue**: Status stays "🟢 Active" after refresh
**Solution**: Check console for errors, verify API endpoint is working

**Issue**: Multiple API calls
**Solution**: Check if `hasClosedRef` is working correctly

**Issue**: Hook doesn't run
**Solution**: Verify `enabled` prop is `true`

**Issue**: Documents don't appear
**Solution**: Verify you're the winner, check document generation logs

---

## Success Criteria Summary

✅ **Test 1**: Refresh closes expired auction
✅ **Test 2**: Polling closes expired auction
✅ **Test 3**: Already closed auctions don't trigger API
✅ **Test 4**: No duplicate closures on rapid refresh
✅ **Test 5**: Network errors are handled gracefully
✅ **Test 6**: Winner sees documents after closure

---

## Report Template

```
Test Date: [DATE]
Tester: [NAME]
Environment: [dev/staging/production]

Test Case 1: [PASS/FAIL]
Notes: [Any observations]

Test Case 2: [PASS/FAIL]
Notes: [Any observations]

Test Case 3: [PASS/FAIL]
Notes: [Any observations]

Test Case 4: [PASS/FAIL]
Notes: [Any observations]

Test Case 5: [PASS/FAIL]
Notes: [Any observations]

Test Case 6: [PASS/FAIL]
Notes: [Any observations]

Overall Status: [PASS/FAIL]
Issues Found: [List any issues]
```

---

**Priority:** URGENT - User-facing bug fix
**Estimated Test Time:** 15-20 minutes
