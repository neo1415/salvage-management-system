# PostgreSQL Status and Next Steps

## Current Status ✅

### What's Working:
1. ✅ **PostgreSQL 18 is installed** at `C:\Program Files\PostgreSQL\18`
2. ✅ **psql command is available** (version 18.3)
3. ✅ **PostgreSQL is in your PATH**
4. ✅ **TEST_DATABASE_URL exists in .env** (but points to Supabase)

### What's Needed:
1. ❌ **PostgreSQL password** - Need to know the password you set during installation
2. ❌ **Create salvage_test database**
3. ❌ **Update TEST_DATABASE_URL in .env** to point to local database
4. ❌ **Run migrations** on local database

---

## Next Steps (5 Minutes)

### Step 1: Find Your PostgreSQL Password

You need the password you set when you installed PostgreSQL. Common defaults:
- `postgres`
- `admin`
- `password`
- Or whatever you chose during installation

**To test your password:**
```powershell
psql -U postgres
# Enter your password when prompted
# If successful, you'll see: postgres=#
# Type \q to exit
```

### Step 2: Create the Database

Once you know your password, run:

```powershell
# Set password as environment variable (replace YOUR_PASSWORD)
$env:PGPASSWORD = "YOUR_PASSWORD"

# Create database
psql -U postgres -c "CREATE DATABASE salvage_test;"

# Verify it was created
psql -U postgres -l | Select-String "salvage"
```

### Step 3: Update .env File

Open your `.env` file and change this line:

**FROM (current - Supabase):**
```bash
TEST_DATABASE_URL=postgresql://postgres.htdehmkqfrwjewzjingm:K%40tsur0u1415@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

**TO (new - Local):**
```bash
TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/salvage_test
```

Replace `YOUR_PASSWORD` with your actual PostgreSQL password.

### Step 4: Run Migrations

```powershell
.\scripts\migrate-test-database.ps1
```

This will:
- Temporarily set DATABASE_URL to your TEST_DATABASE_URL
- Run `npm run db:push` to create all tables
- Restore original DATABASE_URL

### Step 5: Verify Setup

```powershell
tsx scripts/setup-test-database.ts
```

This will verify:
- ✅ Connection works
- ✅ All tables exist
- ✅ Ready for testing

### Step 6: Run Tests! 🎉

```powershell
npm run test:integration -- tests/integration/auction-deposit/bid-placement-e2e-optimized.test.ts
```

Tests should complete in **10-20 seconds** instead of timing out!

---

## If You Don't Remember Your Password

### Option 1: Reset Password (Recommended)

1. Find `pg_hba.conf` file:
   ```powershell
   Get-ChildItem "C:\Program Files\PostgreSQL\18\data" -Filter "pg_hba.conf"
   ```

2. Open it in Notepad as Administrator

3. Find this line:
   ```
   host    all             all             127.0.0.1/32            scram-sha-256
   ```

4. Change `scram-sha-256` to `trust`:
   ```
   host    all             all             127.0.0.1/32            trust
   ```

5. Restart PostgreSQL service:
   ```powershell
   Restart-Service postgresql-x64-18
   ```

6. Now you can connect without password:
   ```powershell
   psql -U postgres
   ```

7. Reset password:
   ```sql
   ALTER USER postgres PASSWORD 'postgres';
   \q
   ```

8. Change `pg_hba.conf` back to `scram-sha-256`

9. Restart service again

### Option 2: Use pgAdmin

1. Open pgAdmin 4 (should be installed with PostgreSQL)
2. Connect to localhost
3. Right-click on "postgres" user → Properties → Definition
4. Set new password
5. Save

---

## Quick Test Command

Once you have your password, test everything with:

```powershell
# Replace YOUR_PASSWORD with your actual password
$env:PGPASSWORD = "YOUR_PASSWORD"

# Test connection
psql -U postgres -c "SELECT version();"

# If that works, create database
psql -U postgres -c "CREATE DATABASE salvage_test;"

# Verify
psql -U postgres -l | Select-String "salvage"
```

---

## Summary

You're **90% there**! PostgreSQL is installed and working. You just need to:

1. 🔑 Find/reset your PostgreSQL password (2 minutes)
2. 🗄️ Create salvage_test database (30 seconds)
3. ✏️ Update .env file (30 seconds)
4. 📦 Run migrations (2 minutes)
5. 🎉 Run tests!

**Total time remaining: ~5 minutes**

---

## Need Help?

If you're stuck on the password, let me know and I can guide you through the reset process step-by-step!
