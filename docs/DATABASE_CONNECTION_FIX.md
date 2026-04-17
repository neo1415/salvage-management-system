# Database Connection Issue Fix

## Problem
Getting `PostgresError XX000` causing authentication failures and logout loops.

## Root Cause
Connection pool exhaustion - too many open connections to Supabase.

## Immediate Solutions

### 1. Restart Dev Server (Try First)
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### 2. Update Connection Pool Settings
If restart doesn't help, reduce max connections:

**Edit `src/lib/db/drizzle.ts`:**
```typescript
const client = postgres(connectionString, {
  max: 3,  // Reduce from 10 to 3
  idle_timeout: 20,  // Reduce from 30 to 20
  max_lifetime: 60 * 10,  // Reduce from 30min to 10min
  connect_timeout: 10,
  prepare: !isTest,
});
```

### 3. Check Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Database → Connection Pooling
4. Check if you're hitting connection limits

### 4. Use Transaction Mode (If Issue Persists)
Update your DATABASE_URL to use transaction mode:

```env
# Change from:
DATABASE_URL=postgresql://user:password@host:5432/database

# To:
DATABASE_URL=postgresql://user:password@host:5432/database?pgbouncer=true
```

Note: Port changed from 5432 to 6543 and added `?pgbouncer=true`

### 5. Clear Next.js Cache

**Windows PowerShell:**
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

**Windows CMD:**
```cmd
rmdir /s /q .next
npm run dev
```

**Note**: In PowerShell, use `Remove-Item` (not `rm`). The `-rf` flags don't exist in PowerShell.

## Prevention
- Restart dev server daily
- Don't leave dev server running overnight
- Use transaction pooling mode for production

## Why This Happens
- Next.js dev mode with hot reload creates new connections
- Old connections don't always close properly
- Supabase free tier has connection limits
- Session pooler can get overwhelmed

## Test After Fix
1. Restart dev server
2. Try logging in
3. Navigate between pages
4. Should stay logged in now
