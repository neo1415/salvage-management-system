# Auction Closure Status Enum Fix

## Problem
When an auction expired, the closure process failed with:
```
Error [PostgresError]: invalid input value for enum auction_status: "closing"
```

The closure service was trying to use an intermediate `'closing'` status that doesn't exist in the database enum.

## Root Cause
The `auction_status` enum in the database only includes:
- `'scheduled'`
- `'active'`
- `'extended'`
- `'closed'`
- `'cancelled'`
- `'forfeited'`

The closure service was attempting to:
1. Set status to `'closing'` (INVALID - doesn't exist in enum)
2. Generate documents
3. Set status to `'closed'`

## Solution
Removed the intermediate `'closing'` state. The new flow is:

1. **Broadcast closing event** (while auction is still active/extended)
2. **Generate documents synchronously** (auction status unchanged)
3. **Update status to 'closed'** (only after documents succeed)

If document generation fails, the auction remains in its current status (`'active'` or `'extended'`), allowing retry.

## Changes Made

### `src/features/auctions/services/closure.service.ts`
- Removed the database update that set status to `'closing'`
- Moved broadcast to happen before any status changes
- Documents are now generated while auction is still in `'active'` or `'extended'` status
- Only update to `'closed'` after documents are successfully generated
- If documents fail, auction status remains unchanged (no need to revert)

## Testing
Test the fix by:
1. Creating an auction with a short duration
2. Placing a bid
3. Waiting for the auction to expire (or extending it and waiting)
4. Verify the auction closes successfully and documents are generated

## Impact
- Auction closure now works for both `'active'` and `'extended'` auctions
- No more database enum errors
- Documents are generated before status changes to `'closed'`
- Failed document generation doesn't require status rollback
