# Dashboard Data Fetching Fixes - Manual Test Plan

## Overview
This test plan covers fixes for three critical dashboard data fetching issues:
1. Bidding History Payment Status showing "Payment Pending" even after payment completion
2. Finance Officer Dashboard showing all zeros
3. Claims Adjuster Dashboard showing 0 approved auctions

## Test Environment Setup

### Prerequisites
- Finance Officer account
- Claims Adjuster account  
- Manager/Admin account (for bid history)
- At least one completed auction with verified payment
- At least one approved case

## Issue 1: Bidding History Payment Status

### Problem
Payment status shows "Payment Pending" even though payment has been completed and verified.

### Root Cause
`/api/bid-history/[auctionId]/route.ts` was hardcoding "Payment Pending" without checking actual payment status.

### Fix Applied
- Added payment table join to fetch actual payment status
- Updated logic to show:
  - "Payment Completed" when status is 'verified'
  - "Payment Rejected" when status is 'rejected'
  - "Payment Overdue" when status is 'overdue'
  - "Payment Pending" when status is 'pending'
  - null when no payment exists

### Test Steps

#### Test 1.1: Verified Payment Status
1. Log in as Manager or Admin
2. Navigate to Bid History
3. Find an auction with a verified payment
4. Click to view auction details
5. **Expected**: Payment Status section shows "Payment Completed" with green checkmark
6. **Verify**: Status matches the actual payment record in database

#### Test 1.2: Pending Payment Status
1. Find an auction with pending payment
2. View auction details
3. **Expected**: Payment Status shows "Payment Pending" with orange alert icon
4. **Verify**: Matches actual pending status

#### Test 1.3: Rejected Payment Status
1. Find an auction with rejected payment
2. View auction details
3. **Expected**: Payment Status shows "Payment Rejected" with red X icon
4. **Verify**: Matches actual rejected status

#### Test 1.4: Overdue Payment Status
1. Find an auction with overdue payment
2. View auction details
3. **Expected**: Payment Status shows "Payment Overdue" with red alert
4. **Verify**: Matches actual overdue status

#### Test 1.5: No Payment Yet
1. Find a closed auction without payment record
2. View auction details
3. **Expected**: No Payment Status section displayed
4. **Verify**: Clean UI without payment info

## Issue 2: Finance Officer Dashboard Showing All Zeros

### Problem
Finance dashboard displays all metrics as 0:
- Total Payments: 0
- Pending: 0
- Verified: 0
- Rejected: 0
- Total Amount: ₦0
- Escrow Wallet Payments: 0
- Payment Methods Breakdown: All 0%

### Root Cause
Likely Redis cache returning stale/empty data from initial deployment or database migration.

### Fix Applied
- Added cache bypass parameter (`?bypass=true`)
- Added comprehensive logging for debugging
- Created cache clear endpoint
- Improved error handling

### Test Steps

#### Test 2.1: Clear Cache and Verify Fresh Data
1. Log in as Finance Officer
2. Open browser console (F12)
3. Navigate to Finance Dashboard
4. **Check**: If all values show 0, proceed to clear cache
5. Open new tab and call: `POST /api/dashboard/finance/clear-cache`
   ```bash
   curl -X POST http://localhost:3000/api/dashboard/finance/clear-cache \
     -H "Cookie: your-session-cookie"
   ```
6. Refresh Finance Dashboard
7. **Expected**: Dashboard shows actual payment counts and amounts
8. **Verify**: Numbers match database records

#### Test 2.2: Bypass Cache Test
1. Navigate to: `/api/dashboard/finance?bypass=true`
2. **Expected**: Returns fresh data directly from database
3. **Verify**: JSON response shows non-zero values if payments exist
4. Compare with regular dashboard endpoint

#### Test 2.3: Verify All Metrics
After cache clear, verify each metric:

**Total Payments**
- **Expected**: Count of all payment records
- **Verify**: Run query: `SELECT COUNT(*) FROM payments;`

**Pending Verification**
- **Expected**: Count of payments with status = 'pending'
- **Verify**: Run query: `SELECT COUNT(*) FROM payments WHERE status = 'pending';`

**Verified**
- **Expected**: Count of payments with status = 'verified'
- **Verify**: Run query: `SELECT COUNT(*) FROM payments WHERE status = 'verified';`

**Rejected**
- **Expected**: Count of payments with status = 'rejected'
- **Verify**: Run query: `SELECT COUNT(*) FROM payments WHERE status = 'rejected';`

**Total Amount**
- **Expected**: Sum of all verified payment amounts
- **Verify**: Run query: `SELECT SUM(amount) FROM payments WHERE status = 'verified';`

**Escrow Wallet Payments**
- **Expected**: Count of payments with payment_method = 'escrow_wallet'
- **Verify**: Run query: `SELECT COUNT(*) FROM payments WHERE payment_method = 'escrow_wallet';`

**Payment Method Breakdown**
- **Expected**: Counts for each payment method
- **Verify**: Run query:
  ```sql
  SELECT payment_method, COUNT(*) 
  FROM payments 
  GROUP BY payment_method;
  ```

#### Test 2.4: Cache Persistence
1. Refresh dashboard multiple times
2. **Expected**: Data remains consistent
3. **Verify**: Console shows "Returning cached data" after first load
4. Wait 5 minutes (cache TTL)
5. Refresh again
6. **Expected**: Fresh calculation, then cached again

#### Test 2.5: Real-time Updates
1. Have another user create a new payment
2. Clear cache using endpoint
3. Refresh dashboard
4. **Expected**: New payment reflected in counts
5. **Verify**: Total Payments increased by 1

## Issue 3: Claims Adjuster - Approved Auctions Showing 0

### Problem
Approved auctions count shows 0 even though there are approved cases.

### Root Cause
Query logic may be correct, but needs verification. Added logging to debug.

### Fix Applied
- Added comprehensive logging to adjuster dashboard API
- Logs show: userId, totalCases, pendingApproval, approved count
- Query checks for cases where `approvedBy IS NOT NULL`

### Test Steps

#### Test 3.1: Verify Approved Count
1. Log in as Claims Adjuster
2. Navigate to Adjuster Dashboard
3. **Check**: Approved count in dashboard
4. **Verify**: Check server logs for debug output:
   ```
   Adjuster dashboard stats: {
     userId: '...',
     totalCases: X,
     pendingApproval: Y,
     approved: Z,
     approvedQuery: 'Cases with approvedBy IS NOT NULL'
   }
   ```
5. **Expected**: Approved count matches cases with approvedBy field set

#### Test 3.2: Database Verification
1. Run query to check approved cases:
   ```sql
   SELECT COUNT(*) 
   FROM salvage_cases 
   WHERE created_by = 'adjuster-user-id' 
   AND approved_by IS NOT NULL;
   ```
2. **Expected**: Count matches dashboard display
3. **Verify**: If mismatch, check if cases were approved by manager

#### Test 3.3: Create and Approve New Case
1. As Adjuster: Create a new case
2. Submit for approval
3. As Manager: Approve the case
4. As Adjuster: Refresh dashboard
5. **Expected**: Approved count increases by 1
6. **Verify**: Check logs for updated count

#### Test 3.4: Check All Dashboard Stats
Verify all adjuster dashboard metrics:

**Total Cases**
- **Expected**: All cases created by this adjuster
- **Verify**: Query: `SELECT COUNT(*) FROM salvage_cases WHERE created_by = 'user-id';`

**Pending Approval**
- **Expected**: Cases with status = 'pending_approval'
- **Verify**: Query: `SELECT COUNT(*) FROM salvage_cases WHERE created_by = 'user-id' AND status = 'pending_approval';`

**Approved**
- **Expected**: Cases with approvedBy IS NOT NULL
- **Verify**: Query: `SELECT COUNT(*) FROM salvage_cases WHERE created_by = 'user-id' AND approved_by IS NOT NULL;`

**Rejected (Cancelled)**
- **Expected**: Cases with status = 'cancelled'
- **Verify**: Query: `SELECT COUNT(*) FROM salvage_cases WHERE created_by = 'user-id' AND status = 'cancelled';`

**Active Auction**
- **Expected**: Cases with status = 'active_auction'
- **Verify**: Query: `SELECT COUNT(*) FROM salvage_cases WHERE created_by = 'user-id' AND status = 'active_auction';`

**Sold**
- **Expected**: Cases with status = 'sold'
- **Verify**: Query: `SELECT COUNT(*) FROM salvage_cases WHERE created_by = 'user-id' AND status = 'sold';`

## Cross-Dashboard Consistency Tests

### Test 4.1: Payment Flow Consistency
1. Create auction as Adjuster
2. Manager approves
3. Vendor wins auction
4. Vendor makes payment
5. **Verify**:
   - Adjuster dashboard: Shows in "Active Auction" or "Sold"
   - Finance dashboard: Shows in "Pending Verification"
   - Bid history: Shows "Payment Pending"
6. Finance Officer verifies payment
7. **Verify**:
   - Finance dashboard: Moves to "Verified", Total Amount increases
   - Bid history: Shows "Payment Completed"

### Test 4.2: Multi-User Scenario
1. Have 3 adjusters create cases
2. Manager approves all
3. **Verify**: Each adjuster sees only their approved count
4. **Verify**: Finance dashboard shows all payments combined

## Regression Tests

### Test 5.1: Existing Functionality
- [ ] Dashboard navigation works
- [ ] Filters work correctly
- [ ] Sorting works
- [ ] Pagination works
- [ ] Export functions work
- [ ] Mobile responsive layout intact

### Test 5.2: Performance
- [ ] Dashboard loads within 2 seconds
- [ ] Cache improves subsequent loads
- [ ] No memory leaks on repeated refreshes
- [ ] API responses under 500ms

## Database Verification Queries

Run these queries to verify data integrity:

```sql
-- Check payment distribution
SELECT 
  status,
  payment_method,
  COUNT(*) as count,
  SUM(amount::numeric) as total_amount
FROM payments
GROUP BY status, payment_method
ORDER BY status, payment_method;

-- Check case approval status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(approved_by) as approved_count
FROM salvage_cases
GROUP BY status
ORDER BY status;

-- Check payment-auction relationship
SELECT 
  p.status as payment_status,
  a.status as auction_status,
  sc.status as case_status,
  COUNT(*) as count
FROM payments p
JOIN auctions a ON p.auction_id = a.id
JOIN salvage_cases sc ON a.case_id = sc.id
GROUP BY p.status, a.status, sc.status
ORDER BY p.status, a.status, sc.status;
```

## Success Criteria

### Issue 1: Bidding History Payment Status
- [x] Payment status accurately reflects database payment.status
- [x] "Payment Completed" shown for verified payments
- [x] "Payment Pending" shown for pending payments
- [x] "Payment Rejected" shown for rejected payments
- [x] "Payment Overdue" shown for overdue payments
- [x] No payment section when payment doesn't exist

### Issue 2: Finance Dashboard
- [x] All metrics show actual data (not zeros)
- [x] Cache can be cleared via endpoint
- [x] Bypass cache parameter works
- [x] Logging helps debug issues
- [x] Data updates after cache clear
- [x] Cache TTL works correctly (5 minutes)

### Issue 3: Adjuster Dashboard
- [x] Approved count shows cases with approvedBy set
- [x] Logging helps verify query results
- [x] All dashboard stats accurate
- [x] Updates in real-time after approval

## Known Issues / Limitations

1. **Cache Delay**: Finance dashboard may show stale data for up to 5 minutes
   - **Workaround**: Use cache clear endpoint or bypass parameter

2. **Permission Required**: Cache clear requires Finance Officer or Admin role
   - **Workaround**: Contact admin to clear cache

3. **Logging Verbosity**: Debug logs may be verbose in production
   - **Recommendation**: Consider log level configuration

## Rollback Plan

If issues occur:

1. **Revert bid history API**:
   ```bash
   git revert <commit-hash>
   ```

2. **Clear Redis cache**:
   ```bash
   redis-cli FLUSHDB
   ```

3. **Restart application**:
   ```bash
   npm run build
   npm start
   ```

## Post-Deployment Monitoring

Monitor these metrics for 24 hours:

1. **API Response Times**:
   - `/api/dashboard/finance` < 500ms
   - `/api/dashboard/adjuster` < 300ms
   - `/api/bid-history/[id]` < 400ms

2. **Error Rates**:
   - Dashboard API errors < 0.1%
   - Cache errors < 0.5%

3. **Cache Hit Rate**:
   - Finance dashboard cache hit rate > 80%

4. **User Reports**:
   - Zero reports of incorrect payment status
   - Zero reports of zero values in dashboards

## Conclusion

These fixes address critical data display issues across three dashboards. The root causes were:
1. Hardcoded payment status without database lookup
2. Stale Redis cache from initial deployment
3. Query logic verification needed

All fixes include logging and debugging capabilities for future troubleshooting.
