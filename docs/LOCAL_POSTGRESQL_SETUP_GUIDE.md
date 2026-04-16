# Local PostgreSQL Setup Guide for Integration Tests

## Quick Overview

Setting up a local PostgreSQL database will allow integration tests to run fast (no network latency) with unlimited connections and no timeouts.

**Time Required**: 15-20 minutes
**Difficulty**: Easy (follow step-by-step)

---

## Step 1: Install PostgreSQL on Windows

### Option A: Using Official Installer (Recommended)

1. **Download PostgreSQL**:
   - Go to: https://www.postgresql.org/download/windows/
   - Click "Download the installer"
   - Download PostgreSQL 16.x (latest stable version)
   - File size: ~300MB

2. **Run the Installer**:
   - Double-click the downloaded `.exe` file
   - Click "Next" through the welcome screen
   
3. **Installation Directory**:
   - Default: `C:\Program Files\PostgreSQL\16`
   - Click "Next"

4. **Select Components**:
   - ✅ PostgreSQL Server (required)
   - ✅ pgAdmin 4 (GUI tool - recommended)
   - ✅ Command Line Tools (required)
   - ✅ Stack Builder (optional)
   - Click "Next"

5. **Data Directory**:
   - Default: `C:\Program Files\PostgreSQL\16\data`
   - Click "Next"

6. **Set Password**:
   - Enter a password for the `postgres` superuser
   - **IMPORTANT**: Remember this password!
   - Suggestion: Use `postgres` for simplicity (local dev only)
   - Click "Next"

7. **Port**:
   - Default: `5432`
   - Click "Next"

8. **Locale**:
   - Default: `[Default locale]`
   - Click "Next"

9. **Summary**:
   - Review settings
   - Click "Next" to install

10. **Installation**:
    - Wait 2-3 minutes for installation
    - Click "Finish"

### Option B: Using Chocolatey (If you have Chocolatey installed)

```powershell
choco install postgresql16 -y
```

---

## Step 2: Verify Installation

Open a **new** PowerShell window (important - to reload PATH):

```powershell
psql --version
```

Expected output:
```
psql (PostgreSQL) 16.x
```

If you get "command not found", add PostgreSQL to PATH:
1. Search Windows for "Environment Variables"
2. Click "Environment Variables"
3. Under "System variables", find "Path"
4. Click "Edit"
5. Click "New"
6. Add: `C:\Program Files\PostgreSQL\16\bin`
7. Click "OK" on all dialogs
8. **Close and reopen PowerShell**

---

## Step 3: Create Test Database

Open PowerShell and run:

```powershell
# Connect to PostgreSQL (will prompt for password)
psql -U postgres

# You should see: postgres=#
```

If prompted for password, enter the password you set during installation.

Once connected, run these SQL commands:

```sql
-- Create test database
CREATE DATABASE salvage_test;

-- Verify it was created
\l

-- Exit psql
\q
```

---

## Step 4: Update Environment Variables

Add the test database URL to your `.env` file:

```bash
# Add this line to your .env file
TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/salvage_test
```

Replace `YOUR_PASSWORD` with the password you set during installation.

Example:
```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/salvage_test
```

---

## Step 5: Run Database Migrations

Now we need to apply all migrations to the test database:

```powershell
# Set environment variable temporarily for this session
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/salvage_test"

# Run migrations
npm run db:push
```

Or create a dedicated script. I'll create one for you.

---

## Step 6: Verify Setup

Let's verify the database is set up correctly:

```powershell
# Connect to test database
psql -U postgres -d salvage_test

# List tables (should see all your tables)
\dt

# Exit
\q
```

You should see tables like:
- users
- vendors
- escrow_wallets
- auctions
- bids
- salvage_cases
- deposit_events
- etc.

---

## Step 7: Run Integration Tests

Now you can run integration tests against the local database:

```powershell
npm run test:integration -- tests/integration/auction-deposit/bid-placement-e2e-optimized.test.ts
```

Tests should now run in **seconds** instead of minutes!

---

## Troubleshooting

### Issue: "psql: command not found"
**Solution**: Add PostgreSQL to PATH (see Step 2)

### Issue: "password authentication failed"
**Solution**: 
1. Check your password in `.env` matches installation password
2. Try resetting password:
   ```powershell
   psql -U postgres
   ALTER USER postgres PASSWORD 'newpassword';
   ```

### Issue: "database does not exist"
**Solution**: Create the database (see Step 3)

### Issue: "connection refused"
**Solution**: 
1. Check if PostgreSQL service is running:
   ```powershell
   Get-Service postgresql*
   ```
2. If not running, start it:
   ```powershell
   Start-Service postgresql-x64-16
   ```

### Issue: Migrations fail
**Solution**:
1. Make sure DATABASE_URL points to test database
2. Check database is empty (drop and recreate if needed):
   ```sql
   DROP DATABASE salvage_test;
   CREATE DATABASE salvage_test;
   ```

---

## Benefits of Local Database

✅ **Fast**: No network latency (0-5ms vs 200-500ms)
✅ **Unlimited Connections**: No Supabase limits
✅ **No Timeouts**: Connections don't close
✅ **True Integration Tests**: Real database behavior
✅ **Offline Development**: Work without internet
✅ **Free**: No cloud costs for testing

---

## Next Steps

Once setup is complete:

1. ✅ Run all Task 26 integration tests
2. ✅ Verify they pass
3. ✅ Mark Task 26 complete
4. ✅ Continue with remaining spec tasks

---

## Alternative: Docker PostgreSQL (Advanced)

If you prefer Docker:

```powershell
# Pull PostgreSQL image
docker pull postgres:16

# Run PostgreSQL container
docker run --name postgres-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16

# Create database
docker exec -it postgres-test psql -U postgres -c "CREATE DATABASE salvage_test;"
```

Then use:
```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/salvage_test
```

---

## Maintenance

### Reset Test Database (Clean Slate)

```powershell
# Drop and recreate
psql -U postgres -c "DROP DATABASE IF EXISTS salvage_test;"
psql -U postgres -c "CREATE DATABASE salvage_test;"

# Re-run migrations
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/salvage_test"
npm run db:push
```

### Backup Test Data

```powershell
# Backup
pg_dump -U postgres salvage_test > salvage_test_backup.sql

# Restore
psql -U postgres salvage_test < salvage_test_backup.sql
```

---

**Ready to proceed?** Follow the steps above and let me know when PostgreSQL is installed!
