# Dashboard Data Quality - Quick Fix Guide

## Quick Summary

Fixed 4 data quality issues in the Intelligence Dashboard:

| Issue | Before | After | Fix Type |
|-------|--------|-------|----------|
| Regional Demand | 10000% | 100% | UI fix |
| Regional Variance | ±31625939% | ±83.2% | DB + UI fix |
| Trending Assets Trend | 0% | 0% | Documented (no tracking) |
| Trending Assets Sell-Through | 0% | 20-95% | DB fix |

---

## Quick Fix Commands

### 1. Run the Fix
```bash
npx tsx scripts/fix-dashboard-data-quality.ts
```

### 2. Verify the Fix
```bash
npx t