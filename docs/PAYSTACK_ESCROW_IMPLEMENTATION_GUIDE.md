# Paystack Escrow Implementation Guide

## Overview

This document explains how real money actually moves between accounts in Paystack with escrow, answering the user's question: **"How does real money actually move between accounts in Paystack with escrow?"**

## Current System Architecture

### Escrow Flow in the Application

```
1. Vendor Funds Wallet → Paystack Payment → Wallet Credited
2. Vendor Wins Auction → Funds Frozen in Wallet
3. Vendor Signs Documents → Payment Processed
4. Admin Confirms Pickup → Funds Released to NEM Insurance
```

### Current Implementation Status

**✅ Implemented:**
- Wallet funding via Paystack (vendor pays money in)
- Funds freezing when vendor wins auction
- Funds unfreezing if auction cancelled
- Atomic release operation (prevents infinite money glitch)

**⚠️ Partially Implemented:**
- Fund release to NEM Insurance (code exists but skipped in development)

**❌ Missing:**
- Transfer recipient configuration for NEM Insurance
- Production environment variables
- Webhook handling for transfer status

---

## How Paystack Transfers Work

### The Two-Step Process

Paystack transfers require TWO steps:

#### Step 1: Create Transfer Recipient

Before you can send money to someone, you must create a **Transfer Recipient** with their bank details.

**API Endpoint:** `POST https://api.paystack.co/transferrecipient`

**Request:**
```json
{
  "type": "nuban",
  "name": "NEM Insurance Plc",
  "account_number": "0123456789",
  "bank_code": "058",
  "currency": "NGN"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Transfer recipient created successfully",
  "data": {
    "recipient_code": "RCP_m7ljkv8leesep7p",
    "name": "NEM Insurance Plc",
    "type": "nuban",
    "currency": "NGN",
    "details": {
      "account_number": "0123456789",
      "account_name": "NEM Insurance Plc",
      "bank_code": "058",
      "bank_name": "Guaranty Trust Bank"
    }
  }
}
```

**Important:** The `recipient_code` (e.g., `RCP_m7ljkv8leesep7p`) is what you save as `PAYSTACK_NEM_RECIPIENT_CODE` in your environment variables.

#### Step 2: Initiate Transfer

Once you have the recipient code, you can send money to them.

**API Endpoint:** `POST https://api.paystack.co/transfer`

**Request:**
```json
{
  "source": "balance",
  "amount": 37000000,
  "recipient": "RCP_m7ljkv8leesep7p",
  "reference": "TRANSFER_8170710b_1774198978061",
  "reason": "Auction payment for auction 8170710b"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Transfer has been queued",
  "data": {
    "transfer_code": "TRF_v5tip3zx8nna9o78",
    "reference": "TRANSFER_8170710b_1774198978061",
    "amount": 37000000,
    "currency": "NGN",
    "status": "success",
    "recipient": 56824902,
    "createdAt": "2025-08-04T10:32:40.000Z"
  }
}
```

---

## Current Code Implementation

### Where the Transfer Happens

**File:** `src/features/payments/services/escrow.service.ts`

**Function:** `releaseFunds()`

```typescript
// Convert amount to kobo (Paystack uses kobo)
const amountInKobo = Math.round(amount * 100);

// Get NEM Insurance transfer recipient code from environment
const nemRecipientCode = process.env.PAYSTACK_NEM_RECIPIENT_CODE;

if (!nemRecipientCode) {
  console.warn('PAYSTACK_NEM_RECIPIENT_CODE not configured. Skipping actual transfer in development mode.');
} else {
  // Initiate transfer to NEM Insurance via Paystack Transfers API
  const transferResponse = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: amountInKobo,
      recipient: nemRecipientCode,
      reason: `Auction payment for auction ${auctionId.substring(0, 8)}`,
      reference: transferReference,
    }),
  });

  if (!transferResponse.ok) {
    const error = await transferResponse.json();
    throw new Error(`Paystack transfer failed: ${error.message || 'Unknown error'}`);
  }

  const transferData = await transferResponse.json();
  console.log('Paystack transfer initiated:', transferData);
}
```

### Why It's Skipped in Development

The log message you saw:

```
🔓 Releasing ₦370,000 from vendor wallet...
PAYSTACK_NEM_RECIPIENT_CODE not configured. Skipping actual transfer in development mode.
```

This happens because `PAYSTACK_NEM_RECIPIENT_CODE` is not set in your `.env` file. The code is designed to skip the actual Paystack transfer in development to avoid moving real money during testing.

---

## How Escrow Works with Paystack

### Escrow Pattern

Paystack doesn't have a built-in "escrow" feature. Instead, you implement escrow by:

1. **Holding funds in your Paystack balance** (not transferring immediately)
2. **Tracking fund status in your database** (frozen vs available)
3. **Transferring funds when conditions are met** (e.g., pickup confirmed)

### Your Implementation

```
┌─────────────────────────────────────────────────────────────┐
│ VENDOR WALLET (Your Database)                               │
├─────────────────────────────────────────────────────────────┤
│ Balance: ₦500,000                                           │
│ Available: ₦130,000 (can be used for new bids)             │
│ Frozen: ₦370,000 (locked for auction GIA-8823)             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Pickup Confirmed
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ PAYSTACK TRANSFER API                                       │
├─────────────────────────────────────────────────────────────┤
│ Transfer ₦370,000 from your Paystack balance               │
│ To: NEM Insurance (RCP_m7ljkv8leesep7p)                     │
│ Reference: TRANSFER_8170710b_1774198978061                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Transfer Successful
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ VENDOR WALLET (Updated)                                     │
├─────────────────────────────────────────────────────────────┤
│ Balance: ₦130,000 (₦370,000 deducted)                      │
│ Available: ₦130,000                                         │
│ Frozen: ₦0 (₦370,000 released)                             │
└─────────────────────────────────────────────────────────────┘
```

### Atomic Operation

The `releaseFunds()` function performs an **ATOMIC** operation:

```typescript
// ATOMIC UPDATE: Update wallet with BOTH balance and frozen amount reduced
const [updatedWallet] = await db
  .update(escrowWallets)
  .set({
    balance: newBalance.toFixed(2),      // ₦500,000 → ₦130,000
    frozenAmount: newFrozen.toFixed(2),  // ₦370,000 → ₦0
    updatedAt: new Date(),
  })
  .where(eq(escrowWallets.id, wallet.id))
  .returning();
```

This prevents the "infinite money glitch" where money could exist in two places (frozen in wallet AND transferred to NEM).

---

## Production Setup Requirements

### Step 1: Create NEM Insurance Transfer Recipient

**One-time setup** - Run this script in production:

```typescript
// scripts/create-nem-transfer-recipient.ts
import fetch from 'node-fetch';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

async function createNEMRecipient() {
  const response = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'nuban',
      name: 'NEM Insurance Plc',
      account_number: '0123456789', // Replace with actual NEM account number
      bank_code: '058',             // Replace with actual bank code
      currency: 'NGN',
      description: 'NEM Insurance - Salvage Auction Payments',
    }),
  });

  const data = await response.json();
  
  if (data.status) {
    console.log('✅ Transfer recipient created successfully!');
    console.log(`Recipient Code: ${data.data.recipient_code}`);
    console.log('');
    console.log('Add this to your .env file:');
    console.log(`PAYSTACK_NEM_RECIPIENT_CODE=${data.data.recipient_code}`);
  } else {
    console.error('❌ Failed to create recipient:', data.message);
  }
}

createNEMRecipient();
```

### Step 2: Get NEM Insurance Bank Details

You need:
- **Account Number:** NEM Insurance's bank account number
- **Bank Code:** The Paystack bank code (e.g., `058` for GTBank)
- **Account Name:** Must match bank records exactly

**Get bank codes:**
```bash
curl https://api.paystack.co/bank \
  -H "Authorization: Bearer YOUR_SECRET_KEY"
```

Common Nigerian bank codes:
- Access Bank: `044`
- GTBank: `058`
- Zenith Bank: `057`
- First Bank: `011`
- UBA: `033`

### Step 3: Environment Variables

Add to your `.env` file:

```bash
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx

# NEM Insurance Transfer Recipient
PAYSTACK_NEM_RECIPIENT_CODE=RCP_m7ljkv8leesep7p

# Webhook Configuration
PAYSTACK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Webhook Configuration

Set up webhooks in your Paystack dashboard to receive transfer status updates:

**Webhook URL:** `https://your-domain.com/api/webhooks/paystack`

**Events to subscribe to:**
- `transfer.success` - Transfer completed successfully
- `transfer.failed` - Transfer failed
- `transfer.reversed` - Transfer was reversed

**Webhook handler example:**

```typescript
// src/app/api/webhooks/paystack/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db/drizzle';
import { walletTransactions } from '@/lib/db/schema/escrow';
import { eq } from 'drizzle-orm';

const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature');

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    // Handle transfer events
    if (event.event === 'transfer.success') {
      const { reference, amount, recipient } = event.data;
      
      console.log(`✅ Transfer successful: ${reference}`);
      console.log(`   Amount: ₦${amount / 100}`);
      console.log(`   Recipient: ${recipient.name}`);

      // Update transaction status in database
      await db
        .update(walletTransactions)
        .set({ 
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(walletTransactions.reference, reference));

    } else if (event.event === 'transfer.failed') {
      const { reference, amount, recipient } = event.data;
      
      console.error(`❌ Transfer failed: ${reference}`);
      console.error(`   Amount: ₦${amount / 100}`);
      console.error(`   Recipient: ${recipient.name}`);

      // Update transaction status and alert admins
      await db
        .update(walletTransactions)
        .set({ 
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(walletTransactions.reference, reference));

      // TODO: Send alert to finance team
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
```

---

## Security Considerations

### 1. OTP Requirement

Paystack may require OTP (One-Time Password) for transfers. You can:

**Option A:** Disable OTP in Paystack dashboard (for automated transfers)
- Go to Settings → Transfers → Disable OTP

**Option B:** Implement OTP finalization
```typescript
// If transfer status is 'otp', finalize with OTP
if (transferData.data.status === 'otp') {
  const otp = await getOTPFromUser(); // Implement this
  
  await fetch('https://api.paystack.co/transfer/finalize_transfer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transfer_code: transferData.data.transfer_code,
      otp: otp,
    }),
  });
}
```

### 2. Transfer Limits

Paystack has transfer limits:
- **Single transfer:** Up to ₦5,000,000
- **Daily limit:** Varies by account verification level

For large transfers, you may need to:
- Split into multiple transfers
- Request limit increase from Paystack

### 3. Idempotency

The current implementation already handles idempotency:

```typescript
// CRITICAL CHECK: Verify this payment hasn't already been released
const [existingDebitTransaction] = await db
  .select()
  .from(walletTransactions)
  .where(
    and(
      eq(walletTransactions.walletId, wallet.id),
      eq(walletTransactions.type, 'debit'),
      eq(walletTransactions.reference, `TRANSFER_${auctionId.substring(0, 8)}`)
    )
  )
  .limit(1);

if (existingDebitTransaction) {
  console.warn(`⚠️  Funds already released for auction ${auctionId}. Skipping duplicate release.`);
  return { /* current wallet state */ };
}
```

This prevents duplicate transfers if the function is called multiple times.

---

## Testing in Development

### Mock Transfer Mode

The current implementation already supports mock mode:

```typescript
if (!nemRecipientCode) {
  console.warn('PAYSTACK_NEM_RECIPIENT_CODE not configured. Skipping actual transfer in development mode.');
} else {
  // Actual transfer code
}
```

### Test with Paystack Test Mode

1. Use test API keys: `sk_test_xxxxx`
2. Create test transfer recipient
3. Transfers in test mode don't move real money
4. You can simulate success/failure scenarios

---

## Configuration Checklist

### Development Environment

- [ ] `PAYSTACK_SECRET_KEY` set to test key (`sk_test_xxxxx`)
- [ ] `PAYSTACK_PUBLIC_KEY` set to test key (`pk_test_xxxxx`)
- [ ] `PAYSTACK_NEM_RECIPIENT_CODE` **NOT SET** (skips transfers)
- [ ] Test wallet funding works
- [ ] Test funds freezing works
- [ ] Test funds unfreezing works

### Production Environment

- [ ] `PAYSTACK_SECRET_KEY` set to live key (`sk_live_xxxxx`)
- [ ] `PAYSTACK_PUBLIC_KEY` set to live key (`pk_live_xxxxx`)
- [ ] `PAYSTACK_NEM_RECIPIENT_CODE` set to NEM recipient code
- [ ] `PAYSTACK_WEBHOOK_SECRET` set for webhook verification
- [ ] Webhook URL configured in Paystack dashboard
- [ ] OTP disabled for automated transfers (or OTP flow implemented)
- [ ] Transfer limits verified with Paystack
- [ ] NEM Insurance bank details verified
- [ ] Test transfer to NEM Insurance successful

---

## Common Issues and Solutions

### Issue 1: "Insufficient balance"

**Cause:** Your Paystack balance is lower than the transfer amount.

**Solution:** Ensure vendors fund their wallets BEFORE bidding. The wallet balance should always be >= frozen amount.

### Issue 2: "Invalid recipient code"

**Cause:** `PAYSTACK_NEM_RECIPIENT_CODE` is incorrect or recipient was deleted.

**Solution:** Verify recipient exists:
```bash
curl https://api.paystack.co/transferrecipient/RCP_m7ljkv8leesep7p \
  -H "Authorization: Bearer YOUR_SECRET_KEY"
```

### Issue 3: "Transfer requires OTP"

**Cause:** OTP is enabled in Paystack dashboard.

**Solution:** Disable OTP for automated transfers in Paystack Settings → Transfers.

### Issue 4: "Transfer failed" webhook received

**Cause:** Various reasons (insufficient balance, invalid account, bank issues).

**Solution:** 
1. Check webhook payload for error details
2. Retry transfer after fixing issue
3. Alert finance team for manual intervention

---

## Summary

### How Real Money Moves

1. **Vendor pays Paystack** → Money goes to YOUR Paystack balance
2. **Vendor wins auction** → Money stays in YOUR Paystack balance (tracked as "frozen" in database)
3. **Pickup confirmed** → YOUR code calls Paystack Transfers API
4. **Paystack transfers money** → Money moves from YOUR balance to NEM Insurance's bank account
5. **Webhook confirms** → Your system updates transaction status

### Key Points

- **Escrow is implemented in YOUR code**, not Paystack
- **Paystack just holds the money** in your balance until you transfer it
- **Transfers API moves money** from your balance to recipient's bank account
- **Recipient code is required** - create it once, use it for all transfers
- **Webhooks confirm status** - implement them for production reliability

### Next Steps

1. Get NEM Insurance bank details (account number, bank code)
2. Run `create-nem-transfer-recipient.ts` script in production
3. Add `PAYSTACK_NEM_RECIPIENT_CODE` to production `.env`
4. Set up webhook endpoint and configure in Paystack dashboard
5. Test with small transfer amount first
6. Monitor transfers in Paystack dashboard

---

## Additional Resources

- [Paystack Transfers Documentation](https://paystack.com/docs/transfers/single-transfers/)
- [Paystack Transfer Recipients API](https://docs-v2.paystack.com/docs/api/transfer-recipient/)
- [Paystack Webhooks Guide](https://paystack.com/docs/payments/webhooks/)
- [Paystack Bank Codes](https://paystack.com/docs/api/miscellaneous/#bank)

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** Kiro AI Assistant
