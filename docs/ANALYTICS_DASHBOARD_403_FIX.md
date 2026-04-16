# Analytics Dashboard 403 Error Fix

## Problem Summary

The analytics dashboard was showing "No data available" for all components despite:
- Database containing 110+ analytics records
- API endpoints returning 200 status codes (eventually)
- Service layer working correctly
- No JavaScript errors in console

## Root Cause

**Race Condition + Silent Failures**

1. **Race Condition**: The dashboard component was making API calls immediately on mount, before the NextAuth session was fully loaded
2. **403 Forbidden Errors**: When APIs were called without a valid session, they returned 403 errors
3. **Silent Failures**: The component was checking `if (response.ok)` but not handling the `else` case, so failed API calls just left empty arrays
4. **No User Feedback**: No error messages were displayed to the user, making it appear as if there was simply no data

## Evidence from Logs

```
GET /api/intelligence/analytics/asset-performance?... 403 in 772ms
GET /api/intelligence/analytics/temporal-patterns?... 403 in 711ms
GET /api/intelligence/analytics/geographic-patterns?... 403 in 702ms
GET /api/auth/session 200 in 727ms  ← Session loads AFTER API calls
GET /api/intelligence/analytics/asset-performance?... 200 in 2.4s  ← Retry succeeds
```

The pattern shows:
1. Dashboard mounts and immediately calls APIs → 403 errors
2. Session loads
3. User manually refreshes → 200 success

## The Fix

### 1. Wait for Session Before Fetching

**Before:**
```typescript
useEffect(() => {
  fetchAllAnalytics();
}, []);
```

**After:**
```typescript
import { useSession } from 'next-auth/react';

const { data: session, status } = useSession();

useEffect(() => {
  // Wait for session to be loaded before fetching analytics
  if (status === 'authenticated') {
    fetchAllAnalytics();
  } else if (status === 'unauthenticated') {
    setError('You must be logged in to view analytics');
    setLoading(false);
  }
}, [status]);
```

### 2. Handle Authorization Errors

**Before:**
```typescript
if (assetRes.ok) {
  const data = await assetRes.json();
  setAssetPerformance(data.data || []);
}
// No else - just silently fails!
```

**After:**
```typescript
// Check for authorization errors first
const responses = [assetRes, attrRes, temporalRes, geoRes, segmentsRes, funnelRes, sessionRes];
const forbiddenResponse = responses.find(r => r.status === 403);
if (forbiddenResponse) {
  const errorData = await forbiddenResponse.json();
  setError(`Access denied: ${errorData.error || 'You do not have permission to view analytics'}`);
  setLoading(false);
  return;
}

const unauthorizedResponse = responses.find(r => r.status === 401);
if (unauthorizedResponse) {
  setError('Session expired. Please refresh the page and log in again.');
  setLoading(false);
  return;
}

// Process successful responses
if (assetRes.ok) {
  const data = await assetRes.json();
  setAssetPerformance(data.data || []);
} else {
  console.warn('Asset performance API failed:', assetRes.status);
}
```

### 3. Display Error Messages to User

**Added:**
```typescript
const [error, setError] = useState<string | null>(null);

// In render:
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

### 4. Show Loading State During Session Load

```typescript
if (status === 'loading') {
  return (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
```

## API Authorization Requirements

All analytics API endpoints require one of these roles:
- `system_admin`
- `salvage_manager`
- `finance_officer`

If a user doesn't have one of these roles, they will get a 403 error.

## Files Modified

1. **src/components/intelligence/admin/analytics/analytics-dashboard-content.tsx**
   - Added `useSession` hook
   - Added session status checking
   - Added error state and display
   - Added 403/401 error handling
   - Added console warnings for debugging
   - Added loading state for session

## Testing

### Run Diagnostic Script

```bash
npx tsx scripts/diagnose-analytics-403.ts
```

This will check:
- Current session and user role
- Role permissions
- Analytics table data
- Provide fix recommendations

### Manual Testing

1. Log in as a user with `system_admin`, `salvage_manager`, or `finance_officer` role
2. Navigate to `/admin/intelligence/analytics`
3. Dashboard should:
   - Show loading spinner while session loads
   - Wait for session before making API calls
   - Display data if available
   - Show clear error message if access is denied
   - Show clear error message if APIs fail

### Browser Console Testing

Open browser console and run:
```javascript
// Test API endpoint
fetch('/api/intelligence/analytics/asset-performance?startDate=2026-03-07&endDate=2026-04-07')
  .then(r => r.json())
  .then(console.log);

// Check session
fetch('/api/auth/session')
  .then(r => r.json())
  .then(console.log);
```

## Prevention

To prevent similar issues in the future:

1. **Always use `useSession` hook** when making authenticated API calls in client components
2. **Wait for `status === 'authenticated'`** before fetching data
3. **Handle all HTTP error codes** (401, 403, 404, 500, etc.)
4. **Display error messages** to users - never fail silently
5. **Log warnings** for debugging when APIs fail
6. **Test with different user roles** to ensure authorization works correctly

## Related Issues

- Type coercion errors (fixed separately)
- Vendor segments 400 error (fixed separately)
- React key warnings (fixed separately)

## Status

✅ Race condition fixed - dashboard waits for session
✅ Error handling added - 403/401 errors caught and displayed
✅ User feedback added - error alerts shown
✅ Debugging improved - console warnings added
✅ Loading states added - spinner shown during session load

The dashboard should now properly wait for authentication before fetching data and show clear error messages if something goes wrong.
