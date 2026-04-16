# Payment Data Discrepancy Fix - Complete

## Problem Summary

User reported major discrepancies between three financial reports:
- **Vendor Spending**: ₦4,055,000 (3 vendors, 7-6-1 transactions)
- **Salvage Recovery**: ₦5,530,000 (20 cases)
- **Payment Analytics**: ₦9,005,000 (18 payments: 14 verified + 4 overdue)

These numbers should have been consistent but weren't.

## Root Cause Analysis

### Issue 1: Salvage Recovery Using Bids Instead of Payments
**Location**: `src/features/reports/financial/repositories/financial-data.repository.ts`

The `getRevenueData` query was using:
```typescript
const salvageRecovery = parseFloat(row.paymentAmount || row.currentBid || '0');
```

This inflated the salvage recovery numbers by including unpaid bids.

### Issue 2: Salvage Recovery Filtering by Wrong Status
The query was filtering for `case.status = 'sold'`, but investigation revealed:
- 21 cases marked as "sold"
- Only 2 of them had payments (₦700,000)
- The other 14 verified payments (₦4,055,000) were linked to cases with status "active_auction"

**This revealed a workflow bug**: Cases remain in "active_auction" status even after payment is verified.

### Issue 3: Payment Analytics Counting All Payments
Payment Analytics was counting ALL payments (including wallet deposits, etc.), not just auction payments.

## Solutions Implemented

### Fix 1: Salvage Recovery - Query from Payments, Not Cases
Changed the query to start from `payments` table instead of `salvageCases`:

```typescript
// OLD: Started from cases with status='sold'
.from(salvageCases)
.leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
.leftJoin(payments, eq(auctions.id, payments.auctionId))
.where(eq(salvageCases.status, 'sold'))

// NEW: Start from verified payments
.from(payments)
.innerJoin(auctions, eq(payments.auctionId, auctions.id))
.innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
.where(and(
  eq(payments.status, 'verified'),
  sql`${payments.auctionId} IS NOT NULL`
))
```

### Fix 2: Removed Bid Fallback
```typescript
// OLD: Used bids as fallback
const salvageRecovery = parseFloat(row.paymentAmount || row.currentBid || '0');

// NEW: Only use actual payments
const salvageRecovery = parseFloat(row.paymentAmount || '0');
```

### Fix 3: Payment Analytics - Filter to Auction Payments Only
```typescript
// Added filter to exclude wallet deposits, etc.
conditions.push(sql`${payments.auctionId} IS NOT NULL`);
```

## Verification Results

After fixes, all three reports show consistent numbers:

```
VENDOR SPENDING:    ₦4,055,000 (verified only)
SALVAGE RECOVERY:   ₦4,055,000 (verified only)
PAYMENT ANALYTICS:  ₦9,005,000 (all auction payments)
  - verified:       ₦4,055,000 (14 payments)
  - overdue:        ₦4,950,000 (4 payments)
```

✅ **Vendor Spending = Salvage Recovery = Payment Analytics (verified only)**

## Expected Behavior

1. **Vendor Spending** counts only verified payments with auctionId
2. **Salvage Recovery** counts only verified payments (same as vendor spending)
3. **Payment Analytics** shows:
   - Total: All auction payments (verified + pending + overdue)
   - Breakdown by status shows verified payments match the other two reports

## Files Modified

1. `src/features/reports/financial/repositories/financial-data.repository.ts`
   - Fixed `getRevenueData()` to query from payments instead of cases
   - Removed bid fallback, only use actual payment amounts
   - Fixed `getPaymentData()` to filter to auction payments only

## Diagnostic Scripts Created

1. `scripts/diagnose-payment-discrepancy.ts` - Initial investigation
2. `scripts/debug-salvage-recovery-join.ts` - Analyzed join issues
3. `scripts/analyze-sold-cases-payments.ts` - Revealed case status workflow bug
4. `scripts/verify-payment-consistency.ts` - Confirms all reports match

## Known Issue: Case Status Workflow

**Discovered but NOT fixed in this session:**

Cases remain in "active_auction" status even after payment is verified. They should be updated to "sold" status.

This is a separate workflow issue that should be addressed in the auction closure/payment verification logic, not in the reporting system.

## Testing

Run verification script:
```bash
npx tsx scripts/verify-payment-consistency.ts
```

Expected output:
- All three reports show ₦4,055,000 for verified payments
- Payment Analytics total (₦9,005,000) includes pending/overdue payments
- No discrepancies between reports

## Date
April 15, 2026
