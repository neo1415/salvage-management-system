# Database Connection Timeout Fix

## Issue Summary

**Error**: `CONNECT_TIMEOUT aws-1-eu-central-1.pooler.supabase.com:5432`

**Location**: Case approval API route (`/api/cases/[id]/approve`)

**Root Cause**: Network instability causing DNS resolution delays and connection timeouts to Supabase

## Diagnosis Results

### Network Tests
- **DNS Resolution**: ✅ Working (found 3 IPs for Supabase pooler)
- **DNS Performance**: ⚠️ Slow (multiple 2-second timeouts before success)
- **Internet Connectivity**: ⚠️ Unstable (50% packet loss to 8.8.8.8)
- **Error Type**: `ENOTFOUND` / `CONNECT_TIMEOUT`

### Actual Error
```
Error: getaddrinfo ENOTFOUND aws-1-eu-central-1.pooler.supabase.com
errno: -3008
code: 'ENOTFOUND'
syscall: 'getaddrinfo'
```

This indicates the Node.js process couldn't resolve the Supabase hostname due to network/DNS issues.

## Fixes Applied

### 1. Increased Connection Timeouts

**File**: `src/lib/db/drizzle.ts`

```typescript
// Before
connect_timeout: 10,
queue_timeout: 5000,

// After
connect_timeout: 30,  // 10s → 30s
queue_timeout: 15000, // 5s → 15s
```

### 2. Added Retry Logic

**File**: `src/app/api/cases/[id]/approve/route.ts`

Added `withRetry()` wrapper to all database queries:

```typescript
// Import retry helper
import { db, withRetry } from '@/lib/db/drizzle';

// Wrap critical queries
const [user] = await withRetry(async () => {
  return await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
});
```

**Retry Configuration**:
- Max retries: 3 attempts
- Delay: Exponential backoff (1s, 2s, 3s)
- Only retries on connection errors (not logic errors)

### 3. Created Diagnostic Script

**File**: `scripts/check-supabase-connection.ts`

Tests:
1. Basic health check
2. Simple SELECT query
3. WHERE clause query (like the failing query)
4. Concurrent queries (load test)

**Usage**:
```bash
npx tsx scripts/check-supabase-connection.ts
```

## Recommendations

### Immediate Actions

1. **Check your internet connection**
   - Restart your router/modem
   - Switch to a more stable network if available
   - Consider using a wired connection instead of WiFi

2. **Check DNS settings**
   - Try using Google DNS (8.8.8.8, 8.8.4.4)
   - Or Cloudflare DNS (1.1.1.1, 1.0.0.1)
   - Windows: Settings → Network → Change adapter options → Properties → IPv4 → DNS

3. **Retry the case approval**
   - The retry logic should now handle transient failures
   - If it still fails after 3 retries, the network issue is severe

### Long-term Solutions

1. **Monitor Supabase Status**
   - Check: https://status.supabase.com/
   - Subscribe to status updates

2. **Consider Connection Pooling**
   - Already configured (max: 200 connections in production)
   - Session pooler supports up to 200 concurrent connections

3. **Add Connection Health Monitoring**
   - Use the diagnostic script periodically
   - Set up alerts for connection failures

4. **Fallback Strategy** (if issues persist)
   - Consider using Supabase's direct connection (port 5432) instead of pooler
   - Or use transaction mode pooler for better reliability

## Testing the Fix

### Test 1: Connection Health
```bash
npx tsx scripts/check-supabase-connection.ts
```

Expected: All 4 tests should pass in < 5 seconds

### Test 2: Retry Case Approval
Try approving a case again through the UI. The retry logic should handle transient failures automatically.

### Test 3: Monitor Logs
Watch for these log messages:
- `[Database] Retry attempt X/3 after error:` - Retry in progress
- `[Database] Connection closed` - Normal connection cleanup

## Current Status

✅ **Code fixes applied**:
- Connection timeout increased (10s → 30s)
- Queue timeout increased (5s → 15s)
- Retry logic added to approve route
- Diagnostic script created

⚠️ **Network issues detected**:
- DNS resolution delays (2-second timeouts)
- 50% packet loss to internet
- Unstable connection to Supabase

## Next Steps

1. Fix your network connection (restart router, check ISP)
2. Retry the case approval operation
3. If still failing, run diagnostic script to verify connection
4. Consider switching to a more stable network

## Related Files

- `src/lib/db/drizzle.ts` - Database configuration with timeouts
- `src/app/api/cases/[id]/approve/route.ts` - Approve route with retry logic
- `scripts/check-supabase-connection.ts` - Connection diagnostic tool

## Notes

- The code is now more resilient to transient network failures
- Retry logic will automatically handle temporary connection issues
- If all 3 retries fail, the underlying network issue needs to be resolved
- Cloudinary image timeouts in the error log suggest broader network issues
