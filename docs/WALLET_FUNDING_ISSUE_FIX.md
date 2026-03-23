# Wallet Funding Issue - Balance Not Updating ✅ FIXED

## Problem

You funded your wallet with ₦60,000, but the balance cards still show ₦0.00 even though the transaction appears in the history with status "Pending confirmation".

## Root Cause

The transaction is stuck in "Pending confirmation" status because:

1. **Paystack webhook hasn't been received** - In development (localhost), Paystack cannot send webhooks to your local machine
2. **Balance only updates after webhook confirmation** - The wallet balance is only credited when Paystack confirms the payment via webhook
3. **The transaction was created but not completed** - The initial transaction record was created, but the actual crediting step requires webhook confirmation

## How Wallet Funding Works

```
1. User clicks "Add Funds" → Creates pending transaction
2. User pays via Paystack → Payment successful
3. Paystack sends webhook → Confirms payment
4. Webhook handler credits wallet → Balance updated ✅
```

**In development, step 3 fails** because Paystack can't reach localhost.

## ✅ Scripts Fixed

Both scripts have been updated to use the correct database schema exports:
- `walletTransactions` (not `escrowTransactions`)
- `vendors` imported from `@/lib/db/schema/vendors` (not from users schema)

## Solutions

### Option 1: Simulate Paystack Webhook (Recommended for Testing)

This processes the actual pending transaction:

```bash
npx tsx scripts/simulate-paystack-webhook.ts
```

**Steps:**
1. Script will show all pending transactions
2. Enter the transaction reference (e.g., `WALLET_8f63926d_1770124382238`)
3. Or type "all" to process all pending transactions
4. Refresh the wallet page

### Option 2: Manually Credit Wallet (Quick Fix for Testing)

Run this script to manually credit the wallet:

```bash
npx tsx scripts/manually-credit-wallet.ts
```

**Steps:**
1. Enter the vendor's email
2. Enter the amount to credit (e.g., 60000)
3. Confirm the action
4. Refresh the wallet page

### Option 3: Use ngrok for Real Webhooks (Production-like Testing)

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start your dev server:**
   ```bash
   npm run dev
   ```

3. **Expose localhost with ngrok:**
   ```bash
   ngrok http 3000
   ```

4. **Update Paystack webhook URL:**
   - Go to Paystack Dashboard → Settings → Webhooks
   - Set webhook URL to: `https://your-ngrok-url.ngrok.io/api/webhooks/paystack`
   - Save

5. **Test the payment flow:**
   - Add funds to wallet
   - Pay via Paystack
   - Webhook will be received automatically
   - Balance updates immediately

### Option 4: Use Paystack Test Mode

1. **Ensure you're using test keys** in `.env`:
   ```
   PAYSTACK_SECRET_KEY=sk_test_...
   PAYSTACK_PUBLIC_KEY=pk_test_...
   ```

2. **Use test card details:**
   - Card: 4084 0840 8408 4081
   - CVV: 408
   - Expiry: Any future date
   - PIN: 0000
   - OTP: 123456

3. **Webhook will still need ngrok** or manual simulation

## Checking Transaction Status

### View Pending Transactions

```bash
npx tsx scripts/simulate-paystack-webhook.ts
```

This will list all pending transactions with their references.

### Check Wallet Balance

```sql
SELECT * FROM escrow_wallets WHERE vendor_id = 'your-vendor-id';
```

### Check Transaction History

```sql
SELECT * FROM wallet_transactions 
WHERE wallet_id = 'your-wallet-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Expected Behavior After Fix

Once you run one of the scripts above:

1. **Total Balance** - Will show ₦60,000.00
2. **Available Balance** - Will show ₦60,000.00
3. **Frozen Amount** - Will show ₦0.00
4. **Transaction History** - Will show:
   - Original pending transaction (updated to "Confirmed via webhook simulation")
   - New credit transaction with updated balance

## Production Setup

In production, this issue won't occur because:

1. **Public URL** - Your server has a public URL that Paystack can reach
2. **Webhook Configuration** - Paystack webhook URL is set to `https://yourdomain.com/api/webhooks/paystack`
3. **Automatic Processing** - Webhooks are received and processed automatically
4. **Instant Balance Updates** - Balance updates within 2-5 seconds of payment

## Webhook Configuration for Production

1. **Set webhook URL in Paystack:**
   ```
   https://yourdomain.com/api/webhooks/paystack
   ```

2. **Ensure webhook secret is set:**
   ```env
   PAYSTACK_SECRET_KEY=sk_live_...
   PAYSTACK_WEBHOOK_SECRET=your_webhook_secret
   ```

3. **Test webhook:**
   - Make a test payment
   - Check Paystack Dashboard → Webhooks → Logs
   - Verify webhook was delivered successfully

## Troubleshooting

### Balance Still Shows ₦0 After Running Script

1. **Hard refresh the page:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Check browser console** for errors
3. **Verify transaction was processed:**
   ```bash
   npx tsx scripts/simulate-paystack-webhook.ts
   ```

### "Transaction Not Found" Error

The transaction reference might be incorrect. Check the exact reference in the transaction history table.

### "Wallet Not Found" Error

The vendor might not have a wallet yet. The wallet is created automatically on first funding attempt.

## Summary

**For Development Testing:**
- Use `scripts/simulate-paystack-webhook.ts` to process pending transactions (RECOMMENDED)
- Or use `scripts/manually-credit-wallet.ts` for quick manual credits

**For Production:**
- Configure Paystack webhook URL properly
- Webhooks will work automatically
- No manual intervention needed

**Current Issue:**
Your ₦60,000 transaction is pending because the webhook wasn't received. Run the simulation script to complete it.

## Quick Fix Command

```bash
# Process your pending ₦60,000 transaction
npx tsx scripts/simulate-paystack-webhook.ts
```

Then refresh your wallet page - the balance should update to ₦60,000!

## What Was Fixed

✅ Fixed import statements in both scripts:
- Changed `escrowTransactions` to `walletTransactions`
- Fixed `vendors` import to use correct schema file
- Removed metadata field that doesn't exist in schema
- Updated transaction processing logic to work with actual schema

Both scripts are now ready to use without TypeScript errors!
