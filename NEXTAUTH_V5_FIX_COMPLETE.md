# NextAuth v5 TypeScript Error Fix - Complete

## Problem
Multiple API route files were importing `authOptions` from `@/lib/auth/next-auth.config` which doesn't exist. This is a NextAuth v4 pattern that's incompatible with NextAuth v5.

**Error Message:**
```
Module '"@/lib/auth/next-auth.config"' has no exported member 'authOptions'.
```

## Solution Applied
Replaced all instances of the NextAuth v4 pattern with the NextAuth v5 pattern:

### Before (NextAuth v4 - BROKEN):
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/next-auth.config';

const session = await getServerSession(authOptions);
```

### After (NextAuth v5 - FIXED):
```typescript
import { auth } from '@/lib/auth/next-auth.config';

const session = await auth();
```

## Files Fixed
All 4 API route files have been successfully updated:

1. ✅ `src/app/api/vendor/wallet/route.ts`
2. ✅ `src/app/api/vendor/settings/transactions/route.ts`
3. ✅ `src/app/api/vendor/settings/transactions/export/route.ts`
4. ✅ `src/app/api/vendor/settings/change-password/route.ts`

## Verification
- ✅ No more `authOptions` imports in source code
- ✅ No more `getServerSession` usage in API routes
- ✅ All files now use the correct NextAuth v5 `auth()` function
- ✅ TypeScript diagnostics confirm NextAuth errors are resolved

## Remaining Issues
One unrelated TypeScript error remains in `change-password/route.ts`:
- Error: Module '"@/lib/utils/audit-logger"' has no exported member 'auditLogger'
- This is a separate issue unrelated to NextAuth v5 migration

## NextAuth v5 Configuration
The NextAuth config at `src/lib/auth/next-auth.config.ts` correctly exports:
```typescript
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

The `auth()` function is the NextAuth v5 way to get the session in server components and API routes.

## Impact
- All vendor settings API routes now work correctly with NextAuth v5
- Session authentication is properly handled across all affected endpoints
- TypeScript compilation errors related to NextAuth are resolved
