# Payment Reconciliation System - Phase 2 Deployment Checklist

**Date**: 2026-05-01  
**Phase**: Phase 2 (Infrastructure + Integration)  
**Status**: Ready for Deployment

---

## Pre-Deployment Checklist

### Code Quality
- [x] All TypeScript files compile without errors
- [x] No diagnostic errors in modified files
- [x] All ledger writes are non-blocking (wrapped in try-catch)
- [x] All ledger writes happen AFTER existing operations succeed
- [x] No modifications to existing payment logic

### Database
- [x] Migration file created: `0032_add_ledger_system.sql`
- [x] Migration tested locally
- [x] Rollback migration created: `0032_rollback_ledger_system.sql`
- [x] Database trigger validates transaction balance

### Testing
- [x] Test script created: `scripts/test-ledger-integration.ts`
- [x] Manual testing plan documented
- [x] Validation queries documented

### Documentation
- [x] Phase 2.1 documentation: `PAYMENT_RECONCILIATION_PHASE_2_COMPLETE.md`
- [x] Phase 2.2 documentation: `PAYMENT_RECONCILIATION_PHASE_2_2_INTEGRATION_COMPLETE.md`
- [x] Deployment checklist: This file
- [x] Implementation plan: `PAYMENT_RECONCILIATION_IMPLEMENTATION_PLAN.md`

---

## Deployment Steps

### Step 1: Database Migration
```bash
# Run migration to create ledger tables
npm run db:migrate

# Verify tables were created
npm run tsx scripts/verify-ledger-tables.ts
```

**Expected Output**:
```
✅ ledger_accounts table exists
✅ ledger_entries table exists
✅ ledger_transaction_summary view exists
✅ refresh_ledger_transaction_summary function exists
✅ validate_ledger_transaction_balance trigger exists
```

### Step 2: Deploy Application Code
```bash
# Build application
npm run build

# Deploy to production (Vercel)
vercel --prod
```

### Step 3: Verify Cron Jobs
```bash
# Check vercel.json has cron job configured
cat vercel.json | grep "refresh-ledger-summary"
```

**Expected Output**:
```json
{
  "path": "/api/cron/refresh-ledger-summary",
  "schedule": "0 * * * *"
}
```

### Step 4: Test Ledger Integration
```bash
# Run integration test
npm run tsx scripts/test-ledger-integration.ts
```

**Expected Output**:
```
🧪 Testing Ledger Integration
✅ Ledger tables are operational
✅ Integration is working correctly
🎉 Ledger integration test complete!
```

### Step 5: Monitor First Transactions
After deployment, monitor the first few transactions:

1. **Fund a wallet via Paystack**:
   - Check console logs for: `[Ledger] Recorded wallet funding: ₦X`
   - Verify ledger entry created in database

2. **Place a bid (triggers deposit freeze)**:
   - Check console logs for: `[Ledger] Recorded deposit freeze: ₦X`
   - Verify ledger entry created in database

3. **Complete payment (triggers fund release)**:
   - Check console logs for: `[Ledger] Recorded payment debit: ₦X`
   - Verify ledger entry created in database

---

## Post-Deployment Verification

### Immediate Checks (First Hour)

#### 1. Check Ledger Entries Are Being Created
```sql
-- Check recent ledger entries
SELECT 
  id,
  transaction_id,
  debit,
  credit,
  description,
  created_at
FROM ledger_entries
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: New entries appear as payments are made

#### 2. Verify All Transactions Are Balanced
```sql
-- Check for unbalanced transactions
SELECT 
  transaction_id,
  SUM(debit::numeric) as total_debit,
  SUM(credit::numeric) as total_credit,
  ABS(SUM(debit::numeric) - SUM(credit::numeric)) as discrepancy
FROM ledger_entries
GROUP BY transaction_id
HAVING ABS(SUM(debit::numeric) - SUM(credit::numeric)) > 0.01;
```

**Expected**: 0 rows (all transactions balanced)

#### 3. Check Console Logs for Errors
```bash
# Check Vercel logs for ledger errors
vercel logs --follow
```

**Look for**:
- `[Ledger] Recorded wallet funding: ₦X` (success)
- `[Ledger] Failed to record wallet funding (non-blocking): Error` (failure)

**Expected**: Success messages, no failure messages

### Daily Checks (First Week)

#### 1. Compare Wallet Balances with Ledger Balances
```sql
-- For each vendor, compare wallet balance with ledger balance
SELECT 
  ew.vendor_id,
  ew.balance::numeric as wallet_balance,
  COALESCE(SUM(le.debit::numeric) - SUM(le.credit::numeric), 0) as ledger_balance,
  ABS(ew.balance::numeric - COALESCE(SUM(le.debit::numeric) - SUM(le.credit::numeric), 0)) as discrepancy
FROM escrow_wallets ew
LEFT JOIN ledger_accounts la ON la.account_type = 'vendor_wallet' AND la.account_id = ew.vendor_id
LEFT JOIN ledger_entries le ON le.account_id = la.id
GROUP BY ew.vendor_id, ew.balance
HAVING ABS(ew.balance::numeric - COALESCE(SUM(le.debit::numeric) - SUM(le.credit::numeric), 0)) > 0.01
ORDER BY discrepancy DESC;
```

**Expected**: 0 rows (all balances match)

**Note**: Discrepancies may exist for wallets funded before ledger integration. This is expected and can be resolved with a one-time correcting entry.

#### 2. Check Cron Job Execution
```bash
# Check cron job logs
vercel logs --filter "refresh-ledger-summary"
```

**Expected**: Cron job runs every hour, no errors

#### 3. Monitor Ledger Entry Growth
```sql
-- Check ledger entry count by day
SELECT 
  DATE(created_at) as date,
  COUNT(*) as entry_count,
  SUM(debit::numeric) as total_debit,
  SUM(credit::numeric) as total_credit
FROM ledger_entries
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;
```

**Expected**: Steady growth as payments are made

---

## Rollback Plan

If critical issues arise, follow this rollback procedure:

### Option 1: Disable Ledger Writes (Soft Rollback)
Comment out ledger write code in:
- `src/features/payments/services/escrow.service.ts`
- `src/features/auctions/services/escrow.service.ts`

```typescript
// PHASE 2.2: Record ledger entry AFTER wallet credit succeeds
// try {
//   const { ledgerService } = await import('@/features/ledger/services/ledger.service');
//   await ledgerService.recordWalletFunding(...);
// } catch (ledgerError) {
//   console.error('[Ledger] Failed to record wallet funding (non-blocking):', ledgerError);
// }
```

Redeploy application. Payments will continue working, ledger entries will stop being created.

### Option 2: Drop Ledger Tables (Hard Rollback)
```sql
-- Drop ledger tables (WARNING: This deletes all ledger data)
DROP MATERIALIZED VIEW IF EXISTS ledger_transaction_summary CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS ledger_accounts CASCADE;
DROP FUNCTION IF EXISTS refresh_ledger_transaction_summary() CASCADE;
DROP FUNCTION IF EXISTS validate_ledger_transaction_balance() CASCADE;
```

**Note**: This is a last resort. Ledger writes are non-blocking, so they should never cause payment failures.

---

## Known Issues & Limitations

### 1. Pre-Integration Wallet Balances
**Issue**: Wallets funded before ledger integration will have discrepancies between wallet balance and ledger balance.

**Solution**: Run a one-time script to create correcting ledger entries for existing wallet balances.

**Status**: Not implemented yet (Phase 3)

### 2. Ledger Write Failures
**Issue**: If ledger write fails (e.g., database connection issue), payment succeeds but ledger entry is not created.

**Impact**: Ledger will be incomplete, but payments are not affected.

**Solution**: Cron job will detect missing entries and alert finance team. Manual correcting entries can be created.

**Status**: Monitoring in place (Phase 2.1)

### 3. Concurrent Transactions
**Issue**: High-volume concurrent transactions may cause ledger write delays.

**Impact**: Ledger entries may be created slightly after payment completes.

**Solution**: Ledger writes are async and non-blocking. Delays are acceptable for reconciliation purposes.

**Status**: Acceptable for current volume

---

## Success Criteria

### Phase 2 is successful if:

1. ✅ All payment flows continue working without errors
2. ✅ Ledger entries are created for all new transactions
3. ✅ All ledger transactions are balanced (debits = credits)
4. ✅ No payment failures due to ledger writes
5. ✅ Cron job runs successfully every hour
6. ✅ Console logs show successful ledger recording

### Phase 2 has failed if:

1. ❌ Payment flows are broken or throwing errors
2. ❌ Ledger writes are blocking payments
3. ❌ Unbalanced transactions are being created
4. ❌ Database performance is degraded
5. ❌ Cron job is failing consistently

---

## Support & Troubleshooting

### Common Issues

#### Issue: Ledger write fails with "Account not found"
**Cause**: Ledger account doesn't exist for vendor

**Solution**: Ledger service auto-creates accounts. Check if `getOrCreateAccount()` is working correctly.

#### Issue: Unbalanced transaction detected
**Cause**: Bug in ledger entry creation logic

**Solution**: 
1. Check transaction details in `ledger_entries` table
2. Identify which entry is incorrect
3. Create manual correcting entry
4. Fix bug in ledger service

#### Issue: Wallet balance doesn't match ledger balance
**Cause**: Wallet was funded before ledger integration

**Solution**: Create one-time correcting entry to sync balances (Phase 3)

### Emergency Contacts
- **Database Issues**: DBA team
- **Payment Issues**: Finance team
- **Deployment Issues**: DevOps team

---

## Next Steps After Deployment

### Phase 3: Reconciliation Dashboard Enhancement
1. Add ledger balance display to finance dashboard
2. Add ledger transaction history view
3. Add reconciliation reports
4. Add manual reconciliation tools

### Phase 3 Timeline
- **Start**: After Phase 2 is stable (1 week)
- **Duration**: 2-3 weeks
- **Completion**: End of May 2026

---

## Approval Sign-Off

- [ ] **Developer**: Code reviewed and tested
- [ ] **QA**: Integration tests passed
- [ ] **Finance**: Reconciliation requirements met
- [ ] **DevOps**: Deployment plan approved
- [ ] **Product**: Feature requirements met

---

**Prepared by**: Kiro AI  
**Date**: 2026-05-01  
**Version**: 1.0
