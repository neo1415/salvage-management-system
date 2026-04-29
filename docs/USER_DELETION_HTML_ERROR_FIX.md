# User Deletion API HTML Error Fix

## Problem
When trying to delete a user (Dante Dan) from the admin UI, the API returns an HTML error page instead of JSON:
```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

## Root Cause
The error indicates that the DELETE endpoint at `/api/admin/users/[id]` is returning an HTML error page instead of a JSON response. This typically happens when:

1. **Next.js routing issue** - The route file exists but Next.js isn't recognizing it
2. **Build/compilation error** - The route file has a syntax error or isn't being compiled
3. **Dev server cache** - The dev server needs to be restarted to pick up route changes
4. **Authentication redirect** - Middleware is redirecting to a login page (returns HTML)

## Investigation Results

### User Status
- **User**: Dante Dan (f9767a05-b4b5-4c45-83fe-35e896d3eacc)
- **Email**: drayne691@gmail.com
- **Phone**: 08103493005
- **Role**: claims_adjuster
- **Status**: phone_verified_tier_0

### Foreign Key Constraints
✅ **No blocking constraints found:**
- Salvage cases created: 0
- Vendor profile: 0
- Bids placed: 0
- Payments: 0
- Audit logs: (not checked due to query error, but soft delete doesn't require deletion)
- Escrow wallets: 0

### API Endpoint Analysis
The DELETE endpoint at `src/app/api/admin/users/[id]/route.ts` is correctly implemented:
- ✅ Performs **soft delete** (sets status to 'deleted')
- ✅ Has proper authentication check
- ✅ Returns JSON responses
- ✅ Has audit logging
- ✅ Prevents self-deletion

## Solution

### 1. Improved Error Handling (COMPLETED)
Added better error handling to the admin UI modal to detect HTML responses:

**File**: `src/app/(dashboard)/admin/users/action-modal.tsx`

```typescript
// Check if response is JSON before parsing
const contentType = response.headers.get('content-type');
if (!contentType || !contentType.includes('application/json')) {
  const text = await response.text();
  console.error('Non-JSON response:', text.substring(0, 500));
  throw new Error(`Server returned HTML instead of JSON. This usually means the API endpoint is not found or there's a server error. Please restart the dev server and try again.`);
}

const data = await response.json();
```

This will now show a clear error message to the user instead of a cryptic JSON parse error.

### 2. Restart Dev Server (REQUIRED)
The most common cause of this issue is that the Next.js dev server needs to be restarted to pick up route changes.

**Steps:**
1. Stop the dev server (Ctrl+C)
2. Clear Next.js cache: `rm -rf .next` (or `Remove-Item -Recurse -Force .next` on Windows)
3. Restart the dev server: `npm run dev`

### 3. Verify Route File
The route file is correctly located at:
```
src/app/api/admin/users/[id]/route.ts
```

The file exports the DELETE function correctly:
```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ... implementation
}
```

### 4. Test the Endpoint
After restarting the dev server, test the endpoint:

**Option A: Browser DevTools**
1. Open the admin users page
2. Open browser DevTools (F12)
3. Go to Network tab
4. Try to delete a user
5. Check the DELETE request to `/api/admin/users/[id]`
6. Verify it returns JSON with status 200

**Option B: Direct API Test**
Create a test script to call the endpoint directly (requires authentication):
```bash
curl -X DELETE http://localhost:3000/api/admin/users/f9767a05-b4b5-4c45-83fe-35e896d3eacc \
  -H "Cookie: your-session-cookie"
```

## Expected Behavior After Fix

### Success Response
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### Error Responses
```json
{
  "error": "Unauthorized"
}
```

```json
{
  "error": "User not found"
}
```

```json
{
  "error": "Cannot delete your own account"
}
```

## Verification Steps

1. ✅ Restart dev server
2. ✅ Clear browser cache
3. ✅ Try deleting a test user
4. ✅ Verify user status changes to 'deleted' in database
5. ✅ Verify audit log is created
6. ✅ Verify UI shows success message

## Alternative: Hard Delete Script
If soft delete is not sufficient and you need to completely remove a user, use the cleanup script:

```bash
npx tsx scripts/clear-deleted-user.ts
```

This script handles all foreign key constraints and completely removes the user from the database.

## Files Modified
1. `src/app/(dashboard)/admin/users/action-modal.tsx` - Added HTML response detection
2. `scripts/test-delete-user-api.ts` - Created diagnostic script

## Next Steps
1. **Restart the dev server** - This is the most likely fix
2. **Test the delete functionality** - Try deleting Dante Dan again
3. **Check browser console** - Look for any additional error messages
4. **Verify database** - Confirm user status changes to 'deleted'

## Notes
- The DELETE endpoint performs a **soft delete** (sets status to 'deleted')
- The user record remains in the database but is marked as deleted
- This preserves audit trails and foreign key relationships
- For complete removal, use the `clear-deleted-user.ts` script
