# Registration Fee "Unknown" Vendor Name - Root Cause Analysis

## Issue Summary
The KPI Dashboard's "Registration Fees Breakdown" table shows "Unknown" as the vendor name for the latest payment (4/29/2026, ₦20,500) instead of displaying the actual vendor's business name.

## Root Cause Identified

### The Problem
When vendors register through the system, the `business_name` field in the `vendors` table is **NOT populated** during registration. It remains NULL.

### Evidence
**Diagnostic Results:**
```
Payment ID: b1ea39e2-191a-4c94-8c18-d10d9a2379cd
Vendor ID: fb12a54e-1a81-4d6c-aec8-054218d38458
Business Name: NULL ⚠️
Amount: ₦20500.00
Status: verified
Created: 2026-04-29 18:19:10.421026
```

### Code Analysis
**File:** `src/features/auth/services/auth.service.ts` (lines 119-135)

When a vendor registers, the vendor record is created with:
```typescript
await tx.insert(vendors).values({
  userId: newUser.id,
  tier: 'tier1_bvn',
  status: 'pending',
  registrationFeePaid: false,
  performanceStats: { ... },
  rating: '0.00',
  // ❌ businessName is NOT set here!
})
```

**Missing:** The `businessName` field is never populated during registration.

### Why "Unknown" Appears
**File:** `src/features/reports/executive/services/kpi-dashboard.service.ts`

The report query uses:
```sql
COALESCE(v.business_name, 'Unknown') as vendor_name
```

When `business_name` is NULL, it defaults to 'Unknown'.

## Impact
- **All new vendors** who register will show as "Unknown" in reports until they manually update their business name
- The 4/29/2026 payment shows "Unknown" because that vendor never set their business name
- The 4/20/2026 payment shows "Master" correctly because that vendor DID set their business name (possibly through a profile update)

## Solution Options

### Option 1: Collect Business Name During Registration (Recommended)
**Pros:**
- Ensures all vendors have a business name from the start
- Better data quality
- No NULL values in reports

**Cons:**
- Requires updating registration form and validation
- May slow down registration flow

**Implementation:**
1. Add `businessName` field to registration form
2. Update `registrationSchema` in validation
3. Update `authService.register()` to include businessName in vendor insert
4. Update registration API route

### Option 2: Use User's Full Name as Fallback
**Pros:**
- Quick fix
- No registration flow changes needed
- Better than "Unknown"

**Cons:**
- Business name might not match user's full name
- Still not ideal for business reporting

**Implementation:**
Update report query to:
```sql
COALESCE(v.business_name, u.full_name, 'Unknown') as vendor_name
```

### Option 3: Require Business Name Before Registration Fee Payment
**Pros:**
- Ensures business name is set before appearing in reports
- Natural checkpoint in the flow

**Cons:**
- Adds friction to payment flow
- Requires profile completion step

**Implementation:**
1. Add profile completion page after registration
2. Require business name before allowing registration fee payment
3. Update registration fee service to check for business_name

## Recommended Approach
**Option 1 + Option 2 (Hybrid)**

1. **Immediate Fix (Option 2):** Update report queries to use `full_name` as fallback
   - This fixes existing "Unknown" entries immediately
   - No data migration needed

2. **Long-term Fix (Option 1):** Add business name to registration flow
   - Prevents future NULL values
   - Improves data quality going forward

## Files to Update

### Immediate Fix (Option 2):
- `src/features/reports/executive/services/kpi-dashboard.service.ts`
- Any other report services that display vendor names

### Long-term Fix (Option 1):
- `src/lib/utils/validation.ts` - Add businessName to registrationSchema
- `src/features/auth/services/auth.service.ts` - Include businessName in vendor insert
- `src/app/api/auth/register/route.ts` - Pass businessName to service
- Registration form component (need to locate)

## Next Steps
1. Decide which solution option to implement
2. If Option 2: Update report queries with fallback to full_name
3. If Option 1: Update registration flow to collect business name
4. Test with new registrations
5. Verify reports show correct vendor names

## Related Files
- `src/lib/db/schema/vendors.ts` - Vendor schema (businessName is optional)
- `src/lib/db/schema/users.ts` - User schema (fullName is required)
- `src/features/auth/services/auth.service.ts` - Registration logic
- `src/features/reports/executive/services/kpi-dashboard.service.ts` - Report query

## Database Schema Note
The `business_name` column in the `vendors` table is defined as:
```typescript
businessName: varchar('business_name', { length: 255 }),
```

It's **nullable** by design, which allows vendors to register without a business name. This is the architectural decision that led to this issue.
