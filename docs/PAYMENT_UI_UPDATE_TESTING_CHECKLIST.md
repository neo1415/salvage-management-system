# Payment UI Update - Testing Checklist

## Pre-Test Setup

- [ ] Ensure you have an auction in `awaiting_payment` status
- [ ] Ensure the auction has a verified payment (status='verified')
- [ ] Know the auction ID (from diagnostic script or database)

## Test Procedure

### 1. Run Diagnostic Script ✅

```bash
npx tsx scripts/diagnose-payment-ui-realtime.ts
```

**Expected Output:**
```
✅ DATABASE: Payment is verified
✅ POLLING API: Returns hasVerifiedPayment: true
✅ HOOK: Sets auction.hasVerifiedPayment: true
```

**If you see this, proceed to step 2.**

---

### 2. Open Test Page ✅

Navigate to: `http://localhost:3000/test-payment-ui-update.html`

Click **"Test Polling API"** button.

**Expected Output:**
```
✅ API Response received
Status: awaiting_payment
hasVerifiedPayment: true
✅ Payment is verified! UI should show "Payment Verified" banner
```

**If you see this, proceed to step 3.**

---

### 3. Open Auction Detail Page ✅

Navigate to: `/vendor/auctions/[auction-id]`

(Replace `[auction-id]` with the actual auction ID from step 1)

---

### 4. Open Browser Console ✅

Press **F12** to open Developer Tools, then click **Console** tab.

---

### 5. Check Console Logs ✅

Look for these logs in order (they appear every 2 seconds):

#### Log 1: Polling API Response
```
📊 Poll: Auction xxx updated
   - Current bid: ₦350,000
   - Status: awaiting_payment
   - hasVerifiedPayment: true  ← MUST BE TRUE
✅ Auction state updated with hasVerifiedPayment: true
```

- [ ] Log appears every 2 seconds
- [ ] `hasVerifiedPayment: true` is shown
- [ ] "✅ Auction state updated" appears

**If missing or false, STOP HERE and report the issue.**

---

#### Log 2: useEffect Trigger
```
🔍 useEffect triggered for hasVerifiedPayment update {
  realtimeAuction: { currentBid: "350000", status: "awaiting_payment", hasVerifiedPayment: true, ... },
  hasField: true,  ← MUST BE TRUE
  value: true      ← MUST BE TRUE
}
```

- [ ] Log appears after polling log
- [ ] `hasField: true` is shown
- [ ] `value: true` is shown

**If missing or false, STOP HERE and report the issue.**

---

#### Log 3: State Update
```
📡 Updating hasVerifiedPayment from realtime data: true  ← MUST BE TRUE
```

- [ ] Log appears after useEffect log
- [ ] Shows `true` (not `false`)

**If missing or false, STOP HERE and report the issue.**

---

#### Log 4: Component Render State
```
🎯 Component render state: {
  auctionStatus: "awaiting_payment",
  hasVerifiedPayment: true,                    ← MUST BE TRUE
  realtimeAuctionHasVerifiedPayment: true,     ← MUST BE TRUE
  currentBidder: "xxx",
  sessionVendorId: "xxx",
  shouldShowPaymentVerified: true,             ← MUST BE TRUE
  shouldShowPayNow: false                      ← MUST BE FALSE
}
```

- [ ] `hasVerifiedPayment: true`
- [ ] `realtimeAuctionHasVerifiedPayment: true`
- [ ] `shouldShowPaymentVerified: true`
- [ ] `shouldShowPayNow: false`

**If any value is wrong, STOP HERE and report the issue.**

---

### 6. Check UI Display ✅

Scroll to the top of the page and look for the banner.

**Expected: "Payment Verified" Banner (Green)**
```
┌─────────────────────────────────────────────────────────┐
│ ✅ Payment Verified!                                    │
│ Your payment has been confirmed. Check your email for   │
│ pickup authorization details.                           │
│                                    [View Documents] →   │
└─────────────────────────────────────────────────────────┘
```

- [ ] Green banner is visible
- [ ] Says "Payment Verified!"
- [ ] "View Documents" button is present

**NOT Expected: "Payment Required" Banner (Red)**
```
┌─────────────────────────────────────────────────────────┐
│ 🎉 Payment Required                                     │
│ All documents signed! Complete your payment to unlock   │
│ pickup authorization.                                   │
│                                         [Pay Now] →     │
└─────────────────────────────────────────────────────────┘
```

- [ ] Red banner is NOT visible
- [ ] "Pay Now" button is NOT visible

---

## Test Results

### ✅ PASS - All Checks Passed

If all checkboxes are checked:
- ✅ Diagnostic script shows payment verified
- ✅ Test page shows API returns true
- ✅ Console shows all 4 logs with correct values
- ✅ UI shows "Payment Verified" banner (green)
- ✅ "Pay Now" banner is hidden

**Result: Issue is FIXED! 🎉**

---

### ❌ FAIL - Issue Persists

If any checkbox is unchecked, identify the break point:

| Failed Check | Break Point | Action |
|--------------|-------------|--------|
| Step 1 fails | Database | Check payment status in DB |
| Step 2 fails | Polling API | Check API endpoint code |
| Log 1 missing | Polling not running | Check network tab |
| Log 1 shows false | API logic | Check polling API code |
| Log 2 missing | Hook not passing data | Check hook code |
| Log 3 missing | useEffect not running | Check useEffect dependencies |
| Log 4 shows false | State being reset | Check for other useEffects |
| UI shows wrong banner | Rendering logic | Check JSX conditions |

---

## Reporting Issues

If test fails, provide:

1. **Diagnostic Script Output**
   ```bash
   npx tsx scripts/diagnose-payment-ui-realtime.ts > diagnostic-output.txt
   ```

2. **Console Logs**
   - Right-click in console → "Save as..." → `console-logs.txt`

3. **Network Tab**
   - Filter by "poll"
   - Right-click on `/api/auctions/[id]/poll` → "Copy" → "Copy response"

4. **Screenshot**
   - Full page screenshot showing the banner

5. **Auction Details**
   - Auction ID
   - Payment ID
   - Current status

---

## Quick Troubleshooting

### Issue: No logs appear at all
**Solution:** Polling might not be running. Check network tab for `/api/auctions/[id]/poll` requests.

### Issue: Logs show false but payment is verified
**Solution:** Cache issue. Try hard refresh (Ctrl+Shift+R) or clear browser cache.

### Issue: Logs show true but UI shows "Pay Now"
**Solution:** React not re-rendering. Check for React Strict Mode or service worker issues.

### Issue: Logs appear once then stop
**Solution:** Polling stopped. Check for errors in console or network tab.

---

## Success Indicators

When everything works correctly, you should see:

1. ✅ Diagnostic script confirms payment verified
2. ✅ Test page confirms API returns true
3. ✅ Console logs appear every 2 seconds
4. ✅ All 4 log types show correct values
5. ✅ Green "Payment Verified" banner is visible
6. ✅ Red "Pay Now" banner is hidden
7. ✅ "View Documents" button works

---

## Additional Tests

### Test 1: Page Refresh
- [ ] Refresh the page (F5)
- [ ] Logs still appear correctly
- [ ] UI still shows "Payment Verified" banner

### Test 2: Navigate Away and Back
- [ ] Navigate to `/vendor/auctions`
- [ ] Click on the auction again
- [ ] Logs still appear correctly
- [ ] UI still shows "Payment Verified" banner

### Test 3: Multiple Tabs
- [ ] Open auction in two tabs
- [ ] Both tabs show "Payment Verified" banner
- [ ] Both tabs show correct logs

---

## Cleanup

After testing:
- [ ] Close all auction detail tabs
- [ ] Close test page
- [ ] Close diagnostic script output

---

## Notes

- Logs appear every 2 seconds (polling interval)
- If you don't see logs, wait at least 5 seconds
- Console logs are color-coded (green = success, red = error)
- Use Ctrl+F in console to search for specific log prefixes (📊, 🔍, 📡, 🎯)
