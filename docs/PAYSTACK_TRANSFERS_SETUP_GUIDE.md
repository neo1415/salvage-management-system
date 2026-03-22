# Paystack Transfers API Setup Guide

## Overview

This guide explains how to configure Paystack Transfers API to enable automatic fund transfers from the escrow wallet to NEM Insurance when vendors complete salvage pickups.

## What is Paystack Transfers API?

Paystack Transfers API allows you to programmatically send money from your Paystack balance to bank accounts. In our system, when a vendor confirms pickup of salvage items, the frozen funds in their escrow wallet are automatically transferred to NEM Insurance's bank account.

## Prerequisites

1. **Active Paystack Account**: You must have a Paystack business account
2. **Verified Business**: Your business must be verified by Paystack
3. **Sufficient Balance**: Ensure your Paystack balance has sufficient funds for transfers
4. **API Keys**: You need your Paystack Secret Key (already configured)

## Setup Steps

### Step 1: Create Transfer Recipient for NEM Insurance

A transfer recipient is a saved bank account that you can send money to. You need to create one for NEM Insurance.

#### Option A: Via Paystack Dashboard (Recommended)

1. Log in to your [Paystack Dashboard](https://dashboard.paystack.com)
2. Navigate to **Transfers** → **Recipients**
3. Click **Create Recipient**
4. Fill in NEM Insurance bank details:
   - **Name**: NEM Insurance Plc
   - **Bank**: Select the bank (e.g., Access Bank, GTBank, etc.)
   - **Account Number**: Enter NEM Insurance's account number
   - **Currency**: NGN (Nigerian Naira)
5. Click **Create**
6. Copy the **Recipient Code** (format: `RCP_xxxxxxxxxx`)

#### Option B: Via API

You can also create a recipient programmatically:

```bash
curl https://api.paystack.co/transferrecipient \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "nuban",
    "name": "NEM Insurance Plc",
    "account_number": "0123456789",
    "bank_code": "044",
    "currency": "NGN"
  }'
```

**Bank Codes**: You can get bank codes from Paystack's [List Banks API](https://paystack.com/docs/api/#miscellaneous-bank):

```bash
curl https://api.paystack.co/bank \
  -H "Authorization: Bearer YOUR_SECRET_KEY"
```

Common Nigerian bank codes:
- Access Bank: `044`
- GTBank: `058`
- First Bank: `011`
- Zenith Bank: `057`
- UBA: `033`

### Step 2: Configure Environment Variable

Add the recipient code to your `.env` file:

```bash
PAYSTACK_NEM_RECIPIENT_CODE=RCP_xxxxxxxxxx
```

Replace `RCP_xxxxxxxxxx` with the actual recipient code from Step 1.

### Step 3: Verify Configuration

Run this test script to verify the setup:

```typescript
// scripts/test-paystack-transfer.ts
import { config } from 'dotenv';
config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_NEM_RECIPIENT_CODE = process.env.PAYSTACK_NEM_RECIPIENT_CODE!;

async function testTransfer() {
  try {
    // Test with ₦100 (10,000 kobo)
    const response = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: 10000, // ₦100 in kobo
        recipient: PAYSTACK_NEM_RECIPIENT_CODE,
        reason: 'Test transfer - Escrow wallet setup verification',
        reference: `TEST_${Date.now()}`,
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Transfer initiated successfully!');
      console.log('Transfer details:', data.data);
    } else {
      console.error('❌ Transfer failed:', data.message);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testTransfer();
```

Run the test:

```bash
npx tsx scripts/test-paystack-transfer.ts
```

## How It Works in Production

### 1. Vendor Wins Auction
When a vendor wins an auction, the bid amount is frozen in their escrow wallet:

```typescript
await escrowService.freezeFunds(vendorId, bidAmount, auctionId, userId);
```

This moves funds from `availableBalance` to `frozenAmount`.

### 2. Vendor Completes Payment
The vendor pays for the salvage item (if not using escrow wallet).

### 3. Vendor Confirms Pickup
When the vendor confirms pickup, the system:

1. Calls `releaseFunds()` in the escrow service
2. Initiates a Paystack transfer to NEM Insurance
3. Debits the frozen amount from the wallet
4. Creates a transaction record with the transfer reference
5. Logs the activity in the audit trail

```typescript
await escrowService.releaseFunds(vendorId, amount, auctionId, userId);
```

### 4. Transfer Processing
Paystack processes the transfer:
- **Instant Transfers**: Most transfers complete within seconds
- **Delayed Transfers**: Some banks may take up to 24 hours
- **Failed Transfers**: Paystack will retry automatically

### 5. Transfer Webhooks (Optional Enhancement)
You can set up webhooks to receive transfer status updates:

1. Go to **Settings** → **Webhooks** in Paystack Dashboard
2. Add webhook URL: `https://yourdomain.com/api/webhooks/paystack-transfer`
3. Subscribe to `transfer.success` and `transfer.failed` events

## Test Mode vs Live Mode

### Test Mode
- Use test API keys (starts with `sk_test_`)
- Transfers are simulated (no real money moves)
- Test recipient codes work without actual bank accounts
- Perfect for development and testing

### Live Mode
- Use live API keys (starts with `sk_live_`)
- Real money transfers occur
- Requires verified business and bank accounts
- Charges apply (₦10 + 0.5% per transfer, capped at ₦50)

## Development Mode Fallback

If `PAYSTACK_NEM_RECIPIENT_CODE` is not configured, the system will:
1. Log a warning to the console
2. Skip the actual transfer (development mode)
3. Still update the database records
4. Still create audit logs

This allows development without configuring real bank accounts.

## Security Best Practices

1. **Never commit API keys**: Keep `.env` in `.gitignore`
2. **Use environment variables**: Never hardcode recipient codes
3. **Verify webhook signatures**: Always validate Paystack webhooks
4. **Monitor transfers**: Set up alerts for failed transfers
5. **Audit logs**: Review transfer logs regularly

## Troubleshooting

### Error: "Insufficient balance"
**Solution**: Fund your Paystack balance via the dashboard

### Error: "Invalid recipient code"
**Solution**: Verify the recipient code is correct and active

### Error: "Transfer failed"
**Solution**: Check if the recipient bank account is active and correct

### Error: "Recipient not found"
**Solution**: Ensure you're using the correct API key (test vs live)

### Transfers are slow
**Solution**: Some banks process transfers slower than others. Paystack will retry automatically.

## Cost Breakdown

Paystack charges for transfers:
- **Fee**: ₦10 + 0.5% per transfer
- **Cap**: Maximum ₦50 per transfer
- **Example**: ₦100,000 transfer = ₦10 + ₦500 = ₦50 (capped)

## API Reference

### Initiate Transfer

```http
POST https://api.paystack.co/transfer
Authorization: Bearer YOUR_SECRET_KEY
Content-Type: application/json

{
  "source": "balance",
  "amount": 10000,
  "recipient": "RCP_xxxxxxxxxx",
  "reason": "Auction payment for auction ABC123",
  "reference": "TRANSFER_ABC123_1234567890"
}
```

### Response

```json
{
  "status": true,
  "message": "Transfer has been queued",
  "data": {
    "reference": "TRANSFER_ABC123_1234567890",
    "integration": 123456,
    "domain": "live",
    "amount": 10000,
    "currency": "NGN",
    "source": "balance",
    "reason": "Auction payment for auction ABC123",
    "recipient": 123456,
    "status": "pending",
    "transfer_code": "TRF_xxxxxxxxxx",
    "id": 123456,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Additional Resources

- [Paystack Transfers Documentation](https://paystack.com/docs/transfers/single-transfers/)
- [Paystack Transfer Recipients API](https://paystack.com/docs/api/#transfer-recipient)
- [Paystack Bank Codes](https://paystack.com/docs/api/#miscellaneous-bank)
- [Paystack Webhooks](https://paystack.com/docs/payments/webhooks/)

## Support

For issues with Paystack Transfers:
1. Check [Paystack Status Page](https://status.paystack.com)
2. Contact Paystack Support: support@paystack.com
3. Review [Paystack Community](https://paystack.com/community)

For issues with the escrow service implementation:
1. Check the audit logs in the database
2. Review the console logs for transfer errors
3. Verify environment variables are correctly set
