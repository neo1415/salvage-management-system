# Notification Routes Auth Import Fix

## Problem

Build errors were occurring in two notification API routes due to incorrect auth imports:

```
Module not found: Can't resolve '@/lib/auth/auth-options'
Export getServerSession doesn't exist in target module
```

**Affected Files**:
- `src/app/api/notifications/push/subscribe/route.ts`
- `src/app/api/notifications/preferences/route.ts`

## Root Cause

These files were using the old NextAuth v4 pattern:
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

const session = await getServerSession(authOptions);
```

However, the project uses a different auth pattern with NextAuth v5:
```typescript
import { auth } from '@/lib/auth/next-auth.config';

const session = await auth();
```

## Fix Applied

### 1. Updated Imports

**Before**:
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
```

**After**:
```typescript
import { auth } from '@/lib/auth/next-auth.config';
```

### 2. Updated Auth Calls

**Before**:
```typescript
const session = await getServerSession(authOptions);
```

**After**:
```typescript
const session = await auth();
```

## Files Modified

### src/app/api/notifications/push/subscribe/route.ts
- Updated import statement
- Updated POST handler auth call
- Updated DELETE handler auth call

### src/app/api/notifications/preferences/route.ts
- Updated import statement
- Updated GET handler auth call
- Updated PUT handler auth call

## Verification

✅ No TypeScript diagnostics errors
✅ Consistent with other API routes in the project
✅ Uses the correct NextAuth v5 pattern

## Related Files

All other API routes in the project already use the correct pattern:
- `src/app/api/auctions/[id]/restart/route.ts`
- `src/app/api/vendors/*/route.ts`
- `src/app/api/reports/*/route.ts`
- And many others...

## Status

✅ **COMPLETE** - Build errors fixed, notification routes now use correct auth pattern.
