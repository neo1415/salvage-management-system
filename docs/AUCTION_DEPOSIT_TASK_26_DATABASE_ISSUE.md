# Task 26: Integration Testing - Database Connection Issue

## Issue Discovered

When running integration tests for the auction deposit system, we encountered database connection pool exhaustion:

```
PostgresError: MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size
```

## Root Cause

The integration tests are attempting to connect to the Supabase database which is configured in **Session mode**. This mode has strict connection limits based on the pool size, and the tests are exhausting the available connections.

## Impact

- Integration tests cannot run successfully
- Tests timeout after 10-15 seconds
- Database cleanup (afterEach) fails due to connection timeout

## Root Cause Analysis

After investigation, the issue is:
1. Tests are using the production Supabase database
2. Supabase Session mode pooler has strict connection limits (based on plan)
3. Integration tests create many connections rapidly
4. Connection pool exhaustion causes `MaxClientsInSessionMode` error
5. After exhaustion, new connections timeout with `CONNECT_TIMEOUT`

## Solutions

### Option 1: Use Supabase Transaction Mode Pooler (QUICKEST FIX)

Supabase provides two pooler modes:
- **Session Mode** (port 5432): Limited connections, used for long-lived connections
- **Transaction Mode** (port 6543): Higher connection limits, perfect for tests

**Steps:**
1. Get your Transaction mode connection string from Supabase dashboard
2. Add to `.env`:
   ```env
   TEST_DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
   ```
3. Update `src/lib/db/drizzle.ts` to use TEST_DATABASE_URL when in test mode
4. Run tests

**Pros:**
- Quick to implement (5 minutes)
- No local setup required
- Uses same database schema as production
- Higher connection limits

**Cons:**
- Still depends on external service
- Slower than local database
- Uses production database (need to be careful with data)

### Option 2: Use Local PostgreSQL for Testing (RECOMMENDED FOR LONG TERM)

Set up a local PostgreSQL database specifically for testing:

1. Install PostgreSQL locally
2. Create a test database
3. Add test-specific environment variables:
   ```env
   TEST_DATABASE_URL=postgresql://localhost:5432/salvage_test
   ```
4. Update `vitest.setup.ts` to use test database when running tests

### Option 2: Increase Supabase Connection Pool

Upgrade Supabase plan to increase connection pool size. However, this is not ideal for testing as:
- Tests should not depend on external services
- Costs money
- Slower than local database
- Can interfere with production data

### Option 3: Use Transaction Rollback Pattern

Instead of creating/deleting data in beforeEach/afterEach:
- Start a transaction in beforeEach
- Run test
- Rollback transaction in afterEach

This is faster and doesn't require cleanup, but requires refactoring all tests.

### Option 4: Mock Database Layer

Mock the database layer entirely for integration tests. However, this defeats the purpose of integration testing which should test real database interactions.

## Recommendation

**Use Option 1: Local PostgreSQL for Testing**

This is the industry standard approach:
- Fast test execution
- No external dependencies
- No connection limits
- Can run tests offline
- Isolated from production data

## Implementation Steps

1. Install PostgreSQL locally (if not already installed)
2. Create test database: `createdb salvage_test`
3. Run migrations on test database
4. Update test configuration to use test database
5. Add database reset script for tests
6. Update CI/CD to use test database

## Test Files Created

The following integration test files have been created but cannot run until database issue is resolved:

1. `tests/integration/auction-deposit/bid-placement-e2e.test.ts` - Bid placement flow (16 tests)
2. `tests/integration/auction-deposit/auction-closure-e2e.test.ts` - Auction closure flow (estimated 15+ tests)
3. `tests/integration/auction-deposit/fallback-chain-e2e.test.ts` - Fallback chain flow (estimated 15+ tests)

## Next Steps

1. **IMMEDIATE**: Set up local PostgreSQL for testing
2. Configure test database connection
3. Run tests to verify they pass
4. Continue with remaining 3 test suites (payment, forfeiture, configuration)
5. Fix any failing tests
6. Mark Task 26 complete

## Alternative: Skip Integration Tests for Now

If setting up local PostgreSQL is not feasible right now, we can:
1. Mark integration tests as "pending" or "skip"
2. Document that they need local database setup
3. Move to Task 27 (Performance and Security Testing)
4. Return to integration tests when database is set up

However, this is NOT recommended as integration tests are critical for a financial system.

---

**Created:** 2026-04-08
**Status:** BLOCKED - Awaiting database setup
**Priority:** HIGH - Integration tests are critical for financial system
