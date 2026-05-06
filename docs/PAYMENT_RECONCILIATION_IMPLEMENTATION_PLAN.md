# Payment Reconciliation Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for adding **perfect, auditable, and transparent reconciliation** to the NEM Salvage Management System's pooled account payment system.

**CRITICAL**: This is an **ADDITIVE-ONLY** implementation. We will NOT modify existing payment flows. All reconciliation features are new additions that run alongside existing systems.

---

## Current System Analysis

### What We Have (Pooled Account Model)
- All vendor funds go to NEM's Paystack merchant account
- Database-level accounting tracks vendor balances
- `escrowWallets` table: balance, availableBalance, frozenAmount, forfeitedAmount
- `walletTransactions` table: Logs all operations (credit, debit, freeze, unfreeze)
- Wallet invariant: `balance = availableBalance + frozenAmount + forfeitedAmount`
- Atomic operations with database transactions
- Row-level locking for concurrency
- Idempotency protection via Vercel KV
- Comprehensive audit logging

### What We're Missing
1. **No daily reconciliation** - Can't prove database matches Paystack
2. **No double-entry ledger** - Can't detect if money appears/disappears
3. **No external reconciliation** - Never compare database to Paystack API
4. **No finance dashboard** - Officers can't verify totals
5. **No event sourcing** - Balances are mutable

---

## Implementation Phases

### **Phase 1: Immediate Fixes (This Week)** ✅ STARTING NOW

#### 1.1 Database Schema - Reconciliation Tables
**Files to create:**
- `src/lib/db/schema/reconciliation.ts`
- `src/lib/db/migrations/0031_add_reconciliation_tables.sql`

**Tables:**
```typescript
// Daily reconciliation logs
reconciliationLogs {
  id: uuid
  reconciliationDate: date
  paystackBalance: numeric
  databaseBalance: numeric  
  discrepancy: numeric
  status: 'passed' | 'failed'
  details: jsonb
  createdAt: timestamp
}

// Unmatched transactions
unmatchedTransactions {
  id: uuid
  source: 'paystack' | 'database' | 'both'
  reference: string
  paystackAmount: numeric
  databaseAmount: numeric
  status: 'missing_in_database' | 'missing_in_paystack' | 'amount_mismatch'
  resolvedAt: timestamp
  resolvedBy: uuid
  createdAt: timestamp
}
```

#### 1.2 Reconciliation Service
**File to create:**
- `src/features/reconciliation/services/reconciliation.service.ts`

**Functions:**
- `calculateTotalVendorBalances()` - Sum all escrowWallets.balance
- `fetchPaystackBalance()` - Get balance from Paystack API
- `performDailyReconciliation()` - Main reconciliation logic
- `flagDiscrepancy()` - Alert finance + admin
- `fetchPaystackTransactions()` - Get transactions from Paystack
- `matchTransactions()` - Match Paystack vs database
- `flagUnmatchedTransaction()` - Log mismatches

#### 1.3 Daily Reconciliation Cron Job
**File to create:**
- `src/app/api/cron/reconcile-wallets/route.ts`

**Logic:**
1. Calculate total vendor balances from database
2. Fetch Paystack balance via API
3. Compare with ₦1 tolerance
4. Log result to `reconciliationLogs`
5. Send alerts if discrepancy > ₦1

#### 1.4 External Transaction Reconciliation Cron Job
**File to create:**
- `src/app/api/cron/reconcile-paystack-transactions/route.ts`

**Logic:**
1. Fetch last 24 hours of Paystack transactions
2. Match against `walletTransactions` by reference
3. Flag unmatched transactions
4. Flag amount mismatches

#### 1.5 Finance Reconciliation Dashboard
**Files to create:**
- `src/app/(dashboard)/finance/reconciliation/page.tsx`
- `src/components/finance/reconciliation-dashboard.tsx`
- `src/app/api/finance/reconciliation/route.ts`

**Features:**
- Daily reconciliation status (passed/failed)
- Discrepancy history chart
- Vendor balance breakdown (top 10)
- Pending transactions list
- Unmatched transactions table
- Manual sync tools

---

### **Phase 2: Structural Improvements (Next 2-4 Weeks)**

#### 2.1 Double-Entry Ledger System
**Files to create:**
- `src/lib/db/schema/ledger.ts`
- `src/lib/db/migrations/0032_add_ledger_system.sql`
- `src/features/ledger/services/ledger.service.ts`

**Tables:**
```typescript
ledgerAccounts {
  id: uuid
  accountType: 'vendor_wallet' | 'nem_paystack' | 'nem_bank'
  accountId: string  // vendorId or 'nem'
  name: string
}

ledgerEntries {
  id: uuid
  transactionId: uuid  // Groups entries
  accountId: uuid
  debit: numeric
  credit: numeric
  description: string
  createdAt: timestamp
}
```

**Invariant:** For each `transactionId`, `SUM(debit) = SUM(credit)`

#### 2.2 Ledger Integration
**Modify (carefully):**
- `src/features/payments/services/escrow.service.ts` - Add ledger entries alongside existing logic
- `src/features/auctions/services/escrow.service.ts` - Add ledger entries

**Strategy:** Add ledger writes AFTER existing operations succeed, never before

---

### **Phase 3: Advanced Features (1-2 Months)**

#### 3.1 Event Sourcing
**Files to create:**
- `src/lib/db/schema/wallet-events.ts`
- `src/lib/db/migrations/0033_add_wallet_events.sql`
- `src/features/wallet-events/services/event-sourcing.service.ts`

**Table:**
```typescript
walletEvents {
  id: uuid
  walletId: uuid
  eventType: 'credited' | 'debited' | 'frozen' | 'unfrozen'
  amount: numeric
  reference: string
  metadata: jsonb
  createdAt: timestamp
  // IMMUTABLE: No updatedAt, no UPDATE queries
}
```

#### 3.2 Automated Anomaly Detection
**File to create:**
- `src/features/reconciliation/services/anomaly-detection.service.ts`
- `src/app/api/cron/detect-payment-anomalies/route.ts`

**Detections:**
- Vendor balance suddenly drops to zero
- Frozen amount > balance (invariant violation)
- Large transactions (>₦1M) without Paystack record
- Webhook received but no database update

---

## Safety Guarantees

### What We Will NOT Touch
❌ Existing payment flows in `paystack.service.ts`
❌ Existing escrow operations in `escrow.service.ts`
❌ Existing webhook handlers
❌ Existing wallet transaction logic
❌ Any existing database tables or columns

### What We WILL Add
✅ New database tables (reconciliation, ledger, events)
✅ New cron jobs (reconciliation, anomaly detection)
✅ New dashboard pages (finance reconciliation)
✅ New services (reconciliation, ledger, event sourcing)
✅ New API routes (reconciliation data)

### Testing Strategy
1. Create reconciliation in parallel to existing system
2. Run both systems side-by-side
3. Verify reconciliation catches discrepancies
4. Never modify existing payment logic
5. All new code is isolated in new files

---

## Success Metrics

### Phase 1 Success Criteria
- [ ] Daily reconciliation runs automatically
- [ ] Finance dashboard shows reconciliation status
- [ ] Discrepancies trigger alerts
- [ ] External transaction matching works
- [ ] Zero impact on existing payment flows

### Phase 2 Success Criteria
- [ ] Double-entry ledger tracks all transactions
- [ ] Ledger invariant always holds
- [ ] Ledger provides audit trail

### Phase 3 Success Criteria
- [ ] Event sourcing provides complete history
- [ ] Anomaly detection catches suspicious patterns
- [ ] Time-travel debugging available

---

## Rollout Plan

### Week 1 (Phase 1)
- Day 1-2: Database schema + migrations
- Day 3-4: Reconciliation service + cron jobs
- Day 5: Finance dashboard

### Week 2-4 (Phase 2)
- Week 2: Double-entry ledger schema
- Week 3: Ledger service integration
- Week 4: Testing and validation

### Month 2-3 (Phase 3)
- Month 2: Event sourcing implementation
- Month 3: Anomaly detection + testing

---

## Risk Mitigation

### Risk 1: Database Migration Fails
**Mitigation:** Test migrations on staging first, have rollback scripts ready

### Risk 2: Reconciliation Shows False Positives
**Mitigation:** Start with ₦1 tolerance, adjust based on real data

### Risk 3: Performance Impact
**Mitigation:** Run cron jobs during off-peak hours, add database indexes

### Risk 4: Paystack API Rate Limits
**Mitigation:** Cache results, batch requests, respect rate limits

---

## Next Steps

1. ✅ Create this implementation plan
2. ⏳ Create database schema for reconciliation
3. ⏳ Create reconciliation service
4. ⏳ Create daily reconciliation cron job
5. ⏳ Create external reconciliation cron job
6. ⏳ Create finance reconciliation dashboard

---

## Notes

- This is a **non-breaking** implementation
- All existing functionality remains unchanged
- Reconciliation runs in parallel to existing systems
- Finance officers get transparency without disrupting vendors
- System admin can monitor discrepancies in real-time

---

**Document Version:** 1.0  
**Created:** 2026-05-01  
**Status:** Phase 1 In Progress
