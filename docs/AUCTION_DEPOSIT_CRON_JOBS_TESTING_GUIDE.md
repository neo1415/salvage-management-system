# Auction Deposit Cron Jobs - Testing Guide

## Overview

This guide explains how to test the auction deposit cron jobs without waiting for hours or days. The system supports a testing mode that uses environment variables to override time periods.

## Cron Jobs

### 1. Document Deadline Checker
**Endpoint**: `GET /api/cron/check-document-deadlines`
**Schedule**: Every hour (`0 * * * *`)
**Purpose**: Checks for expired document deadlines and triggers fallback chain

### 2. Payment Deadline Checker
**Endpoint**: `GET /api/cron/check-payment-deadlines`
**Schedule**: Every hour (`0 * * * *`)
**Purpose**: Checks for expired payment deadlines, triggers forfeiture and fallback

### 3. Wallet Invariant Verification
**Endpoint**: `GET /api/cron/verify-wallet-invariants`
**Schedule**: Daily (`0 0 * * *`)
**Purpose**: Verifies wallet invariant for all escrow wallets

## Testing Mode

### Environment Variables

Add these to your `.env` file for testing:

```env
# Enable testing mode
TESTING_MODE=true

# Override time periods (in minutes)
TESTING_DOCUMENT_VALIDITY_MINUTES=5      # Document validity: 5 minutes instead of 48 hours
TESTING_PAYMENT_DEADLINE_MINUTES=10      # Payment deadline: 10 minutes instead of 72 hours
TESTING_BUFFER_MINUTES=2                 # Fallback buffer: 2 minutes instead of 24 hours
TESTING_EXTENSION_MINUTES=5              # Grace extension: 5 minutes instead of 24 hours

# Cron secret for authentication
CRON_SECRET=your-test-secret-key
```

### Production vs Testing

| Parameter | Production | Testing (Example) |
|-----------|-----------|-------------------|
| Document Validity | 48 hours | 5 minutes |
| Payment Deadline | 72 hours | 10 minutes |
| Fallback Buffer | 24 hours | 2 minutes |
| Grace Extension | 24 hours | 5 minutes |

## Testing Scenarios

### Scenario 1: Document Deadline Expiry

**Goal**: Test fallback chain when winner doesn't sign documents

**Steps**:
1. Set testing mode in `.env`:
   ```env
   TESTING_MODE=true
   TESTING_DOCUMENT_VALIDITY_MINUTES=5
   TESTING_BUFFER_MINUTES=2
   ```

2. Create auction and close it (winner identified)

3. Wait 5 minutes (document validity expires)

4. Wait 2 more minutes (buffer period)

5. Call cron job manually:
   ```bash
   curl -X GET http://localhost:3000/api/cron/check-document-deadlines \
     -H "Authorization: Bearer your-test-secret-key"
   ```

6. Verify:
   - Winner marked as `failed_to_sign`
   - Deposit unfrozen
   - Next bidder promoted to winner
   - New documents generated

**Expected Timeline**:
- T+0: Auction closes, winner identified
- T+5min: Document deadline expires
- T+7min: Buffer period ends, cron triggers fallback
- T+7min: Next bidder becomes winner

### Scenario 2: Payment Deadline Expiry

**Goal**: Test forfeiture when winner signs but doesn't pay

**Steps**:
1. Set testing mode in `.env`:
   ```env
   TESTING_MODE=true
   TESTING_PAYMENT_DEADLINE_MINUTES=10
   TESTING_BUFFER_MINUTES=2
   ```

2. Create auction, close it, winner signs documents

3. Wait 10 minutes (payment deadline expires)

4. Wait 2 more minutes (buffer period)

5. Call cron job manually:
   ```bash
   curl -X GET http://localhost:3000/api/cron/check-payment-deadlines \
     -H "Authorization: Bearer your-test-secret-key"
   ```

6. Verify:
   - Deposit forfeited (100% by default)
   - Winner marked as `failed_to_pay`
   - Auction status updated to `deposit_forfeited`
   - Next bidder promoted to winner
   - New documents generated

**Expected Timeline**:
- T+0: Winner signs documents
- T+10min: Payment deadline expires
- T+12min: Buffer period ends, cron triggers forfeiture + fallback
- T+12min: Next bidder becomes winner

### Scenario 3: Wallet Invariant Verification

**Goal**: Test wallet invariant check for all vendors

**Steps**:
1. Call cron job manually:
   ```bash
   curl -X GET http://localhost:3000/api/cron/verify-wallet-invariants \
     -H "Authorization: Bearer your-test-secret-key"
   ```

2. Check response for violations:
   ```json
   {
     "success": true,
     "walletsChecked": 50,
     "violationsFound": 0,
     "violations": []
   }
   ```

3. If violations found, check console logs for details

**Expected Result**:
- All wallets pass invariant check
- No violations reported
- Console shows: "✅ All X wallets passed invariant check"

### Scenario 4: Grace Extension

**Goal**: Test grace extension with testing mode

**Steps**:
1. Set testing mode in `.env`:
   ```env
   TESTING_MODE=true
   TESTING_EXTENSION_MINUTES=5
   ```

2. Create auction, close it, winner identified

3. Finance Officer grants extension via API:
   ```bash
   curl -X POST http://localhost:3000/api/auctions/{auctionId}/extensions \
     -H "Content-Type: application/json" \
     -d '{"reason": "Vendor requested more time"}'
   ```

4. Verify:
   - Document deadline extended by 5 minutes (instead of 24 hours)
   - Extension count incremented
   - Audit trail recorded

**Expected Result**:
- Deadline extended by 5 minutes
- Winner has 5 more minutes to sign documents

## Manual Testing Commands

### Test Document Deadline Checker
```bash
# Local
curl -X GET http://localhost:3000/api/cron/check-document-deadlines \
  -H "Authorization: Bearer your-test-secret-key"

# Production (Vercel)
curl -X GET https://your-app.vercel.app/api/cron/check-document-deadlines \
  -H "Authorization: Bearer your-production-secret"
```

### Test Payment Deadline Checker
```bash
# Local
curl -X GET http://localhost:3000/api/cron/check-payment-deadlines \
  -H "Authorization: Bearer your-test-secret-key"

# Production (Vercel)
curl -X GET https://your-app.vercel.app/api/cron/check-payment-deadlines \
  -H "Authorization: Bearer your-production-secret"
```

### Test Wallet Invariant Verification
```bash
# Local
curl -X GET http://localhost:3000/api/cron/verify-wallet-invariants \
  -H "Authorization: Bearer your-test-secret-key"

# Production (Vercel)
curl -X GET https://your-app.vercel.app/api/cron/verify-wallet-invariants \
  -H "Authorization: Bearer your-production-secret"
```

## Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-document-deadlines",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/check-payment-deadlines",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/verify-wallet-invariants",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Note**: Vercel Free Plan only allows cron jobs to run once per day. For testing, call endpoints manually.

## Monitoring Cron Jobs

### Check Logs

**Local Development**:
```bash
# Terminal shows console.log output
npm run dev
```

**Vercel Production**:
1. Go to Vercel Dashboard
2. Select your project
3. Click "Logs" tab
4. Filter by "cron" or endpoint path

### Response Format

All cron jobs return JSON with:
```json
{
  "success": true,
  "timestamp": "2026-04-08T10:30:00.000Z",
  "testingMode": true,
  "bufferHours": 0.033,
  "auctionsChecked": 5,
  "processed": 3,
  "errors": 0,
  "results": [...]
}
```

## Troubleshooting

### Issue: Cron job returns 401 Unauthorized

**Solution**: Check `CRON_SECRET` in `.env` matches the Authorization header

### Issue: No auctions found to process

**Solution**: 
- Verify auctions exist in correct status
- Check deadline timestamps in database
- Ensure buffer period has elapsed

### Issue: Testing mode not working

**Solution**:
- Verify `TESTING_MODE=true` in `.env`
- Restart development server after changing `.env`
- Check console logs for "TESTING MODE" indicator

### Issue: Wallet invariant violations

**Solution**:
- Check deposit_events table for missing entries
- Verify all freeze/unfreeze operations recorded
- Run wallet balance reconciliation script

## Best Practices

### Development
1. Always use testing mode in development
2. Test each scenario independently
3. Verify database state after each test
4. Check console logs for detailed output

### Staging
1. Use testing mode with longer periods (e.g., 30 minutes)
2. Test with real vendor accounts
3. Monitor for errors and edge cases
4. Verify notifications are sent

### Production
1. NEVER use testing mode in production
2. Set `TESTING_MODE=false` or remove variable
3. Use production time periods (48h, 72h, 24h)
4. Monitor cron job execution via Vercel logs
5. Set up alerts for failures

## Security

### Cron Secret
- Generate strong random secret: `openssl rand -base64 32`
- Store in environment variables
- Never commit to version control
- Rotate periodically

### Authorization
All cron endpoints require:
```
Authorization: Bearer {CRON_SECRET}
```

Without valid secret, returns:
```json
{
  "error": "Unauthorized"
}
```

## Performance

### Execution Time
- Document deadline checker: ~5-10 seconds per 100 auctions
- Payment deadline checker: ~10-15 seconds per 100 auctions
- Wallet invariant verification: ~30-60 seconds per 1000 wallets

### Vercel Limits
- Free Plan: 60 seconds max execution time
- Pro Plan: 300 seconds max execution time
- Set `maxDuration` in route.ts accordingly

## Next Steps

After testing cron jobs:
1. Verify all scenarios work correctly
2. Test with multiple concurrent auctions
3. Check notification delivery
4. Verify audit trails are complete
5. Move to Task 26: Integration Testing

---

**Status**: Task 25 Complete ✅
**Date**: 2026-04-08
**Testing Mode**: Enabled for development
