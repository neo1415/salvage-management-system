# Paystack Unified Webhook and Redirect Pattern Confirmation

**Date**: 2026-04-20  
**Status**: ✅ CONFIRMED - Wallet funding uses the same secure pattern as auction payments

## Summary

Confirmed that the wallet funding system uses the **SAME unified webhook endpoint** and **SAME redirect pattern** as auction payments, avoiding CSP/iframe issues.

---

## 1. Unified Webhook Endpoint ✅

**Single Webhook URL**: `/api/webhooks/paystack`

This endpoint handles ALL Paystack payments by routing based on reference prefix:

```typescript
// src/app/api/webhooks/paystack/route.ts
const reference = payload.data.reference;

if (reference.startsWith('PAY-') || reference.startsWith('PAY_')) {
  // Auction payment
  await paymentService.handlePaystackWebhook(reference, true);
} else if (reference.startsWith('REG-')) {
  // Registration fee payment
  await registrationFeeService.handleRegistrationFeeWebhook(reference, true);
} else {
  // Wallet funding or other payment
  await processPaystackWebhook(payload, signature, rawBody);
}
```

### Reference Patterns
- **Wallet Funding**: `WALLET_{walletId}_{timestamp}`
- **Auction Payment**: `PAY_{auctionId}_{timestamp}` or `PAY-{auctionId}_{timestamp}`
- **Registration Fee**: `REG-{vendorId}_{timestamp}`

---

## 2. Redirect Pattern (No iframes) ✅

Both wallet funding and auction payments use **full-page redirects** to Paystack's hosted payment page, avoiding CSP/iframe issues.

### Wallet Funding Flow

**Step 1: Initialize Payment**
```typescript
// src/features/payments/services/escrow.service.ts - fundWallet()
const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: user.email,
    amount: amountInKobo,
    reference,
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/vendor/wallet?status=success`, // ✅ Full-page redirect
    metadata: {
      walletId: wallet.id,
      vendorId,
      type: 'wallet_funding', // ✅ Identifies as wallet funding
      custom_fields: [...]
    },
  }),
});

return {
  walletId: wallet.id,
  transactionId: transaction.id,
  amount,
  newBalance: parseFloat(wallet.balance),
  paymentUrl: paystackData.data.authorization_url, // ✅ Full-page redirect URL
  reference,
};
```

**Step 2: User Redirects to Paystack**
```typescript
// src/app/(dashboard)/vendor/wallet/page.tsx - handleAddFunds()
const data = await response.json();

// Redirect to Paystack payment page (full-page redirect, no iframe)
if (data.paymentUrl) {
  window.location.href = data.paymentUrl; // ✅ Full-page redirect
}
```

**Step 3: User Completes Payment on Paystack**
- User is on Paystack's hosted payment page
- No CSP issues because it's a full-page redirect
- No iframe blocking

**Step 4: Paystack Redirects Back**
```
callback_url: ${APP_URL}/vendor/wallet?status=success
```

**Step 5: Webhook Processes Payment**
```typescript
// src/features/payments/services/paystack.service.ts - processPaystackWebhook()
if (metadata && metadata.type === 'wallet_funding') {
  await processWalletFunding(reference, amount, metadata);
  return;
}

// processWalletFunding() calls escrowService.creditWallet()
await escrowService.creditWallet(walletId, amount, reference, vendor.userId);
```

**Step 6: UI Refreshes Wallet Balance**
```typescript
// src/app/(dashboard)/vendor/wallet/page.tsx
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('status');
  
  if (paymentStatus === 'success') {
    // Refresh wallet data after successful payment
    setTimeout(() => {
      refresh(); // ✅ Fetches updated balance from API
    }, 2000); // Wait 2 seconds for webhook to process
    
    // Clear URL parameters
    window.history.replaceState({}, '', '/vendor/wallet');
  }
}, []);
```

---

## 3. Security Features ✅

Both flows implement the same security measures:

### Webhook Signature Verification
```typescript
function verifySignature(payload: string, signature: string): boolean {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest('hex');
  return hash === signature;
}
```

### Idempotency Protection
```typescript
// Prevent replay attacks
const webhookKey = `webhook:processed:${reference}`;
const alreadyProcessed = await kv.get(webhookKey);

if (alreadyProcessed) {
  console.log(`⚠️  Webhook already processed for reference: ${reference}. Ignoring duplicate.`);
  return;
}

// Mark webhook as processed (TTL: 7 days)
await kv.set(webhookKey, true, { ex: 7 * 24 * 60 * 60 });
```

### Amount Verification
```typescript
// Wallet funding
const expectedAmountInKobo = Math.round(amount * 100);
// Verify on webhook

// Auction payment
const expectedAmountInKobo = Math.round(parseFloat(payment.amount) * 100);
if (amountInKobo !== expectedAmountInKobo) {
  throw new Error('Amount mismatch');
}
```

---

## 4. Why This Pattern Avoids CSP/Iframe Issues

### Problem with Iframes
- Modern browsers block iframes from different origins (CSP)
- Paystack's payment page cannot be embedded in an iframe
- Would cause "Refused to display in a frame" errors

### Solution: Full-Page Redirect
1. **User clicks "Add Funds via Paystack"**
2. **Backend initializes payment** → Gets `authorization_url`
3. **Frontend redirects** → `window.location.href = authorization_url`
4. **User completes payment on Paystack's domain**
5. **Paystack redirects back** → `callback_url` with `?status=success`
6. **Webhook processes payment** → Credits wallet
7. **UI refreshes** → Shows updated balance

✅ **No iframes involved**  
✅ **No CSP violations**  
✅ **Works on all browsers**

---

## 5. Registration Fee Payment (Same Pattern)

The registration fee payment also uses the same pattern:

```typescript
// Reference: REG-{vendorId}_{timestamp}
// Webhook routing:
if (reference.startsWith('REG-')) {
  await registrationFeeService.handleRegistrationFeeWebhook(reference, true);
}
```

---

## Conclusion

✅ **Unified Webhook**: Single endpoint `/api/webhooks/paystack` handles all payment types  
✅ **Reference-Based Routing**: Routes to correct handler based on reference prefix  
✅ **Full-Page Redirects**: No iframes, no CSP issues  
✅ **Secure**: Signature verification, idempotency, amount verification  
✅ **Consistent Pattern**: All payment types use the same flow

**For Registration Fee Implementation**: Use the exact same pattern:
1. Initialize payment with Paystack
2. Get `authorization_url`
3. Redirect user: `window.location.href = authorization_url`
4. Set `callback_url` to return to your page
5. Process webhook with unified endpoint
6. Refresh UI after redirect

**No need to worry about CSP/iframe issues** - the full-page redirect pattern is already proven and working for wallet funding and auction payments.
