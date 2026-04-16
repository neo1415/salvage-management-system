# Task 26 Integration Testing - Critical Issue

## Problem Summary

Integration tests for the Auction Deposit system are failing due to **database connection exhaustion** when running against the remote Supabase database.

## Root Cause

1. **Remote Database Latency**: Each database operation takes 200-500ms due to network latency to Supabase (AWS EU-Central-1)
2. **Connection Pool Limits**: Supabase Nano plan has 15 connections max, tests use 2 connections
3. **Long-Running Setup**: `beforeAll` hook takes 60+ seconds to create test users/vendors/wallets
4. **Connection Timeout**: Connections close after 60 seconds idle (max_lifetime setting)
5. **Test Timeout**: Tests timeout after 30 seconds, hooks after 60 seconds

## Error Pattern

```
Failed to freeze deposit: Error: write CONNECTION_CLOSED aws-1-eu-central-1.pooler.supabase.com:5432
```

This occurs after ~74 seconds of test execution, right when the first actual test tries to run.

## Why This Happens

1. `beforeAll` starts at T=0, creates users/vendors/wallets (takes 60+ seconds)
2. Connection is established at T=0
3. At T=60, connection hits `max_lifetime` and closes
4. At T=74, first test tries to use the closed connection
5. Test fails with CONNECTION_CLOSED error

## Solutions (In Order of Preference)

### Option 1: Local Test Database (RECOMMENDED)
**Status**: Requires setup

Set up a local PostgreSQL database for integration tests:

```bash
# Install PostgreSQL locally
# Create test database
createdb salvage_test

# Add to .env
TEST_DATABASE_URL=postgresql://localhost:5432/salvage_test

# Run migrations
npm run db:migrate
```

**Pros**:
- Fast (no network latency)
- Unlimited connections
- No timeout issues
- True integration testing

**Cons**:
- Requires local PostgreSQL installation
- Need to run migrations locally
- Each developer needs setup

### Option 2: Unit Tests with Mocked Database (FAST)
**Status**: Can implement immediately

Convert integration tests to unit tests with mocked database calls:

```typescript
// Mock the database
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

// Test business logic without actual database
```

**Pros**:
- No database required
- Fast execution (milliseconds)
- No connection issues
- Can implement immediately

**Cons**:
- Not true integration tests
- Doesn't catch database-level issues
- Requires mocking setup

### Option 3: Increase Connection Timeouts (TEMPORARY)
**Status**: Partial solution only

Increase timeouts in `drizzle.ts` for test environment:

```typescript
max_lifetime: isTest ? 300 : 60, // 5 minutes for tests
idle_timeout: isTest ? 120 : 20, // 2 minutes for tests
```

**Pros**:
- Quick fix
- No infrastructure changes

**Cons**:
- Doesn't solve latency issue
- Tests still slow (2-3 minutes each)
- Wastes Supabase connections
- Not a real solution

### Option 4: Reduce Test Scope (COMPROMISE)
**Status**: Can implement immediately

Create minimal "smoke tests" that verify critical paths only:

```typescript
// Instead of 6 tests per suite, do 1-2 critical tests
describe('Bid Placement - Smoke Test', () => {
  it('should place bid and freeze deposit', async () => {
    // Single end-to-end test
  });
});
```

**Pros**:
- Faster execution
- Less connection usage
- Can run against remote DB

**Cons**:
- Incomplete coverage
- Doesn't meet Task 26 requirements fully

## Current Status

### Completed
- ✅ Test file structure created
- ✅ Test logic implemented
- ✅ Timeouts configured
- ✅ Tier 1 limits fixed
- ✅ Syntax errors fixed

### Blocked
- ❌ Tests cannot run against remote Supabase database
- ❌ Connection exhaustion after 60-74 seconds
- ❌ Cannot complete Task 26 without infrastructure changes

## Recommendation

**Implement Option 2 (Unit Tests) immediately** to unblock Task 26, then **plan Option 1 (Local DB)** for true integration testing in the future.

This allows us to:
1. Complete Task 26 requirements (test coverage)
2. Verify business logic correctness
3. Move forward with the spec
4. Add true integration tests later when local DB is set up

## Next Steps

1. Convert integration tests to unit tests with mocked database
2. Verify all business logic paths are tested
3. Mark Task 26 as complete
4. Create follow-up task for local database setup
5. Re-run as integration tests once local DB is available

## Files Affected

- `tests/integration/auction-deposit/bid-placement-e2e-optimized.test.ts` - Currently failing
- `tests/integration/auction-deposit/auction-closure-e2e.test.ts` - Not yet run
- `tests/integration/auction-deposit/fallback-chain-e2e.test.ts` - Not yet run
- Need to create: payment-flow, forfeiture-flow, config-management tests

## Time Estimate

- Option 1 (Local DB): 2-4 hours setup + testing
- Option 2 (Unit Tests): 1-2 hours conversion
- Option 3 (Timeouts): 15 minutes (but doesn't solve problem)
- Option 4 (Smoke Tests): 30 minutes

---

**Decision Required**: Which option should we proceed with?
