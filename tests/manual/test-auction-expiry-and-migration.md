# Manual Test: Auction Expiry Check & Migration

## Test Date: [Fill in date]
## Tester: [Fill in name]

---

## ISSUE 1: Migration Script

### Test 1.1: Verify Migration Scripts Added to package.json
**Expected:** Migration scripts should be available in package.json

**Steps:**
1. Open `package.json`
2. Check for the following scripts:
   - `db:generate`
   - `db:migrate`
   - `db:push`
   - `db:studio`

**Result:** ✅ PASS / ❌ FAIL

**Notes:**
```
[Add any observations]
```

---

### Test 1.2: Verify Migration Was Applied
**Expected:** Database should have new enum values and columns

**Steps:**
1. Connect to database
2. Run: `SELECT enum_range(NULL::auction_status);`
3. Verify 'forfeited' is in the list
4. Run: `SELECT enum_range(NULL::payment_status);`
5. Verify 'forfeited' is in the list
6. Run: `\d release_forms`
7. Verify 'disabled' column exists (boolean, default false)

**Result:** ✅ PASS / ❌ FAIL

**Notes:**
```
[Add SQL output]
```

---

## ISSUE 2: Real-Time Auction Closure

### Test 2.1: API Endpoint - Check Single Auction
**Expected:** API should close expired auctions immediately

**Steps:**
1. Create a test auction with endTime in the past:
   ```sql
   UPDATE auctions 
   SET end_time = NOW() - INTERVAL '1 minute',
       status = 'active'
   WHERE id = '[auction-id]';
   ```
2. Call API: `GET /api/auctions/check-expired?auctionId=[auction-id]`
3. Verify response shows `closed: true`
4. Check database: auction status should be 'closed'
5. Verify payment record was created
6. Verify documents were generated (Bill of Sale, Liability Waiver)

**Result:** ✅ PASS / ❌ FAIL

**API Response:**
```json
[Paste response]
```

**Notes:**
```
[Add observations]
```

---

### Test 2.2: API Endpoint - Batch Check
**Expected:** API should close all expired auctions

**Steps:**
1. Create 3 test auctions with endTime in the past
2. Call API: `POST /api/auctions/check-expired` with body `{"checkAll": true}`
3. Verify response shows correct count of closed auctions
4. Check database: all 3 auctions should be 'closed'

**Result:** ✅ PASS / ❌ FAIL

**API Response:**
```json
[Paste response]
```

**Notes:**
```
[Add observations]
```

---

### Test 2.3: Client-Side Hook - Single Auction Page
**Expected:** Auction should close automatically when timer expires

**Steps:**
1. Create a test auction with endTime 30 seconds in the future
2. Navigate to `/vendor/auctions/[id]`
3. Wait for countdown timer to reach 0
4. Observe:
   - Hook should detect expiry within 10 seconds
   - API call should be made automatically
   - Page should refresh to show closed status
   - Documents section should appear (if you're the winner)
   - Toast notification should appear

**Result:** ✅ PASS / ❌ FAIL

**Observations:**
```
Time to detect expiry: [X] seconds
API call made: YES / NO
Page refreshed: YES / NO
Documents appeared: YES / NO
Toast shown: YES / NO
```

**Notes:**
```
[Add observations]
```

---

### Test 2.4: Client-Side Hook - Auctions List Page
**Expected:** Expired auctions should be removed from active list

**Steps:**
1. Create 2 test auctions:
   - Auction A: endTime 20 seconds in future
   - Auction B: endTime 40 seconds in future
2. Navigate to `/vendor/auctions`
3. Observe both auctions in the list
4. Wait for Auction A timer to expire
5. Within 30 seconds, Auction A should:
   - Disappear from active list
   - Status badge should change to "Closed"
6. Wait for Auction B timer to expire
7. Verify same behavior

**Result:** ✅ PASS / ❌ FAIL

**Observations:**
```
Auction A:
- Time to detect: [X] seconds
- Removed from list: YES / NO
- Status updated: YES / NO

Auction B:
- Time to detect: [X] seconds
- Removed from list: YES / NO
- Status updated: YES / NO
```

**Notes:**
```
[Add observations]
```

---

### Test 2.5: Race Condition Handling
**Expected:** Multiple simultaneous closure requests should be handled gracefully

**Steps:**
1. Create a test auction with endTime in the past
2. Open 3 browser tabs to the same auction page
3. All 3 tabs should detect expiry and call API
4. Verify:
   - Only ONE payment record created
   - Only ONE set of documents generated
   - No duplicate notifications sent
   - All tabs show correct closed status

**Result:** ✅ PASS / ❌ FAIL

**Database Check:**
```sql
-- Check for duplicate payments
SELECT COUNT(*) FROM payments WHERE auction_id = '[auction-id]';
-- Expected: 1

-- Check for duplicate documents
SELECT document_type, COUNT(*) 
FROM release_forms 
WHERE auction_id = '[auction-id]' 
GROUP BY document_type;
-- Expected: 1 per document type
```

**Notes:**
```
[Add observations]
```

---

### Test 2.6: Performance - No Active Auctions
**Expected:** Hook should not make unnecessary API calls

**Steps:**
1. Navigate to `/vendor/auctions/[id]` for a closed auction
2. Open browser DevTools Network tab
3. Wait 60 seconds
4. Verify NO calls to `/api/auctions/check-expired`

**Result:** ✅ PASS / ❌ FAIL

**Notes:**
```
[Add observations]
```

---

### Test 2.7: Integration - Full Auction Lifecycle
**Expected:** Complete flow from active → expired → closed → documents → payment

**Steps:**
1. Create auction with endTime 1 minute in future
2. Place winning bid as Vendor A
3. Wait for auction to expire
4. Verify automatic closure:
   - Status changes to 'closed'
   - Payment record created with 24-hour deadline
   - Documents generated (Bill of Sale, Liability Waiver)
   - Winner receives notifications (SMS, Email, Push)
5. Sign all documents as Vendor A
6. Verify payment processing:
   - Funds deducted from escrow wallet
   - Pickup Authorization generated
   - Pickup code sent via SMS/Email
7. Verify no manual intervention was needed

**Result:** ✅ PASS / ❌ FAIL

**Timeline:**
```
[Time] Auction created
[Time] Bid placed
[Time] Auction expired
[Time] Closure detected (expected: within 10 seconds)
[Time] Documents generated
[Time] Notifications sent
[Time] Documents signed
[Time] Payment processed
[Time] Pickup code received
```

**Notes:**
```
[Add observations]
```

---

## Summary

### Issue 1: Migration Script
- [ ] Migration scripts added to package.json
- [ ] Migration executed successfully
- [ ] Database schema updated correctly

### Issue 2: Real-Time Auction Closure
- [ ] API endpoint works for single auction
- [ ] API endpoint works for batch check
- [ ] Client-side hook works on auction detail page
- [ ] Client-side hook works on auctions list page
- [ ] Race conditions handled correctly
- [ ] No unnecessary API calls for closed auctions
- [ ] Full lifecycle works end-to-end

### Overall Result
✅ ALL TESTS PASSED / ❌ SOME TESTS FAILED

### Critical Issues Found
```
[List any critical issues]
```

### Recommendations
```
[Add recommendations]
```

---

## Tester Sign-off

**Name:** ___________________________

**Date:** ___________________________

**Signature:** ___________________________
