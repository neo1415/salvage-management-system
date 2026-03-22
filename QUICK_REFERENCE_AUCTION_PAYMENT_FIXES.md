# Quick Reference: Auction Closure & Payment Deadline Fixes

## TL;DR - What Changed?

### 1. Documents Generated Immediately ⚡
- **Before**: Wait up to 24 hours for cron job
- **After**: Documents available within 5 seconds of auction closure

### 2. Forfeiture After 72 Hours (No Suspension) 🕐
- **Before**: 48 hours → Forfeiture + 7-day account suspension
- **After**: 72 hours → Forfeiture + NO suspension + Funds frozen

### 3. Grace Period Restores Documents 🔄
- **Before**: No way to restore document access after forfeiture
- **After**: Finance Officer can grant 3-day grace period → Documents re-enabled

### 4. Forfeiture Check on Signing 🔒
- **Before**: No check, potential security issue
- **After**: Signing blocked if forfeited, clear error message

---

## For Developers

### New Database Fields

```typescript
// auctions table
status: 'scheduled' | 'active' | 'extended' | 'closed' | 'cancelled' | 'forfeited'

// release_forms table
disabled: boolean // true when auction is forfeited

// payments table
status: 'pending' | 'verified' | 'overdue' | 'forfeited'
```

### Key Functions Changed

```typescript
// 1. Immediate document generation
auctionClosureService.closeAuction(auctionId)
  → generateWinnerDocuments() // Now generates 2 docs immediately

// 2. 72-hour forfeiture
enforcePaymentDeadlines()
  → forfeitAuctionWinners() // Changed from 48h to 72h, no suspension

// 3. Grace period restoration
grantGracePeriod(paymentId, financeOfficerId)
  → Re-enables documents, extends deadline

// 4. Forfeiture check
signDocument(documentId, vendorId, ...)
  → Checks disabled flag and auction status
```

### Migration Required

```bash
npm run db:migrate
```

---

## For Finance Officers

### How to Grant Grace Period

1. Go to Finance Dashboard → Payments
2. Find overdue/forfeited payment
3. Click "Grant Grace Period"
4. Confirm action

**What Happens:**
- Payment deadline extended by 3 days
- Documents re-enabled (vendor can sign)
- Vendor notified via SMS, email, and in-app
- Auction status restored to 'closed'

### When to Grant Grace Period

✅ **Grant if:**
- Vendor contacted support and has valid reason
- Technical issue prevented payment
- First-time offender
- High-value auction

❌ **Don't grant if:**
- Vendor has history of non-payment
- No response from vendor
- Already granted grace period once

---

## For Vendors

### What You Need to Know

#### After Winning Auction
1. **Documents available immediately** (no waiting!)
2. Sign 2 documents within 24 hours:
   - Bill of Sale
   - Release & Waiver of Liability
3. Payment auto-processed after signing
4. Pickup code sent via SMS/email

#### If You Miss Deadline
- **24-48 hours**: Payment marked as overdue
- **72 hours**: Auction forfeited, documents disabled
- **Contact support immediately** if you still want the item
- Finance Officer may grant 3-day grace period

#### After Grace Period Granted
- Documents re-enabled (you can sign again)
- New deadline: Original + 3 days
- **This is your last chance** - no second grace period

---

## For Support Team

### Common Scenarios

#### Scenario 1: "I can't sign documents"
**Check:**
1. Is auction forfeited? → Contact Finance Officer for grace period
2. Are documents disabled? → Same as above
3. Technical issue? → Escalate to dev team

#### Scenario 2: "My account was suspended"
**Response:**
- Account suspensions removed in new system
- Funds remain frozen until resolved
- Contact Finance Officer for grace period

#### Scenario 3: "I didn't receive documents"
**Check:**
1. Auction closed? → Documents should be immediate
2. Check vendor dashboard → Documents page
3. Check email spam folder
4. If missing → Escalate to dev team (check logs)

---

## Troubleshooting

### Documents Not Generated
```bash
# Check logs
tail -f logs/app.log | grep "Document generated"

# Check database
SELECT * FROM release_forms WHERE auction_id = 'AUCTION_ID';

# If missing, manually trigger
# (Contact dev team - don't do this yourself)
```

### Forfeiture Not Triggered
```bash
# Check cron job running
# Check payment deadline
SELECT payment_deadline, status FROM payments WHERE id = 'PAYMENT_ID';

# Should be forfeited if:
# - status = 'overdue'
# - payment_deadline < NOW() - 72 hours
```

### Grace Period Not Working
```bash
# Check if documents re-enabled
SELECT disabled FROM release_forms WHERE auction_id = 'AUCTION_ID';
# Should be false after grace period

# Check auction status
SELECT status FROM auctions WHERE id = 'AUCTION_ID';
# Should be 'closed' after grace period (not 'forfeited')
```

---

## API Endpoints

### Grant Grace Period (Finance Officer Only)
```bash
POST /api/payments/{paymentId}/grant-grace-period
Authorization: Bearer {financeOfficerToken}
```

**Response:**
```json
{
  "success": true,
  "message": "Grace period granted successfully"
}
```

---

## Monitoring Queries

### Check Forfeited Auctions Today
```sql
SELECT a.id, a.status, p.amount, u.email
FROM auctions a
JOIN payments p ON a.id = p.auction_id
JOIN vendors v ON p.vendor_id = v.id
JOIN users u ON v.user_id = u.id
WHERE a.status = 'forfeited'
AND a.updated_at > CURRENT_DATE
ORDER BY a.updated_at DESC;
```

### Check Grace Periods Granted Today
```sql
SELECT p.id, p.payment_deadline, u.email
FROM payments p
JOIN vendors v ON p.vendor_id = v.id
JOIN users u ON v.user_id = u.id
WHERE p.status = 'pending'
AND p.updated_at > CURRENT_DATE
AND p.payment_deadline > (SELECT payment_deadline FROM payments WHERE id = p.id) + INTERVAL '2 days'
ORDER BY p.updated_at DESC;
```

### Check Disabled Documents
```sql
SELECT rf.id, rf.auction_id, rf.document_type, rf.disabled, a.status
FROM release_forms rf
JOIN auctions a ON rf.auction_id = a.id
WHERE rf.disabled = true
ORDER BY rf.updated_at DESC;
```

---

## Testing Checklist

Before deploying:
- [ ] Run migration: `npm run db:migrate`
- [ ] Test immediate document generation
- [ ] Test 72-hour forfeiture (no suspension)
- [ ] Test grace period restoration
- [ ] Test forfeiture check on signing
- [ ] Verify no TypeScript errors
- [ ] Check logs for errors
- [ ] Test in staging environment

---

## Emergency Contacts

- **Dev Team**: [dev-team@nem-insurance.com]
- **Finance Team**: [finance@nem-insurance.com]
- **Support Team**: [support@nem-insurance.com]

---

## Related Documentation

- Full Implementation: `AUCTION_CLOSURE_PAYMENT_DEADLINE_FIXES_COMPLETE.md`
- Testing Guide: `tests/manual/test-auction-closure-payment-deadline-fixes.md`
- Migration Script: `drizzle/migrations/0000_add_forfeited_status_and_disabled_documents.sql`
