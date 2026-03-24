# Manual Test Plan: Payment Receipt & Transaction History API Fixes

## Overview
This test plan verifies the fixes for two critical API issues:
1. Payment receipt page 404 error
2. Transaction history 400 errors

## Test Environment
- **Payment ID**: `251e4807-7406-44d2-8082-5897951fa7e1`
- **User Role**: Vendor (logged in)
- **Date Range**: Last 30 days

---

## Issue 1: Payment Receipt Page 404

### Test Case 1.1: Fetch Payment Details
**Endpoint**: `GET /api/payments/251e4807-7406-44d2-8082-5897951fa7e1`

**Expected Response**:
```json
{
  "id": "251e4807-7406-44d2-8082-5897951fa7e1",
  "auctionId": "...",
  "amount": "...",
  "status": "completed",
  "paymentDeadline": "...",
  "paymentMethod": "escrow_wallet",
  "paymentReference": "...",
  "createdAt": "...",
  "vendor": {
    "id": "...",
    "businessName": "...",
    "tier": "...",
    "status": "...",
    "bankAccountNumber": "...",
    "bankName": "...",
    "bankAccountName": "..."
  },
  "auction": {
    "id": "...",
    "caseId": "...",
    "currentBid": "...",
    "case": {
      "claimReference": "...",
      "assetType": "...",
      "assetDetails": {...},
      "marketValue": "...",
      "estimatedSalvageValue": "...",
      "locationName": "...",
      "photos": [...]
    }
  }
}
```

**Steps**:
1. Log in as vendor
2. Navigate to `/vendor/payments/251e4807-7406-44d2-8082-5897951fa7e1`
3. Verify page loads without 404 error
4. Verify all payment details are displayed
5. Verify vendor details are included in the response

**Success Criteria**:
- ✅ Status code: 200
- ✅ Payment details returned
- ✅ Vendor details included
- ✅ Auction and case details included
- ✅ No 404 error

### Test Case 1.2: Authentication Check
**Endpoint**: `GET /api/payments/[different-vendor-payment-id]`

**Steps**:
1. Log in as vendor A
2. Try to access payment belonging to vendor B
3. Verify 403 Forbidden response

**Success Criteria**:
- ✅ Status code: 403
- ✅ Error message: "Unauthorized"

---

## Issue 2: Transaction History 400 Errors

### Test Case 2.1: Wallet Transactions
**Endpoint**: `GET /api/vendor/settings/transactions?type=wallet&startDate=2026-02-21&endDate=2026-03-23&limit=20&offset=0`

**Expected Response**:
```json
{
  "transactions": [
    {
      "id": "...",
      "date": "2026-03-15T10:30:00.000Z",
      "description": "Escrow wallet deposit",
      "amount": 50000.00,
      "type": "credit",
      "status": "completed",
      "reference": "DEPOSIT_...",
      "balanceAfter": 50000.00
    },
    {
      "id": "...",
      "date": "2026-03-16T14:20:00.000Z",
      "description": "Funds frozen for auction...",
      "amount": 25000.00,
      "type": "debit",
      "status": "completed",
      "reference": "FREEZE_...",
      "balanceAfter": 25000.00
    }
  ],
  "totalCount": 2
}
```

**Steps**:
1. Log in as vendor
2. Navigate to vendor settings > transaction history
3. Select "Wallet" tab
4. Set date range
5. Verify transactions load without 400 error

**Success Criteria**:
- ✅ Status code: 200
- ✅ Wallet transactions returned
- ✅ Includes credit, debit, freeze, unfreeze transactions
- ✅ No 400 error

### Test Case 2.2: Bid Transactions
**Endpoint**: `GET /api/vendor/settings/transactions?type=bid&startDate=2026-02-21&endDate=2026-03-23&limit=20&offset=0`

**Expected Response**:
```json
{
  "transactions": [
    {
      "id": "...",
      "date": "2026-03-15T10:30:00.000Z",
      "description": "Bid on 2020 Toyota Camry",
      "amount": 25000.00,
      "type": "debit",
      "status": "won",
      "reference": "CLM-..."
    }
  ],
  "totalCount": 1
}
```

**Steps**:
1. Log in as vendor
2. Navigate to vendor settings > transaction history
3. Select "Bids" tab
4. Set date range
5. Verify bid history loads without 400 error

**Success Criteria**:
- ✅ Status code: 200
- ✅ Bid transactions returned
- ✅ Includes bid status (won, lost, outbid, active)
- ✅ No 400 error

### Test Case 2.3: Payment Transactions
**Endpoint**: `GET /api/vendor/settings/transactions?type=payment&startDate=2026-02-21&endDate=2026-03-23&limit=20&offset=0`

**Expected Response**:
```json
{
  "transactions": [
    {
      "id": "251e4807-7406-44d2-8082-5897951fa7e1",
      "date": "2026-03-16T15:00:00.000Z",
      "description": "Payment for 2020 Toyota Camry",
      "amount": 25000.00,
      "type": "debit",
      "status": "completed",
      "reference": "PAY-..."
    }
  ],
  "totalCount": 1
}
```

**Steps**:
1. Log in as vendor
2. Navigate to vendor settings > transaction history
3. Select "Payments" tab
4. Set date range
5. Verify payment history loads without 400 error

**Success Criteria**:
- ✅ Status code: 200
- ✅ Payment transactions returned
- ✅ Includes payment status (pending, completed, overdue)
- ✅ No 400 error

### Test Case 2.4: Invalid Type Parameter
**Endpoint**: `GET /api/vendor/settings/transactions?type=invalid&startDate=2026-02-21&endDate=2026-03-23`

**Expected Response**:
```json
{
  "error": "Invalid transaction type. Must be \"wallet\", \"bid\", or \"payment\""
}
```

**Steps**:
1. Send request with invalid type parameter
2. Verify 400 error with clear message

**Success Criteria**:
- ✅ Status code: 400
- ✅ Clear error message

### Test Case 2.5: Missing Required Parameters
**Endpoint**: `GET /api/vendor/settings/transactions?type=wallet`

**Expected Response**:
```json
{
  "error": "Missing required parameters: type, startDate, endDate"
}
```

**Steps**:
1. Send request without startDate and endDate
2. Verify 400 error with clear message

**Success Criteria**:
- ✅ Status code: 400
- ✅ Clear error message

---

## Integration Tests

### Test Case 3.1: Email Link to Payment Receipt
**Steps**:
1. Check email for payment confirmation
2. Click "View Payment Receipt" button
3. Verify redirects to `/vendor/payments/251e4807-7406-44d2-8082-5897951fa7e1`
4. Verify page loads successfully
5. Verify all payment details are displayed

**Success Criteria**:
- ✅ Email link works
- ✅ Page loads without error
- ✅ All payment details visible

### Test Case 3.2: Transaction History Pagination
**Steps**:
1. Navigate to vendor settings > transaction history
2. Select "Wallet" tab
3. Verify first 20 transactions load
4. Click "Load More" or scroll to trigger pagination
5. Verify next 20 transactions load

**Success Criteria**:
- ✅ Pagination works correctly
- ✅ No duplicate transactions
- ✅ Correct offset applied

---

## Regression Tests

### Test Case 4.1: Other Payment Endpoints Still Work
**Endpoints to verify**:
- `POST /api/payments/[id]/initiate`
- `POST /api/payments/[id]/confirm-wallet`
- `POST /api/payments/[id]/upload-proof`
- `GET /api/payments/[id]/audit-logs`

**Success Criteria**:
- ✅ All endpoints still function correctly
- ✅ No breaking changes

### Test Case 4.2: Transaction Export Still Works
**Endpoint**: `GET /api/vendor/settings/transactions/export?type=wallet&startDate=...&endDate=...`

**Success Criteria**:
- ✅ CSV export still works
- ✅ Includes all transaction types

---

## Performance Tests

### Test Case 5.1: Large Transaction History
**Steps**:
1. Query transaction history with 1000+ records
2. Verify response time < 2 seconds
3. Verify pagination works efficiently

**Success Criteria**:
- ✅ Response time acceptable
- ✅ No timeout errors
- ✅ Pagination efficient

---

## Summary

### Fixed Issues:
1. ✅ Payment receipt endpoint now returns vendor details
2. ✅ Transaction history endpoint now accepts 'wallet', 'bid', 'payment' types
3. ✅ Wallet transactions now properly queried and returned
4. ✅ Clear error messages for invalid parameters

### Changes Made:
1. **`/api/payments/[id]/route.ts`**:
   - Added vendor join to query
   - Included vendor details in response
   - Simplified authentication check

2. **`/api/vendor/settings/transactions/route.ts`**:
   - Added support for 'wallet' transaction type
   - Changed 'bids' to 'bid' and 'payments' to 'payment'
   - Added wallet transaction query logic
   - Updated error messages

### Next Steps:
- Run all test cases
- Verify in production-like environment
- Monitor for any edge cases
