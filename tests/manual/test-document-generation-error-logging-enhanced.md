# Manual Test: Enhanced Document Generation Error Logging

## Overview
Test the enhanced error logging and monitoring for document generation failures to ensure all failures are logged to the audit trail with full context.

## Prerequisites
- Access to admin account
- Access to finance officer account
- Access to database to check audit logs
- Test auction data

## Test Scenarios

### Test 1: Auction Closure Document Generation Failure

**Objective**: Verify document generation failures during auction closure are logged to audit trail

**Steps**:
1. Create a test auction with a winner
2. Modify the document generation service to simulate a failure (or use invalid data)
3. Trigger auction closure (manually or via cron)
4. Check console logs for detailed error information
5. Query audit logs table for `document_generation_failed` entries

**Expected Results**:
- ✅ Console shows detailed error with auction ID, vendor ID, error message, stack trace
- ✅ Audit log entry created with:
  - `actionType: 'document_generation_failed'`
  - `entityType: 'auction'`
  - `entityId: <auction_id>`
  - `afterState` contains: error, stackTrace, documentType, vendorId, timestamp, context
  - Context: `auction_closure` or `document_generation_with_retry` or `generate_winner_documents`

**SQL Query**:
```sql
SELECT * FROM audit_logs 
WHERE action_type = 'document_generation_failed' 
AND entity_id = '<auction_id>'
ORDER BY created_at DESC;
```

### Test 2: Missing Documents Cron Job

**Objective**: Verify missing documents cron logs failures to audit trail

**Steps**:
1. Create a closed auction with missing documents
2. Run the missing documents cron job: `npm run cron:check-missing-documents`
3. Simulate a document generation failure
4. Check console logs
5. Query audit logs

**Expected Results**:
- ✅ Console shows regeneration attempt and failure
- ✅ Audit log entry created with:
  - `userAgent: 'cron-job-missing-documents'`
  - Context: `missing_documents_cron_regeneration`
  - All error details included

**SQL Query**:
```sql
SELECT * FROM audit_logs 
WHERE action_type = 'document_generation_failed' 
AND user_agent = 'cron-job-missing-documents'
ORDER BY created_at DESC;
```

### Test 3: Admin Manual Document Generation

**Objective**: Verify admin manual document generation logs to audit trail

**Steps**:
1. Login as admin
2. Navigate to auction details page
3. Click "Generate Documents" button
4. Simulate a failure (or use invalid auction)
5. Check response and audit logs

**Expected Results**:
- ✅ API response includes error details
- ✅ Audit log entry created with:
  - Context: `admin_manual_generation`
  - `adminUserId` field present
  - All error details included

**SQL Query**:
```sql
SELECT * FROM audit_logs 
WHERE action_type = 'document_generation_failed' 
AND after_state->>'context' = 'admin_manual_generation'
ORDER BY created_at DESC;
```

### Test 4: Payment Verification Pickup Authorization

**Objective**: Verify pickup authorization generation failures are logged

**Steps**:
1. Login as finance officer
2. Navigate to payments page
3. Verify a payment
4. Simulate pickup authorization generation failure
5. Check audit logs

**Expected Results**:
- ✅ Payment verification succeeds even if document fails
- ✅ Audit log entry created with:
  - Context: `payment_verification_pickup_auth`
  - `paymentId` field present
  - All error details included

**SQL Query**:
```sql
SELECT * FROM audit_logs 
WHERE action_type = 'document_generation_failed' 
AND after_state->>'context' = 'payment_verification_pickup_auth'
ORDER BY created_at DESC;
```

### Test 5: Retry Logic Logging

**Objective**: Verify retry attempts are logged correctly

**Steps**:
1. Trigger document generation that will fail and retry
2. Check console logs for retry messages
3. Query audit logs for all retry attempts

**Expected Results**:
- ✅ Console shows retry attempts with delays (2s, 4s, 8s)
- ✅ Multiple audit log entries for each retry attempt
- ✅ Each entry includes:
  - `retryAttempt` field (1, 2, 3)
  - `maxRetries` field (3)
  - `willRetry` field (true/false)

**SQL Query**:
```sql
SELECT 
  entity_id,
  after_state->>'documentType' as document_type,
  after_state->>'retryAttempt' as retry_attempt,
  after_state->>'willRetry' as will_retry,
  after_state->>'error' as error,
  created_at
FROM audit_logs 
WHERE action_type = 'document_generation_failed' 
AND after_state->>'context' = 'document_generation_with_retry'
ORDER BY created_at DESC;
```

## Verification Checklist

### Console Logging
- [ ] Error messages include auction ID
- [ ] Error messages include vendor ID
- [ ] Error messages include document type
- [ ] Error messages include error details
- [ ] Stack traces are logged (when available)
- [ ] Context is clear from log messages

### Audit Trail Logging
- [ ] All failures create audit log entries
- [ ] `actionType` is `document_generation_failed`
- [ ] `entityType` is `auction`
- [ ] `entityId` is the auction ID
- [ ] `afterState` contains all required fields:
  - [ ] error
  - [ ] documentType
  - [ ] vendorId
  - [ ] timestamp
  - [ ] context
- [ ] Stack traces included (when available)
- [ ] Context identifiers are correct
- [ ] Additional context fields present (retry info, payment ID, admin ID, etc.)

### Admin Dashboard
- [ ] Admins can view document generation failures in system logs
- [ ] Logs are searchable by auction ID
- [ ] Logs are searchable by vendor ID
- [ ] Logs are searchable by document type
- [ ] Error messages are clear and actionable

### Finance Dashboard
- [ ] Finance officers can see document generation failures
- [ ] Failures are visible in audit trail
- [ ] Can filter by date range
- [ ] Can export logs for reporting

## Success Criteria

All tests pass with:
1. ✅ Detailed error information logged to console
2. ✅ All failures logged to audit trail
3. ✅ Full context included (auction ID, vendor ID, document type, error, stack trace)
4. ✅ Context identifiers correct
5. ✅ Admins can view failures in dashboard
6. ✅ No application crashes due to logging failures

## Notes

- Logging is non-blocking - failures to log don't break the application
- Stack traces are optional and only included when available
- Context identifiers help filter and analyze errors
- Audit trail entries are permanent
- Console logging is preserved for immediate visibility

## Troubleshooting

### Issue: No audit log entries created
**Solution**: Check database connection and audit_logs table permissions

### Issue: Stack traces not included
**Solution**: This is expected for non-Error objects. Stack traces only included for Error instances.

### Issue: Console logs not showing
**Solution**: Check log level configuration and ensure console.error is not suppressed

### Issue: Missing context fields
**Solution**: Verify the specific context and check if additional fields are expected for that context

---

**Test Date**: _____________
**Tester**: _____________
**Result**: ⬜ Pass ⬜ Fail
**Notes**: _____________
