# Dashboard Data Fixes - Quick Reference

## 🚀 Quick Start

### Problem: Finance Dashboard Shows All Zeros

**Solution**: Clear the cache

```bash
# Method 1: Via API (Recommended)
curl -X POST http://localhost:3000/api/dashboard/finance/clear-cache

# Method 2: Bypass cache for testing
# Navigate to: /api/dashboard/finance?bypass=true
```

### Problem: Payment Status Shows "Payment Pending" After Completion

**Solution**: Already fixed! The API now checks actual payment status.

**Verify**: Navigate to bid history and check payment status section.

### Problem: Adjuster Approved Count Shows 0

**Solution**: Check server logs for debug output.

**Verify**: Look for console log with actual counts.

## 📋 API Endpoints

### Finance Dashboard
```
GET /api/dashboard/finance
GET /api/dashboard/finance?bypass=true  (skip cache)
POST /api/dashboard/finance/clear-cache (clear cache)
```

### Adjuster Dashboard
```
GET /api/dashboard/adjuster
```

### Bid History
```
GET /api/bid-history/[auctionId]
```

## 🔍 Quick Diagnostics

### Check Finance Dashboard Data
```bash
# 1. Check API response
curl http://localhost:3000/api/dashboard/finance?bypass=true

# 2. Check database
psql -d your_database -c "SELECT COUNT(*) FROM payments;"

# 3. Check cache
redis-cli GET dashboard:finance
```

### Check Payment Status
```bash
# 1. Check API response
curl http://localhost:3000/api/bid-history/[auction-id]

# 2. Check database
psql -d your_database -c "SELECT status FROM payments WHERE auction_id = 'auction-id';"
```

### Check Adjuster Approved Count
```bash
# 1. Check server logs
tail -f logs/application.log | grep "Adjuster dashboard stats"

# 2. Check database
psql -d your_database -c "SELECT COUNT(*) FROM salvage_cases WHERE created_by = 'user-id' AND approved_by IS NOT NULL;"
```

## 🛠️ Common Fixes

### Finance Dashboard Shows Zeros
1. Clear cache: `POST /api/dashboard/finance/clear-cache`
2. Refresh dashboard
3. If still zero, check database for payment records

### Payment Status Incorrect
1. Check payment record in database
2. Verify payment.status field
3. Clear browser cache
4. Refresh page

### Adjuster Count Wrong
1. Check server logs for debug output
2. Verify cases have `approved_by` field set
3. Check if user ID matches

## 📊 Database Verification

### Quick Queries
```sql
-- Finance Dashboard
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount::numeric) as total
FROM payments
GROUP BY status;

-- Adjuster Dashboard
SELECT 
  status,
  COUNT(*) as count,
  COUNT(approved_by) as approved
FROM salvage_cases
WHERE created_by = 'user-id'
GROUP BY status;

-- Payment Status
SELECT 
  p.status as payment_status,
  sc.status as case_status
FROM payments p
JOIN auctions a ON p.auction_id = a.id
JOIN salvage_cases sc ON a.case_id = sc.id
WHERE a.id = 'auction-id';
```

## 🔧 Troubleshooting Steps

### Step 1: Check Logs
```bash
# Application logs
tail -f logs/application.log

# Look for:
# - "Finance dashboard: Calculating fresh stats"
# - "Finance dashboard stats: {...}"
# - "Adjuster dashboard stats: {...}"
```

### Step 2: Verify Database
```bash
# Check if data exists
psql -d your_database -c "SELECT COUNT(*) FROM payments;"
psql -d your_database -c "SELECT COUNT(*) FROM salvage_cases WHERE approved_by IS NOT NULL;"
```

### Step 3: Clear Cache
```bash
# Clear finance dashboard cache
curl -X POST http://localhost:3000/api/dashboard/finance/clear-cache

# Or clear all Redis cache
redis-cli FLUSHDB
```

### Step 4: Test API Directly
```bash
# Test finance dashboard
curl http://localhost:3000/api/dashboard/finance?bypass=true

# Test adjuster dashboard
curl http://localhost:3000/api/dashboard/adjuster

# Test bid history
curl http://localhost:3000/api/bid-history/[auction-id]
```

## 📝 Files Modified

```
src/app/api/bid-history/[auctionId]/route.ts
src/app/api/dashboard/finance/route.ts
src/app/api/dashboard/adjuster/route.ts
src/app/api/dashboard/finance/clear-cache/route.ts (new)
```

## ✅ Success Indicators

- [ ] Finance dashboard shows non-zero values
- [ ] Payment status matches database
- [ ] Adjuster approved count matches database
- [ ] Logs show debug output
- [ ] Cache can be cleared successfully
- [ ] Bypass parameter works

## 🚨 Emergency Rollback

```bash
# 1. Revert code
git revert <commit-hash>

# 2. Clear cache
redis-cli FLUSHDB

# 3. Restart app
npm run build && npm start
```

## 📞 Support

If issues persist:
1. Check server logs for errors
2. Verify database connectivity
3. Check Redis connectivity
4. Review test plan: `tests/manual/test-dashboard-data-fixes.md`
5. Review full documentation: `DASHBOARD_DATA_FIXES_COMPLETE.md`
