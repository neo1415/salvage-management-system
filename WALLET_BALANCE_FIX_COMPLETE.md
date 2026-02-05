# Wallet Balance Fix - Complete Resolution

## Problem Summary
After running the wallet reset script, the UI was still showing incorrect balances:
- **UI Display**: Total Balance: ₦100,000.00
- **Expected**: Total Balance: ₦0.00
- **Actual Database**: All fields showed ₦0 except the `balance` field

## Root Causes Identified

### 1. Incomplete Database Reset
The `reset-wallet-completely.ts` script had two issues:
- It only reset `availableBalance` and `frozenBalance` fields
- It didn't reset the main `balance` field
- This violated the wallet invariant: `balance = availableBalance + frozenAmount`

### 2. Redis Caching
The `escrowService.getBalance()` function uses Redis caching with a 5-minute TTL:
- Cache key: `wallet:${walletId}`
- Even after database changes, cached data was being returned
- The UI was displaying stale cached data

### 3. Schema Field Name Inconsistency
The reset script used `frozenBalance` instead of `frozenAmount`, which is the actual field name in the schema.

## Solutions Implemented

### Script 1: Clear Wallet Cache (`scripts/clear-wallet-cache.ts`)
```typescript
// Clears Redis cache for all wallets
// Forces next API call to fetch fresh data from database
```

**What it does:**
- Fetches all wallets from database
- Deletes Redis cache key for each wallet: `wallet:${walletId}`
- Ensures next API call gets fresh data

### Script 2: Fix Wallet Balance Field (`scripts/fix-wallet-balance-field.ts`)
```typescript
// Fixes the balance field to match availableBalance + frozenAmount
// Maintains the wallet invariant
```

**What it does:**
- Calculates correct balance: `availableBalance + frozenAmount`
- Updates the `balance` field in database
- Clears Redis cache for each wallet
- Ensures data consistency

### Script 3: Check Wallet Status (`scripts/check-wallet-status.ts`)
```typescript
// Diagnostic tool to verify wallet state
```

**What it does:**
- Displays all wallet balances
- Shows transaction count
- Lists recent transactions
- Helps verify fixes are working

## Verification Results

### Before Fix
```
Wallet 1 (neowalker502@gmail.com):
  Total Balance:     ₦100,000  ❌ WRONG
  Available Balance: ₦0
  Frozen Amount:     ₦0

Wallet 2 (adneo502@gmail.com):
  Total Balance:     ₦810,000  ❌ WRONG
  Available Balance: ₦0
  Frozen Amount:     ₦0
```

### After Fix
```
Wallet 1 (neowalker502@gmail.com):
  Total Balance:     ₦0  ✅ CORRECT
  Available Balance: ₦0
  Frozen Amount:     ₦0
  Transactions:      0

Wallet 2 (adneo502@gmail.com):
  Total Balance:     ₦0  ✅ CORRECT
  Available Balance: ₦0
  Frozen Amount:     ₦0
  Transactions:      0
```

## How to Use These Scripts

### Clear Redis Cache (after manual DB changes)
```bash
npx tsx scripts/clear-wallet-cache.ts
```

### Fix Balance Field Inconsistencies
```bash
npx tsx scripts/fix-wallet-balance-field.ts
```

### Check Current Wallet Status
```bash
npx tsx scripts/check-wallet-status.ts
```

## Next Steps for User

1. **Hard Refresh Browser**
   - Press `Ctrl + Shift + R` (Windows/Linux)
   - Or `Cmd + Shift + R` (Mac)
   - This clears browser cache and fetches fresh data

2. **Verify UI Shows Correct Balances**
   - Navigate to `/vendor/wallet`
   - All balances should show ₦0.00
   - Transaction history should be empty

3. **Test Wallet Funding**
   - Try adding funds via Paystack
   - Ensure webhook URL is updated to current ngrok URL
   - Verify balance updates correctly after payment

## Important Notes

### Wallet Invariant
The wallet system maintains this critical invariant:
```
balance = availableBalance + frozenAmount
```

**Always ensure:**
- When crediting: increase both `balance` and `availableBalance`
- When freezing: decrease `availableBalance`, increase `frozenAmount` (balance stays same)
- When releasing: decrease both `balance` and `frozenAmount`
- When unfreezing: increase `availableBalance`, decrease `frozenAmount` (balance stays same)

### Redis Cache Management
The wallet balance is cached for 5 minutes. After manual database changes:
1. Always clear the Redis cache
2. Or wait 5 minutes for cache to expire
3. Or restart the application

### Paystack Webhook Configuration
For wallet funding to work properly:
1. Update Paystack webhook URL to current ngrok URL
2. Or use ngrok static domain (paid feature)
3. Webhook endpoint: `https://your-ngrok-url.ngrok-free.app/api/webhooks/paystack`

## Files Modified/Created

### New Scripts
- `scripts/clear-wallet-cache.ts` - Clear Redis cache for wallets
- `scripts/fix-wallet-balance-field.ts` - Fix balance field inconsistencies
- `scripts/check-wallet-status.ts` - Diagnostic tool for wallet state

### Existing Files (No Changes Needed)
- `src/features/payments/services/escrow.service.ts` - Working correctly
- `src/app/api/payments/wallet/balance/route.ts` - Working correctly
- `src/app/(dashboard)/vendor/wallet/page.tsx` - Working correctly

## Resolution Status

✅ **RESOLVED**

All wallet balances are now correctly set to ₦0.00 in both:
- Database (PostgreSQL)
- Cache (Redis)

The UI will display correct values after a hard refresh.

## Lessons Learned

1. **Always maintain database invariants** - The balance field must equal availableBalance + frozenAmount
2. **Clear caches after manual DB changes** - Redis caching can show stale data
3. **Use diagnostic scripts** - Having tools to verify state is crucial for debugging
4. **Test scripts thoroughly** - The original reset script had bugs that caused this issue

---

**Date**: February 5, 2026
**Status**: ✅ Complete
**Next Action**: User should hard refresh browser to see correct ₦0.00 balances
