# Comprehensive Dashboard Issues - Fix Required

## Critical Issues Identified

### 1. **Role-Based Redirect Problem (HIGHEST PRIORITY)**
**Issue**: Claims adjuster gets redirected to `/vendor/dashboard` and sees "Access denied. Vendor role required"

**Root Cause**: All dashboard pages likely have the same role-checking logic as admin dashboard - they check roles before session is fully loaded.

**Files to Fix**:
- `src/app/(dashboard)/adjuster/dashboard/page.tsx`
- `src/app/(dashboard)/manager/dashboard/page.tsx`
- `src/app/(dashboard)/finance/dashboard/page.tsx`
- `src/app/(dashboard)/vendor/dashboard/page.tsx`

**Fix Pattern** (apply to ALL dashboard pages):
```typescript
useEffect(() => {
  // Wait for session to be fully loaded
  if (status === 'loading') {
    return;
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return;
  }

  // Only check role after session is authenticated
  if (status === 'authenticated') {
    const userRole = session?.user?.role;
    
    // Check if user has correct role for THIS dashboard
    if (userRole !== 'expected_role_here') {
      // Redirect to their correct dashboard
      if (userRole === 'vendor') router.push('/vendor/dashboard');
      else if (userRole === 'salvage_manager') router.push('/manager/dashboard');
      else if (userRole === 'claims_adjuster') router.push('/adjuster/dashboard');
      else if (userRole === 'finance_officer') router.push('/finance/dashboard');
      else if (userRole === 'system_admin' || userRole === 'admin') router.push('/admin/dashboard');
      else router.push('/login');
      return;
    }

    // User has correct role, fetch dashboard data
    fetchDashboardData();
  }
}, [session, status, router]);
```

### 2. **Fraud Alerts Showing 3 but Page is Empty**
**Issue**: Admin dashboard shows 3 pending fraud alerts, but fraud page shows nothing

**Possible Causes**:
- Mock data in admin dashboard (hardcoded `pendingFraudAlerts: 3`)
- Fraud alerts API not returning data
- Frontend not fetching/displaying data correctly

**Files to Check**:
- `src/app/(dashboard)/admin/dashboard/page.tsx` - Remove mock data
- `src/app/(dashboard)/admin/fraud/page.tsx` - Check if fetching data
- `src/app/api/admin/fraud-alerts/route.ts` - Check if returning data
- `src/features/fraud/services/fraud-detection.service.ts` - Check detection logic

**Action**: The admin dashboard is using MOCK DATA. Need to create real API endpoint or remove the mock stats.

### 3. **AI Assessment Not Working**
**Issue**: Uploaded photos of totaled cars but AI assessment field didn't populate

**Possible Causes**:
- AI service not configured (Google Document AI credentials)
- API key missing or invalid
- Service not called on image upload
- Error being silently swallowed

**Files to Check**:
- `src/app/(dashboard)/adjuster/cases/new/page.tsx` - Check if AI is called
- `src/features/cases/services/ai-assessment.service.ts` - Check implementation
- `src/lib/integrations/google-document-ai.ts` - Check configuration
- `google-cloud-credentials.json` - Check if valid
- `.env` - Check for `GOOGLE_APPLICATION_CREDENTIALS` or similar

**Action**: AI assessment is likely not integrated yet or credentials are missing. This is a TODO item.

### 4. **Microphone Permission Denied**
**Issue**: Voice recording feature shows permission policy violation

**Error**: `Permissions policy violation: microphone is not allowed in this document`

**Root Cause**: Middleware is setting restrictive permissions policy:
```typescript
response.headers.set(
  'Permissions-Policy',
  'camera=(), microphone=(), geolocation=(self)'
);
```

This BLOCKS microphone access entirely!

**Fix**: Update middleware to allow microphone for case creation:
```typescript
response.headers.set(
  'Permissions-Policy',
  'camera=(self), microphone=(self), geolocation=(self)'
);
```

**File**: `src/middleware.ts`

## Priority Order

1. **Fix microphone permissions** (1 line change in middleware)
2. **Fix all dashboard role checks** (prevent redirect loops for all roles)
3. **Remove mock data from admin dashboard** (or create real API)
4. **Document AI assessment status** (is it implemented? needs credentials?)

## Quick Fixes

### Fix 1: Microphone Permissions (IMMEDIATE)
```typescript
// src/middleware.ts
response.headers.set(
  'Permissions-Policy',
  'camera=(self), microphone=(self), geolocation=(self)'
);
```

### Fix 2: Admin Dashboard Mock Data
```typescript
// src/app/(dashboard)/admin/dashboard/page.tsx
// Either remove the mock data or add a note that it's mock:
setStats({
  totalUsers: 0, // TODO: Fetch from API
  activeVendors: 0, // TODO: Fetch from API
  pendingFraudAlerts: 0, // TODO: Fetch from API
  todayAuditLogs: 0, // TODO: Fetch from API
  userGrowth: 0,
  systemHealth: 'healthy',
});
```

## Testing Checklist

After fixes:
- [ ] System admin can login and see admin dashboard
- [ ] Claims adjuster can login and see adjuster dashboard (not vendor!)
- [ ] Salvage manager can login and see manager dashboard
- [ ] Finance officer can login and see finance dashboard
- [ ] Vendor can login and see vendor dashboard
- [ ] Voice recording works in case creation
- [ ] Fraud alerts page shows correct data (or shows "No alerts")
- [ ] AI assessment either works or shows clear "Not configured" message

## Notes

- The "vendor dashboard" redirect issue affects ALL roles
- Every dashboard page needs the same session loading fix
- Mock data should be clearly marked or removed
- Features that aren't implemented should show clear messages, not silent failures
