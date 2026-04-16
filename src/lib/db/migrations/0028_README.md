# Migration 0028: Auction Deposit Bidding System

## Overview

This migration transforms the auction system from a full-amount freeze model to a capital-efficient deposit-based model. Instead of freezing the entire bid amount, vendors now freeze only a configurable percentage (default 10%, minimum ₦100,000) as deposit.

## What's Changed

### New Tables (7)

1. **auction_winners** - Tracks top N bidders and fallback chain
2. **auction_documents** - Stores Bill of Sale and Liability Waiver documents
3. **grace_extensions** - Records grace period extensions granted by Finance Officers
4. **deposit_forfeitures** - Tracks forfeited deposits when winners fail to pay
5. **system_config** - Stores configurable business rules (12 parameters)
6. **config_change_history** - Immutable audit trail for configuration changes
7. **deposit_events** - Vendor deposit history for transparency

### Table Extensions (2)

1. **bids** table:
   - `deposit_amount` (numeric) - Deposit frozen for this bid
   - `status` (varchar) - Bid status: active, outbid, winner, failed_to_sign, failed_to_pay, completed
   - `is_legacy` (boolean) - True for bids before deposit system

2. **escrow_wallets** table:
   - `forfeited_amount` (numeric) - Total forfeited deposits

### New Auction Statuses

- `awaiting_documents` - Winner must sign documents
- `awaiting_payment` - Winner must complete payment
- `deposit_forfeited` - Winner failed to pay, deposit forfeited
- `forfeiture_collected` - Forfeited funds transferred to platform
- `failed_all_fallbacks` - All top bidders failed, manual intervention needed
- `manual_resolution` - Finance Officer manually resolving auction
- `paid` - Payment completed
- `completed` - Auction fully completed

### Wallet Invariant Constraint

A database-level check constraint enforces the wallet invariant:

```
balance = availableBalance + frozenAmount + forfeitedAmount
```

This ensures financial data consistency at all times.

## Default Configuration

The migration inserts 12 default configuration parameters:

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| deposit_rate | 10% | Percentage of bid to freeze as deposit |
| minimum_deposit_floor | ₦100,000 | Minimum deposit amount |
| tier1_limit | ₦500,000 | Max bid for Tier 1 vendors |
| minimum_bid_increment | ₦20,000 | Minimum increment between bids |
| document_validity_period | 48 hours | Time to sign documents |
| max_grace_extensions | 2 | Maximum extensions allowed |
| grace_extension_duration | 24 hours | Hours added per extension |
| fallback_buffer_period | 24 hours | Wait time before fallback |
| top_bidders_to_keep_frozen | 3 | Number of top bidders |
| forfeiture_percentage | 100% | Deposit penalty on failure |
| payment_deadline_after_signing | 72 hours | Time to pay after signing |
| deposit_system_enabled | true | Global feature flag |

## Running the Migration

### Apply Migration

```bash
# Using Drizzle
npm run db:migrate

# Or manually with psql
psql -U your_user -d your_database -f src/lib/db/migrations/0028_add_auction_deposit_system.sql
```

### Rollback Migration

**⚠️ WARNING: Rollback will delete all deposit system data!**

```bash
# Manually with psql
psql -U your_user -d your_database -f src/lib/db/migrations/0028_rollback_auction_deposit_system.sql
```

## Backward Compatibility

The migration maintains backward compatibility with existing auctions:

- All existing bids are marked as `is_legacy = true`
- Legacy bids continue to use full-amount freeze (100%)
- Legacy auctions complete without deposit system logic
- New auctions use deposit-based logic when `deposit_system_enabled = true`

## Performance Considerations

The migration creates 20+ indexes for optimal query performance:

- Auction winners by auction, vendor, status, rank
- Documents by auction, vendor, status, type
- Extensions by auction, granted_by, created_at
- Forfeitures by auction, vendor, transferred_at
- Config history by parameter, changed_by, created_at
- Deposit events by vendor, auction, created_at

## Verification

After migration, verify:

1. All 7 new tables exist
2. Bids table has 3 new columns
3. Escrow_wallets table has forfeited_amount column
4. All indexes are created
5. Default configuration is inserted
6. Wallet invariant constraint is active

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_name IN (
  'auction_winners', 'auction_documents', 'grace_extensions',
  'deposit_forfeitures', 'system_config', 'config_change_history',
  'deposit_events'
);

-- Check bids columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'bids' 
AND column_name IN ('deposit_amount', 'status', 'is_legacy');

-- Check escrow_wallets column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'escrow_wallets' 
AND column_name = 'forfeited_amount';

-- Check default config
SELECT parameter, value FROM system_config ORDER BY parameter;

-- Check wallet invariant constraint
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'escrow_wallets' 
AND constraint_name = 'check_wallet_invariant';
```

## Related Documentation

- **Requirements**: `.kiro/specs/auction-deposit-bidding-system/requirements.md`
- **Design**: `.kiro/specs/auction-deposit-bidding-system/design.md`
- **Tasks**: `.kiro/specs/auction-deposit-bidding-system/tasks.md`
- **Schema**: `src/lib/db/schema/auction-deposit.ts`

## Support

For issues or questions about this migration, refer to the spec documents or contact the development team.
