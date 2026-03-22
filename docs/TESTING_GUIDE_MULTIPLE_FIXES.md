# Testing Guide: Multiple System Fixes

**Date**: December 2024  
**Status**: Ready for Testing

---

## Overview

This guide covers testing for:
1. ✅ Escrow money transfer fix (already working)
2. ✅ Document signing flow (already working)
3. 🆕 Wallet page re-rendering fix
4. ⚠️ Account suspension recommendations (requires decision)

---

## Test 1: Escrow Money Transfer (Verification)

### Objective
Confirm that when payment is unlocked, money is properly transferred and frozen amount is reduced.

### Prerequisites
- Vendor with escrow wallet funded
- Vendor wins an auction
- Funds are frozen

### Test Steps

1. **Check Initial State**:
   ```sql
   SELECT balance, availableBalance, frozenAmount 
   FROM escrow_wallets 
   WHERE vendorId = 'VENDOR_ID';
   ```
   Expected: `frozenAmount > 0`

2. **Sign Documents**:
   - Sign Bill of Sale
   - Sign Liability Waiver
   - Wait for automatic payment processing

3. **Check Final State**:
   ```sql
   SELECT balance, availableBalance, frozenAmount 
   FROM escrow_wallets 
   WHERE vendorId = 'VENDOR_ID';
   ```
   Expected: 
   - `balance` decreased by payment amount
   - `frozenAmount` decreased by payment amount
   - `availableBalance` unchanged

4. **Check Transactions**:
   ```sql
   SELECT type, amount, description 
   FROM wallet_transactions 
   WHERE walletId = 'WALLET_ID' 
   ORDER BY createdAt DESC 
   LIMIT 5;
   ```
   Expected:
   - One `debit` transaction (money transferred out)
   - One `unfreeze` transaction (frozen amount released)
   - Both with same amount

5. **Check Payment Status**:
   ```sql
   SELECT status, escrowStatus, verifiedAt 
   FROM payments 
   WHERE auctionId = 'AUCTION_ID';
   ```
   Expected:
   - `status = 'verified'`
   - `escrowStatus = 'released'`
   - `verifiedAt` is set

### Expected Results
✅ Money transferred FROM vendor wallet  
✅ Frozen amount DECREASED  
✅ No "infinite money glitch"  
✅ Finance Officer sees payment  
✅ Vendor receives pickup code

---

## Test 2: Document Signing Flow (Verification)

### Objective
Confirm that only 2 documents are required before payment, and pickup auth is sent after.

### Test Steps

1. **Win an Auction**:
   - Place winning bid
   - Wait for auction to close

2. **Check Documents Generated**:
   - Navigate to Documents page
   - Expected: 2 documents (Bill of Sale, Liability Waiver)
   - Expected: Both status = 'pending'

3. **Sign First Document**:
   - Click "Sign Now" on Bill of Sale
   - Complete signature
   - Expected: Progress shows 1/2 (50%)
   - Expected: Push notification sent

4. **Sign Second Document**:
   - Click "Sign Now" on Liability Waiver
   - Complete signature
   - Expected: Progress shows 2/2 (100%)
   - Expected: SMS and Email sent

5. **Wait for Payment Processing**:
   - Expected: Automatic fund release triggered
   - Expected: Payment status changes to 'verified'
   - Expected: Case status changes to 'sold'

6. **Check Pickup Authorization**:
   - Expected: SMS received with pickup code
   - Expected: Email received with pickup details
   - Expected: Push notification with PAYMENT_UNLOCKED modal
   - Expected: Pickup auth code format: `AUTH-XXXXXXXX`

### Expected Results
✅ Only 2 documents required before payment  
✅ Pickup authorization sent AFTER payment  
✅ Auth code sent via SMS and Email  
✅ Payment unlocked modal appears  
✅ No security issues (code not visible before payment)

---

## Test 3: Wallet Page Re-rendering Fix

### Objective
Verify that the wallet page no longer re-renders unnecessarily.

### Prerequisites
- Vendor account with wallet
- Some transactions in wallet history

### Test Steps

1. **Open Wallet Page**:
   - Navigate to `/vendor/wallet`
   - Wait for page to load completely

2. **Monitor for Re-renders**:
   - Open browser DevTools
   - Go to Console tab
   - Watch for repeated fetch calls
   - Observe page for visual flickers

3. **Interact with Page**:
   - Scroll through transactions
   - Click on different elements
   - Wait 30 seconds without interaction
   - Expected: No re-renders or flickers

4. **Check Console Logs**:
   - Expected: Fetch calls only on initial load
   - Expected: No repeated "Fetching wallet data" logs
   - Expected: No unnecessary state updates

5. **Test Add Funds**:
   - Enter amount in funding field
   - Expected: No re-renders while typing
   - Expected: Page remains stable

6. **Test Payment Success Callback**:
   - Add `?status=success` to URL
   - Reload page
   - Expected: Wallet data refreshes once
   - Expected: URL parameters cleared
   - Expected: No repeated refreshes

### Expected Results
✅ No visual flickers or re-renders  
✅ Fetch calls only when needed  
✅ State updates only when data changes  
✅ Smooth user experience  
✅ No performance issues

### Performance Metrics

**Before Fix**:
- Re-renders: 5-10 per minute
- Fetch calls: Multiple per minute
- User experience: Annoying flickers

**After Fix**:
- Re-renders: 0 (unless data actually changes)
- Fetch calls: Only on mount and after payment
- User experience: Smooth and stable

---

## Test 4: Account Suspension (If Implemented)

### Objective
Verify that account suspension logic works as intended (or is properly disabled).

### Test Steps (If Disabled)

1. **Create Overdue Payment**:
   - Set payment deadline to 3 days ago
   - Set payment status to 'overdue'

2. **Run Cron Job**:
   ```bash
   curl -X POST http://localhost:3000/api/cron/check-overdue-payments \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

3. **Check Vendor Status**:
   ```sql
   SELECT status FROM vendors WHERE id = 'VENDOR_ID';
   ```
   Expected: `status != 'suspended'` (if disabled)

4. **Check Notifications**:
   - Expected: Overdue email sent to vendor
   - Expected: Alert sent to Finance Officers
   - Expected: No suspension email sent

### Test Steps (If Enabled with Grace Period)

1. **Grant Grace Period**:
   - Finance Officer grants 3-day grace period
   - Payment deadline extended

2. **Run Cron Job**:
   - Expected: No suspension (grace period active)

3. **Wait for Grace Period to Expire**:
   - Run cron job again after grace period
   - Expected: Suspension occurs

### Expected Results (If Disabled)
✅ Vendors NOT automatically suspended  
✅ Overdue notifications still sent  
✅ Finance Officers alerted for manual review  
✅ No false positives from system bugs

### Expected Results (If Enabled)
✅ Suspension only after grace period  
✅ Finance Officer decisions respected  
✅ Proper notifications sent  
✅ Audit logs created

---

## Regression Testing

### Critical Paths to Test

1. **Auction Bidding Flow**:
   - Place bid → Win auction → Sign documents → Payment processed → Pickup code received

2. **Wallet Funding Flow**:
   - Add funds → Paystack payment → Webhook → Balance updated → Transaction recorded

3. **Document Management**:
   - Generate documents → Sign documents → Download documents → Verify signatures

4. **Payment Processing**:
   - Freeze funds → Release funds → Transfer to NEM → Update payment status

### Edge Cases to Test

1. **Duplicate Payment Processing**:
   - Sign documents twice
   - Expected: Payment processed only once
   - Expected: No duplicate transfers

2. **Concurrent Document Signing**:
   - Sign both documents simultaneously
   - Expected: Both signatures recorded
   - Expected: Payment triggered once

3. **Wallet Balance Edge Cases**:
   - Insufficient balance
   - Exact balance match
   - Balance with pending transactions

4. **Network Failures**:
   - Paystack API timeout
   - Database connection lost
   - Expected: Proper error handling
   - Expected: No data corruption

---

## Automated Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run specific test suites
npm run test -- wallet
npm run test -- escrow
npm run test -- documents
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run specific integration tests
npm run test:integration -- escrow-payment
npm run test:integration -- document-signing
```

### E2E Tests

```bash
# Run end-to-end tests
npm run test:e2e

# Run specific E2E scenarios
npm run test:e2e -- auction-to-pickup
npm run test:e2e -- wallet-funding
```

---

## Monitoring and Logging

### Key Logs to Monitor

1. **Escrow Service**:
   ```
   ✅ ATOMIC RELEASE: Balance X → Y, Frozen A → B
   ⚠️  Funds already released for auction [ID]
   ❌ Error releasing funds: [error]
   ```

2. **Document Service**:
   ```
   ✅ All documents signed for auction [ID]
   🔓 Releasing ₦X from vendor wallet...
   ✅ Funds released successfully via Paystack
   ```

3. **Wallet Page**:
   ```
   📄 Fetching wallet data...
   ✅ Wallet data loaded
   ⏸️  No change, prevent re-render
   ```

4. **Payment Deadlines**:
   ```
   ⚠️  Found X overdue payment(s)
   ✅ Overdue notifications sent
   ⏸️  Grace period granted. Skipping auto-suspension.
   ```

---

## Success Criteria

### Escrow Money Transfer
- [ ] Money transferred correctly
- [ ] Frozen amount reduced
- [ ] No infinite money glitch
- [ ] Finance Officer sees payment
- [ ] Vendor receives pickup code

### Document Signing Flow
- [ ] Only 2 documents before payment
- [ ] Pickup auth sent after payment
- [ ] Auth code in SMS and Email
- [ ] Payment unlocked modal works
- [ ] No security issues

### Wallet Page Re-rendering
- [ ] No visual flickers
- [ ] Fetch calls only when needed
- [ ] State updates only on change
- [ ] Smooth user experience
- [ ] No performance degradation

### Account Suspension
- [ ] Logic works as intended (or properly disabled)
- [ ] Notifications sent correctly
- [ ] Finance Officers alerted
- [ ] No false positives
- [ ] Audit logs created

---

## Rollback Plan

If critical issues are found:

1. **Wallet Page**: Revert to previous version
2. **Account Suspension**: Disable immediately
3. **Escrow/Documents**: Already working, no rollback needed

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Engineer | | | |
| Finance Officer | | | |
| Product Owner | | | |

---

## Notes

- All tests should be performed in a staging environment first
- Production deployment should be done during low-traffic hours
- Monitor logs closely for the first 24 hours after deployment
- Have rollback plan ready in case of issues
