# Local PostgreSQL Quick Start (5 Minutes)

## TL;DR - Fast Track

If you just want to get started quickly:

### 1. Install PostgreSQL (5 minutes)

Download and install: https://www.postgresql.org/download/windows/

- Password: `postgres` (or remember what you choose)
- Port: `5432` (default)
- Click Next through everything else

### 2. Create Database (30 seconds)

Open PowerShell:

```powershell
psql -U postgres -c "CREATE DATABASE salvage_test;"
```

Enter password when prompted.

### 3. Add to .env (10 seconds)

Add this line to your `.env` file:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/salvage_test
```

(Replace `postgres:postgres` with `postgres:YOUR_PASSWORD` if you used a different password)

### 4. Run Migrations (1 minute)

```powershell
.\scripts\migrate-test-database.ps1
```

### 5. Verify Setup (10 seconds)

```powershell
tsx scripts/setup-test-database.ts
```

### 6. Run Tests! 🎉

```powershell
npm run test:integration -- tests/integration/auction-deposit/bid-placement-e2e-optimized.test.ts
```

---

## Expected Results

✅ Tests should complete in **10-20 seconds** (vs 2+ minutes before)
✅ No connection timeouts
✅ No "CONNECTION_CLOSED" errors
✅ All 6 tests should pass

---

## Troubleshooting

### "psql: command not found"

Close and reopen PowerShell, or add to PATH:
- `C:\Program Files\PostgreSQL\16\bin`

### "password authentication failed"

Check your password in `.env` matches what you set during installation.

### "database does not exist"

Run: `psql -U postgres -c "CREATE DATABASE salvage_test;"`

### "connection refused"

Start PostgreSQL service:
```powershell
Start-Service postgresql-x64-16
```

---

## What This Gives You

- ⚡ **100x faster tests** (no network latency)
- 🔒 **No connection limits** (unlimited connections)
- ⏱️ **No timeouts** (connections don't expire)
- 🎯 **True integration testing** (real database)
- 💰 **Free** (no cloud costs)

---

## Full Documentation

See `docs/LOCAL_POSTGRESQL_SETUP_GUIDE.md` for detailed instructions and troubleshooting.

---

**Ready?** Start with Step 1 above! 🚀
