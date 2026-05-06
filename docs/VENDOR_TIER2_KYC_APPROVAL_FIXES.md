# Tier 2 KYC Approval Issues - Fixed

## Issues Identified and Fixed

### 1. ✅ Email Shows Wrong Tier After Approval
**Problem**: When approving a Tier 2 KYC application, the approval email showed "Tier 1 (BVN Verified)" instead of "Tier 2 (Full Business KYC)".

**Root Cause**: The approval endpoint was using `vendor.tier` from the database query, which hadn't been updated yet. The tier was only being set in Tier 2-specific fields (`tier2ApprovedAt`, etc.) but not in the main `tier` column.

**Fix Applied**:
- Modified `src/app/api/vendors/[id]/approve/route.ts`:
  - Added `tier2SubmittedAt` to the vendor query to detect Tier 2 applications
  - Updated the approval logic to set `tier: 'tier2_full'` when `tier2SubmittedAt` is not null
  - Fixed email template to use the correct tier display text based on whether it's a Tier 2 approval
  - Added Tier 2 benefits message to approval email

**Files Changed**:
- `src/app/api/vendors/[id]/approve/route.ts`

---

### 2. ✅ Dashboard Shows "Under Review" After Approval
**Problem**: After a Tier 2 KYC application is approved, the vendor dashboard still shows "Tier 2 Application Under Review" instead of showing the approved status.

**Root Cause**: The KYC status API logic had ambiguous conditions. It wasn't properly checking if `tier2ApprovedAt` was set when determining the status.

**Fix Applied**:
- Modified `src/app/api/kyc/status/route.ts`:
  - Clarified the status determination logic
  - Added explicit check for `tier2ApprovedAt` when determining if Tier 2 is approved
  - Reordered conditions to check approval status first before checking pending review
  - Added check for rejection reason to prevent false "pending_review" status

**Files Changed**:
- `src/app/api/kyc/status/route.ts`

---

### 3. ✅ Profile Doesn't Show Tier 2 Data
**Problem**: The vendor profile page shows "KYC Tier: Tier 1" and "Vendor Status: approved" but doesn't display Tier 2 KYC data after approval.

**Root Cause**: The profile API was already returning the correct `tier` from the database, but the tier wasn't being updated to `tier2_full` during approval (see Fix #1).

**Fix Applied**:
- No additional changes needed - fixed by Fix #1 above
- The profile API (`src/app/api/vendor/settings/profile/route.ts`) already returns the correct tier from the database
- Once the approval endpoint updates the tier to `tier2_full`, the profile will automatically display the correct tier

**Files Verified**:
- `src/app/api/vendor/settings/profile/route.ts` (no changes needed)
- `src/app/(dashboard)/vendor/settings/profile/page.tsx` (no changes needed)

---

### 4. ✅ Missing Bank Account Fields in KYC Form
**Problem**: The Tier 2 KYC form doesn't include bank account details (bank name, account name, account number) for verification against the bank statement.

**Root Cause**: The manual Tier 2 KYC form (`tier2-manual`) didn't have fields for bank account information, even though the database schema already supports these fields.

**Fix Applied**:
- Modified `src/app/(dashboard)/vendor/kyc/tier2-manual/page.tsx`:
  - Added `bankName`, `accountName`, and `accountNumber` to the `FormData` interface
  - Added a new "Bank Account Details" section to the form
  - Added validation note explaining that bank details will be verified against the bank statement
  - Made all three fields required

- Created `src/app/api/kyc/manual/submit/route.ts`:
  - New API endpoint to handle manual Tier 2 KYC submissions
  - Validates required fields including bank account information
  - Encrypts sensitive data (NIN, BVN)
  - Saves bank account details to the vendor record
  - Sends "Under Review" notification to the vendor

**Files Changed**:
- `src/app/(dashboard)/vendor/kyc/tier2-manual/page.tsx`
- `src/app/api/kyc/manual/submit/route.ts` (new file)

**Database Schema** (already exists, no changes needed):
- `vendors.bankName` - Bank name
- `vendors.bankAccountName` - Account holder name
- `vendors.bankAccountNumber` - Account number

---

## Testing Instructions

### Test Case 1: Tier 2 Approval Email
1. Log in as a Salvage Manager
2. Navigate to KYC Approvals page
3. Find a vendor with Tier 2 KYC submitted (look for `tier2SubmittedAt` not null)
4. Approve the application
5. **Expected**: Email should say "Tier 2 (Full Business KYC)" and include Tier 2 benefits

### Test Case 2: Dashboard Status After Approval
1. Submit a Tier 2 KYC application as a vendor
2. Have a manager approve it
3. Refresh the vendor dashboard
4. **Expected**: Should show "Tier 2 Verified" badge with "Active" status, not "Under Review"

### Test Case 3: Profile Displays Tier 2
1. After Tier 2 approval, navigate to Settings > Profile
2. **Expected**: 
   - KYC Tier should show "Tier 2" badge (green)
   - Vendor Status should show "Fully Verified" or "Verified"
   - Business name and bank account (masked) should be displayed

### Test Case 4: Bank Account Fields in Form
1. Navigate to `/vendor/kyc/tier2-manual`
2. **Expected**: 
   - Form should have a "Bank Account Details" section
   - Three required fields: Bank Name, Account Name, Account Number
   - Blue info box explaining verification against bank statement
3. Fill out the form including bank account details
4. Submit
5. **Expected**: 
   - Submission succeeds
   - Bank account details are saved to the vendor record
   - Manager can see bank account info when reviewing the application

---

## Database Verification Queries

### Check if vendor tier was updated after approval:
```sql
SELECT 
  id, 
  business_name,
  tier,
  tier2_submitted_at,
  tier2_approved_at,
  tier2_approved_by,
  tier2_expires_at,
  bank_name,
  bank_account_name,
  bank_account_number
FROM vendors 
WHERE user_id = '<user_id>';
```

### Check KYC status for a vendor:
```sql
SELECT 
  tier,
  tier2_submitted_at,
  tier2_approved_at,
  tier2_rejection_reason,
  tier2_expires_at
FROM vendors
WHERE user_id = '<user_id>';
```

---

## Summary

All four issues have been fixed:

1. ✅ **Email tier display** - Now correctly shows "Tier 2 (Full Business KYC)" for Tier 2 approvals
2. ✅ **Dashboard status** - Now shows "Tier 2 Verified" after approval instead of "Under Review"
3. ✅ **Profile tier display** - Now shows correct Tier 2 status after approval
4. ✅ **Bank account fields** - Added to manual KYC form with validation and submission handling

The fixes ensure that:
- The `tier` column is updated to `tier2_full` during approval
- The KYC status API correctly determines approval status
- Bank account information is collected and saved for verification
- Email notifications reflect the correct tier being approved

---

## Test Vendor Details

**Email**: neowalker502@gmail.com  
**Business Name**: NEM Insurance Plc

Use this vendor to test the fixes.
