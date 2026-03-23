# Next.js 15 Async Params Fix - Admin User Management

## Issue
When attempting to delete a user, received a 500 Internal Server Error with the following message:

```
Error: Route "/api/admin/users/[id]" used `params.id`. 
`params` is a Promise and must be unwrapped with `await` or `React.use()` 
before accessing its properties.
```

## Root Cause
In Next.js 15+, dynamic route parameters (`params`) are now returned as Promises and must be awaited before accessing their properties. This is a breaking change from Next.js 14.

## Solution
Updated all admin user management API routes to properly await the `params` Promise before accessing the `id` property.

### Files Fixed

1. **src/app/api/admin/users/[id]/route.ts**
   - GET handler
   - PATCH handler  
   - DELETE handler

2. **src/app/api/admin/users/[id]/suspend/route.ts**
   - POST handler

3. **src/app/api/admin/users/[id]/unsuspend/route.ts**
   - POST handler

4. **src/app/api/admin/users/[id]/reset-password/route.ts**
   - POST handler

### Code Changes

**Before (Next.js 14 style):**
```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Directly access params.id
  if (params.id === session.user.id) {
    // ...
  }
  
  const user = await db.query.users.findFirst({
    where: eq(users.id, params.id),
  });
}
```

**After (Next.js 15+ style):**
```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params first
  const { id } = await params;
  
  // Then use the id
  if (id === session.user.id) {
    // ...
  }
  
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
}
```

## Pattern to Follow

For all dynamic route handlers in Next.js 15+:

1. **Update the type signature:**
   ```typescript
   { params }: { params: Promise<{ id: string }> }
   ```

2. **Await params at the start of the function:**
   ```typescript
   const { id } = await params;
   ```

3. **Use the destructured value throughout:**
   ```typescript
   // Use 'id' instead of 'params.id'
   where: eq(users.id, id)
   ```

## Testing
After applying these fixes:
- ✅ User deletion works correctly
- ✅ User suspension works correctly
- ✅ User unsuspension works correctly
- ✅ Password reset works correctly
- ✅ Role changes work correctly
- ✅ User details retrieval works correctly

## Related Documentation
- [Next.js 15 Dynamic Routes](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic-route-segments)
- [Next.js Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-15)

## Impact
This fix resolves all 500 errors in the admin user management system. All CRUD operations now work as expected.

---

**Status**: ✅ Fixed
**Date**: February 5, 2026
**Next.js Version**: 15+
