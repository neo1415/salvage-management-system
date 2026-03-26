# Security Fixes - Manual Testing Guide

## Overview
This document provides testing procedures for the 5 critical security fixes implemented today.

**Testing Priority**: HIGH  
**Breaking Changes**: NONE  
**Backward Compatibility**: YES

---

## Fix 1: Webhook Replay Protection

### What Was Fixed
Added idempotency check to prevent attackers from replaying webhook requests to credit wallets multiple times.

### How It Works
- Each webhook is identified by its payment reference
- First webhook is processed normally
- Duplicate webhooks are detected and ignored
- Redis stores processed webhook IDs for 7 days

### Test Cases

#### Test 1.1: Normal Webhook Processing
**Steps:**
1. Make a payment via Paystack
2. Wait for webhook to arrive
3. Check logs for: `✅ Payment auto-verified successfully`
4. Verify payment status is 'verified' in database

**Expected Result:**
- Payment is verified
- Pickup code is generated
- SMS and email sent

#### Test 1.2: Duplicate Webhook Detection
**Steps:**
1. Make a payment via Paystack
2. Wait for first webhook to process
3. Manually trigger the same webhook again (using Paystack dashboard)
4. Check logs for: `⚠️ Webhook already processed for reference: XXX. Ignoring duplicate.`

**Expected Result:**
- Second webhook is ignored
- No duplicate payment verification
- No duplicate SMS/email sent
- Wallet balance unchanged

#### Test 1.3: Different Webhooks
**Steps:**
1. Make payment A
2. Make payment B
3. Both webhooks should process successfully

**Expected Result:**
- Both payments verified independently
- No interference between different payments

---

## Fix 2: Payment Race Condition Protection

### What Was Fixed
Added database transaction with row-level locking to prevent concurrent payment processing from causing double-spending or data corruption.

### How It Works
- Payment row is locked during processing
- Only ONE webhook can process a payment at a time
- Other concurrent requests wait or fail gracefully
- Transaction ensures atomic updates

### Test Cases

#### Test 2.1: Concurrent Webhook Requests
**Steps:**
1. Make a payment
2. Simulate 2 webhooks arriving simultaneously (use Postman or curl)
3. Check logs for transaction lock messages

**Expected Result:**
- Only one webhook processes successfully
- Second webhook either waits or fails gracefully
- No duplicate payment verification
- Database remains consistent

#### Test 2.2: Normal Sequential Processing
**Steps:**
1. Make payment A
2. Wait for webhook to complete
3. Make payment B
4. Wait for webhook to complete

**Expected Result:**
- Both payments process successfully
- No locking conflicts
- All data correct

---

## Fix 3: IDOR Authorization Checks

### What Was Fixed
Added ownership validation to payment endpoints to prevent users from accessing other users' payment data.

### How It Works
- Checks if user is the payment owner OR has authorized role
- Authorized roles: admin, salvage_manager, system_admin, finance_officer
- Logs IDOR attempts for security monitoring

### Test Cases

#### Test 3.1: Owner Access (Should Work)
**Steps:**
1. Login as Vendor A
2. Make a payment
3. Access GET /api/payments/[payment-id]
4. Verify you can see your payment details

**Expected Result:**
- ✅ 200 OK
- Payment details returned

#### Test 3.2: Unauthorized Access (Should Fail)
**Steps:**
1. Login as Vendor A
2. Get payment ID from Vendor B (different vendor)
3. Try to access GET /api/payments/[vendor-b-payment-id]
4. Check logs for IDOR warning

**Expected Result:**
- ❌ 403 Forbidden
- Error: "Forbidden - You do not have permission to access this payment"
- Log: `⚠️ IDOR attempt: User X tried to access payment Y owned by Z`

#### Test 3.3: Admin Access (Should Work)
**Steps:**
1. Login as Admin
2. Access any payment GET /api/payments/[any-payment-id]

**Expected Result:**
- ✅ 200 OK
- Payment details returned (admin can see all payments)

#### Test 3.4: Finance Officer Access (Should Work)
**Steps:**
1. Login as Finance Officer
2. Access any payment GET /api/payments/[any-payment-id]

**Expected Result:**
- ✅ 200 OK
- Payment details returned (finance can see all payments)

---

## Fix 4: Input Validation

### What Was Fixed
Added comprehensive bid amount validation to prevent invalid or malicious inputs.

### How It Works
- Validates bid amount is a positive number
- Checks maximum limit (₦100M)
- Ensures at most 2 decimal places
- Prevents NaN, Infinity, negative values

### Test Cases

#### Test 4.1: Valid Bid Amount
**Steps:**
1. Login as vendor
2. Place bid with amount: 50000
3. Verify bid is accepted

**Expected Result:**
- ✅ Bid placed successfully

#### Test 4.2: Negative Amount (Should Fail)
**Steps:**
1. Try to place bid with amount: -50000

**Expected Result:**
- ❌ Error: "Bid amount must be a positive number"

#### Test 4.3: Zero Amount (Should Fail)
**Steps:**
1. Try to place bid with amount: 0

**Expected Result:**
- ❌ Error: "Bid amount must be a positive number"

#### Test 4.4: Excessive Amount (Should Fail)
**Steps:**
1. Try to place bid with amount: 150000000 (₦150M)

**Expected Result:**
- ❌ Error: "Bid amount exceeds maximum allowed (₦100,000,000)"

#### Test 4.5: Too Many Decimals (Should Fail)
**Steps:**
1. Try to place bid with amount: 50000.123 (3 decimal places)

**Expected Result:**
- ❌ Error: "Bid amount can have at most 2 decimal places"

#### Test 4.6: NaN Value (Should Fail)
**Steps:**
1. Try to place bid with amount: NaN or "abc"

**Expected Result:**
- ❌ Error: "Bid amount must be a positive number"

#### Test 4.7: Valid Decimal Amount
**Steps:**
1. Place bid with amount: 50000.50 (2 decimal places)

**Expected Result:**
- ✅ Bid placed successfully

---

## Fix 5: Error Message Sanitization

### What Was Fixed
Removed sensitive system information from error messages to prevent information disclosure.

### How It Works
- Generic error messages for unexpected errors
- Specific errors only for user-actionable issues
- Internal details logged server-side only
- No database/stack trace exposure

### Test Cases

#### Test 5.1: Database Error (Should Be Generic)
**Steps:**
1. Simulate database connection failure
2. Try to access payment endpoint
3. Check error message

**Expected Result:**
- Error: "Failed to retrieve payment details. Please try again."
- NO database connection strings
- NO stack traces
- NO internal paths

#### Test 5.2: User-Actionable Error (Should Be Specific)
**Steps:**
1. Try to place bid below minimum
2. Check error message

**Expected Result:**
- Error: "Bid too low. Minimum bid: ₦XX,XXX"
- Specific, actionable message
- No sensitive details

#### Test 5.3: Unexpected Error (Should Be Generic)
**Steps:**
1. Cause an unexpected error (e.g., invalid JSON)
2. Check error message

**Expected Result:**
- Error: "Failed to place bid. Please try again."
- Generic message
- Details logged server-side only

---

## Regression Testing

### Existing Functionality Should Still Work

#### RT-1: Normal Payment Flow
**Steps:**
1. Vendor wins auction
2. Makes payment via Paystack
3. Webhook processes payment
4. Pickup code generated
5. SMS/email sent

**Expected Result:**
- ✅ All steps work as before
- No breaking changes

#### RT-2: Normal Bidding Flow
**Steps:**
1. Vendor places valid bid
2. OTP verified
3. Bid recorded
4. Auction updated
5. Previous bidder notified

**Expected Result:**
- ✅ All steps work as before
- No breaking changes

#### RT-3: Admin Pickup Confirmation
**Steps:**
1. Admin confirms pickup
2. Case status updated
3. Vendor notified

**Expected Result:**
- ✅ All steps work as before
- No breaking changes

---

## Security Monitoring

### What to Monitor After Deployment

1. **IDOR Attempts**
   - Check logs for: `⚠️ IDOR attempt`
   - Investigate repeated attempts from same user

2. **Webhook Replay Attempts**
   - Check logs for: `⚠️ Webhook already processed`
   - Monitor frequency of duplicate webhooks

3. **Invalid Input Attempts**
   - Check logs for validation errors
   - Look for patterns of malicious input

4. **Error Rate**
   - Monitor 500 errors
   - Investigate spikes in error rates

---

## Rollback Plan

If any issues are found:

1. **Immediate**: Revert the specific fix causing issues
2. **Investigate**: Check logs for root cause
3. **Fix**: Address the issue
4. **Re-deploy**: Test thoroughly before re-deploying

### Files to Revert (if needed):
- `src/features/payments/services/paystack.service.ts`
- `src/app/api/payments/[id]/route.ts`
- `src/features/auctions/services/bidding.service.ts`
- `src/app/api/auctions/[id]/bids/route.ts`
- `src/app/api/admin/auctions/[id]/confirm-pickup/route.ts`

---

## Success Criteria

All fixes are successful if:
- ✅ All test cases pass
- ✅ No breaking changes to existing functionality
- ✅ No increase in error rates
- ✅ Security improvements verified
- ✅ Performance remains acceptable

---

## Notes

- All fixes are **backward compatible**
- No database migrations required
- No environment variable changes needed
- Can be deployed independently
- Can be rolled back independently
