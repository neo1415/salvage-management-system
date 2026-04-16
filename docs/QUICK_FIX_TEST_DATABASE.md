# Quick Fix: Enable Integration Tests

## Problem
Integration tests fail with: `MaxClientsInSessionMode: max clients reached`

## Solution (5 Minutes)

### Step 1: Get Transaction Mode Connection String

1. Go to your Supabase Dashboard
2. Navigate to: **Project Settings** > **Database** > **Connection Pooling**
3. Select **Transaction** mode (not Session)
4. Copy the connection string - it should look like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
   ```
   Note: Port is **6543** (not 5432)

### Step 2: Add to .env

Open your `.env` file and add:

```env
TEST_DATABASE_URL=postgresql://postgres.[your-project-ref]:[your-password]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
```

**IMPORTANT:** Replace `[your-project-ref]` and `[your-password]` with your actual values

### Step 3: Test It

Run the integration tests:

```bash
npm run test:integration -- tests/integration/auction-deposit/bid-placement-e2e.test.ts
```

Should complete in ~30 seconds without connection errors.

## Why This Works

- **Session Mode** (port 5432): Limited connections, for long-lived connections
- **Transaction Mode** (port 6543): Higher limits, perfect for tests
- Tests create/destroy connections rapidly → Transaction mode handles this better

## What Changed

The code now automatically uses `TEST_DATABASE_URL` when running tests:

```typescript
// src/lib/db/drizzle.ts
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const connectionString = isTest && process.env.TEST_DATABASE_URL 
  ? process.env.TEST_DATABASE_URL  // Use Transaction mode for tests
  : process.env.DATABASE_URL;       // Use Session mode for app
```

## Verification

After adding TEST_DATABASE_URL, you should see:
- ✅ Tests connect successfully
- ✅ No "MaxClientsInSessionMode" errors
- ✅ No "CONNECT_TIMEOUT" errors
- ✅ Tests complete in reasonable time

## Next Steps

Once tests run successfully:
1. Review test results
2. Fix any failing tests
3. Continue with remaining 3 test suites
4. Complete Task 26

---

**Time Required:** 5 minutes
**Difficulty:** Easy
**Impact:** Unblocks all integration testing
