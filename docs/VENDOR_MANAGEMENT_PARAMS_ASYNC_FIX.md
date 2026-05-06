# Vendor Management Params Async Fix

**Date:** May 5, 2026  
**Status:** ✅ Complete

## Problem

When attempting to approve a vendor application, the API returned a 404 error with the message:

```
Error: Route "/api/vendors/[id]/approve" used `params.id`. 
`params` is a Promise and must be unwrapped with `await` or `React.use()` 
before accessing its properties.
```

This is a Next.js 15+ requirement where dynamic route parameters are now returned as Promises.

## Root Cause

The approval endpoint was accessing `params.id` directly without awaiting the `params` Promise first:

```typescript
// ❌ Old (incorrect)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ...
  .where(eq(vendors.id, params.id))
}
```

## Solution

Updated the endpoint to properly await the `params` Promise before accessing its properties:

```typescript
// ✅ New (correct)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params (Next.js 15+ requirement)
    const { id } = await params;
    
    // Now use `id` instead of `params.id`
    .where(eq(vendors.id, id))
  }
}
```

## Changes Made

### File: `src/app/api/vendors/[id]/approve/route.ts`

1. **Updated function signature:**
   - Changed `params: { id: string }` to `params: Promise<{ id: string }>`

2. **Added params unwrapping:**
   - Added `const { id } = await params;` at the start of the try block

3. **Replaced all `params.id` references:**
   - Line 77: `.where(eq(vendors.id, id))` (vendor lookup)
   - Line 125: `.where(eq(vendors.id, id))` (approval update)
   - Line 172: `.where(eq(vendors.id, id))` (rejection update)

## Testing Checklist

- [ ] Navigate to `/manager/vendors`
- [ ] Click on a vendor application to review
- [ ] Test approving a vendor
  - [ ] Verify vendor status changes to "approved"
  - [ ] Verify email notification is sent
  - [ ] Verify SMS notification is sent
- [ ] Test rejecting a vendor
  - [ ] Verify vendor status changes to "rejected"
  - [ ] Verify rejection reason is saved
  - [ ] Verify email notification is sent
  - [ ] Verify SMS notification is sent
- [ ] Test all three tier tabs (Tier 0, Tier 1, Tier 2)
- [ ] Test status filters (All, Pending, Approved, Rejected)

## Related Files

- `src/app/api/vendors/[id]/approve/route.ts` - Fixed async params
- `src/app/(dashboard)/manager/vendors/page.tsx` - Frontend vendor management
- `src/lib/db/schema/vendors.ts` - Vendor schema with tier0 support

## Next Steps

1. Restart your development server if it hasn't auto-reloaded
2. Test the approval flow end-to-end
3. Verify email and SMS notifications are working
4. Check that all tier tabs display vendors correctly

## Notes

- This is a Next.js 15+ breaking change that affects all dynamic route parameters
- All route handlers with `[id]` or other dynamic segments need this fix
- The pattern is: `params: Promise<{ paramName: string }>` and `const { paramName } = await params;`
