# Duplicate Documents - Quick Fix Guide

## Problem
Going offline/online during auction closure creates 6 documents instead of 2 (3x bill_of_sale, 3x liability_waiver).

## Quick Fix

### Step 1: Run the Fix Script
```bash
npx tsx scripts/fix-duplicate-documents.ts
```

This will:
- ✅ Find and delete duplicate documents (keeps oldest)
- ✅ Add database UNIQUE constraint to prevent future duplicates
- ✅ Safe to run multiple times

### Step 2: Verify
Check your auction documents - you should now see exactly 2 documents:
- 1x Bill of Sale
- 1x Liability Waiver

## What Was Fixed

### Code Changes:
1. **Database Constraint**: Added UNIQUE constraint on `(auction_id, vendor_id, document_type)`
2. **Conflict Handling**: Updated `generateDocument()` to handle duplicate inserts gracefully

### How It Works:
- Database prevents duplicate inserts
- If duplicate is attempted, code fetches and returns existing document
- No errors, no duplicates, works with offline/online scenarios

## Testing
Try going offline/online during auction closure - you'll still get exactly 2 documents.

## Files Changed
- `src/features/documents/services/document.service.ts` - Added conflict handling
- `scripts/fix-duplicate-documents.ts` - Cleanup script
- Database: Added UNIQUE constraint

## Done!
The issue is completely fixed. No more duplicate documents.
