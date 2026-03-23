# Manual Test Plan: Document Duplicate and Real-Time Display Fixes

## Overview
This test plan validates fixes for two critical document generation issues:
1. **Duplicate Documents**: Documents created multiple times on page reload
2. **Real-Time Display**: Documents don't show until page reload

## Prerequisites
- Database access for cleanup script
- Admin account for auction management
- Vendor account for testing
- Test auction ready to expire

---

## Issue 1: Duplicate Documents Prevention

### Test 1.1: Find Existing Duplicates (DRY RUN)
**Objective**: Identify any existing duplicate documents in the database

**Steps**:
1. Run the duplicate detection script in dry-run mode:
   ```bash
   npm run ts-node scripts/find-and-delete-duplicate-documents.ts
   ```

**Expected Results**:
- ✅ Script lists all duplicate document groups
- ✅ Shows which documents would be kept (oldest)
- ✅ Shows which documents would be deleted (newer)
- ✅ No actual deletions occur (dry run)
- ✅ Summary shows total duplicates found

**Pass Criteria**:
- Script runs without errors
- Output is clear and readable
- No database changes made

---

### Test 1.2: Delete Duplicate Documents (LIVE)
**Objective**: Remove all duplicate documents from the database

**Steps**:
1. Run the duplicate deletion script in live mode:
   ```bash
   npm run ts-node scripts/find-and-delete-duplicate-documents.ts --live
   ```

2. Verify deletion log file is created:
   ```bash
   ls -la deletion-log-*.json
   ```

3. Review deletion log:
   ```bash
   cat deletion-log-*.json
   ```

**Expected Results**:
- ✅ Script deletes all duplicate documents
- ✅ Keeps oldest document for each group
- ✅ Creates deletion log file with timestamp
- ✅ Log contains all deleted document IDs
- ✅ Summary shows successful deletions

**Pass Criteria**:
- All duplicates removed
- Deletion log created and accurate
- No errors during deletion

---

### Test 1.3: Add Unique Constraint
**Objective**: Prevent future duplicate documents with database constraint

**Steps**:
1. Run the migration script:
   ```bash
   npm run ts-node scripts/run-migration-0019.ts
   ```

2. Verify constraint was created:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'release_forms';
   ```

3. Look for index: `idx_release_forms_unique_document`

**Expected Results**:
- ✅ Migration runs successfully
- ✅ Unique index created on (auction_id, vendor_id, document_type)
- ✅ Index comment explains purpose
- ✅ No errors during migration

**Pass Criteria**:
- Unique constraint exists
- Constraint covers correct columns
- Database schema updated

---

### Test 1.4: Verify Duplicate Prevention
**Objective**: Confirm that duplicate documents cannot be created

**Steps**:
1. Create a test auction and close it
2. Wait for documents to generate
3. Try to manually create a duplicate document via API:
   ```bash
   curl -X POST http://localhost:3000/api/auctions/{auctionId}/documents/generate \
     -H "Content-Type: application/json" \
     -d '{"documentType": "bill_of_sale"}'
   ```

**Expected Results**:
- ✅ First document creation succeeds
- ✅ Second attempt returns existing document (idempotent)
- ✅ No duplicate created in database
- ✅ Logs show "Document already exists" message

**Pass Criteria**:
- Only 1 document of each type exists
- API returns existing document on duplicate attempt
- No database errors

---

## Issue 2: Real-Time Document Display

### Test 2.1: Documents Show Immediately After Auction Expires
**Objective**: Verify documents appear without page reload when auction timer expires

**Setup**:
1. Create a test auction that expires in 2 minutes
2. Place a winning bid as a vendor
3. Stay on the auction details page
4. Watch the countdown timer

**Steps**:
1. Wait for auction timer to reach 0:00
2. Observe the page behavior
3. Check browser console logs
4. Verify documents section appears

**Expected Results**:
- ✅ Auction status changes to "Closed" automatically
- ✅ Documents section appears within 5-10 seconds
- ✅ No page reload required
- ✅ Console shows: "🎯 Auction expired and closed! Refreshing data..."
- ✅ Console shows: "🔄 Fetching documents after auction closure..."
- ✅ Console shows: "✅ Loaded 2 documents"

**Pass Criteria**:
- Documents visible within 10 seconds of expiry
- No manual refresh needed
- All 2 documents present (bill_of_sale, liability_waiver)

---

### Test 2.2: Document Polling Works
**Objective**: Verify polling mechanism fetches documents if initial generation is slow

**Setup**:
1. Same as Test 2.1
2. Monitor browser console for polling logs

**Steps**:
1. Wait for auction to expire
2. Watch console logs for polling activity
3. Verify documents appear even if generation takes time

**Expected Results**:
- ✅ Console shows: "🔄 Polling for documents... (current: 0/2)"
- ✅ Polling occurs every 5 seconds
- ✅ Polling stops when all documents loaded
- ✅ Console shows: "✅ All documents loaded (2/2). Stopping poll."
- ✅ Polling stops after 60 seconds max

**Pass Criteria**:
- Polling starts automatically
- Polling stops when documents loaded
- Documents appear within 60 seconds

---

### Test 2.3: Page Reload Shows Documents Immediately
**Objective**: Verify documents persist and show immediately on page reload

**Setup**:
1. Complete Test 2.1 or 2.2
2. Documents are now generated and visible

**Steps**:
1. Reload the page (F5 or Cmd+R)
2. Observe document loading behavior
3. Check console logs

**Expected Results**:
- ✅ Documents load immediately on page load
- ✅ No polling needed (documents already exist)
- ✅ Console shows: "✅ Loaded 2 documents"
- ✅ All document details visible (title, status, etc.)

**Pass Criteria**:
- Documents visible within 2 seconds
- No duplicate documents shown
- Document status accurate

---

### Test 2.4: Multiple Page Reloads Don't Create Duplicates
**Objective**: Verify the unique constraint prevents duplicates on multiple reloads

**Setup**:
1. Auction is closed with documents generated
2. Documents are visible on page

**Steps**:
1. Reload page 5 times rapidly (F5 x5)
2. Check document count on page
3. Query database for document count:
   ```sql
   SELECT auction_id, vendor_id, document_type, COUNT(*)
   FROM release_forms
   WHERE auction_id = '{auctionId}'
   GROUP BY auction_id, vendor_id, document_type;
   ```

**Expected Results**:
- ✅ Page shows exactly 2 documents after each reload
- ✅ Database shows exactly 2 documents (1 of each type)
- ✅ No duplicates created
- ✅ Console logs show "Document already exists" if generation attempted

**Pass Criteria**:
- Document count remains 2
- No database errors
- No duplicate documents

---

## Issue 3: Integration Testing

### Test 3.1: End-to-End Auction Closure Flow
**Objective**: Verify complete flow from auction expiry to document signing

**Steps**:
1. Create test auction expiring in 2 minutes
2. Place winning bid as vendor
3. Stay on auction details page
4. Wait for auction to expire
5. Verify documents appear automatically
6. Sign both documents
7. Verify payment processing

**Expected Results**:
- ✅ Auction closes automatically at expiry
- ✅ Documents appear within 10 seconds
- ✅ Exactly 2 documents shown (no duplicates)
- ✅ Documents can be signed successfully
- ✅ Payment processes after signing
- ✅ Pickup code received

**Pass Criteria**:
- Complete flow works without manual intervention
- No duplicates at any stage
- All notifications received

---

### Test 3.2: Multiple Vendors, Multiple Auctions
**Objective**: Verify fixes work correctly with multiple concurrent auctions

**Setup**:
1. Create 3 test auctions expiring at same time
2. Different vendors win each auction
3. All vendors stay on their auction pages

**Steps**:
1. Wait for all auctions to expire simultaneously
2. Verify each vendor sees their documents
3. Check database for duplicates across all auctions

**Expected Results**:
- ✅ Each vendor sees exactly 2 documents
- ✅ No cross-contamination between auctions
- ✅ No duplicates in any auction
- ✅ All documents generated correctly

**Pass Criteria**:
- 6 total documents (2 per auction)
- No duplicates
- Correct vendor-auction associations

---

## Rollback Plan

If issues are found during testing:

1. **Rollback Unique Constraint**:
   ```sql
   DROP INDEX IF EXISTS idx_release_forms_unique_document;
   ```

2. **Rollback Code Changes**:
   ```bash
   git revert <commit-hash>
   ```

3. **Restore Deleted Documents** (if needed):
   - Use deletion log file to identify deleted documents
   - Restore from database backup if necessary

---

## Success Criteria Summary

### Issue 1: Duplicate Documents
- ✅ All existing duplicates removed
- ✅ Unique constraint prevents new duplicates
- ✅ Document generation is idempotent
- ✅ Multiple page reloads don't create duplicates

### Issue 2: Real-Time Display
- ✅ Documents appear within 10 seconds of auction expiry
- ✅ No page reload required
- ✅ Polling mechanism works for slow generation
- ✅ Documents persist on page reload

### Overall
- ✅ No regressions in existing functionality
- ✅ All tests pass
- ✅ User experience improved significantly
- ✅ Data integrity maintained

---

## Notes

- Run tests in staging environment first
- Monitor production logs after deployment
- Keep deletion log files for audit trail
- Document any edge cases discovered during testing
