# Manual Test Plan: Document & Payment Flow Fixes

## Date: March 24, 2026

## Overview
This test plan validates the fixes for document generation and payment flow issues.

---

## Test 1: Document Generation Success

### Objective
Verify that both documents (Bill of Sale + Liability Waiver) are generated when auction closes

### Steps
1. Create an auction with a winning bid
2. Wait for auction to end (or end it manually)
3. Check the database for generated documents

### Expected Results
- ✅ Bill of Sale document created
- ✅ Liability Waiver document created
- ✅ Both documents have status='pending'
- ✅ Vendor receives notification with link to sign documents

### SQL Query
```sql
SELECT 
  id,
  auction_id,
  document_type,
  status,
  created_at
FROM release_forms
WHERE auction_id = 'YOUR_AUCTION_ID'
ORDER BY created_at DESC;
```

### Expected Output
```
| id | auction_id | document_type      | status  | created_at |
|----|------------|--------------------|---------|------------|
| 1  | abc123     | bill_of_sale       | pending | 2026-03-24 |
| 2  | abc123     | liability_waiver   | pending | 2026-03-24 |
```

---

## Test 2: Document Generation Failure Visibility

### Objective
Verify that document generation failures are logged and visible

### Steps
1. Temporarily break document generation (e.g., invalid Cloudinary credentials)
2. Create an auction with a winning bid
3. Wait for auction to end
4. Check server logs

### Expected Results
- ✅ Error logged with clear message: "Failed to generate Bill of Sale"
- ✅ Error includes full stack trace
- ✅ Closure service logs the failure
- ✅ Audit log entry created for document generation failure

### Log Output Example
```
❌ CRITICAL: Failed to generate documents for auction abc123:
   - Vendor ID: vendor-123
   - Error details: Cloudinary upload failed: Invalid credentials
```

---

## Test 3: Finance Dashboard - Frozen Escrow Exclusion

### Objective
Verify that frozen escrow payments do NOT appear in finance dashboard

### Steps
1. Create an auction with escrow wallet payment
2. Wait for auction to close (documents generated, payment created with escrowStatus='frozen')
3. Log in as Finance Officer
4. Navigate to Finance Dashboard

### Expected Results
- ✅ Pending Verification count does NOT include frozen escrow payment
- ✅ Total Amount does NOT include frozen escrow amount
- ✅ Dashboard shows accurate counts for payments ready for action

### API Test
```bash
curl -X GET http://localhost:3000/api/dashboard/finance \
  -H "Cookie: your-session-cookie"
```

### Expected Response
```json
{
  "totalPayments": 5,
  "pendingVerification": 2,  // Does NOT include frozen escrow
  "verified": 3,
  "rejected": 0,
  "totalAmount": 1500000,    // Does NOT include frozen escrow amount
  "escrowWalletPayments": 1,
  "escrowWalletPercentage": 20
}
```

---

## Test 4: Finance Payments Page - No Approve/Reject for Frozen Escrow

### Objective
Verify that frozen escrow payments show "Waiting for Documents" instead of approve/reject buttons

### Steps
1. Create an auction with escrow wallet payment
2. Wait for auction to close (payment created with escrowStatus='frozen')
3. Log in as Finance Officer
4. Navigate to Finance → Payments

### Expected Results
- ✅ Frozen escrow payment is visible in the list
- ✅ Shows "⏳ Waiting for Documents" message
- ✅ Shows document progress: "0/2 signed"
- ✅ NO approve/reject buttons visible
- ✅ "View Details" button is available

### Screenshot Checklist
- [ ] Payment card shows yellow "Waiting for Documents" badge
- [ ] Document progress indicator visible
- [ ] No green "Approve" button
- [ ] No red "Reject" button

---

## Test 5: Finance Payment Details Modal - Frozen Escrow

### Objective
Verify that payment details modal shows correct information for frozen escrow

### Steps
1. From Finance → Payments page
2. Click "View Details" on a frozen escrow payment

### Expected Results
- ✅ Modal shows payment details
- ✅ Shows escrow status badge: "🔒 Frozen"
- ✅ Shows document progress section
- ✅ Shows wallet balance information
- ✅ Shows yellow info box: "Waiting for Vendor to Sign Documents"
- ✅ Info box explains: "No manual approval needed - funds will auto-release when documents are complete"
- ✅ NO approve/reject buttons at bottom

### Screenshot Checklist
- [ ] Yellow info box visible
- [ ] Document progress: "0/2 documents signed"
- [ ] Escrow status badge shows "Frozen"
- [ ] No action buttons at bottom

---

## Test 6: Document Signing Flow

### Objective
Verify complete document signing and auto-release flow

### Steps
1. Create auction with escrow wallet payment
2. Wait for auction to close
3. Log in as Vendor
4. Navigate to auction details
5. Sign Bill of Sale (1/2)
6. Sign Liability Waiver (2/2)
7. Wait 30 seconds for auto-release
8. Check payment status

### Expected Results
- ✅ Vendor sees "Progress: 0/2 documents signed"
- ✅ After signing first document: "Progress: 1/2 documents signed"
- ✅ After signing second document: "Progress: 2/2 documents signed"
- ✅ Within 30 seconds: Funds auto-released
- ✅ Payment status updated to 'verified'
- ✅ Escrow status updated to 'released'
- ✅ Case status updated to 'sold'
- ✅ Vendor receives SMS with pickup code
- ✅ Vendor receives email with pickup details
- ✅ Push notification sent: "Payment Complete!"

### SQL Verification
```sql
-- Check payment status
SELECT 
  id,
  status,
  escrow_status,
  auto_verified,
  verified_at
FROM payments
WHERE auction_id = 'YOUR_AUCTION_ID';

-- Expected:
-- status: 'verified'
-- escrow_status: 'released'
-- auto_verified: true
-- verified_at: [timestamp]
```

---

## Test 7: Finance Dashboard After Auto-Release

### Objective
Verify that finance dashboard shows completed payment after auto-release

### Steps
1. Complete Test 6 (document signing and auto-release)
2. Log in as Finance Officer
3. Navigate to Finance Dashboard

### Expected Results
- ✅ Verified count increased by 1
- ✅ Total Amount includes the released payment
- ✅ Payment visible in "Verified" tab
- ✅ Shows "✅ Verified (Auto)" badge
- ✅ Shows "Documents: 2/2 Signed"
- ✅ Shows pickup code

---

## Test 8: Bank Transfer Payment (Control Test)

### Objective
Verify that non-escrow payments still show approve/reject buttons

### Steps
1. Create a payment with paymentMethod='bank_transfer'
2. Log in as Finance Officer
3. Navigate to Finance → Payments

### Expected Results
- ✅ Payment shows in pending list
- ✅ Shows green "Approve" button
- ✅ Shows red "Reject" button
- ✅ Can click "View Details"
- ✅ Details modal shows approve/reject buttons

### Note
This test confirms that the fix only affects escrow wallet payments, not other payment methods.

---

## Test 9: Document Generation Error Recovery

### Objective
Verify that if document generation fails, the system handles it gracefully

### Steps
1. Temporarily break document generation
2. Create auction and let it close
3. Check logs and database
4. Fix document generation
5. Manually trigger document generation (if possible)

### Expected Results
- ✅ Error logged clearly
- ✅ Audit log entry created
- ✅ Finance officers notified (if notification system exists)
- ✅ Payment record still created
- ✅ Vendor can still see auction details
- ✅ System doesn't crash or hang

---

## Test 10: Edge Case - Multiple Document Signing Attempts

### Objective
Verify that signing the same document twice doesn't cause issues

### Steps
1. Create auction with escrow payment
2. Wait for closure
3. Sign Bill of Sale
4. Try to sign Bill of Sale again
5. Sign Liability Waiver
6. Check payment status

### Expected Results
- ✅ Second signing attempt is rejected or ignored
- ✅ Document shows as "already signed"
- ✅ Auto-release still triggers correctly after second document
- ✅ No duplicate payment records
- ✅ No duplicate notifications

---

## Regression Tests

### Test R1: Paystack Payments Still Work
- [ ] Create Paystack payment
- [ ] Finance officer can approve/reject
- [ ] Payment verification works correctly

### Test R2: Bank Transfer Payments Still Work
- [ ] Create bank transfer payment
- [ ] Upload payment proof
- [ ] Finance officer can approve/reject
- [ ] Payment verification works correctly

### Test R3: Overdue Payments Still Work
- [ ] Create payment past deadline
- [ ] Shows in "Overdue" tab
- [ ] Finance officer can grant grace period
- [ ] Grace period extends deadline correctly

---

## Performance Tests

### Test P1: Dashboard Load Time
- [ ] Finance dashboard loads in < 2 seconds
- [ ] Dashboard with 100+ payments loads in < 5 seconds
- [ ] Redis caching works correctly

### Test P2: Payment List Load Time
- [ ] Payments page loads in < 2 seconds
- [ ] Filtering works quickly (< 1 second)
- [ ] Export to CSV works for 1000+ payments

---

## Success Criteria

All tests must pass with ✅ before deploying to production.

**Critical Tests (Must Pass):**
- Test 1: Document Generation Success
- Test 3: Finance Dashboard - Frozen Escrow Exclusion
- Test 4: Finance Payments Page - No Approve/Reject
- Test 6: Document Signing Flow
- Test 7: Finance Dashboard After Auto-Release

**Important Tests (Should Pass):**
- Test 2: Document Generation Failure Visibility
- Test 5: Finance Payment Details Modal
- Test 8: Bank Transfer Payment (Control)
- All Regression Tests

**Nice to Have (Can Fix Later):**
- Test 9: Document Generation Error Recovery
- Test 10: Edge Case - Multiple Signing Attempts
- Performance Tests

---

## Test Execution Log

| Test | Date | Tester | Result | Notes |
|------|------|--------|--------|-------|
| Test 1 | | | | |
| Test 2 | | | | |
| Test 3 | | | | |
| Test 4 | | | | |
| Test 5 | | | | |
| Test 6 | | | | |
| Test 7 | | | | |
| Test 8 | | | | |
| Test 9 | | | | |
| Test 10 | | | | |

---

**Test Plan Status:** ✅ READY FOR EXECUTION
**Created:** March 24, 2026
**Last Updated:** March 24, 2026
