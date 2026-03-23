# Restart Dev Server - Build Cache Issue

## Problem
The browser is showing an old build error even though the code has been fixed:
```
Export authOptions doesn't exist in target module
Export getServerSession doesn't exist in target module
```

## Solution
The file `src/app/api/auctions/route.ts` has been correctly updated to use NextAuth v5 pattern, but the browser is serving cached build files.

## Steps to Fix

### 1. Stop the Dev Server
Press `Ctrl+C` in your terminal to stop the current dev server.

### 2. Delete the Build Cache
Run this command:
```bash
rmdir /s /q .next
```

### 3. Restart the Dev Server
```bash
npm run dev
```

### 4. Hard Refresh Browser
Once the server restarts:
- Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or open DevTools (F12) → Right-click the refresh button → "Empty Cache and Hard Reload"

## What Was Fixed
The file now correctly uses:
- ✅ `import { auth } from '@/lib/auth/next-auth.config'` (line 23)
- ✅ `const session = await auth()` (line 31)

Instead of the old NextAuth v4 pattern:
- ❌ `import { getServerSession } from 'next-auth'`
- ❌ `import { authOptions } from '@/lib/auth/next-auth.config'`
- ❌ `getServerSession(authOptions)`

## Verification
After restarting, the error should disappear and you should be able to:
1. Navigate to the auctions page
2. See the auction history tabs working
3. Access the finance payments page

---

**Status**: Waiting for dev server restart
**Date**: 2026-02-14
