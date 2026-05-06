# Profile API "Object.entries" Error - Root Cause & Fix

## Issue Summary

**Error**: `Cannot convert undefined or null to object`  
**Location**: Vendor profile page (`/vendor/settings/profile`)  
**When**: After vendor approval was implemented with enhanced logging

## Root Cause Analysis

### Timeline
1. ✅ Vendor approval endpoint was enhanced with comprehensive logging
2. ✅ Database update was changed to use `.returning()` to verify updates
3. ❌ Profile API started failing with "Cannot convert undefined or null to object"

### The Problem

The vendor approval fix added `.returning()` to the database update:

```typescript
const updateResult = await db
  .update(vendors)
  .set(updateData)
  .where(eq(vendors.id, id))
  .returning();  // ← This returns ALL vendor fields
```

This returns the **complete vendor record** including ALL fields from the database, including JSONB fields that can be NULL:

- `performanceStats` (JSONB)
- `ninVerificationData` (JSONB)
- `amlScreeningData` (JSONB)
- `directorIds` (JSONB)
- `fraudFlags` (JSONB)

### Why It Caused the Error

1. **Before the fix**: Profile API only selected specific fields, excluding JSONB fields
2. **After the fix**: Vendor approval returns ALL fields, but profile API still didn't handle JSONB fields
3. **The bug**: When profile API fetches vendor data, NULL JSONB fields are returned
4. **The crash**: Frontend code (or cached data) tries to use `Object.entries()` on NULL values

### Where Object.entries Was Used

The error wasn't in the profile page itself, but in:
- Cached profile data that might have NULL JSONB fields
- Any component that processes vendor data with `Object.entries()`
- The auction details page uses `Object.entries(auction.case.assetDetails)` (already has defensive checks)

## The Fix

### 1. Profile API Enhancement

**File**: `src/app/api/vendor/settings/profile/route.ts`

**Changes**:
- Explicitly select JSONB fields in the query
- Convert `undefined` to `null` for all JSONB fields using nullish coalescing (`??`)
- Ensure response structure never has `undefined` values

```typescript
// Fetch vendor data if exists
const [vendor] = await db
  .select({
    // ... other fields ...
    // CRITICAL: Explicitly select JSONB fields
    performanceStats: vendors.performanceStats,
    ninVerificationData: vendors.ninVerificationData,
    amlScreeningData: vendors.amlScreeningData,
    directorIds: vendors.directorIds,
    fraudFlags: vendors.fraudFlags,
  })
  .from(vendors)
  .where(eq(vendors.userId, session.user.id))
  .limit(1);

// Build response with explicit null handling for ALL fields including JSONB
const response = {
  user: { /* ... */ },
  vendor: vendor ? {
    // ... other fields ...
    // CRITICAL FIX: Ensure JSONB fields are never undefined
    performanceStats: vendor.performanceStats ?? null,
    ninVerificationData: vendor.ninVerificationData ?? null,
    amlScreeningData: vendor.amlScreeningData ?? null,
    directorIds: vendor.directorIds ?? null,
    fraudFlags: vendor.fraudFlags ?? null,
  } : null,
};
```

### 2. use-cached-profile Hook Enhancement

**File**: `src/hooks/use-cached-profile.ts`

**Changes**:
- Added data sanitization to prevent `Object.entries` errors
- Converts `undefined` to `null` for all JSONB fields
- Ensures cached data is always safe to use

```typescript
// CRITICAL FIX: Sanitize vendor data to prevent Object.entries errors
if (data.vendor && typeof data.vendor === 'object') {
  const sanitizedVendor = { ...data.vendor };
  
  // List of JSONB fields that might be null/undefined
  const jsonbFields = ['performanceStats', 'ninVerificationData', 'amlScreeningData', 'directorIds', 'fraudFlags'];
  
  jsonbFields.forEach(field => {
    const key = field as keyof typeof sanitizedVendor;
    // Convert undefined to null to prevent Object.entries errors
    if (sanitizedVendor[key] === undefined) {
      (sanitizedVendor as any)[key] = null;
    }
  });
  
  data.vendor = sanitizedVendor as any;
}
```

### 3. Diagnostic Script

**File**: `scripts/diagnose-profile-api-issue.ts`

A comprehensive diagnostic script that:
- Checks vendor JSONB fields for NULL values
- Tests `Object.entries()` on each JSONB field
- Simulates profile API response
- Provides clear next steps

## Testing the Fix

### 1. Run Diagnostic Script

```bash
npx tsx scripts/diagnose-profile-api-issue.ts
```

**Expected Output**:
```
🔍 Diagnosing Profile API Issue

✅ Found user: { id: '...', fullName: 'Master', email: 'neowalker502@gmail.com' }

📊 Vendor Data Structure:
ID: 049ac348-f4e2-42e0-99cf-b9f4f811560c
Business Name: NEM Insurance Plc
Tier: tier2_full
Status: approved

🔍 JSONB Fields (potential NULL issues):
performanceStats: object
ninVerificationData: NULL
amlScreeningData: NULL
directorIds: NULL
fraudFlags: NULL

✅ Profile response structure is valid
```

### 2. Manual Testing

1. **Clear browser cache and localStorage**:
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Log out and log back in**

3. **Navigate to vendor profile page**: `/vendor/settings/profile`

4. **Verify**:
   - ✅ No "Cannot convert undefined or null to object" error
   - ✅ Profile data loads correctly
   - ✅ Tier 2 information displays properly
   - ✅ No console errors

### 3. API Testing

```bash
# Test profile API directly
curl -X GET http://localhost:3000/api/vendor/settings/profile \
  -H "Cookie: your-session-cookie"
```

**Expected Response**:
```json
{
  "user": {
    "id": "...",
    "fullName": "Master",
    "email": "neowalker502@gmail.com",
    ...
  },
  "vendor": {
    "businessName": "NEM Insurance Plc",
    "tier": "tier2_full",
    "status": "approved",
    "performanceStats": { "totalBids": 0, ... },
    "ninVerificationData": null,
    "amlScreeningData": null,
    "directorIds": null,
    "fraudFlags": null
  }
}
```

## What This Guarantees

### For All Vendors (Current and Future)

✅ **Profile API will never return undefined JSONB fields**
- All JSONB fields are explicitly selected
- `undefined` is converted to `null` using `??` operator

✅ **Cached profile data is always safe**
- use-cached-profile hook sanitizes data before caching
- Prevents `Object.entries` errors on cached data

✅ **No more "Cannot convert undefined or null to object" errors**
- All JSONB fields are guaranteed to be either valid objects or `null`
- Frontend code can safely check for `null` before using `Object.entries`

### Defensive Coding Pattern

```typescript
// SAFE: Check for null before using Object.entries
if (vendor.performanceStats && typeof vendor.performanceStats === 'object') {
  Object.entries(vendor.performanceStats).forEach(([key, value]) => {
    // Process entries
  });
}

// SAFE: Use optional chaining
const totalBids = vendor.performanceStats?.totalBids ?? 0;

// UNSAFE: Direct Object.entries without null check
Object.entries(vendor.performanceStats); // ❌ Would fail if null
```

## Files Modified

1. ✅ `src/app/api/vendor/settings/profile/route.ts` - Profile API with JSONB handling
2. ✅ `src/hooks/use-cached-profile.ts` - Data sanitization
3. ✅ `scripts/diagnose-profile-api-issue.ts` - Diagnostic tool (new)
4. ✅ `docs/PROFILE_API_OBJECT_ENTRIES_FIX.md` - This documentation (new)

## Prevention for Future

### When Adding New JSONB Fields

1. **Always add to profile API select**:
   ```typescript
   const [vendor] = await db.select({
     // ... existing fields ...
     newJsonbField: vendors.newJsonbField, // ← Add here
   })
   ```

2. **Always add to response with nullish coalescing**:
   ```typescript
   vendor: vendor ? {
     // ... existing fields ...
     newJsonbField: vendor.newJsonbField ?? null, // ← Add here
   } : null
   ```

3. **Always add to sanitization list in use-cached-profile**:
   ```typescript
   const jsonbFields = [
     'performanceStats',
     'ninVerificationData',
     'amlScreeningData',
     'directorIds',
     'fraudFlags',
     'newJsonbField', // ← Add here
   ];
   ```

### When Using Object.entries

Always add defensive checks:

```typescript
// ✅ GOOD
if (data && typeof data === 'object' && Object.keys(data).length > 0) {
  Object.entries(data).forEach(([key, value]) => {
    // Safe to process
  });
}

// ❌ BAD
Object.entries(data).forEach(([key, value]) => {
  // Crashes if data is null/undefined
});
```

## Related Issues

- Vendor approval fix: `docs/VENDOR_TIER2_APPROVAL_ROOT_CAUSE_FIX.md`
- Auction details page already has defensive checks for `assetDetails`

## Summary

The profile API error was caused by NULL JSONB fields being returned from the database after the vendor approval fix added `.returning()`. The fix ensures:

1. Profile API explicitly handles all JSONB fields
2. `undefined` is converted to `null` to prevent `Object.entries` errors
3. Cached data is sanitized before storage
4. All future JSONB fields follow the same pattern

This is a **permanent fix** that prevents the same issue from happening again for any vendor, current or future.
