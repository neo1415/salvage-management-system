# Payment UI Update Debugging Guide

## Problem Statement

After a vendor pays for an auction via Paystack, the UI continues showing "Payment Required" banner instead of "Payment Verified" banner, even though:
- Payment is verified in database (status='verified')
- Wallet transactions are correct (freeze, debit, unfreeze)
- Finance dashboard shows payment as verified
- Polling API returns `hasVerifiedPayment: true`

## Data Flow Analysis

### 1. Database Layer ✅
```sql
-- Payment is verified
SELECT * FROM payments 
WHERE auction_id = 'xxx' 
AND status = 'verified';
-- Returns: payment record with verified status
```

### 2. Polling API ✅
```typescript
// File: src/app/api/auctions/[id]/poll/route.ts
// Lines: 99-113

let hasVerifiedPayment = false;
if (auction.status === 'awaiting_payment') {
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, auctionId),
        eq(payments.status, 'verified')
      )
    )
    .limit(1);
  hasVerifiedPayment = !!payment;
}

// Returns in response:
{
  success: true,
  data: {
    auctionId: "xxx",
    status: "awaiting_payment",
    hasVerifiedPayment: true, // ← THIS IS CORRECT
    ...
  }
}
```

### 3. Hook Layer ✅
```typescript
// File: src/hooks/use-socket.ts
// Lines: 595-625

const result = await response.json();
if (result.success && result.data) {
  const data = result.data;
  
  // Update auction state
  setAuction({
    currentBid: data.currentBid?.toString(),
    currentBidder: data.currentBidder,
    status: data.status,
    endTime: data.endTime,
    hasVerifiedPayment: data.hasVerifiedPayment, // ← SET HERE
  });
}
```

### 4. Component Layer ❓
```typescript
// File: src/app/(dashboard)/vendor/auctions/[id]/page.tsx
// Lines: 169, 195-201

const [hasVerifiedPayment, setHasVerifiedPayment] = useState(false);

// This useEffect should update the state
useEffect(() => {
  if (realtimeAuction && 'hasVerifiedPayment' in realtimeAuction) {
    const newValue = realtimeAuction.hasVerifiedPayment || false;
    console.log(`📡 Updating hasVerifiedPayment from realtime data: ${newValue}`);
    setHasVerifiedPayment(newValue);
  }
}, [realtimeAuction]);
```

### 5. UI Rendering ❓
```typescript
// Lines: 1151-1186

// "Payment Verified" banner (should show when hasVerifiedPayment === true)
{auction.status === 'awaiting_payment' && 
 session?.user?.vendorId && 
 auction.currentBidder === session.user.vendorId &&
 hasVerifiedPayment && (
  <div className="bg-gradient-to-r from-green-500 to-emerald-600">
    Payment Verified!
  </div>
)}

// "Payment Required" banner (should show when hasVerifiedPayment === false)
{auction.status === 'awaiting_payment' && 
 session?.user?.vendorId && 
 auction.currentBidder === session.user.vendorId &&
 !hasVerifiedPayment && (
  <div className="bg-gradient-to-r from-[#800020] to-[#600018]">
    Payment Required
  </div>
)}
```

## Debugging Steps

### Step 1: Run Diagnostic Script
```bash
npx tsx scripts/diagnose-payment-ui-realtime.ts
```

This will show you:
- ✅ Database state (payment verified or not)
- ✅ Polling API response (hasVerifiedPayment value)
- ✅ Expected UI state

### Step 2: Open Test Page
```
http://localhost:3000/test-payment-ui-update.html
```

Click "Test Polling API" to verify the API is returning correct data.

### Step 3: Check Browser Console

Open the auction detail page and look for these logs:

#### Expected Logs (in order):
```
📊 Poll: Auction xxx updated
   - Current bid: ₦350,000
   - Status: awaiting_payment
   - hasVerifiedPayment: true
✅ Auction state updated with hasVerifiedPayment: true

🔍 useEffect triggered for hasVerifiedPayment update {
  realtimeAuction: { ... },
  hasField: true,
  value: true
}
📡 Updating hasVerifiedPayment from realtime data: true

🎯 Component render state: {
  auctionStatus: "awaiting_payment",
  hasVerifiedPayment: true,
  realtimeAuctionHasVerifiedPayment: true,
  shouldShowPaymentVerified: true,
  shouldShowPayNow: false
}
```

### Step 4: Identify the Issue

| Log Present | Issue | Solution |
|------------|-------|----------|
| ❌ "📊 Poll" missing | Polling not working | Check network tab, verify polling is running |
| ✅ "📊 Poll" but hasVerifiedPayment: false | Database issue | Run diagnostic script, check payment status |
| ✅ "📊 Poll" with true, ❌ "🔍 useEffect" missing | useEffect not running | Check if realtimeAuction has the field |
| ✅ Both logs, but hasVerifiedPayment state is false | State update issue | Check for other useEffects resetting state |
| ✅ All logs, state is true, but UI shows "Pay Now" | Rendering issue | Check JSX conditions |

## Common Issues & Fixes

### Issue 1: useEffect Not Running
**Symptom:** "🔍 useEffect triggered" log is missing

**Cause:** `realtimeAuction` object doesn't have `hasVerifiedPayment` field

**Fix:** Check the hook is setting the field correctly (line 620 in use-socket.ts)

### Issue 2: State Update Not Persisting
**Symptom:** "📡 Updating hasVerifiedPayment" shows true, but next render shows false

**Cause:** Another useEffect or state update is overwriting it

**Fix:** Search for other `setHasVerifiedPayment` calls in the component

### Issue 3: Polling Returns False
**Symptom:** "📊 Poll" shows hasVerifiedPayment: false

**Cause:** Payment not actually verified in database

**Fix:** 
1. Check payment status: `SELECT * FROM payments WHERE auction_id = 'xxx'`
2. Verify webhook was processed: Check webhook logs
3. Manually verify payment if needed

### Issue 4: React Not Re-rendering
**Symptom:** State updates but UI doesn't change

**Cause:** React optimization preventing re-render

**Fix:** Add a key prop to force re-render or use `useReducer` instead of `useState`

## Enhanced Logging

We've added comprehensive logging at every step:

1. **Hook Level** (use-socket.ts):
   - Line 614: Log hasVerifiedPayment from API
   - Line 623: Log after setting auction state

2. **Component Level** (page.tsx):
   - Line 195: Log useEffect trigger with full context
   - Line 197: Log state update
   - Line 870: Log render-time state values

## Testing Checklist

- [ ] Run diagnostic script - confirms database state
- [ ] Open test page - confirms API response
- [ ] Check browser console - confirms data flow
- [ ] Verify "📊 Poll" log shows hasVerifiedPayment: true
- [ ] Verify "🔍 useEffect" log appears
- [ ] Verify "📡 Updating" log shows true
- [ ] Verify "🎯 Component render" shows correct state
- [ ] Verify UI shows "Payment Verified" banner

## Next Steps

If all logs show correct values but UI still shows "Pay Now":

1. Check for CSS issues (z-index, display: none, etc.)
2. Check for conditional rendering logic errors
3. Check for React Strict Mode double-rendering issues
4. Check for service worker caching issues
5. Try hard refresh (Ctrl+Shift+R)

## Files Modified

1. `src/hooks/use-socket.ts` - Added logging after setting auction state
2. `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - Added comprehensive logging
3. `scripts/diagnose-payment-ui-realtime.ts` - New diagnostic script
4. `public/test-payment-ui-update.html` - New test page

## Contact

If issue persists after following this guide, provide:
1. Screenshot of browser console logs
2. Output of diagnostic script
3. Network tab showing polling API responses
4. Current auction ID and payment ID
