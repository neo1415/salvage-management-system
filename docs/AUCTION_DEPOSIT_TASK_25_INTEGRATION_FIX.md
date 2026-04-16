# Task 25: Cron Jobs Integration Fix

## Issue Identified

The cron jobs were created but the underlying services (document-integration and extension) were NOT using the testing mode environment variables. They were only reading from the database config, which meant testing mode wouldn't work properly.

## What Was Fixed

### 1. Document Integration Service
**File**: `src/features/auction-deposit/services/document-integration.service.ts`

**Before**: Only read from database `system_config` table
**After**: Checks `TESTING_MODE` environment variable first, then falls back to database

**Testing Mode Support Added**:
- `TESTING_DOCUMENT_VALIDITY_MINUTES` → Overrides `document_validity_period`
- `TESTING_PAYMENT_DEADLINE_MINUTES` → Overrides `payment_deadline_after_signing`
- `TESTING_EXTENSION_MINUTES` → Overrides `grace_extension_duration`

**Functions Affected**:
- `generateDocumentsWithDeadline()` - Now uses testing mode for document validity
- `setPaymentDeadline()` - Now uses testing mode for payment deadline
- `extendDocumentDeadline()` - Now uses testing mode for extension duration

### 2. Extension Service
**File**: `src/features/auction-deposit/services/extension.service.ts`

**Before**: Only read from database `system_config` table
**After**: Checks `TESTING_MODE` environment variable first, then falls back to database

**Testing Mode Support Added**:
- `TESTING_EXTENSION_MINUTES` → Overrides `grace_extension_duration`

**Functions Affected**:
- `grantExtension()` - Now uses testing mode for extension duration

## How Testing Mode Works Now

### Environment Variables
```env
TESTING_MODE=true
TESTING_DOCUMENT_VALIDITY_MINUTES=5      # 5 minutes instead of 48 hours
TESTING_PAYMENT_DEADLINE_MINUTES=10      # 10 minutes instead of 72 hours
TESTING_BUFFER_MINUTES=2                 # 2 minutes instead of 24 hours
TESTING_EXTENSION_MINUTES=5              # 5 minutes instead of 24 hours
```

### Flow

1. **Service checks testing mode**:
   ```typescript
   const testingMode = process.env.TESTING_MODE === 'true';
   ```

2. **If testing mode enabled, use env var**:
   ```typescript
   if (testingMode && process.env.TESTING_DOCUMENT_VALIDITY_MINUTES) {
     const minutes = parseInt(process.env.TESTING_DOCUMENT_VALIDITY_MINUTES);
     return minutes / 60; // Convert to hours
   }
   ```

3. **Otherwise, use database config**:
   ```typescript
   const [config] = await db.select().from(systemConfig)...
   ```

4. **Console logs indicate testing mode**:
   ```
   🧪 TESTING MODE: Using 5 minutes for document validity (instead of 48 hours)
   ```

## Complete Integration Chain

### Document Deadline Flow
1. **Auction closes** → Winner identified
2. **Document Integration Service** generates documents
   - Checks `TESTING_MODE`
   - Uses `TESTING_DOCUMENT_VALIDITY_MINUTES` if enabled
   - Sets `validityDeadline` = now + 5 minutes (testing) or 48 hours (production)
3. **Wait 5 minutes** (testing) or 48 hours (production)
4. **Cron Job** (`check-document-deadlines`) runs
   - Checks `TESTING_MODE`
   - Uses `TESTING_BUFFER_MINUTES` if enabled
   - Waits 2 minutes (testing) or 24 hours (production) after deadline
5. **Fallback Service** triggers
   - Unfreezes winner's deposit
   - Promotes next bidder
6. **Document Integration Service** regenerates documents
   - Uses testing mode again for new winner
   - New deadline = now + 5 minutes (testing)

### Payment Deadline Flow
1. **Winner signs documents**
2. **Document Integration Service** sets payment deadline
   - Checks `TESTING_MODE`
   - Uses `TESTING_PAYMENT_DEADLINE_MINUTES` if enabled
   - Sets `paymentDeadline` = now + 10 minutes (testing) or 72 hours (production)
3. **Wait 10 minutes** (testing) or 72 hours (production)
4. **Cron Job** (`check-payment-deadlines`) runs
   - Checks `TESTING_MODE`
   - Uses `TESTING_BUFFER_MINUTES` if enabled
   - Waits 2 minutes (testing) or 24 hours (production) after deadline
5. **Forfeiture Service** forfeits deposit
6. **Fallback Service** triggers
7. **Document Integration Service** regenerates documents
   - Uses testing mode for new winner

### Grace Extension Flow
1. **Finance Officer grants extension**
2. **Extension Service** extends deadline
   - Checks `TESTING_MODE`
   - Uses `TESTING_EXTENSION_MINUTES` if enabled
   - Extends by 5 minutes (testing) or 24 hours (production)
3. **Document Integration Service** updates deadline
   - New deadline = current + 5 minutes (testing)

## Testing Example

### Setup
```bash
# .env
TESTING_MODE=true
TESTING_DOCUMENT_VALIDITY_MINUTES=5
TESTING_PAYMENT_DEADLINE_MINUTES=10
TESTING_BUFFER_MINUTES=2
TESTING_EXTENSION_MINUTES=5
CRON_SECRET=test-secret-123
```

### Test Document Deadline (7 minutes total)
```bash
# T+0: Create auction and close it
# Console shows: 🧪 TESTING MODE: Using 5 minutes for document validity (instead of 48 hours)

# T+5: Document deadline expires

# T+7: Buffer period ends, call cron
curl -X GET http://localhost:3000/api/cron/check-document-deadlines \
  -H "Authorization: Bearer test-secret-123"

# Response shows: "testingMode": true, "bufferHours": 0.033
# Fallback triggered, new winner gets documents with 5-minute deadline
```

### Test Payment Deadline (12 minutes total)
```bash
# T+0: Winner signs documents
# Console shows: 🧪 TESTING MODE: Using 10 minutes for payment deadline (instead of 72 hours)

# T+10: Payment deadline expires

# T+12: Buffer period ends, call cron
curl -X GET http://localhost:3000/api/cron/check-payment-deadlines \
  -H "Authorization: Bearer test-secret-123"

# Response shows: "testingMode": true, "bufferHours": 0.033
# Deposit forfeited, fallback triggered
```

### Test Grace Extension (5 minutes)
```bash
# Finance Officer grants extension
curl -X POST http://localhost:3000/api/auctions/{id}/extensions \
  -H "Content-Type: application/json" \
  -d '{"reason": "Vendor requested more time"}'

# Console shows: 🧪 TESTING MODE: Using 5 minutes for grace extension (instead of 24 hours)
# Deadline extended by 5 minutes
```

## Verification

### Check Console Logs
Look for testing mode indicators:
```
🧪 TESTING MODE: Using 5 minutes for document validity (instead of 48 hours)
🧪 TESTING MODE: Using 10 minutes for payment deadline (instead of 72 hours)
🧪 TESTING MODE: Using 5 minutes for grace extension (instead of 24 hours)
```

### Check API Responses
Cron job responses include testing mode status:
```json
{
  "success": true,
  "testingMode": true,
  "bufferHours": 0.033,
  ...
}
```

### Check Database
Verify deadlines are set correctly:
```sql
-- Should show deadlines 5-10 minutes in future (testing mode)
SELECT 
  auction_id,
  validity_deadline,
  payment_deadline,
  EXTRACT(EPOCH FROM (validity_deadline - NOW())) / 60 as minutes_until_validity,
  EXTRACT(EPOCH FROM (payment_deadline - NOW())) / 60 as minutes_until_payment
FROM release_forms
WHERE auction_id = 'your-auction-id';
```

## Production Safety

### Defaults
- `TESTING_MODE` defaults to `false` if not set
- Services fall back to database config if testing mode disabled
- Console logs clearly indicate when testing mode is active

### Warnings
- Never set `TESTING_MODE=true` in production
- Always verify testing mode is disabled before deploying
- Check environment variables in Vercel dashboard

### Deployment Checklist
- [ ] Verify `TESTING_MODE=false` or not set in production `.env`
- [ ] Check Vercel environment variables
- [ ] Test cron jobs in staging with testing mode
- [ ] Verify production uses full time periods (48h, 72h, 24h)
- [ ] Monitor first few cron executions in production

## Files Modified

1. `src/features/auction-deposit/services/document-integration.service.ts`
   - Added testing mode support to `getConfigValue()`
   - Checks `TESTING_MODE` environment variable
   - Overrides with testing minutes if enabled

2. `src/features/auction-deposit/services/extension.service.ts`
   - Added testing mode support to `getConfigValue()`
   - Checks `TESTING_MODE` environment variable
   - Overrides with testing minutes if enabled

## Summary

The integration is now complete! Testing mode works end-to-end:
- ✅ Cron jobs check testing mode
- ✅ Services check testing mode
- ✅ Deadlines use testing minutes
- ✅ Console logs indicate testing mode
- ✅ API responses include testing mode status
- ✅ Production safety maintained (defaults to false)

You can now test the entire auction deposit system in minutes instead of days!

---

**Status**: Integration Complete ✅
**Date**: 2026-04-08
**Testing**: Fully functional with 5-10 minute cycles
