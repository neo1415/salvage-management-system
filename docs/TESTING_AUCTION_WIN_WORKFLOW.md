# Testing Guide: Auction Win Workflow Fixes

## Quick Test Checklist

### 1. Test Document Visibility (Primary Issue)

**Scenario:** Vendor wins auction and should see documents on `/vendor/documents` page

**Steps:**
1. Create and close an auction with a winner
2. Wait 5-10 seconds for async document generation
3. Login as the winning vendor
4. Navigate to `/vendor/documents`
5. **Expected:** See 3 pending documents (Bill of Sale, Liability Waiver, Pickup Authorization)
6. **Previously:** Showed "No Documents Yet" even though logs showed documents generated

**Debug if fails:**
```bash
npx tsx scripts/debug-document-visibility.ts <auctionId>
```

---

### 2. Test Payment Record Creation

**Scenario:** Payment record should be created automatically when auction closes

**Steps:**
1. Create and close an auction with a winner
2. Check database for payment record:
   ```sql
   SELECT * FROM payments WHERE auction_id = '<auctionId>';
   ```
3. **Expected:** Payment record exists with:
   - Status: 'pending'
   - Method: 'escrow_wallet'
   - Amount: winning bid
   - Deadline: 24 hours from closure

**Debug if fails:**
- Check auction closure logs
- Check audit logs for closure errors
- Verify auction status is 'closed'

---

### 3. Test Manual Notification Sending

**Scenario:** Admin can manually send notification if automatic sending failed

**Steps:**
1. Close an auction with a winner
2. As admin, try to send notification:
   ```bash
   POST /api/admin/auctions/<auctionId>/send-notification
   ```
3. **Expected:** 
   - If payment exists: Notification sent successfully
   - If payment missing: Clear error message with troubleshooting steps

**Previous Issue:** Generic error "no payment transaction found" without context

**New Behavior:** Detailed error with:
- Auction status
- Winner information
- Troubleshooting suggestions
- Next steps

---

### 4. Test Document Generation Scope

**Scenario:** Documents should ONLY be generated for the winner, not all vendors

**Steps:**
1. Create auction with multiple bidders
2. Close auction (winner = highest bidder)
3. Check documents in database:
   ```sql
   SELECT vendor_id, document_type, COUNT(*) 
   FROM release_forms 
   WHERE auction_id = '<auctionId>' 
   GROUP BY vendor_id, document_type;
   ```
4. **Expected:** Only winner's vendor_id appears (3 documents)
5. **Verify:** No documents for other bidders

---

### 5. Test End-to-End Workflow

**Complete workflow from auction close to document signing:**

1. **Create Test Auction:**
   ```bash
   # As admin
   POST /api/admin/auctions
   {
     "caseId": "<caseId>",
     "startingBid": 100000,
     "duration": 1 // 1 hour for quick testing
   }
   ```

2. **Place Winning Bid:**
   ```bash
   # As vendor
   POST /api/auctions/<auctionId>/bids
   {
     "amount": 150000
   }
   ```

3. **Wait for Auction to Close:**
   - Either wait for endTime
   - Or manually close via admin panel

4. **Verify Automatic Actions:**
   - ✅ Payment record created
   - ✅ Documents generated (3 documents)
   - ✅ Notifications sent (SMS, Email, In-App)
   - ✅ Auction status = 'closed'

5. **Check Vendor Experience:**
   - Login as winning vendor
   - Navigate to `/vendor/documents`
   - Should see 3 pending documents
   - Click "Sign Document" on each
   - Should receive pickup authorization code

6. **Check Payment Flow:**
   - Navigate to `/vendor/payments/<paymentId>`
   - Should see payment details
   - Should be able to initiate payment

---

## Diagnostic Commands

### Check Auction Status
```sql
SELECT 
  a.id,
  a.status,
  a.current_bidder,
  a.current_bid,
  a.end_time,
  v.id as vendor_id,
  u.full_name as winner_name
FROM auctions a
LEFT JOIN vendors v ON a.current_bidder = v.id
LEFT JOIN users u ON v.user_id = u.id
WHERE a.id = '<auctionId>';
```

### Check Payment Record
```sql
SELECT 
  p.id,
  p.status,
  p.amount,
  p.payment_method,
  p.escrow_status,
  p.payment_deadline,
  p.created_at
FROM payments p
WHERE p.auction_id = '<auctionId>';
```

### Check Documents
```sql
SELECT 
  rf.id,
  rf.document_type,
  rf.status,
  rf.vendor_id,
  rf.pdf_url IS NOT NULL as has_pdf,
  rf.created_at,
  rf.signed_at
FROM release_forms rf
WHERE rf.auction_id = '<auctionId>'
ORDER BY rf.created_at DESC;
```

### Check Notifications
```sql
SELECT 
  n.id,
  n.type,
  n.title,
  n.is_read,
  n.created_at
FROM notifications n
WHERE n.user_id = '<userId>'
  AND n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC;
```

### Check Audit Logs
```sql
SELECT 
  al.action_type,
  al.entity_type,
  al.entity_id,
  al.after_state,
  al.created_at
FROM audit_logs al
WHERE al.entity_id = '<auctionId>'
  AND al.action_type IN (
    'auction_closed',
    'document_generation_failed',
    'notification_failed'
  )
ORDER BY al.created_at DESC;
```

---

## Common Issues & Solutions

### Issue: Documents not visible to vendor

**Diagnosis:**
```bash
npx tsx scripts/debug-document-visibility.ts <auctionId>
```

**Common Causes:**
1. Documents not generated (check logs)
2. Wrong vendor ID (check database)
3. API response format issue (fixed in this PR)
4. Session missing vendorId (re-login)

**Solutions:**
1. Manually trigger generation: `POST /api/admin/auctions/<auctionId>/generate-documents`
2. Check audit logs for errors
3. Verify session has vendorId
4. Clear browser cache

---

### Issue: "No payment record found" error

**Diagnosis:**
```sql
SELECT * FROM payments WHERE auction_id = '<auctionId>';
```

**Common Causes:**
1. Auction not closed yet
2. Closure failed (check logs)
3. Payment creation failed

**Solutions:**
1. Wait for automatic closure
2. Manually close auction
3. Check audit logs for closure errors
4. If closure succeeded but no payment, report bug

---

### Issue: Notifications not received

**Diagnosis:**
```sql
SELECT * FROM audit_logs 
WHERE entity_id = '<auctionId>' 
  AND action_type = 'notification_failed';
```

**Common Causes:**
1. SMS service down
2. Email service down
3. Invalid phone/email

**Solutions:**
1. Manually retry: `POST /api/admin/auctions/<auctionId>/send-notification`
2. Check SMS/Email service status
3. Verify vendor contact details
4. Check audit logs for specific error

---

## Performance Testing

### Test Concurrent Auction Closures

**Scenario:** Multiple auctions close at the same time

**Steps:**
1. Create 10 auctions ending at the same time
2. Place bids on all
3. Wait for cron job to close them
4. Verify all closures succeeded

**Expected:**
- All auctions closed
- All payment records created
- All documents generated
- All notifications sent

**Monitor:**
- Database connection pool
- API response times
- Memory usage
- Error logs

---

## Regression Testing

### Verify No Breaking Changes

**Test Cases:**
1. ✅ Existing auctions still work
2. ✅ Bidding still works
3. ✅ Payment flow still works
4. ✅ Document signing still works
5. ✅ Admin panel still works
6. ✅ Vendor dashboard still works

**Run Full Test Suite:**
```bash
npm run test
npm run test:integration
npm run test:e2e
```

---

## Success Criteria

### All Tests Pass When:

1. ✅ Vendor can see documents on `/vendor/documents` page
2. ✅ Documents are only generated for winner (not all vendors)
3. ✅ Payment record is created automatically on closure
4. ✅ Manual notification sending works with clear error messages
5. ✅ Diagnostic script provides useful troubleshooting info
6. ✅ Audit logs capture failures for admin visibility
7. ✅ No TypeScript errors
8. ✅ No breaking changes to existing functionality

---

## Rollback Plan

If issues are found in production:

1. **Immediate Rollback:**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Manual Workarounds:**
   - Use admin panel to manually generate documents
   - Use admin panel to manually send notifications
   - Direct database queries to verify data

3. **Communication:**
   - Notify support team
   - Update status page
   - Inform affected vendors

---

## Monitoring

### Key Metrics to Watch:

1. **Document Generation Success Rate:**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE action_type = 'document_generated') as success,
     COUNT(*) FILTER (WHERE action_type = 'document_generation_failed') as failed
   FROM audit_logs
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

2. **Notification Delivery Rate:**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE action_type = 'notification_sent') as success,
     COUNT(*) FILTER (WHERE action_type = 'notification_failed') as failed
   FROM audit_logs
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

3. **Auction Closure Success Rate:**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'closed') as closed,
     COUNT(*) FILTER (WHERE status = 'active' AND end_time < NOW()) as stuck
   FROM auctions
   WHERE end_time > NOW() - INTERVAL '24 hours';
   ```

---

## Next Steps After Testing

1. ✅ Deploy to staging
2. ✅ Run full test suite
3. ✅ Manual QA testing
4. ✅ Performance testing
5. ✅ Deploy to production
6. ✅ Monitor metrics for 24 hours
7. ✅ Update documentation
8. ✅ Train support team on new diagnostic tools

---

**Status:** Ready for Testing
**Priority:** High (Critical user-facing issue)
**Estimated Testing Time:** 2-3 hours
