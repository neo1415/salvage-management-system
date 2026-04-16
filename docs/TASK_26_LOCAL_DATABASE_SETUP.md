# Task 26: Local PostgreSQL Database Setup

## What We're Doing

Setting up a local PostgreSQL database to run integration tests fast and reliably.

## Why We Need This

Integration tests were failing against remote Supabase database due to:
- ❌ Connection timeouts after 60 seconds
- ❌ Network latency (200-500ms per operation)
- ❌ Limited connections (15 max on Nano plan)
- ❌ Tests taking 2+ minutes and failing

With local PostgreSQL:
- ✅ No timeouts (unlimited connection time)
- ✅ No latency (0-5ms per operation)
- ✅ Unlimited connections
- ✅ Tests complete in 10-20 seconds

## Time Required

- **Total**: 15-20 minutes
- **PostgreSQL Installation**: 5-10 minutes
- **Database Setup**: 2-3 minutes
- **Migration**: 2-3 minutes
- **Verification**: 1-2 minutes

## Step-by-Step Process

### Quick Start (For Experienced Users)

See: `docs/LOCAL_POSTGRESQL_QUICK_START.md`

### Detailed Guide (For First-Time Setup)

See: `docs/LOCAL_POSTGRESQL_SETUP_GUIDE.md`

## Helper Scripts Created

### 1. Check Prerequisites
```powershell
.\scripts\check-test-db-prerequisites.ps1
```

Checks:
- ✅ PostgreSQL installed
- ✅ TEST_DATABASE_URL in .env
- ✅ PostgreSQL service running
- ✅ Can connect to database

### 2. Migrate Test Database
```powershell
.\scripts\migrate-test-database.ps1
```

- Temporarily sets DATABASE_URL to TEST_DATABASE_URL
- Runs `npm run db:push`
- Restores original DATABASE_URL
- Creates all tables in test database

### 3. Verify Setup
```powershell
tsx scripts/setup-test-database.ts
```

Verifies:
- ✅ TEST_DATABASE_URL configured
- ✅ Can connect to database
- ✅ Tables exist
- ✅ Critical tables present

## Installation Steps Summary

1. **Download PostgreSQL**
   - https://www.postgresql.org/download/windows/
   - Version 16.x recommended
   - ~300MB download

2. **Install PostgreSQL**
   - Run installer
   - Set password (remember it!)
   - Use default port 5432
   - Install command line tools

3. **Create Test Database**
   ```powershell
   psql -U postgres -c "CREATE DATABASE salvage_test;"
   ```

4. **Configure .env**
   ```bash
   TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/salvage_test
   ```

5. **Run Migrations**
   ```powershell
   .\scripts\migrate-test-database.ps1
   ```

6. **Verify Setup**
   ```powershell
   tsx scripts/setup-test-database.ts
   ```

7. **Run Tests**
   ```powershell
   npm run test:integration -- tests/integration/auction-deposit/bid-placement-e2e-optimized.test.ts
   ```

## Expected Results

### Before (Remote Supabase)
- ❌ Tests timeout after 60-120 seconds
- ❌ CONNECTION_CLOSED errors
- ❌ Slow (200-500ms per operation)
- ❌ Unreliable

### After (Local PostgreSQL)
- ✅ Tests complete in 10-20 seconds
- ✅ No connection errors
- ✅ Fast (0-5ms per operation)
- ✅ Reliable

## Troubleshooting

### PostgreSQL Not Found
```powershell
# Add to PATH
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"
```

### Password Authentication Failed
- Check password in .env matches installation password
- Try resetting: `ALTER USER postgres PASSWORD 'newpassword';`

### Database Does Not Exist
```powershell
psql -U postgres -c "CREATE DATABASE salvage_test;"
```

### Service Not Running
```powershell
Start-Service postgresql-x64-16
```

## Files Created

1. `docs/LOCAL_POSTGRESQL_SETUP_GUIDE.md` - Detailed setup guide
2. `docs/LOCAL_POSTGRESQL_QUICK_START.md` - Quick 5-minute guide
3. `scripts/setup-test-database.ts` - Verification script
4. `scripts/migrate-test-database.ps1` - Migration script
5. `scripts/check-test-db-prerequisites.ps1` - Prerequisites checker
6. `docs/TASK_26_LOCAL_DATABASE_SETUP.md` - This file

## Next Steps After Setup

Once PostgreSQL is set up and verified:

1. ✅ Run bid-placement-e2e-optimized.test.ts
2. ✅ Fix/create remaining Task 26 test suites:
   - auction-closure-e2e.test.ts
   - fallback-chain-e2e.test.ts
   - payment-flow-e2e.test.ts (new)
   - forfeiture-flow-e2e.test.ts (new)
   - config-management-e2e.test.ts (new)
3. ✅ Verify all tests pass
4. ✅ Mark Task 26 complete

## Benefits

- 🚀 **100x faster** - Tests run in seconds, not minutes
- 🔒 **Reliable** - No connection timeouts or limits
- 💰 **Free** - No cloud costs for testing
- 🎯 **True integration** - Real database behavior
- 📴 **Offline** - Work without internet

## Alternative: Docker

If you prefer Docker:

```powershell
docker run --name postgres-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
docker exec -it postgres-test psql -U postgres -c "CREATE DATABASE salvage_test;"
```

Then use same TEST_DATABASE_URL.

---

**Ready to start?** Run the prerequisites checker:

```powershell
.\scripts\check-test-db-prerequisites.ps1
```

This will tell you exactly what needs to be done!
