# Duplicate Documents Fix - Complete

## Problem

When going offline/online during auction closure, multiple closure requests happen simultaneously, creating duplicate documents:
- 3x Bill of Sale
- 3x Liability Waiver
- Total: 6 documents instead of 2

## Root Cause

Race condition in document generation:

1. **Request 1** checks: "Does bill_of_sale exist?" → No
2. **Request 2** checks: "Does bill_of_sale exist?" → No (Request 1 hasn't inserted yet)
3. **Request 3** checks: "Does bill_of_sale exist?" → No (Requests 1 & 2 haven't inserted yet)
4. **Request 1** inserts bill_of_sale
5. **Request 2** inserts bill_of_sale (DUPLICATE!)
6. **Request 3** inserts bill_of_sale (DUPLICATE!)

This happens because:
- User goes offline → auction expires
- User comes back online → multiple closure requests fire
- All requests pass the "document exists" check before any completes the insert
- Result: 3x duplicates of each document type

## Solution

### 1. Database-Level Unique Constraint

Added UNIQUE constraint on `(auction_id, vendor_id, document_type)`:

```sql
ALTER TABLE release_forms 
ADD CONSTRAINT release_forms_auction_vendor_type_unique 
UNIQUE (auction_id, vendor_id, document_type);
```

This prevents duplicates at the database level - the second insert will fail with a unique constraint violation.

### 2. Graceful Conflict Handling

Updated `generateDocument()` in `src/features/documents/services/document.service.ts`:

```typescript
try {
  [document] = await db.insert(releaseForms).values({...}).returning();
} catch (insertError: any) {
  // Handle unique constraint violation
  if (insertError.code === '23505' || 
      insertError.message?.includes('duplicate key') || 
      insertError.message?.includes('unique constraint')) {
    
    console.log(`⚠️  Duplicate detected, fetching existing document...`);
    
    // Fetch and return existing document
    const [existingDoc] = await db
      .select()
      .from(releaseForms)
      .where(and(
        eq(releaseForms.auctionId, auctionId),
        eq(releaseForms.vendorId, vendorId),
        eq(releaseForms.documentType, documentType)
      ))
      .limit(1);
    
    return existingDoc;
  }
  throw insertError;
}
```

### 3. Existing Duplicate Prevention

The code already had duplicate prevention in `generateWinnerDocuments()`:

```typescript
// Check if documents already exist
const existingDocuments = await db
  .select()
  .from(releaseForms)
  .where(and(
    eq(releaseForms.auctionId, auctionId),
    eq(releaseForms.vendorId, vendorId)
  ));

const hasBillOfSale = existingTypes.includes('bill_of_sale');
const hasLiabilityWaiver = existingTypes.includes('liability_waiver');

if (hasBillOfSale && hasLiabilityWaiver) {
  console.log(`✅ All documents already exist. Skipping generation.`);
  return;
}
```

This works for sequential requests, but not for simultaneous requests (race condition).

## How It Works Now

### Scenario: User Goes Offline/Online During Auction Closure

1. **Request 1** checks: "Does bill_of_sale exist?" → No
2. **Request 2** checks: "Does bill_of_sale exist?" → No
3. **Request 3** checks: "Does bill_of_sale exist?" → No
4. **Request 1** tries to insert → SUCCESS (first one wins)
5. **Request 2** tries to insert → FAILS (unique constraint violation)
   - Catches error
   - Fetches existing document from Request 1
   - Returns existing document
6. **Request 3** tries to insert → FAILS (unique constraint violation)
   - Catches error
   - Fetches existing document from Request 1
   - Returns existing document

Result: Only 1 document created, all requests succeed with the same document.

## Fix Script

Run this script to:
1. Remove existing duplicates (keeps oldest)
2. Add unique constraint

```bash
npx tsx scripts/fix-duplicate-documents.ts
```

The script:
- Finds all duplicate documents
- Deletes duplicates (keeps oldest by `created_at`)
- Adds UNIQUE constraint to prevent future duplicates
- Safe to run multiple times (idempotent)

## Testing

### Test Duplicate Prevention:

```typescript
// Try to create duplicate documents
const doc1 = await generateDocument(auctionId, vendorId, 'bill_of_sale', 'system');
const doc2 = await generateDocument(auctionId, vendorId, 'bill_of_sale', 'system');

// Both should return the same document ID
expect(doc1.id).toBe(doc2.id);
```

### Test Offline/Online Scenario:

1. Start auction
2. Place winning bid
3. Go offline
4. Wait for auction to expire
5. Come back online
6. Check documents → Should see exactly 2 documents (not 6)

## Files Modified

### 1. `src/features/documents/services/document.service.ts`
- Added unique constraint violation handling
- Returns existing document on conflict
- Logs duplicate detection for monitoring

### 2. `scripts/fix-duplicate-documents.ts` (NEW)
- Finds and removes existing duplicates
- Adds UNIQUE constraint
- Safe to run multiple times

### 3. `docs/DUPLICATE_DOCUMENTS_FIX.md` (NEW)
- Complete documentation of the fix

## Database Schema

### Before:
```sql
CREATE TABLE release_forms (
  id UUID PRIMARY KEY,
  auction_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  ...
);
-- No unique constraint - duplicates possible
```

### After:
```sql
CREATE TABLE release_forms (
  id UUID PRIMARY KEY,
  auction_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  ...
  CONSTRAINT release_forms_auction_vendor_type_unique 
    UNIQUE (auction_id, vendor_id, document_type)
);
-- Unique constraint prevents duplicates
```

## Benefits

1. **Database-Level Protection**: Duplicates are impossible at the database level
2. **Graceful Handling**: Application handles conflicts without errors
3. **Idempotent**: Safe to call `generateDocument()` multiple times
4. **Race Condition Safe**: Works correctly even with simultaneous requests
5. **Offline/Online Safe**: Handles network interruptions gracefully

## Monitoring

Check logs for duplicate detection:
```
⚠️  Duplicate document detected during insert: bill_of_sale for auction abc123
   - This is expected during race conditions (offline/online, multiple closure requests)
   - Fetching existing document instead...
✅ Using existing document: doc-xyz (status: pending)
```

This is normal and expected - it means the fix is working correctly.

## Summary

The duplicate documents issue is now completely fixed:
- ✅ Database constraint prevents duplicates
- ✅ Application handles conflicts gracefully
- ✅ Existing duplicates can be cleaned up with script
- ✅ Works correctly with offline/online scenarios
- ✅ Safe for simultaneous closure requests

No more 6 documents when you expect 2!
