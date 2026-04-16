# Payment Method Selection - Quick Test Guide

## Quick Test Steps

### Setup
1. Have 2 vendor accounts ready
2. Have sufficient wallet balance in one account
3. Have insufficient balance in another account

### Test 1: Wallet-Only Payment (5 minutes)

1. **Win Auction**
   - Place winning bid (e.g., ₦230,000)
   - Wait for auction to close
   - Verify deposit frozen (₦100,000 if using default config)

2. **Sign Documents**
   - Navigate to auction detail page
   - Sign Bill of Sale
   - Sign Liability Waiver
   - Verify both marked as 'signed'

3. **Choose Payment Method**
   - Verify payment modal appears automatically
   - Verify shows:
     - Final Bid: ₦230,000
     - Deposit Paid: -₦100,000
     - Remaining: ₦130,000
     - Your Wallet Balance: (your balance)
   - Verify "Wallet Only" option is ENABLED
   - Select "Wallet Only"
   - Click "Pay with Wallet"

4. **Verify Success**
   - Payment processes successfully
   - Deposit unfrozen (₦100,000 released)
   - Remaining amount deducted (₦130,000)
   - Pickup code received via SMS/Email
   - Page shows pickup authorization

**Expected Result:** ✅ Payment completes, pickup code received

---

### Test 2: Paystack-Only Payment (5 minutes)

1. **Win Auction** (with account that has insufficient balance)
   - Place winning bid (e.g., ₦230,000)
   - Ensure wallet balance < ₦130,000 remaining
   - Wait for auction to close

2. **Sign Documents**
   - Sign both documents

3. **Choose Payment Method**
   - Verify payment modal appears
   - Verify "Wallet Only" option is DISABLED (insufficient balance)
   - Select "Paystack Only"
   - Click "Pay with Paystack"

4. **Complete Paystack Payment**
   - Verify redirected to Paystack modal
   - Verify amount is ₦130,000 (fixed, non-modifiable)
   - Complete payment using test card
   - Wait for webhook processing

5. **Verify Success**
   - Deposit unfrozen
   - Pickup code received
   - Page shows pickup authorization

**Expected Result:** ✅ Payment via Paystack completes, pickup code received

---

### Test 3: Hybrid Payment (5 minutes)

1. **Win Auction** (with account that has partial balance)
   - Place winning bid (e.g., ₦230,000)
   - Ensure wallet balance is between ₦1 and ₦129,999
   - Example: ₦80,000 in wallet
   - Wait for auction to close

2. **Sign Documents**
   - Sign both documents

3. **Choose Payment Method**
   - Verify payment modal appears
   - Select "Hybrid"
   - Verify breakdown shows:
     - From Wallet: ₦80,000
     - Via Paystack: ₦50,000
   - Click "Proceed to Hybrid Payment"

4. **Complete Hybrid Payment**
   - Verify wallet portion deducted immediately (₦80,000)
   - Verify redirected to Paystack for remainder (₦50,000)
   - Complete Paystack payment
   - Wait for webhook processing

5. **Verify Success**
   - Deposit unfrozen (₦100,000)
   - Wallet portion deducted (₦80,000)
   - Paystack portion paid (₦50,000)
   - Total: ₦230,000 transferred
   - Pickup code received

**Expected Result:** ✅ Hybrid payment completes, pickup code received

---

## Quick Verification Checklist

After each test, verify:

- [ ] Auction status updated correctly
- [ ] Deposit unfrozen (check wallet frozen amount)
- [ ] Payment record created with correct method
- [ ] Finance Officer received funds
- [ ] Vendor received pickup code via:
  - [ ] SMS
  - [ ] Email
  - [ ] Push notification
- [ ] Pickup authorization displayed on page

## Common Issues

### Issue: Payment modal doesn't appear
**Check:**
- Auction status is 'awaiting_payment' (not 'closed')
- All documents are signed
- You are the winning vendor

**Fix:** Check browser console for errors

### Issue: "Wallet Only" always disabled
**Check:**
- Wallet available balance
- Remaining amount calculation
- API response from `/api/auctions/[id]/payment/calculate`

**Fix:** Verify wallet balance is sufficient

### Issue: Paystack modal doesn't open
**Check:**
- Paystack API keys configured
- API response includes `authorizationUrl`
- Browser popup blocker

**Fix:** Check `.env` for Paystack keys

### Issue: Payment processes but no pickup code
**Check:**
- Webhook endpoint configured
- Webhook processing logs
- Notification service logs

**Fix:** Check webhook URL in Paystack dashboard

## Test Data

### Vendor Account 1 (Sufficient Balance)
- Wallet Balance: ₦500,000
- Can test: Wallet-Only payment

### Vendor Account 2 (Insufficient Balance)
- Wallet Balance: ₦50,000
- Can test: Paystack-Only payment

### Vendor Account 3 (Partial Balance)
- Wallet Balance: ₦80,000
- Can test: Hybrid payment

## Quick Commands

### Check auction status
```bash
# In browser console
fetch('/api/auctions/[auction-id]').then(r => r.json()).then(console.log)
```

### Check wallet balance
```bash
# In browser console
fetch('/api/vendor/wallet').then(r => r.json()).then(console.log)
```

### Check payment breakdown
```bash
# In browser console
fetch('/api/auctions/[auction-id]/payment/calculate').then(r => r.json()).then(console.log)
```

## Success Criteria

All 3 payment methods work correctly:
- ✅ Wallet-Only: Deducts from wallet, unfreezes deposit
- ✅ Paystack-Only: Processes via Paystack, unfreezes deposit
- ✅ Hybrid: Deducts wallet portion + Paystack remainder, unfreezes deposit

All vendors receive pickup codes after payment.

## Estimated Time

- Setup: 5 minutes
- Test 1 (Wallet): 5 minutes
- Test 2 (Paystack): 5 minutes
- Test 3 (Hybrid): 5 minutes
- **Total: 20 minutes**

## Date

April 10, 2026
