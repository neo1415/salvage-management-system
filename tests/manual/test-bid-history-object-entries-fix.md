# Bid History Object.entries() Error Fix - Test Plan

## Issue
The bid history tab was returning a 500 error with "TypeError: Cannot convert undefined or null to object at Object.entries".

## Root Cause
When using Drizzle ORM's `leftJoin`, if the joined table has no matching records, it returns an object with all properties set to `null` (e.g., `{ claimReference: null, assetType: null, assetDetails: null }`). The previous code was creating nested objects in the select statement:
```typescript
auction: {
  id: auctions.id,
  status: auctions.status,
  // ...
},
case: {
  claimReference: salvageCases.claimReference,
  assetType: salvageCases.assetType,
  assetDetails: salvageCases.assetDetails,
}
```

This structure could cause issues during JSON serialization when Next.js or Drizzle internally calls `Object.entries()` on these nested objects containing null values.

## Solution
Changed the select statement to use flat field names instead of nested objects:
```typescript
auctionStatus: auctions.status,
auctionCurrentBid: auctions.currentBid,
auctionCurrentBidder: auctions.currentBidder,
caseClaimReference: salvageCases.claimReference,
caseAssetType: salvageCases.assetType,
caseAssetDetails: salvageCases.assetDetails,
```

This approach:
1. Avoids creating nested objects that could contain all-null properties
2. Makes null checks simpler and more explicit
3. Prevents any internal `Object.entries()` calls on problematic nested structures
4. Ensures `undefined` is used instead of `null` for optional reference fields

## Changes Made

### File: `src/app/api/vendor/settings/transactions/route.ts`

1. **Bid History Section**:
   - Flattened the select statement to use individual fields instead of nested objects
   - Updated null checks to verify `record.caseClaimReference` instead of `record.case`
   - Updated auction status checks to use `record.auctionStatus` instead of `record.auction.status`
   - Changed reference field to use `|| undefined` to avoid returning `null`

2. **Payment History Section**:
   - Applied the same flattening approach
   - Updated all property access to use the new flat field names
   - Ensured consistent null handling across both sections

## Test Cases

### Test 1: Bid History with Valid Data
**Endpoint**: `GET /api/vendor/settings/transactions?type=bids&startDate=2026-02-21&endDate=2026-03-23&limit=20&offset=0`

**Expected Result**:
- Status: 200 OK
- Response contains array of bid transactions
- Each transaction has proper description with vehicle details
- No 500 errors

**Steps**:
1. Log in as a vendor who has placed bids
2. Navigate to Settings > Transactions > Bid History tab
3. Verify the page loads without errors
4. Check that bid descriptions show vehicle details (e.g., "Bid on 2020 Toyota Camry")

### Test 2: Bid History with Missing Case Data
**Scenario**: Bids where the associated auction or case has been deleted

**Expected Result**:
- Status: 200 OK
- Transactions with missing case data show "Bid placed" as description
- Reference field is `undefined` (not `null`)
- No 500 errors

**Steps**:
1. Create a bid record in the database
2. Delete or nullify the associated case
3. Call the API endpoint
4. Verify response handles missing data gracefully

### Test 3: Payment History with Valid Data
**Endpoint**: `GET /api/vendor/settings/transactions?type=payments&startDate=2026-02-21&endDate=2026-03-23&limit=20&offset=0`

**Expected Result**:
- Status: 200 OK
- Response contains array of payment transactions
- Each transaction has proper description with vehicle details
- Payment status correctly shows 'overdue' for past-deadline payments

**Steps**:
1. Log in as a vendor with payment records
2. Navigate to Settings > Transactions > Payment History tab
3. Verify the page loads without errors
4. Check payment descriptions and statuses

### Test 4: Wallet History (Unchanged)
**Endpoint**: `GET /api/vendor/settings/transactions?type=wallet&startDate=2026-02-21&endDate=2026-03-23&limit=20&offset=0`

**Expected Result**:
- Status: 200 OK
- Wallet transactions load correctly (no changes to this section)

### Test 5: Edge Cases
**Scenarios**:
- Empty result set (no transactions in date range)
- Vendor with no wallet
- Invalid date range
- Missing required parameters

**Expected Results**:
- Appropriate error messages or empty arrays
- No 500 errors
- Proper HTTP status codes

## Verification Checklist

- [ ] Bid history tab loads without 500 errors
- [ ] Payment history tab loads without 500 errors
- [ ] Wallet history tab still works correctly
- [ ] Vehicle descriptions display correctly when data is available
- [ ] Missing case data is handled gracefully
- [ ] Null values don't cause Object.entries() errors
- [ ] Reference fields use `undefined` instead of `null` when empty
- [ ] TypeScript compilation succeeds with no errors
- [ ] All transaction types return proper data structure

## Technical Notes

### Why This Fix Works

1. **Avoids Nested Object Issues**: By flattening the select statement, we avoid creating nested objects that Drizzle might try to serialize or iterate over using `Object.entries()`.

2. **Explicit Null Handling**: Direct field access makes it easier to check for null values explicitly before using them.

3. **Prevents Serialization Issues**: When Next.js serializes the response to JSON, it won't encounter nested objects with all-null properties that could trigger `Object.entries()` calls.

4. **Consistent with Drizzle Patterns**: This approach is more aligned with how Drizzle handles leftJoin results - as flat records rather than nested structures.

### Alternative Approaches Considered

1. **Adding Object.entries() guards**: Would require finding all places where it's called internally
2. **Post-processing to remove null objects**: Would add overhead and complexity
3. **Using inner joins**: Would exclude valid bids without case data

The chosen solution is the most robust and maintainable.
