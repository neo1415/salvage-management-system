# Grace Period Database Query Parameter Fix

## Problem
The `grantGracePeriod` function was failing with a database query error where the payment ID parameter was missing:

```
Failed query: select "payments"."id", ... from "payments" 
inner join "vendors" on "payments"."vendor_id" = "vendors"."id" 
inner join "users" on "vendors"."user_id" = "users"."id" 
inner join "auctions" on "payments"."auction_id" = "auctions"."id" 
inner join "salvage_cases" on "auctions"."case_id" = "salvage_cases"."id" 
where "payments"."id" = $1 limit $2 
params: ,1
```

**Issue**: The first parameter (payment ID) was empty: `params: ,1`

## Root Cause
The project is using **Next.js 16.1.6**, which requires the `params` prop in API route handlers to be treated as a **Promise** and awaited before use. This is a breaking change introduced in Next.js 15+.

The old pattern (Next.js 14 and earlier):
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const paymentId = params.id; // ❌ params.id is undefined in Next.js 15+
}
```

The new pattern (Next.js 15+):
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: paymentId } = await params; // ✅ Correct
}
```

## Files Fixed

### 1. `/api/payments/[id]/grant-grace-period/route.ts`
**Primary Issue**: The grace period API route was not awaiting params
- Changed params type from `{ id: string }` to `Promise<{ id: string }>`
- Added `await params` before accessing the ID
- This fixes the missing payment ID parameter in the database query

### 2. `/api/payments/[id]/audit-logs/route.ts`
**Issue**: Same params handling issue
- Updated to await params before accessing payment ID

### 3. `/api/auctions/[id]/confirm-pickup/route.ts`
**Issue**: Vendor pickup confirmation was affected
- Updated to await params before accessing auction ID

### 4. `/api/auctions/[id]/documents/progress/route.ts`
**Issue**: Document progress API had the same issue
- Updated to await params before accessing auction ID

### 5. `/api/notifications/[id]/route.ts`
**Issue**: Both PATCH and DELETE handlers affected
- Updated both handlers to await params before accessing notification ID

### 6. `/api/admin/auctions/[id]/confirm-pickup/route.ts`
**Issue**: Admin pickup confirmation affected
- Updated RouteParams interface to use `Promise<{ id: string }>`
- Added await for params before accessing auction ID

## Verification
All fixed files passed TypeScript diagnostics with no errors.

## Impact
This fix resolves:
- ✅ Grace period granting functionality
- ✅ Payment audit log retrieval
- ✅ Vendor pickup confirmation
- ✅ Admin pickup confirmation
- ✅ Document progress tracking
- ✅ Notification management (mark as read, delete)

## Testing Recommendations
1. Test granting grace period for an overdue payment
2. Verify payment audit logs load correctly
3. Test vendor and admin pickup confirmation flows
4. Check document progress API responses
5. Test notification mark as read and delete operations

## Next.js Migration Note
When upgrading to Next.js 15+, all dynamic route parameters in API routes must be awaited. This is a breaking change that affects all routes with `[param]` segments.

**Pattern to search for**: `{ params }: { params: { [key]: string } }`
**Should be replaced with**: `{ params }: { params: Promise<{ [key]: string }> }` + `await params`
