# Payment Methods Quick Reference

## Three Payment Methods

### 1. Wallet-Only 💰
**Use when**: Wallet balance ≥ Remaining amount

**What happens**:
- Deducts remaining amount from wallet
- Unfreezes and transfers deposit to finance
- Instant payment (no external gateway)

**API**: `POST /api/auctions/[id]/payment/wallet`

---

### 2. Paystack-Only 💳
**Use when**: Always available (fallback option)

**What happens**:
- Redirects to Paystack for full remaining amount
- User pays via card/bank transfer
- Webhook processes payment and releases deposit

**API**: `POST /api/auctions/[id]/payment/paystack`

---

### 3. Hybrid ⚡
**Use when**: 0 < Wallet balance < Remaining amount

**What happens**:
- Deducts available wallet balance immediately
- Redirects to Paystack for the difference
- User pays remaining via card/bank transfer
- Webhook processes payment and releases deposit

**API**: `POST /api/auctions/[id]/payment/hybrid`

**Rollback**: If Paystack fails, wallet portion is refunded automatically

---

## Payment Flow Comparison

| Step | Wallet-Only | Paystack-Only | Hybrid |
|------|-------------|---------------|--------|
| 1 | Deduct from wallet | Initialize Paystack | Deduct wallet portion |
| 2 | Unfreeze deposit | User pays on Paystack | Initialize Paystack |
| 3 | Transfer to finance | Webhook receives | User pays on Paystack |
| 4 | Create verified payment | Mark verified | Webhook receives |
| 5 | Unfreeze non-winners | Unfreeze deposit | Mark verified |
| 6 | Generate pickup auth | Transfer to finance | Unfreeze deposit |
| 7 | ✅ Done | Unfreeze non-winners | Transfer to finance |
| 8 | | Generate pickup auth | Unfreeze non-winners |
| 9 | | ✅ Done | Generate pickup auth |
| 10 | | | ✅ Done |

---

## When Each Method Appears

```typescript
const remainingAmount = finalBid - depositAmount;
const walletBalance = availableBalance;

// Wallet-Only
if (walletBalance >= remainingAmount) {
  // Show "Wallet Only" option (recommended)
}

// Paystack-Only
// Always show (fallback option)

// Hybrid
if (walletBalance > 0 && walletBalance < remainingAmount) {
  // Show "Hybrid Payment" option (smart)
}
```

---

## Error Handling

### Wallet-Only
- ❌ Insufficient balance → Show error, suggest Paystack
- ❌ Wallet not found → Show error
- ❌ Transaction fails → Automatic rollback

### Paystack-Only
- ❌ Initialization fails → Show error, user can retry
- ❌ User cancels → Payment stays pending, can retry
- ❌ Payment fails → User can retry

### Hybrid
- ❌ Wallet deduction fails → Show error, no charge
- ❌ Paystack init fails → Wallet refunded automatically
- ❌ User cancels → Wallet already deducted, can retry Paystack
- ❌ Payment fails → User can retry Paystack

---

## Testing

### Quick Test
```bash
npx tsx scripts/test-all-payment-methods.ts
```

### Manual Test Scenarios

**Scenario 1: Full Wallet Balance**
- Wallet: ₦500,000
- Remaining: ₦400,000
- Result: ✅ Wallet-only available (recommended)

**Scenario 2: No Wallet Balance**
- Wallet: ₦0
- Remaining: ₦400,000
- Result: ✅ Paystack-only available

**Scenario 3: Partial Wallet Balance**
- Wallet: ₦200,000
- Remaining: ₦400,000
- Result: ✅ Hybrid available (wallet ₦200k + Paystack ₦200k)

---

## Key Features

### All Methods
- ✅ Atomic transactions
- ✅ Wallet invariant maintained
- ✅ Idempotency protection
- ✅ IDOR protection
- ✅ Automatic rollback on failure
- ✅ Deposit released to finance
- ✅ Non-winners unfrozen
- ✅ Pickup authorization generated

### Hybrid-Specific
- ✅ Automatic wallet refund if Paystack fails
- ✅ Fixed Paystack amount (can't be modified)
- ✅ Wallet portion deducted immediately
- ✅ User can retry Paystack if payment fails

---

## API Endpoints

### Calculate Breakdown
```bash
GET /api/auctions/[id]/payment/calculate
```

Returns:
```json
{
  "breakdown": {
    "finalBid": 500000,
    "depositAmount": 100000,
    "remainingAmount": 400000,
    "walletBalance": 200000,
    "canPayWithWallet": false,
    "walletPortion": 200000,
    "paystackPortion": 200000
  }
}
```

### Wallet Payment
```bash
POST /api/auctions/[id]/payment/wallet
```

Returns:
```json
{
  "success": true,
  "payment": { ... },
  "message": "Payment processed successfully from wallet"
}
```

### Paystack Payment
```bash
POST /api/auctions/[id]/payment/paystack
```

Returns:
```json
{
  "success": true,
  "authorization_url": "https://checkout.paystack.com/...",
  "access_code": "...",
  "reference": "..."
}
```

### Hybrid Payment
```bash
POST /api/auctions/[id]/payment/hybrid
```

Returns:
```json
{
  "success": true,
  "walletAmount": 200000,
  "paystackAmount": 200000,
  "authorization_url": "https://checkout.paystack.com/...",
  "access_code": "...",
  "reference": "...",
  "message": "Wallet portion (₦200,000) deducted..."
}
```

---

## Troubleshooting

### "Insufficient wallet balance"
- Check wallet available balance
- Ensure deposit is frozen (not available)
- Use Paystack-only or Hybrid instead

### "Payment already exists"
- Check for pending payment
- Complete or cancel existing payment first
- Idempotency protection working correctly

### "Wallet invariant violation"
- Database inconsistency detected
- Transaction automatically rolled back
- Contact support to investigate

### "Paystack initialization failed"
- Check Paystack secret key
- Verify Paystack account active
- For hybrid: Wallet portion refunded automatically

---

## Best Practices

### For Users
1. Use wallet-only when available (instant, no fees)
2. Use hybrid to maximize wallet usage
3. Use Paystack-only as fallback

### For Developers
1. Always fetch payment breakdown first
2. Let API generate idempotency keys
3. Trust atomic transactions (no manual cleanup)
4. Handle errors gracefully with clear messages
5. Test all three methods thoroughly

---

## Summary

Three payment methods, all working perfectly:
- 💰 Wallet-only: Fast and free
- 💳 Paystack-only: Always available
- ⚡ Hybrid: Best of both worlds

All methods are atomic, secure, and handle errors gracefully.
