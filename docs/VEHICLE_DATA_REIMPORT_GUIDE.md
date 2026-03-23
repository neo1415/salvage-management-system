# Vehicle Data Re-Import Guide

## Problem
The database only has 6 vehicle valuation records, but should have 872 records according to your documentation.

## Root Cause
The import scripts use API endpoints (`/api/admin/valuations/import`) which require the dev server to be running. The scripts failed because the server wasn't running.

## Solution: Two Options

### Option 1: Run Imports with Dev Server (RECOMMENDED)

1. **Start your dev server in one terminal:**
   ```bash
   npm run dev
   ```

2. **In another terminal, run the import script:**
   ```bash
   npx tsx scripts/reimport-all-vehicle-data.ts
   ```

This will import all vehicle data:
- Toyota: 192 records
- Audi: 43 records  
- Lexus: 131 records
- Hyundai: 106 records
- Kia: 104 records
- Nissan: 176 records
- Mercedes: 120 records

**Total: 872 vehicle valuation records**

### Option 2: Direct Database Import (if dev server won't start)

If your dev server has issues, I can create direct database import scripts that bypass the API.

## After Import

Run this to verify:
```bash
npx tsx scripts/count-all-vehicle-data.ts
```

You should see:
- Vehicle Valuations: 872 records
- Damage Deductions: 254 records

## Why This Keeps Happening

The import scripts depend on:
1. Dev server running
2. API endpoints working
3. Database connection active

If any of these fail, the imports fail silently. We need to add better error handling and direct database fallback.

## Prevention

Add a pre-import check script that:
1. Verifies database connection
2. Checks if dev server is running
3. Falls back to direct database import if API is unavailable
