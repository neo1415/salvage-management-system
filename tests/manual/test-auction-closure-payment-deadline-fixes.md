# Manual Testing Guide: Auction Closure & Payment Deadline Fixes

## Overview
This guide covers testing for the critical fixes to auction closure and payment deadline system:
1. Immediate document generation on auction closure
2. 72-hour forfeiture logic (no suspension)
3. Grace period document restoration
4. Document signing with forfeiture check

## Prerequisites
- Access to admin, finance officer, and vendor accounts
- Database access to verify state changes
- Ability to manipulate time (or wait for cron jobs)

---

## Test 1: Immediate Document Generation on Auction Closure

### Objective
Verify that documents are generated immediately when an auction closes with a winner.

### Steps
1. **Setup**: Create an auction with a winning bid
2. **Trigger**: Wait for auction to end OR manually close auction
3. **Verify**:
   - [ ] Payment record created immediately
   - [ ] Bill of Sale generated immediately
   - [ ] Liability Waiver generated immediately
   - [ ] Pickup Authorization NOT generated (security fix)
   - [ ] Documents visible in vendor dashboard
   - [ ] Vendor receives notification with link to sign documents

### Expected Results
```
✅ Payment record created: payment_id
✅ Bill of Sale generated for auction auction_id
✅ Liability Waiver generated for auction auction_id
📄 Document generation complete: 2/2 successful
```

### Database Verification
```sql
-- Check payment record
SELECT id, auction_id, vendor_id, status, payment_method, escrow_status, payment_deadline
FROM payments
WHERE auction_id = 'YOUR_AUCTION_ID';

-- Check documents
SELECT id, auction_id, document_type, status, disabled, created_at
FROM release_forms
WHERE auction_id = 'YOUR_AUCTION_ID'
ORDER BY created_at DESC;
```

### Success Criteria
- ✅ 2 documents generated (Bill of Sale, Liability Waiver)
- ✅ No duplicate documents created
- ✅ Documents available within seconds of auction closure
- ✅ Vendor notified immediately

---

## Test 2: 72-Hour Forfeiture Logic (No Suspension)

### Objective
Verify that auctions are forfeited after 72 hours without payment, funds stay frozen, and NO account suspension occurs.

### Steps
1. **Setup**: Create auction with winner, let payment become overdue
2. **Wait**: 72 hours after payment deadline (or manipulate time)
3. **Trigger**: Run cron job `enforcePaymentDeadlines()`
4. **Verify**:
   - [ ] Auction status changed to 'forfeited'
   - [ ] Payment status changed to 'forfeited'
   - [ ] Documents disabled (disabled = true)
   - [ ] Funds remain frozen in vendor wallet
   - [ ] Vendor account NOT suspended
   - [ ] Vendor receives email: "Contact support if still interested"
   - [ ] Finance Officers receive alert for manual review

### Expected Results
```
⚠️  Found 1 overdue payment(s)
✅ Auction forfeited: auction_id
✅ Documents disabled for auction auction_id
✅ Funds remain frozen: ₦XXX,XXX
✅ Forfeiture alerts sent to 3 Finance Officers
```

### Database Verification
```sql
-- Check auction status
SELECT id, status, updated_at
FROM auctions
WHERE id = 'YOUR_AUCTION_ID';
-- Expected: status = 'forfeited'

-- Check payment status
SELECT id, status, escrow_status, updated_at
FROM payments
WHERE auction_id = 'YOUR_AUCTION_ID';
-- Expected: status = 'forfeited', escrow_status = 'frozen'

-- Check documents disabled
SELECT id, document_type, disabled, updated_at
FROM release_forms
WHERE auction_id = 'YOUR_AUCTION_ID';
-- Expected: disabled = true for all documents

-- Check vendor NOT suspended
SELECT id, status
FROM vendors
WHERE id = 'YOUR_VENDOR_ID';
-- Expected: status != 'suspended'

-- Check wallet funds still frozen
SELECT id, balance, available_balance, frozen_amount
FROM escrow_wallets
WHERE vendor_id = 'YOUR_VENDOR_ID';
-- Expected: frozen_amount = payment amount
```

### Success Criteria
- ✅ Auction marked as 'forfeited' after 72 hours
- ✅ Documents disabled
- ✅ Funds remain frozen
- ✅ NO account suspension
- ✅ Finance Officers alerted
- ✅ Vendor notified to contact support

---

## Test 3: Grace Period Document Restoration

### Objective
Verify that Finance Officer can grant grace period, which re-enables documents and extends deadline.

### Steps
1. **Setup**: Have a forfeited auction (from Test 2)
2. **Action**: Finance Officer grants 3-day grace period
3. **Verify**:
   - [ ] Payment deadline extended by 3 days
   - [ ] Payment status changed from 'forfeited' to 'pending'
   - [ ] Auction status changed from 'forfeited' to 'closed'
   - [ ] Documents re-enabled (disabled = false)
   - [ ] Vendor receives notification: "You can now sign documents"
   - [ ] Vendor can access and sign documents

### Expected Results
```
🔄 Granting grace period for payment payment_id...
✅ Documents re-enabled and auction status restored for auction_id
✅ Grace period granted: New deadline 2024-XX-XX
✅ Grace period notifications sent to vendor
```

### API Test
```bash
# As Finance Officer
curl -X POST http://localhost:3000/api/payments/PAYMENT_ID/grant-grace-period \
  -H "Authorization: Bearer FINANCE_OFFICER_TOKEN" \
  -H "Content-Type: application/json"
```

### Database Verification
```sql
-- Check payment deadline extended
SELECT id, payment_deadline, status, updated_at
FROM payments
WHERE id = 'YOUR_PAYMENT_ID';
-- Expected: payment_deadline = original + 3 days, status = 'pending'

-- Check auction status restored
SELECT id, status, updated_at
FROM auctions
WHERE id = 'YOUR_AUCTION_ID';
-- Expected: status = 'closed'

-- Check documents re-enabled
SELECT id, document_type, disabled, updated_at
FROM release_forms
WHERE auction_id = 'YOUR_AUCTION_ID';
-- Expected: disabled = false for all documents
```

### Success Criteria
- ✅ Deadline extended by 3 days
- ✅ Documents re-enabled
- ✅ Auction status restored to 'closed'
- ✅ Vendor can sign documents
- ✅ Vendor notified with clear instructions

---

## Test 4: Document Signing with Forfeiture Check

### Objective
Verify that document signing is blocked when auction is forfeited, and allowed after grace period.

### Steps

#### Part A: Signing Blocked When Forfeited
1. **Setup**: Have a forfeited auction with disabled documents
2. **Action**: Vendor attempts to sign document
3. **Verify**:
   - [ ] Signing blocked with error message
   - [ ] Error: "Document signing is disabled. This auction has been forfeited."
   - [ ] Document status remains 'pending'

#### Part B: Signing Allowed After Grace Period
1. **Setup**: Finance Officer grants grace period (from Test 3)
2. **Action**: Vendor signs documents
3. **Verify**:
   - [ ] Document signing succeeds
   - [ ] Document status changed to 'signed'
   - [ ] After all documents signed, payment auto-processed
   - [ ] Vendor receives pickup authorization code

### Expected Results

**Part A (Blocked):**
```
❌ Error: Document signing is disabled. This auction has been forfeited. Please contact support if you wish to proceed.
```

**Part B (Allowed):**
```
✅ Document signed: document_id by vendor vendor_id
✅ All documents signed for auction auction_id
🔓 Releasing ₦XXX,XXX from vendor wallet...
✅ Funds released successfully via Paystack
✅ Payment status updated to 'verified'
```

### Database Verification
```sql
-- Check document signing blocked (Part A)
SELECT id, status, signed_at, disabled
FROM release_forms
WHERE id = 'YOUR_DOCUMENT_ID';
-- Expected: status = 'pending', signed_at = NULL, disabled = true

-- Check document signing allowed (Part B)
SELECT id, status, signed_at, disabled
FROM release_forms
WHERE id = 'YOUR_DOCUMENT_ID';
-- Expected: status = 'signed', signed_at = NOW(), disabled = false

-- Check payment auto-processed
SELECT id, status, escrow_status, verified_at, auto_verified
FROM payments
WHERE auction_id = 'YOUR_AUCTION_ID';
-- Expected: status = 'verified', escrow_status = 'released', auto_verified = true
```

### Success Criteria
- ✅ Signing blocked when forfeited
- ✅ Clear error message shown
- ✅ Signing allowed after grace period
- ✅ Payment auto-processed after all documents signed

---

## Test 5: End-to-End Flow

### Objective
Test the complete flow from auction closure to payment completion.

### Steps
1. **Auction Closes**: Winner determined
   - ✅ Documents generated immediately
   - ✅ Payment record created
   - ✅ Vendor notified

2. **Vendor Signs Documents** (within 24 hours)
   - ✅ Bill of Sale signed
   - ✅ Liability Waiver signed
   - ✅ Payment auto-processed
   - ✅ Pickup code sent

3. **Alternative: Vendor Delays** (72+ hours)
   - ✅ Auction forfeited
   - ✅ Documents disabled
   - ✅ Funds frozen
   - ✅ Finance Officers alerted

4. **Finance Officer Grants Grace**
   - ✅ Documents re-enabled
   - ✅ Deadline extended
   - ✅ Vendor can sign

5. **Vendor Signs After Grace**
   - ✅ Documents signed
   - ✅ Payment processed
   - ✅ Pickup code sent

### Success Criteria
- ✅ No duplicate documents
- ✅ No duplicate payment records
- ✅ No account suspension
- ✅ Funds properly managed
- ✅ Clear notifications at each step

---

## Regression Tests

### Test 6: Verify No Breaking Changes

1. **Normal Flow Still Works**
   - [ ] Auction closes → Documents generated
   - [ ] Vendor signs within 24 hours → Payment processed
   - [ ] No errors or delays

2. **Existing Auctions Not Affected**
   - [ ] Old auctions still accessible
   - [ ] Old documents still signable
   - [ ] No data corruption

3. **Backward Compatibility**
   - [ ] Auctions without 'disabled' field work
   - [ ] Payments without 'forfeited' status work
   - [ ] No migration errors

---

## Performance Tests

### Test 7: Document Generation Speed

1. **Measure**: Time from auction closure to documents available
2. **Target**: < 5 seconds
3. **Verify**: No timeout errors

### Test 8: Cron Job Performance

1. **Measure**: Time to process 100 overdue payments
2. **Target**: < 30 seconds
3. **Verify**: No memory leaks

---

## Security Tests

### Test 9: Authorization Checks

1. **Verify**: Only Finance Officers can grant grace period
2. **Verify**: Vendors cannot sign disabled documents
3. **Verify**: Vendors cannot bypass forfeiture check

---

## Monitoring & Alerts

### What to Monitor

1. **Document Generation Failures**
   - Check audit logs for `DOCUMENT_GENERATION_FAILED`
   - Alert Finance Officers

2. **Forfeiture Events**
   - Track number of forfeitures per day
   - Alert if > 10 per day

3. **Grace Period Grants**
   - Track frequency
   - Alert if > 5 per day

4. **Payment Processing Failures**
   - Check for stuck payments
   - Alert Finance Officers immediately

---

## Rollback Plan

If issues are found:

1. **Disable Cron Job**: Stop `enforcePaymentDeadlines()`
2. **Revert Schema**: Run rollback migration
3. **Restore Code**: Revert to previous version
4. **Notify Users**: Send email about temporary issues

---

## Sign-Off Checklist

- [ ] All 9 tests passed
- [ ] No duplicate documents created
- [ ] No duplicate payment records
- [ ] No account suspensions
- [ ] Funds properly frozen/released
- [ ] Finance Officers receive alerts
- [ ] Vendors receive clear notifications
- [ ] Performance acceptable
- [ ] Security checks passed
- [ ] Documentation updated

---

## Notes

- Run migration before testing: `npm run db:migrate`
- Check logs for errors: `tail -f logs/app.log`
- Monitor Paystack dashboard for transfers
- Test in staging environment first
