# Vendor Registration Fee - Auction ID Nullable Fix

## Problem

When vendors tried to pay the registration fee, the payment creation failed with:

```
null value in column "auction_id" of relation "payments" violates not-null constraint
```

## Root Cause

The `payments` table had `auction_id` defined as `NOT NULL`, but registration fee payments are not associated with any auction. They are standalone payments for vendor registration.

## Solution

### 1. Database Migration

Created migration `0031_make_auction_id_nullable_in_payments.sql` to make the `auction_id` column nullable:

```sql
ALTER TABLE payments 
ALTER COLUMN auction_id DROP NOT NULL;
```

### 2. Schema Update

Updated `src/lib/db/schema/payments.ts` to remove `.notNull()` from `auctionId`:

```typescript
auctionId: uuid('auction_id')
  .references(() => auctions.id, { onDelete: 'cascade' }), // Nullable for registration fees
```

## How to Apply the Fix

Run the migration script:

```bash
npx tsx scripts/run-auction-id-nullable-migration.ts
```

## Verification

After running the migration, registration fee payments should work correctly:

1. Vendor clicks "Pay Now" on registration fee page
2. Payment record is created with `auction_id = null`
3. Paystack payment is initialized
4. Vendor completes payment
5. Webhook updates payment status

## Files Modified

- `src/lib/db/migrations/0031_make_auction_id_nullable_in_payments.sql` - Migration file
- `src/lib/db/schema/payments.ts` - Schema definition (already updated)
- `scripts/run-auction-id-nullable-migration.ts` - Migration runner script
- `docs/VENDOR_REGISTRATION_FEE_AUCTION_ID_FIX.md` - This documentation

## Impact

- Registration fee payments can now be created without an auction
- All existing auction-related payments remain unchanged
- The foreign key constraint is still in place (when auction_id is not null, it must reference a valid auction)
