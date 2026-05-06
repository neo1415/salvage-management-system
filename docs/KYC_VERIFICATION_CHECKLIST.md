# KYC Manual Submission - Verification Checklist ✅

Use this checklist to verify the KYC manual submission is working correctly.

---

## 🔧 Prerequisites

### Environment Setup
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in `.env`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in `.env`
- [ ] `ENCRYPTION_KEY` set in `.env` (32 characters)
- [ ] Dependencies installed: `@supabase/supabase-js`, `browser-image-compression`

### Supabase Configuration
- [ ] Supabase project created
- [ ] Bucket `kyc-documents` created
- [ ] Bucket set to **Private** (not public)
- [ ] Bucket policies configured for authenticated access

---

## ✅ Automated Tests

Run the automated test script:

```bash
npx tsx scripts/test-kyc-complete-flow.ts
```

**Expected Results:**
- [ ] ✅ TypeScript types fixed (tier0 added)
- [ ] ✅ Document upload service created
- [ ] ✅ Database schema verified (17 fields)
- [ ] ✅ KYC repository methods working
- [ ] ✅ Supabase configured (or warning shown)

---

## 🧪 Manual Testing

### Test 1: Normal Submission (Happy Path)

**Steps:**
1. [ ] Login as vendor (tier0 or tier1_bvn)
2. [ ] Navigate to `/vendor/kyc/tier2-manual`
3. [ ] Fill all required fields:
   - [ ] Business Name: "Test Business"
   - [ ] Business Type: "Individual"
   - [ ] Address: "123 Test Street"
   - [ ] City: "Lagos"
   - [ ] State: "Lagos"
   - [ ] NIN: "12345678901" (11 digits)
   - [ ] BVN: "12345678901" (11 digits)
   - [ ] Bank Name: "Access Bank"
   - [ ] Account Name: "Test User"
   - [ ] Account Number: "1234567890" (10 digits)
4. [ ] Upload documents (all < 5MB):
   - [ ] NIN Card (image)
   - [ ] Utility Bill (image)
   - [ ] Bank Statement (PDF)
   - [ ] Photo ID (image)
5. [ ] Click "Submit for Review"

**Expected Results:**
- [ ] ✅ No errors in browser console
- [ ] ✅ Images automatically compressed
- [ ] ✅ Success message shown
- [ ] ✅ Status changes to "Under Review"
- [ ] ✅ SMS notification sent (check phone)
- [ ] ✅ Email notification sent (check inbox)

---

### Test 2: Oversized File (Error Handling)

**Steps:**
1. [ ] Login as vendor
2. [ ] Navigate to `/vendor/kyc/tier2-manual`
3. [ ] Fill all required fields
4. [ ] Upload a file > 5MB (e.g., 8MB image)
5. [ ] Click "Submit for Review"

**Expected Results:**
- [ ] ❌ Error message shown: "The following files exceed the 5MB limit: [filename] (X.XXMB)"
- [ ] ❌ Submission does NOT proceed
- [ ] ✅ User can fix and resubmit

---

### Test 3: Invalid File Type (Error Handling)

**Steps:**
1. [ ] Login as vendor
2. [ ] Navigate to `/vendor/kyc/tier2-manual`
3. [ ] Fill all required fields
4. [ ] Upload a .txt or .doc file
5. [ ] Click "Submit for Review"

**Expected Results:**
- [ ] ❌ Error message shown: "Invalid file types: [filename] (type)"
- [ ] ❌ Submission does NOT proceed
- [ ] ✅ User can fix and resubmit

---

### Test 4: Missing Required Fields (Error Handling)

**Steps:**
1. [ ] Login as vendor
2. [ ] Navigate to `/vendor/kyc/tier2-manual`
3. [ ] Leave NIN field blank
4. [ ] Fill other fields and upload documents
5. [ ] Click "Submit for Review"

**Expected Results:**
- [ ] ❌ Browser validation prevents submission
- [ ] ❌ "This field is required" message shown
- [ ] ✅ User can fix and resubmit

---

### Test 5: Missing Documents (Error Handling)

**Steps:**
1. [ ] Login as vendor
2. [ ] Navigate to `/vendor/kyc/tier2-manual`
3. [ ] Fill all required fields
4. [ ] Do NOT upload NIN Card
5. [ ] Click "Submit for Review"

**Expected Results:**
- [ ] ❌ Browser validation prevents submission
- [ ] ❌ "This field is required" message shown
- [ ] ✅ User can fix and resubmit

---

### Test 6: Manager Approval Workflow

**Steps:**
1. [ ] Login as manager
2. [ ] Navigate to `/manager/kyc-approvals`
3. [ ] Find the test submission
4. [ ] Click to view details

**Expected Results:**
- [ ] ✅ All business details visible
- [ ] ✅ Address information visible
- [ ] ✅ Document previews/links visible
- [ ] ✅ NIN last 4 digits visible (full NIN encrypted)
- [ ] ✅ Bank account details visible

**Approve:**
5. [ ] Click "Approve"
6. [ ] Confirm approval

**Expected Results:**
- [ ] ✅ Vendor tier updated to `tier2_full`
- [ ] ✅ SMS notification sent to vendor
- [ ] ✅ Email notification sent to vendor
- [ ] ✅ Vendor dashboard shows "Tier 2 Verified" badge
- [ ] ✅ Vendor can now bid unlimited amounts

---

### Test 7: Manager Rejection Workflow

**Steps:**
1. [ ] Login as manager
2. [ ] Navigate to `/manager/kyc-approvals`
3. [ ] Find a test submission
4. [ ] Click "Reject"
5. [ ] Enter rejection reason
6. [ ] Confirm rejection

**Expected Results:**
- [ ] ✅ Vendor tier remains unchanged
- [ ] ✅ SMS notification sent to vendor
- [ ] ✅ Email notification sent to vendor
- [ ] ✅ Vendor can resubmit after 24 hours
- [ ] ✅ Rejection reason visible to vendor

---

### Test 8: Image Compression

**Steps:**
1. [ ] Login as vendor
2. [ ] Navigate to `/vendor/kyc/tier2-manual`
3. [ ] Open browser DevTools → Network tab
4. [ ] Upload a large image (e.g., 5MB)
5. [ ] Watch the file size in the form

**Expected Results:**
- [ ] ✅ Original file: 5MB
- [ ] ✅ After compression: ~500KB
- [ ] ✅ "File selected" checkmark shown
- [ ] ✅ No errors in console

---

### Test 9: Database Verification

**Steps:**
1. [ ] After successful submission, check database
2. [ ] Query vendors table for the test vendor

**Expected Results:**
- [ ] ✅ `businessName` populated
- [ ] ✅ `businessType` populated
- [ ] ✅ `ninEncrypted` populated (encrypted, not plain text)
- [ ] ✅ `bvnEncrypted` populated (encrypted, not plain text)
- [ ] ✅ `ninVerificationData` contains address data
- [ ] ✅ `cacCertificateUrl` populated (if applicable)
- [ ] ✅ `ninCardUrl` populated
- [ ] ✅ `addressProofUrl` populated
- [ ] ✅ `bankStatementUrl` populated
- [ ] ✅ `photoIdUrl` populated
- [ ] ✅ `tier2SubmittedAt` timestamp set
- [ ] ✅ `tier` is `tier0` or `tier1_bvn` (before approval)

---

### Test 10: Supabase Storage Verification

**Steps:**
1. [ ] After successful submission, check Supabase Storage
2. [ ] Navigate to `kyc-documents` bucket
3. [ ] Find the vendor's folder

**Expected Results:**
- [ ] ✅ Folder named with vendor ID exists
- [ ] ✅ Files uploaded with unique names (timestamp)
- [ ] ✅ File types are correct (JPEG, PNG, WebP, PDF)
- [ ] ✅ File sizes are < 5MB
- [ ] ✅ Files are NOT publicly accessible (private bucket)

---

## 🔍 Error Scenarios to Test

### Scenario 1: Supabase Not Configured
**Expected:** Clear error message, submission fails gracefully

### Scenario 2: Network Error During Upload
**Expected:** Error message, user can retry

### Scenario 3: Database Transaction Fails
**Expected:** Rollback, no partial data saved

### Scenario 4: Encryption Service Fails
**Expected:** Error message, submission fails

### Scenario 5: Notification Service Fails
**Expected:** Submission succeeds, notification failure logged

---

## 📊 Performance Checks

### File Upload Performance
- [ ] Single file upload: < 2 seconds
- [ ] Multiple files (5): < 10 seconds
- [ ] Image compression: < 3 seconds per image
- [ ] No UI blocking during compression

### API Response Times
- [ ] `/api/kyc/manual/submit`: < 5 seconds
- [ ] `/api/kyc/status`: < 1 second
- [ ] `/api/kyc/approvals`: < 2 seconds

---

## 🔒 Security Checks

### Data Encryption
- [ ] NIN is encrypted in database (not plain text)
- [ ] BVN is encrypted in database (not plain text)
- [ ] Encryption key is NOT in source code
- [ ] Encryption key is in `.env` file

### File Security
- [ ] Documents stored in private bucket
- [ ] Document URLs require authentication
- [ ] File types validated server-side
- [ ] File sizes validated server-side

### Access Control
- [ ] Only authenticated vendors can submit
- [ ] Only managers can approve/reject
- [ ] Vendors cannot see other vendors' submissions
- [ ] Managers can see all pending submissions

---

## 📝 Documentation Checks

- [ ] `docs/KYC_MANUAL_SUBMISSION_COMPLETE_IMPLEMENTATION.md` exists
- [ ] `docs/TIER2_KYC_FIXES_SUMMARY.md` exists
- [ ] `docs/KYC_QUICK_REFERENCE.md` exists
- [ ] `docs/SESSION_SUMMARY_KYC_COMPLETE_FIX.md` exists
- [ ] `docs/KYC_MANUAL_SUBMISSION_TESTING_COMPLETE.md` exists
- [ ] `docs/KYC_FIXES_VISUAL_SUMMARY.md` exists
- [ ] All documentation is up to date

---

## 🚀 Production Deployment Checks

Before deploying to production:

### Environment
- [ ] Production `.env` configured
- [ ] Supabase production project created
- [ ] Encryption key generated (32 characters)
- [ ] All environment variables set

### Supabase
- [ ] Production bucket `kyc-documents` created
- [ ] Bucket set to private
- [ ] Bucket policies configured
- [ ] Storage limits configured

### Testing
- [ ] All automated tests pass
- [ ] All manual tests pass
- [ ] Error scenarios tested
- [ ] Performance acceptable

### Monitoring
- [ ] Error logging configured (Sentry, etc.)
- [ ] SMS/Email notifications working
- [ ] Database backups configured
- [ ] Support procedures documented

---

## ✅ Final Checklist

- [ ] All automated tests pass
- [ ] All manual tests pass
- [ ] All error scenarios handled
- [ ] All security checks pass
- [ ] All documentation complete
- [ ] Production environment configured
- [ ] Monitoring and logging set up
- [ ] Support team trained

---

## 🎯 Sign-Off

**Tested By:** ___________________  
**Date:** ___________________  
**Environment:** [ ] Development [ ] Staging [ ] Production  
**Status:** [ ] Pass [ ] Fail  
**Notes:** ___________________

---

**Last Updated:** May 5, 2026
