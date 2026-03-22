# Test Failures Fix Plan

## Summary

58 tests failing out of 1253 total tests. The failures fall into these categories:

### 1. Valuation Query Tests (Database Isolation Issues)
**Files:**
- `tests/unit/valuations/valuation-query-helpers.test.ts`
- `tests/unit/valuations/valuation-query-property.test.ts`

**Problem:**
- Tests are not properly isolated
- Property-based tests insert random data that persists across test runs
- Helper tests expect empty database but find leftover data
- Tests marked as `describe.sequential` but still have race conditions

**Root Cause:**
- Multiple test files accessing the same database table in parallel
- `beforeEach` cleanup happens too late - data from previous tests already exists
- Property tests generate random data like " k45m", "49 4ss" that doesn't get cleaned

**Solution:**
1. Add unique test database schema per test file
2. Use transactions that rollback after each test
3. Add better cleanup in `beforeAll` hook
4. Ensure property tests clean up their generated data

### 2. Notification Multi-Channel Tests (Mock Issues)
**File:**
- `tests/unit/notifications/multi-channel.test.ts`

**Problem:**
- SMS service mock not being called when expected
- Email service HTML format mismatch (expecting StringContaining but getting full HTML)

**Root Cause:**
- Property-based tests generating edge case inputs (minimal strings like "0 0", " 0        .")
- Mocks not properly configured for these edge cases
- Email template generating full HTML but test expects partial match

**Solution:**
1. Fix mock setup to handle edge case inputs
2. Update test expectations to match actual email template output
3. Add input validation to prevent edge case strings

### 3. Other Pre-Existing Failures
Various other tests failing in:
- Market data services
- Dashboard APIs
- Other features

**Approach:**
Fix them systematically after addressing the main issues above.

## Fix Priority

1. **HIGH**: Valuation query test isolation (affects 10+ tests)
2. **HIGH**: Notification multi-channel mocks (affects 2+ tests)
3. **MEDIUM**: Other valuation tests
4. **LOW**: Remaining scattered failures

## Implementation Plan

### Phase 1: Fix Valuation Query Test Isolation

1. Create test database helper with transaction support
2. Update valuation query tests to use transactions
3. Add proper cleanup in beforeAll hooks
4. Verify tests pass in isolation and in parallel

### Phase 2: Fix Notification Tests

1. Update mock configuration for edge cases
2. Fix email template expectations
3. Add input validation

### Phase 3: Fix Remaining Failures

1. Run tests again to see what's left
2. Fix systematically by category
3. Verify all tests pass

## Expected Outcome

- All 1253 tests passing
- Tests properly isolated
- No race conditions
- Clean test database between runs
