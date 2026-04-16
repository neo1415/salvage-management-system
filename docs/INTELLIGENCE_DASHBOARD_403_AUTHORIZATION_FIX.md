# Intelligence Dashboard 403 Authorization Fix

## Problem
All 7 analytics endpoints returned **403 Forbidden** errors for vendor users, even when logged in. The APIs only allowed `admin` and `manager` roles.

## Root Cause
Authorization checks in all analytics API routes were too restrictive:
```typescript
// OLD (WRONG)
if (session.user.role !== 'admin' && session.user.role !== 'manager') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

## Solution Implemented

### Authorization Strategy
- **Admin/Manager**: Access to ALL analytics data (system-wide)
- **Vendor**: Access to analytics data with the following rules:
  - **Aggregated analytics** (no vendor-specific data): Same view as admin/manager
  - **Vendor-specific analytics**: Filtered to show only their own data

### Files Fixed

#### 1. Asset Performance Analytics
**File**: `src/app/api/intelligence/analytics/asset-performance/route.ts`
- ✅ Added vendor role to allowed roles
- ℹ️ No vendor filtering needed (aggregated data)

#### 2. Attribute Performance Analytics
**File**: `src/app/api/intelligence/analytics/attribute-performance/route.ts`
- ✅ Added vendor role to allowed roles
- ℹ️ No vendor filtering needed (aggregated data)

#### 3. Temporal Patterns Analytics
**File**: `src/app/api/intelligence/analytics/temporal-patterns/route.ts`
- ✅ Added vendor role to allowed roles
- ℹ️ No vendor filtering needed (aggregated data)

#### 4. Geographic Patterns Analytics
**File**: `src/app/api/intelligence/analytics/geographic-patterns/route.ts`
- ✅ Added vendor role to allowed roles
- ℹ️ No vendor filtering needed (aggregated data)

#### 5. Conversion Funnel Analytics
**File**: `src/app/api/intelligence/analytics/conversion-funnel/route.ts`
- ✅ Added vendor role to allowed roles
- ℹ️ No vendor filtering needed (aggregated data)

#### 6. Session Metrics Analytics
**File**: `src/app/api/intelligence/analytics/session-metrics/route.ts`
- ✅ Added vendor role to allowed roles
- ✅ **Added vendor filtering**: Forces `vendorId` to current user's ID for vendors
```typescript
// If user is a vendor, force filter to their own ID
if (session.user.role === 'vendor') {
  vendorId = session.user.id;
}
```

#### 7. Vendor Segments Analytics
**File**: `src/app/api/intelligence/analytics/vendor-segments/route.ts`
- ✅ Added vendor role to allowed roles
- ✅ **Added vendor filtering**: Filters results to only show vendor's own segment
```typescript
// If user is a vendor, only return their own segment data
if (session.user.role === 'vendor') {
  const segments = await behavioralAnalyticsService.getVendorSegments({
    segment,
    limit,
  });
  
  // Filter to only the current vendor's data
  const vendorSegment = segments.filter(s => s.vendorId === session.user.id);
  // ... return filtered data
}
```

## New Authorization Pattern

All routes now use this consistent pattern:

```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Allow admin, manager, and vendor roles
    const allowedRoles = ['admin', 'manager', 'vendor'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // ... rest of the logic
  }
}
```

## Data Access Matrix

| Endpoint | Admin/Manager | Vendor |
|----------|---------------|--------|
| Asset Performance | All data | All data (aggregated) |
| Attribute Performance | All data | All data (aggregated) |
| Temporal Patterns | All data | All data (aggregated) |
| Geographic Patterns | All data | All data (aggregated) |
| Conversion Funnel | All data | All data (aggregated) |
| Session Metrics | All vendors | Own data only |
| Vendor Segments | All vendors | Own segment only |

## Testing

### Test Cases
1. ✅ Admin can access all endpoints
2. ✅ Manager can access all endpoints
3. ✅ Vendor can access all endpoints
4. ✅ Vendor sees only their own data in session-metrics
5. ✅ Vendor sees only their own segment in vendor-segments
6. ✅ Unauthenticated users get 401
7. ✅ Other roles (adjuster, etc.) get 403

### Manual Testing
```bash
# Test as vendor
curl -H "Cookie: authjs.session-token=<vendor-token>" \
  http://localhost:3000/api/intelligence/analytics/asset-performance

# Should return 200 with data

# Test session metrics as vendor
curl -H "Cookie: authjs.session-token=<vendor-token>" \
  http://localhost:3000/api/intelligence/analytics/session-metrics

# Should return 200 with only vendor's own session data
```

## TypeScript Validation
All files pass TypeScript compilation with no errors:
```bash
✅ asset-performance/route.ts: No diagnostics found
✅ attribute-performance/route.ts: No diagnostics found
✅ temporal-patterns/route.ts: No diagnostics found
✅ geographic-patterns/route.ts: No diagnostics found
✅ vendor-segments/route.ts: No diagnostics found
✅ session-metrics/route.ts: No diagnostics found
✅ conversion-funnel/route.ts: No diagnostics found
```

## Security Considerations

### ✅ Implemented
- Vendors cannot access other vendors' session data
- Vendors cannot access other vendors' segment data
- Proper role-based access control
- No data leakage between vendors

### ℹ️ Design Decision
Aggregated analytics (asset performance, temporal patterns, etc.) are intentionally shared with vendors because:
1. They provide market insights without revealing individual vendor behavior
2. They help vendors make informed bidding decisions
3. They don't contain sensitive vendor-specific information
4. This aligns with the "market insights" feature for vendors

## Related Files
- Analytics schema: `src/lib/db/schema/analytics.ts`
- Service layer: `src/features/intelligence/services/`
- UI components: `src/components/intelligence/admin/analytics/`

## Status
✅ **COMPLETE** - All 7 analytics endpoints now properly handle vendor authorization with appropriate data filtering.
