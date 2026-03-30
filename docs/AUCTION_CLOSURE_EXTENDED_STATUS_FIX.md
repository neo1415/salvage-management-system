# Auction Closure Extended Status Fix

## Problem

When an auction was extended (status changed from `'active'` to `'extended'`), the client-side timer that triggers auction closure would stop working. This meant:

- Extended auctions would never close automatically
- No documents would be generated
- Winners would not be notified
- The auction would just sit there with an expired timer

## Root Cause

The timer setup logic in `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` had this condition:

```typescript
if (!auction || auction.status !== 'active') return;
```

This meant the timer would only work for auctions with status `'active'`. When an auction was extended (status changed to `'extended'`), the useEffect would return early and never set up the timeout.

## Solution

Changed the condition to work for BOTH `'active'` AND `'extended'` statuses:

```typescript
if (!auction || (auction.status !== 'active' && auction.status !== 'extended')) return;
```

Now the timer will:
1. Set up correctly for active auctions
2. Continue working when auction is extended
3. Fire when the extended time expires
4. Trigger the closure process with document generation

## Testing

To test this fix:

1. Start an auction
2. Place a bid in the last 2 minutes (triggers extension)
3. Wait for the extended timer to expire
4. Verify:
   - Auction closes automatically
   - Documents are generated (Bill of Sale, Liability Waiver)
   - Winner receives notifications
   - Status changes to 'closed'

## Files Modified

- `src/app/(dashboard)/vendor/auctions/[id]/page.tsx` - Fixed timer setup condition

## Related Issues

This fix resolves the issue where extended auctions would never close, leaving winners unable to complete payment and sign documents.
