# Manual Test Plan: Document Generation Error Logging

## Overview
Test plan to verify that document generation failures are properly logged to the audit log system with full error context.

## Prerequisites
- Access to admin or finance officer account
- Access to audit log viewing interface
- Test auction that can be closed
- Database access to verify audit log entries

## Test Cases

### Test Case 1: Successful Document Generation
**Objective:** Verify successful document generation is logged to audit log

**Steps:**
1. Create a test auction with a winning bidder
2. Wait for auction to end or manually close it
3. Verify documents are generated successfully
4. Check audit logs for the vendor user

**Expected Results:**
- Two `DOCUMENT_GENERATED` audit log entries (one for each document type)
- Each entry should contain:
  - `actionType`: `DOCUMENT_GENERATED`
  - `entityType`: `AUCTION`
  - `entityId`: auction ID
  - `afterState.documentType`: `bill_of_sale` or `liability_waiver`
  - `afterState.documentId`: generated document ID
  - `afterState.vendorId`: vendor ID
  - `afterState.timestamp`: ISO timestamp

**SQL Query to Verify:**
```sql
SELECT 
  id,
  user_id,
  action_type,
  entity_type,
  entity_id,
  after_state,
  created_at
FROM audit_logs
WHERE 
  action_type = 'document_generated'
  AND entity_id = 'YOUR_AUCTION_ID'
ORDER BY created_at DESC;
```

---

### Test Case 2: Document Generation Failure (All Documents Fail)
**Objective:** Verify document generation failures are logged with full error context

**Setup:**
- Temporarily break document generation (e.g., invalid template path, database connection issue)
- Or use a test auction with invalid data

**Steps:**
1. Create a test auction with a winning bidder
2. Close the auction
3. Observe document generation failures in console logs
4. Check audit logs for failure entries

**Expected Results:**
- Multiple `DOCUMENT_GENERATION_FAILED` audit log entries (one per retry attempt per document)
- Each retry entry should contain:
  - `actionType`: `DOCUMENT_GENERATION_FAILED`
  - `entityType`: `AUCTION`
  - `entityId`: auction ID
  - `afterState.error`: error message
  - `afterState.stackTrace`: full stack trace
  - `afterState.documentType`: document type that failed
  - `afterState.vendorId`: vendor ID
  - `afterState.retryAttempt`: attempt number (1, 2, or 3)
  - `afterState.maxRetries`: 3
  - `afterState.willRetry`: true/false
  - `afterState.timestamp`: ISO timestamp

- One overall failure entry should contain:
  - `afterState.error`: "One or more documents failed to generate"
  - `afterState.successCount`: 0
  - `afterState.totalCount`: 2
  - `afterState.failedDocuments`: array of failed documents with errors

**SQL Query to Verify:**
```sql
SELECT 
  id,
  user_id,
  action_type,
  entity_type,
  entity_id,
  after_state,
  created_at
FROM audit_logs
WHERE 
  action_type = 'document_generation_failed'
  AND entity_id = 'YOUR_AUCTION_ID'
ORDER BY created_at DESC;
```

---

### Test Case 3: Partial Document Generation Failure
**Objective:** Verify partial failures are logged correctly (one document succeeds, one fails)

**Setup:**
- Configure system to fail only one document type (e.g., liability_waiver)
- Or manually delete one document template

**Steps:**
1. Create a test auction with a winning bidder
2. Close the auction
3. Observe that one document succeeds and one fails
4. Check audit logs for both success and failure entries

**Expected Results:**
- One `DOCUMENT_GENERATED` entry for the successful document
- Multiple `DOCUMENT_GENERATION_FAILED` entries for the failed document (one per retry)
- One overall failure entry with:
  - `afterState.successCount`: 1
  - `afterState.totalCount`: 2
  - `afterState.failedDocuments`: array with one failed document

**SQL Query to Verify:**
```sql
SELECT 
  id,
  user_id,
  action_type,
  entity_type,
  entity_id,
  after_state,
  created_at
FROM audit_logs
WHERE 
  entity_id = 'YOUR_AUCTION_ID'
  AND action_type IN ('document_generated', 'document_generation_failed')
ORDER BY created_at DESC;
```

---

### Test Case 4: Retry Logic Verification
**Objective:** Verify retry attempts are logged correctly

**Setup:**
- Configure system to fail first 2 attempts but succeed on 3rd
- Or use intermittent network/database issues

**Steps:**
1. Create a test auction with a winning bidder
2. Close the auction
3. Observe retry attempts in console logs
4. Check audit logs for retry entries

**Expected Results:**
- Two `DOCUMENT_GENERATION_FAILED` entries with:
  - `afterState.retryAttempt`: 1 and 2
  - `afterState.willRetry`: true
- One `DOCUMENT_GENERATED` entry with:
  - `afterState.retryAttempt`: 3 (indicating success after retries)

**Console Output to Verify:**
```
⚠️  Retry 1/3 for bill_of_sale after 2000ms...
⚠️  Retry 2/3 for bill_of_sale after 4000ms...
✅ Bill of Sale generated for auction [auction-id]
```

---

### Test Case 5: Admin/Finance Dashboard Visibility
**Objective:** Verify admins and finance officers can see document generation failures

**Steps:**
1. Log in as admin or finance officer
2. Navigate to audit logs or system logs page
3. Filter by `DOCUMENT_GENERATION_FAILED` action type
4. Search for specific auction ID or vendor ID
5. View detailed error information

**Expected Results:**
- Audit logs are visible in the dashboard
- Can filter by action type, entity type, date range
- Can view full error details including stack traces
- Can identify which vendor and auction were affected
- Can see retry attempts and success/failure counts

---

### Test Case 6: Error Context Completeness
**Objective:** Verify all required error context is captured

**Steps:**
1. Trigger a document generation failure
2. Query the audit log entry
3. Verify all fields are present and populated

**Expected Fields in `afterState`:**
- ✅ `error`: Error message string
- ✅ `stackTrace`: Full stack trace (if available)
- ✅ `documentType`: Document type that failed
- ✅ `vendorId`: Vendor ID
- ✅ `timestamp`: ISO timestamp
- ✅ `retryAttempt`: Attempt number
- ✅ `maxRetries`: Maximum retries
- ✅ `willRetry`: Boolean indicating if more retries will occur

**For Overall Failure:**
- ✅ `successCount`: Number of successful documents
- ✅ `totalCount`: Total number of documents
- ✅ `failedDocuments`: Array of failed documents with errors

---

## Verification Queries

### Count Document Generation Events by Type
```sql
SELECT 
  action_type,
  COUNT(*) as count
FROM audit_logs
WHERE 
  action_type IN ('document_generated', 'document_generation_failed')
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY action_type;
```

### Find All Failed Document Generations
```sql
SELECT 
  id,
  user_id,
  entity_id as auction_id,
  after_state->>'documentType' as document_type,
  after_state->>'error' as error_message,
  after_state->>'retryAttempt' as retry_attempt,
  created_at
FROM audit_logs
WHERE 
  action_type = 'document_generation_failed'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Find Auctions with Document Generation Issues
```sql
SELECT 
  entity_id as auction_id,
  user_id as vendor_user_id,
  COUNT(*) as failure_count,
  MAX(created_at) as last_failure
FROM audit_logs
WHERE 
  action_type = 'document_generation_failed'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY entity_id, user_id
ORDER BY failure_count DESC;
```

### View Complete Error Details for Specific Auction
```sql
SELECT 
  id,
  action_type,
  after_state,
  created_at
FROM audit_logs
WHERE 
  entity_id = 'YOUR_AUCTION_ID'
  AND action_type IN ('document_generated', 'document_generation_failed')
ORDER BY created_at ASC;
```

---

## Success Criteria

- [ ] Successful document generation is logged to audit log
- [ ] Failed document generation is logged with full error context
- [ ] Retry attempts are logged separately
- [ ] Overall generation failures include summary information
- [ ] Stack traces are captured when available
- [ ] Admins/finance can view logs in dashboard
- [ ] All required fields are present in audit log entries
- [ ] Partial failures are handled correctly
- [ ] Existing functionality is not broken

---

## Troubleshooting

### Issue: No audit log entries found
**Possible Causes:**
- Audit logging is disabled
- Database connection issue
- Audit log table doesn't exist

**Solution:**
- Check audit logger configuration
- Verify database connection
- Run database migrations

### Issue: Missing error context in audit logs
**Possible Causes:**
- Error object is not an instance of Error
- Stack trace not available in production

**Solution:**
- Verify error handling in code
- Check error serialization
- Review production error logging configuration

### Issue: Too many audit log entries
**Possible Causes:**
- Retry logic creating multiple entries (expected behavior)
- Multiple concurrent closure attempts

**Solution:**
- This is expected - each retry creates an entry
- Review idempotency checks in closure service
- Check for duplicate cron job executions

---

## Notes

- Document generation happens during auction closure (cron job)
- Retry logic: 3 attempts with exponential backoff (2s, 4s, 8s)
- Two documents are generated: Bill of Sale and Liability Waiver
- Pickup Authorization is generated later after payment
- Audit logs use vendor's user ID, not vendor ID
- All timestamps are in ISO 8601 format
