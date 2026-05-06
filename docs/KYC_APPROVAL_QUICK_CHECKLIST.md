# KYC Tier 2 Approval - Quick Checklist ✅

## Before You Click "Approve"

### Review the Application:
- [ ] Verify all 5 documents are uploaded and accessible
- [ ] Check NIN verification passed
- [ ] Check liveness score is acceptable
- [ ] Check biometric match score is acceptable
- [ ] Review AML risk level (Low/Medium/High)
- [ ] Review fraud risk score
- [ ] Check for any fraud flags

---

## What Happens When You Approve

### ✅ Immediate Actions (Automatic):
1. **Database Updates**:
   - Vendor tier upgraded: `tier1_bvn` → `tier2_full`
   - Approval timestamp recorded
   - Your manager ID recorded as approver
   - Expiry date set (1 year from now)

2. **Bid Limit Removed**:
   - Tier 1 limit (₦500,000) removed
   - Vendor can now bid unlimited amounts
   - No more "Upgrade to Tier 2" prompts

3. **Notifications Sent**:
   - ✅ SMS to vendor's phone
   - ✅ Email to vendor's email
   - ✅ In-app notification in vendor dashboard

4. **Audit Logs Created**:
   - ✅ Manager decision logged (who approved)
   - ✅ Tier change logged (tier1 → tier2)
   - ✅ Timestamp recorded
   - ✅ All changes tracked

---

## After Approval - Verify

### Check Vendor Dashboard:
- [ ] Vendor sees "Tier 2 - Full Access" badge
- [ ] Vendor sees "Unlimited Bidding" status
- [ ] Vendor sees expiry date (1 year from now)
- [ ] Vendor received SMS notification
- [ ] Vendor received email notification

### Check Manager Dashboard:
- [ ] Vendor removed from "Pending Approvals" list
- [ ] Vendor appears in "Approved" filter
- [ ] Vendor shows green "Approved" badge

### Check Bidding System:
- [ ] Vendor can bid above ₦500,000
- [ ] No bid limit errors shown
- [ ] Vendor can access high-value auctions

### Check Audit Logs:
- [ ] Approval action logged
- [ ] Your manager ID recorded
- [ ] Timestamp recorded
- [ ] Tier change logged

---

## Email & SMS Content

### SMS Message:
```
Congratulations {Vendor Name}! Your Tier 2 KYC has been approved. 
You can now bid on unlimited high-value auctions. 
Login to your dashboard to get started.
```

### Email Subject:
```
KYC Application Approved - Unlimited Bidding Access
```

### Email Content:
- Congratulations message
- Confirmation of Tier 2 approval
- Unlimited bidding access confirmed
- Instructions to login to dashboard
- Expiry date (1 year from now)
- Contact information for support

---

## Important Information

### Bid Limits:
- **Tier 1**: ₦500,000 limit
- **Tier 2**: **UNLIMITED** (no limit)

### Expiry:
- **Duration**: 1 year from approval date
- **Reminders**: Sent at 30 days and 7 days before expiry
- **After Expiry**: Vendor automatically downgraded to Tier 1

### Audit Trail:
- **Who**: Your manager ID
- **What**: Tier upgrade (tier1_bvn → tier2_full)
- **When**: Current timestamp
- **Why**: "manager_approved"

---

## If You Need to Reject

### Rejection Process:
1. Click "Reject" button
2. **MUST provide a reason** (required field)
3. Vendor receives SMS and email with rejection reason
4. Vendor can resubmit after 24 hours
5. Audit log records rejection with reason

### Rejection Reasons (Examples):
- "Document quality insufficient - please resubmit clear photos"
- "AML screening flagged high risk - additional verification required"
- "Biometric match score too low - please retry verification"
- "Address proof does not match registered address"

---

## Quick Reference

| Action | Result |
|--------|--------|
| **Approve** | Tier 2 access, unlimited bidding, 1 year validity |
| **Reject** | Vendor stays Tier 1, can resubmit after 24 hours |
| **Bid Limit** | Tier 1: ₦500k, Tier 2: Unlimited |
| **Expiry** | 1 year from approval date |
| **Notifications** | SMS + Email + In-app |
| **Audit Log** | All actions tracked permanently |

---

## Support

**If issues occur after approval**:
1. Check audit logs for approval action
2. Verify vendor tier in database is `tier2_full`
3. Check notification service logs
4. Contact system admin if needed

---

## ✅ Ready to Approve?

**All systems are working correctly**:
- ✅ Email notifications configured
- ✅ Bid limit removal implemented
- ✅ KYC information display working
- ✅ Audit logging active

**You can confidently approve this vendor!** 🎉
