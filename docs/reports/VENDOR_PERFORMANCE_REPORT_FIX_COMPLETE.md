# Vendor Performance Report Fix - Complete

## Issue Summary

The Vendor Performance Report was showing incorrect data compared to the Master Report:

**Before Fix**:
- The Vendor: ₦13,592,000 total spent (WRONG)
- Master: ₦12,665,000 total spent (WRONG)
- Win Rate: 37.04% (WRONG - calculated as wins / total_bids)

**After Fix**:
- The Vendor: ₦3,392,000 total spent (CORRECT - matches Master Report)
- Master: ₦2,405,500 total spent (CORRECT - matches Master Report)
- Win Rate: 57.14% (CORRECT - calculated as wins / auctions_participated)

## Root Causes

### 1. Wrong "Total Spent" Calculation
**Before**: Summed ALL bids placed by vendor
```typescript
totalSpent: Math.round(data.bids.reduce((sum, bid) => sum + bid, 0) * 100) / 100
```

**After**: Summed only VERIFIED PAYMENTS
```sql
WITH vendor_payments AS (
  SELECT 
    v.id as vendor_id,
    COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as total_spent
  FROM vendors v
  LEFT JOIN payments p ON p.vendor_id = v.id AND p.status = 'verified'
  GROUP BY v.id
)
```

### 2. Wrong Win Rate Calculation
**Before**: wins / total_bids (37.04% for The Vendor)
```typescript
const winRate = totalBids > 0 ? (data.wins / totalBids) * 100 : 0;
```

**After**: wins / auctions_participated (57.14% for The Vendor)
```sql
CASE 
  WHEN COUNT(DISTINCT b.auction_id) > 0 
  THEN (COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(DISTINCT b.auction_id) * 100)
  ELSE 0
END as win_rate
```

### 3. Inconsistent Data Structure
The old implementation used in-memory grouping and calculations, which made it hard to match the Master Report's SQL-based approach.

## Solution Implemented

Rewrote `getVendorPerformanceData()` in `OperationalDataRepository` to use the **exact same SQL logic** as the Master Report:

```typescript
static async getVendorPerformanceData(filters: ReportFilters): Promise<VendorPerformanceData[]> {
  const startDate = filters.startDate || '2000-01-01';
  const endDate = filters.endDate || '2099-12-31';

  const results = await db.execute(sql`
    WITH vendor_payments AS (
      SELECT 
        v.id as vendor_id,
        COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as total_spent,
        COUNT(DISTINCT p.auction_id) as paid_auctions
      FROM vendors v
      LEFT JOIN payments p ON p.vendor_id = v.id AND p.status = 'verified'
      WHERE p.created_at >= ${startDate} AND p.created_at <= ${endDate}
      GROUP BY v.id
    )
    SELECT 
      v.id as vendor_id,
      v.business_name as vendor_name,
      v.tier,
      COUNT(DISTINCT b.auction_id) as auctions_participated,
      COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) as auctions_won,
      CASE 
        WHEN COUNT(DISTINCT b.auction_id) > 0 
        THEN (COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(DISTINCT b.auction_id) * 100)
        ELSE 0
      END as win_rate,
      COALESCE(vp.total_spent, 0) as total_spent,
      CASE 
        WHEN COUNT(b.id) > 0 
        THEN AVG(CAST(b.amount AS NUMERIC))
        ELSE 0
      END as avg_bid,
      COUNT(b.id) as total_bids
    FROM vendors v
    LEFT JOIN bids b ON v.id = b.vendor_id 
      AND b.created_at >= ${startDate}
      AND b.created_at <= ${endDate}
    LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
    LEFT JOIN vendor_payments vp ON v.id = vp.vendor_id
    GROUP BY v.id, v.business_name, v.tier, vp.total_spent, vp.paid_auctions
    HAVING COUNT(DISTINCT b.auction_id) > 0
    ORDER BY total_spent DESC, auctions_won DESC
    LIMIT 50
  `);
  
  // ... rest of implementation
}
```

## Verification Results

### Before Fix
```
The Vendor:
  Total Spent (All Bids): ₦13,592,000 ❌
  Win Rate: 37.04% ❌
  
Master:
  Total Spent (All Bids): ₦12,665,000 ❌
  Win Rate: 37.25% ❌
```

### After Fix
```
The Vendor:
  Total Spent: ₦3,392,000 ✅ (matches Master Report)
  Win Rate: 57.14% ✅ (matches Master Report)
  Wins: 20 ✅ (matches Master Report)
  
Master:
  Total Spent: ₦2,405,500 ✅ (matches Master Report)
  Win Rate: 51.35% ✅ (matches Master Report)
  Wins: 19 ✅ (matches Master Report)
```

## Files Modified

1. **src/features/reports/operational/repositories/operational-data.repository.ts**
   - Rewrote `getVendorPerformanceData()` method
   - Now uses same SQL logic as Master Report
   - Uses verified payments for totalSpent
   - Calculates win rate as wins / auctions_participated

## Testing

### Diagnostic Script
```bash
npx tsx scripts/diagnose-vendor-performance-report.ts
```
- Identified the exact differences between reports
- Confirmed root causes

### Verification Script
```bash
npx tsx scripts/verify-vendor-performance-report-fix.ts
```
- Verified all values now match Master Report
- Confirmed Total Spent, Win Rate, and Wins are identical

## Key Learnings

1. **Always use verified payments for revenue/spending**: Only `status = 'verified'` payments should be counted
2. **Win rate should be wins / auctions_participated**: Not wins / total_bids (a vendor can place multiple bids per auction)
3. **Consistency across reports is critical**: All reports should use the same calculation logic
4. **SQL-based calculations are more reliable**: Easier to maintain consistency than in-memory grouping

## Status

✅ **COMPLETE** - Vendor Performance Report now matches Master Report exactly.

---

**Date**: 2026-04-28
**Fixed By**: Kiro AI Assistant
**Verified**: All tests passing ✅
