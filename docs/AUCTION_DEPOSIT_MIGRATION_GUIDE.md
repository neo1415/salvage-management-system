# Auction Deposit System Migration Guide

## Quick Start

### 1. Run Migration

```bash
# Option A: Using the custom script (recommended)
tsx scripts/run-auction-deposit-migration.ts

# Option B: Using Drizzle CLI
npm run db:migrate

# Option C: Manual SQL execution
psql -U your_user -d your_database -f src/lib/db/migrations/0028_add_auction_deposit_system.sql
```

### 2. Verify Migration

```bash
tsx scripts/test-auction-deposit-migration.ts
```

### 3. Rollback (if needed)

⚠️ **WARNING: This will delete all deposit system data!**

```bash
psql -U your_user -d your_database -f src/lib/db/migrations/0028_rollback_auction_deposit_system.sql
```

## What Changed

### New Tables (7)

| Table | Purpose |
|-------|---------|
| `auction_winners` | Tracks top N bidders and fallback chain |
| `auction_documents` | Stores Bill of Sale and Liability Waiver |
| `grace_extensions` | Records extensions granted by Finance Officers |
| `deposit_forfeitures` | Tracks forfeited deposits |
| `system_config` | Stores 12 configurable business rules |
| `config_change_history` | Immutable audit trail for config changes |
| `deposit_events` | Vendor deposit history for transparency |

### Table Extensions (2)

**bids table:**
- `deposit_amount` (numeric) - Deposit frozen for this bid
- `status` (varchar) - Bid status
- `is_legacy` (boolean) - True for pre-deposit-system bids

**escrow_wallets table:**
- `forfeited_amount` (numeric) - Total forfeited deposits

### New Auction Statuses (8)

- `awaiting_documents` - Winner must sign documents
- `awaiting_payment` - Winner must complete payment
- `deposit_forfeited` - Winner failed to pay
- `forfeiture_collected` - Forfeited funds transferred
- `failed_all_fallbacks` - All top bidders failed
- `manual_resolution` - Manual intervention needed
- `paid` - Payment completed
- `completed` - Auction fully completed

## Default Configuration

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `deposit_rate` | 10% | 1-100% | Percentage of bid to freeze |
| `minimum_deposit_floor` | ₦100,000 | ≥₦1,000 | Minimum deposit amount |
| `tier1_limit` | ₦500,000 | - | Max bid for Tier 1 vendors |
| `minimum_bid_increment` | ₦20,000 | - | Minimum increment between bids |
| `document_validity_period` | 48 hours | 1-168 | Time to sign documents |
| `max_grace_extensions` | 2 | 0-10 | Maximum extensions allowed |
| `grace_extension_duration` | 24 hours | 1-72 | Hours added per extension |
| `fallback_buffer_period` | 24 hours | 1-72 | Wait time before fallback |
| `top_bidders_to_keep_frozen` | 3 | 1-10 | Number of top bidders |
| `forfeiture_percentage` | 100% | 0-100% | Deposit penalty on failure |
| `payment_deadline_after_signing` | 72 hours | 1-168 | Time to pay after signing |
| `deposit_system_enabled` | true | - | Global feature flag |

## Wallet Invariant

The migration adds a database-level constraint to enforce:

```
balance = availableBalance + frozenAmount + forfeitedAmount
```

This ensures financial data consistency at all times. Any operation that violates this invariant will be rejected by the database.

## Backward Compatibility

✅ **Fully backward compatible**

- All existing bids are marked as `is_legacy = true`
- Legacy bids continue to use full-amount freeze (100%)
- Legacy auctions complete without deposit system logic
- New auctions use deposit-based logic when feature flag is enabled

## Performance

The migration creates **20+ indexes** for optimal query performance:

- Auction winners: auction_id, vendor_id, status, rank
- Documents: auction_id, vendor_id, status, type
- Extensions: auction_id, granted_by, created_at
- Forfeitures: auction_id, vendor_id, transferred_at
- Config history: parameter, changed_by, created_at
- Deposit events: vendor_id, auction_id, created_at

## Schema Files

### Drizzle Schema

```typescript
// src/lib/db/schema/auction-deposit.ts
import { auctionWinners, auctionDocuments, graceExtensions, ... } from '@/lib/db/schema';
```

### Migration Files

- **Forward**: `src/lib/db/migrations/0028_add_auction_deposit_system.sql`
- **Rollback**: `src/lib/db/migrations/0028_rollback_auction_deposit_system.sql`
- **README**: `src/lib/db/migrations/0028_README.md`

## Verification Queries

### Check Tables

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
  'auction_winners', 'auction_documents', 'grace_extensions',
  'deposit_forfeitures', 'system_config', 'config_change_history',
  'deposit_events'
);
```

### Check Bids Extensions

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bids' 
AND column_name IN ('deposit_amount', 'status', 'is_legacy');
```

### Check Escrow Extension

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'escrow_wallets' 
AND column_name = 'forfeited_amount';
```

### Check Configuration

```sql
SELECT parameter, value, data_type 
FROM system_config 
ORDER BY parameter;
```

### Check Wallet Invariant

```sql
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'escrow_wallets' 
AND constraint_name = 'check_wallet_invariant';
```

### Count Indexes

```sql
SELECT COUNT(*) 
FROM pg_indexes
WHERE tablename IN (
  'auction_winners', 'auction_documents', 'grace_extensions',
  'deposit_forfeitures', 'config_change_history', 'deposit_events'
)
AND indexname LIKE 'idx_%';
```

## Troubleshooting

### Migration Fails

1. Check database connection: `psql $DATABASE_URL`
2. Check for conflicting table names
3. Check PostgreSQL version (requires 12+)
4. Review error message for specific issue

### Wallet Invariant Violations

If you see constraint violations:

1. Check existing wallet data for inconsistencies
2. Run wallet balance reconciliation script
3. Fix data issues before re-running migration

### Rollback Issues

If rollback fails:

1. Check for foreign key dependencies
2. Manually drop tables in reverse order
3. Drop enums last

## Next Steps

After successful migration:

1. ✅ Review migration in `0028_README.md`
2. ✅ Update application code to use new schema
3. ✅ Implement deposit calculator service (Task 2)
4. ✅ Implement bid validator service (Task 2)
5. ✅ Implement escrow service (Task 3)
6. ✅ Test with feature flag enabled
7. ✅ Monitor wallet invariant violations

## Related Documentation

- **Requirements**: `.kiro/specs/auction-deposit-bidding-system/requirements.md`
- **Design**: `.kiro/specs/auction-deposit-bidding-system/design.md`
- **Tasks**: `.kiro/specs/auction-deposit-bidding-system/tasks.md`
- **Schema**: `src/lib/db/schema/auction-deposit.ts`
- **Migration README**: `src/lib/db/migrations/0028_README.md`

## Support

For issues or questions:

1. Check the spec documents
2. Review migration README
3. Run test script for diagnostics
4. Contact development team

---

**Migration Version**: 0028  
**Created**: 2024  
**Status**: Ready for deployment
