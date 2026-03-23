# Migration 0017: Add Pickup Confirmation Fields

## Overview

This migration adds pickup confirmation tracking fields to the `auctions` table to support the escrow wallet payment completion workflow. These fields enable tracking when vendors and admins confirm that salvage items have been picked up.

## Changes

### New Columns Added to `auctions` Table

| Column Name | Type | Nullable | Default | Description |
|------------|------|----------|---------|-------------|
| `pickup_confirmed_vendor` | boolean | YES | false | Indicates if vendor has confirmed item pickup |
| `pickup_confirmed_vendor_at` | timestamp | YES | null | Timestamp when vendor confirmed pickup |
| `pickup_confirmed_admin` | boolean | YES | false | Indicates if admin/manager has confirmed item pickup |
| `pickup_confirmed_admin_at` | timestamp | YES | null | Timestamp when admin confirmed pickup |
| `pickup_confirmed_admin_by` | uuid | YES | null | User ID of admin who confirmed pickup (FK to users.id) |

### New Indexes

1. **idx_auctions_pickup_confirmed_vendor**
   - Partial index on `pickup_confirmed_vendor` WHERE `pickup_confirmed_vendor = false`
   - Optimizes queries for pending vendor confirmations

2. **idx_auctions_pickup_confirmed_admin**
   - Partial index on `pickup_confirmed_admin` WHERE `pickup_confirmed_admin = false`
   - Optimizes queries for pending admin confirmations

### Foreign Key Constraints

- `pickup_confirmed_admin_by` references `users(id)`
  - Tracks which admin/manager confirmed the pickup

## Usage

### Running the Migration

```bash
npx tsx scripts/run-migration-0017.ts
```

### Verifying the Migration

```bash
npx tsx scripts/verify-migration-0017.ts
```

### Testing the Schema Changes

```bash
npx tsx scripts/test-pickup-confirmation-schema.ts
```

## Workflow Integration

These fields support the following workflow:

1. **Vendor Confirms Pickup**
   - After payment is verified and pickup code is provided
   - Vendor enters pickup code and confirms collection
   - System sets `pickup_confirmed_vendor = true` and `pickup_confirmed_vendor_at = NOW()`

2. **Admin Confirms Pickup**
   - Admin/Manager receives notification of vendor confirmation
   - Admin verifies item was actually collected
   - System sets `pickup_confirmed_admin = true`, `pickup_confirmed_admin_at = NOW()`, and `pickup_confirmed_admin_by = admin_user_id`

3. **Transaction Complete**
   - When both vendor and admin confirm pickup
   - Auction status can be marked as 'completed'
   - Triggers final fund release if not already released

## Rollback

If you need to rollback this migration:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_auctions_pickup_confirmed_vendor;
DROP INDEX IF EXISTS idx_auctions_pickup_confirmed_admin;

-- Remove columns
ALTER TABLE auctions 
DROP COLUMN IF EXISTS pickup_confirmed_vendor,
DROP COLUMN IF EXISTS pickup_confirmed_vendor_at,
DROP COLUMN IF EXISTS pickup_confirmed_admin,
DROP COLUMN IF EXISTS pickup_confirmed_admin_at,
DROP COLUMN IF EXISTS pickup_confirmed_admin_by;
```

## Related Files

- **Migration SQL**: `src/lib/db/migrations/0017_add_pickup_confirmation_fields.sql`
- **Schema Definition**: `src/lib/db/schema/auctions.ts`
- **Run Script**: `scripts/run-migration-0017.ts`
- **Verification Script**: `scripts/verify-migration-0017.ts`
- **Test Script**: `scripts/test-pickup-confirmation-schema.ts`

## Dependencies

- Requires `users` table to exist (for foreign key constraint)
- Part of the Escrow Wallet Payment Completion feature
- Spec: `.kiro/specs/escrow-wallet-payment-completion/`

## Notes

- All new columns are nullable to support existing auctions
- Default values ensure backward compatibility
- Partial indexes optimize queries for pending confirmations only
- Foreign key ensures data integrity for admin confirmations
