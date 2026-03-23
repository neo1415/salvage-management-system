# Manual Test Plan: Duplicate Payment Fixes

## Overview

This test plan verifies that duplicate payment records are fixed and prevented.

## Prerequisites

- Access to production/staging database
- Admin access to run scripts
- Test auction with payment record

---

## Test 1: Detect Existing Duplicates

### Steps

1. Run duplicate detection script:
```bash
npm run script scripts/detect-duplicate-records-all-tables.ts
```

2. Review the output

### Expected Results

```
✅ payments:
   Duplicate groups: 0
   Affected records: 0
```

If duplicates found:
```
⚠️  payments:
   Duplicate groups: 2
   Affected records: 4
   Details:
     - auctionId: 8170710b: 2 records
       IDs: abc123, def456
```

### Pass Criteria

- Script runs without errors
- Report is generated and saved to JSON file
- Duplicate count is accurate

---

## Test 2: Clean Up Duplicate Payments

### Steps

1. Run cleanup script in dry-run mode:
```bash
npm run script scripts/find-and-delete-duplicate-payments.ts
```

2. Review the preview output

3. Run cleanup script in live mode:
```bash
npm run script scripts/find-and-delete-duplicate-payments.ts --live
```

4. Verify deletion log is created

### Expected Results

**Dry Run:**
```
⚠️  Found 2 duplicate payment groups:

💳 Duplicate Payment Group:
   - Auction ID: 8170710b
   - Count: 2

   ✅ Keeping oldest payment:
      - ID: abc123
      - Status: verified
      - Created: 2024-01-01T10:00:00.000Z

   🗑️  Deleting 1 duplicate(s):
      - ID: def456
        Status: pending
        Created: 2024-01-01T10:00:05.000Z

💡 This was a DRY RUN. No payments were deleted.
```

**Live Run:**
```
✅ Duplicate payment records deleted successfully!

📝 Deletion log saved to: payment-deletion-log-1234567890.json
```

### Pass Criteria

- Dry run shows correct duplicates
- Live run deletes only newer duplicates
- Oldest payment is kept
- Deletion log is created with audit trail

---

## Test 3: Apply Unique Constraint Migration

### Steps

1. Run migration script:
```bash
npm run script scripts/run-migration-0020.ts
```

2. Verify constraint was created

### Expected Results

```
✅ No duplicate payment records found. Safe to proceed.

🚀 Executing migration...

✅ Migration completed successfully!

🔍 Verifying constraint...

✅ Unique constraint verified:
   Index: idx_payments_unique_auction
   Definition: CREATE UNIQUE INDEX idx_payments_unique_auction ON payments(auction_id)
```

### Pass Criteria

- Migration runs without errors
- Unique constraint is created
- Constraint is verified in database

---

## Test 4: Verify Idempotent Payment Creation

### Steps

1. Find an auction that's about to expire or manually trigger closure

2. Call `closeAuction()` function twice:
```typescript
// In a test script or API endpoint
await auctionClosureService.closeAuction('test-auction-id');
await auctionClosureService.closeAuction('test-auction-id'); // Call again
```

3. Check database for payment records

4. Check logs for idempotent message

### Expected Results

**First Call:**
```
✅ Payment record created for auction test-auction-id
   - Payment ID: payment123
   - Reference: PAY_test-auc_1234567890
```

**Second Call:**
```
✅ Payment already exists for auction test-auction-id (idempotent check)
   - Payment ID: payment123
   - Status: pending
   - Amount: ₦370,000
   - Skipping duplicate payment creation
```

**Database:**
- Only ONE payment record exists for the auction
- Payment ID is the same in both calls

### Pass Criteria

- Second call doesn't create duplicate payment
- Logs show "Payment already exists" message
- No error is thrown
- Function returns successfully both times

---

## Test 5: Verify Unique Constraint Enforcement

### Steps

1. Try to manually insert duplicate payment:
```sql
INSERT INTO payments (
  auction_id,
  vendor_id,
  amount,
  payment_method,
  escrow_status,
  status,
  payment_deadline
) VALUES (
  'existing-auction-id',
  'vendor-id',
  370000,
  'escrow_wallet',
  'frozen',
  'pending',
  NOW() + INTERVAL '24 hours'
);
```

2. Observe the error

### Expected Results

```
ERROR: duplicate key value violates unique constraint "idx_payments_unique_auction"
DETAIL: Key (auction_id)=(existing-auction-id) already exists.
```

### Pass Criteria

- Insert is rejected by database
- Error message mentions unique constraint
- Existing payment record is not affected

---

## Test 6: Comprehensive Duplicate Detection

### Steps

1. Run comprehensive detection:
```bash
npm run script scripts/detect-duplicate-records-all-tables.ts
```

2. Review all tables

### Expected Results

```
═══════════════════════════════════════════════════════
DUPLICATE RECORDS DETECTION REPORT
═══════════════════════════════════════════════════════

✅ payments:
   Duplicate groups: 0
   Affected records: 0

✅ documents (release_forms):
   Duplicate groups: 0
   Affected records: 0

✅ auctions (active/extended):
   Duplicate groups: 0
   Affected records: 0

✅ wallet_transactions:
   Duplicate groups: 0
   Affected records: 0

═══════════════════════════════════════════════════════
Total duplicate groups: 0
Total affected records: 0
═══════════════════════════════════════════════════════

✅ No duplicates found! Database integrity is good.
```

### Pass Criteria

- All tables show 0 duplicates
- Report is saved to JSON file
- No errors during detection

---

## Test 7: Paystack Transfer Recipient Setup (Production Only)

### Steps

1. Get NEM Insurance bank details:
   - Account number
   - Bank code
   - Account name

2. Update `scripts/create-nem-transfer-recipient.ts` with bank details

3. Run the script:
```bash
npm run script scripts/create-nem-transfer-recipient.ts
```

4. Copy recipient code to `.env`

### Expected Results

```
✅ Transfer recipient created successfully!

═══════════════════════════════════════════════════════
RECIPIENT DETAILS
═══════════════════════════════════════════════════════
Recipient Code: RCP_m7ljkv8leesep7p
Name: NEM Insurance Plc
Account Number: 0123456789
Bank: Guaranty Trust Bank (058)
Currency: NGN
Status: Active
═══════════════════════════════════════════════════════

📝 NEXT STEPS:

1. Add this to your .env file:
   PAYSTACK_NEM_RECIPIENT_CODE=RCP_m7ljkv8leesep7p
```

### Pass Criteria

- Recipient is created successfully
- Recipient code is returned
- Bank details are verified
- Recipient details saved to JSON file

---

## Test 8: Verify Transfer in Development (Mock Mode)

### Steps

1. Ensure `PAYSTACK_NEM_RECIPIENT_CODE` is NOT set in `.env`

2. Trigger fund release (e.g., confirm pickup)

3. Check logs

### Expected Results

```
🔓 Releasing ₦370,000 from vendor wallet...
PAYSTACK_NEM_RECIPIENT_CODE not configured. Skipping actual transfer in development mode.
✅ ATOMIC RELEASE: Balance 500000 → 130000, Frozen 370000 → 0
```

### Pass Criteria

- Transfer is skipped (no API call to Paystack)
- Wallet balance is still updated correctly
- Frozen amount is reduced
- No error is thrown

---

## Test 9: Verify Transfer in Production (Live Mode)

### Steps

1. Ensure `PAYSTACK_NEM_RECIPIENT_CODE` is set in production `.env`

2. Trigger fund release with small amount (₦1,000 test)

3. Check logs

4. Verify in Paystack dashboard

### Expected Results

**Logs:**
```
🔓 Releasing ₦1,000 from vendor wallet...
Paystack transfer initiated: {
  transfer_code: "TRF_v5tip3zx8nna9o78",
  status: "success",
  amount: 100000
}
✅ ATOMIC RELEASE: Balance 100000 → 99000, Frozen 1000 → 0
```

**Paystack Dashboard:**
- Transfer appears in Transfers section
- Status: Success
- Amount: ₦1,000
- Recipient: NEM Insurance Plc

### Pass Criteria

- Transfer API call is made
- Transfer is successful
- Wallet balance is updated
- Transfer appears in Paystack dashboard

---

## Regression Tests

### Test 10: Auction Closure Still Works

Verify that auction closure flow is not broken:

1. Create test auction
2. Place winning bid
3. Wait for auction to expire (or manually trigger)
4. Verify:
   - Auction status changes to 'closed'
   - Payment record is created (only one)
   - Documents are generated
   - Winner is notified

### Test 11: Payment Verification Still Works

Verify that payment verification flow is not broken:

1. Find pending payment
2. Finance officer verifies payment
3. Verify:
   - Payment status changes to 'verified'
   - Funds are released (if pickup confirmed)
   - Case status updates to 'sold'

---

## Summary Checklist

- [ ] Test 1: Detect existing duplicates
- [ ] Test 2: Clean up duplicate payments
- [ ] Test 3: Apply unique constraint migration
- [ ] Test 4: Verify idempotent payment creation
- [ ] Test 5: Verify unique constraint enforcement
- [ ] Test 6: Comprehensive duplicate detection
- [ ] Test 7: Paystack transfer recipient setup (production)
- [ ] Test 8: Verify transfer in development (mock mode)
- [ ] Test 9: Verify transfer in production (live mode)
- [ ] Test 10: Auction closure still works
- [ ] Test 11: Payment verification still works

---

## Notes

- Run Tests 1-6 in staging/production to verify fixes
- Run Test 7-9 in production only (with real Paystack keys)
- Run Tests 10-11 to ensure no regressions
- Keep deletion logs for audit trail
- Monitor Paystack dashboard for transfer status

---

## Rollback Plan

If issues occur:

1. **Unique constraint causing problems:**
   ```sql
   DROP INDEX IF EXISTS idx_payments_unique_auction;
   ```

2. **Need to restore deleted payments:**
   - Use deletion log JSON file
   - Manually recreate records if needed

3. **Transfer issues:**
   - Remove `PAYSTACK_NEM_RECIPIENT_CODE` from `.env`
   - Transfers will be skipped (mock mode)
   - Fix issue and re-enable
