# Case Status Naming Fix

## Issue

Case CTE-82863 shows status as "active_auction" even though:
- The auction has closed
- Payment is pending verification
- The auction is no longer active

This is misleading and confusing for users.

## Root Cause

The case status enum only has these values:
```typescript
'draft', 'pending_approval', 'approved', 'active_auction', 'sold', 'cancelled'
```

There's no status for "auction closed, awaiting payment verification", so we're reusing `active_auction` which is incorrect.

## Proposed Solution

Add a new status: `pending_payment` to the case status enum.

### Updated Status Flow

1. `draft` → Adjuster creates case
2. `pending_approval` → Submitted for manager approval
3. `approved` → Manager approves (brief transition)
4. `active_auction` → Auction created and running
5. **`pending_payment`** → Auction closes, payment awaiting verification ✅ **NEW**
6. `sold` → Payment verified by finance officer

### Benefits

1. **Clear semantics**: Status name accurately reflects the state
2. **Better UX**: Users understand what's happening
3. **Accurate filtering**: Can filter cases by payment status
4. **Audit trail**: Clear distinction between active auctions and closed auctions awaiting payment

## Implementation Plan

### 1. Update Database Schema

**File**: `src/lib/db/schema/cases.ts`

```typescript
export const caseStatusEnum = pgEnum('case_status', [
  'draft',
  'pending_approval',
  'approved',
  'active_auction',
  'pending_payment',  // NEW
  'sold',
  'cancelled',
]);
```

### 2. Create Migration

**File**: `src/lib/db/migrations/0003_add_pending_payment_status.sql`

```sql
-- Add 'pending_payment' to case_status enum
ALTER TYPE case_status ADD VALUE IF NOT EXISTS 'pending_payment';

-- Update existing cases that are in 'active_auction' with closed auctions
UPDATE salvage_cases sc
SET status = 'pending_payment'
FROM auctions a
WHERE sc.id = a.case_id
  AND sc.status = 'active_auction'
  AND a.status = 'closed'
  AND EXISTS (
    SELECT 1 FROM payments p
    WHERE p.auction_id = a.id
    AND p.status = 'pending'
  );
```

### 3. Update Auction Closure Service

**File**: `src/features/auctions/services/closure.service.ts`

```typescript
// Line ~285 - Update case status to pending_payment instead of active_auction
await db
  .update(salvageCases)
  .set({
    status: 'pending_payment',  // Changed from keeping as 'active_auction'
    updatedAt: new Date(),
  })
  .where(eq(salvageCases.id, auction.caseId));
```

### 4. Update Payment Verification

**File**: `src/app/api/payments/[id]/verify/route.ts`

Already correct - sets status to 'sold' when payment is verified.

### 5. Update UI Labels

**Manager Approvals Page**: `src/app/(dashboard)/manager/approvals/page.tsx`

Add status badge mapping:
```typescript
const statusConfig = {
  pending_approval: { label: 'Pending', color: 'yellow' },
  approved: { label: 'Approved', color: 'green' },
  active_auction: { label: 'Active Auction', color: 'blue' },
  pending_payment: { label: 'Payment Pending', color: 'orange' },  // NEW
  sold: { label: 'Sold', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'red' },
};
```

### 6. Update TypeScript Types

Ensure all TypeScript types include the new status:

```typescript
type CaseStatus = 
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active_auction'
  | 'pending_payment'  // NEW
  | 'sold'
  | 'cancelled';
```

## Testing

1. ✅ Create new auction and let it close → Status should be `pending_payment`
2. ✅ Finance officer verifies payment → Status should change to `sold`
3. ✅ UI shows correct badge: "Payment Pending" (orange)
4. ✅ Existing case CTE-82863 should update to `pending_payment`

## Migration Steps

1. Run migration to add new enum value
2. Update existing cases with closed auctions to `pending_payment`
3. Deploy code changes
4. Verify in production

## Alternative Considered

**Option**: Use `awaiting_payment` instead of `pending_payment`

Rejected because:
- `pending_payment` is more concise
- Matches the payment status terminology (`pending`)
- Consistent with existing naming conventions

## Status After Fix

Case CTE-82863 will show:
- Status: `pending_payment` (not `active_auction` or `sold`)
- Status Badge: "Payment Pending" (orange)
- Payment Status: `pending`
- Auction Status: `closed`

This accurately reflects the current state of the case.
