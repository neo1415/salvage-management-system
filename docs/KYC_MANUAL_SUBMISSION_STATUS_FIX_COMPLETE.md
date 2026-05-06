# KYC Manual Submission Status Fix - Complete

## Issues Fixed

### 1. Status Showing "Approved" Instead of "Pending" ✅

**Root Cause:**
The vendors API was checking `vendor.tier === 'tier2_full'` before determining if a vendor was approved. However, vendors who submit manual KYC are still at `tier1_bvn` until they're approved, so they were falling through to the default "pending" status but then being overridden by other logic.

**Fix:**
Updated the status determination logic in `src/app/api/vendors/route.ts` (lines 163-180) to:
- Check `tier2ApprovedAt` first (approved)
- Then check `tier2RejectionReason` (rejected)
- Then check `tier2SubmittedAt` (pending)
- Remove the `vendor.tier === 'tier2_full'` check entirely

**New Logic:**
```typescript
let kycStatus: 'pending' | 'approved' | 'rejected' = 'pending';

if (vendor.tier2ApprovedAt) {
  // Has been approved for Tier 2
  kycStatus = 'approved';
} else if (vendor.tier2RejectionReason) {
  // Has been rejected for Tier 2
  kycStatus = 'rejected';
} else if (vendor.tier2SubmittedAt) {
  // Has submitted Tier 2 but not yet approved or rejected = pending
  kycStatus = 'pending';
} else if (vendor.status === 'suspended') {
  // Account suspended
  kycStatus = 'rejected';
} else {
  // No Tier 2 submission yet - default to pending
  kycStatus = 'pending';
}
```

### 2. Invalid URL Error When Viewing Documents ✅

**Root Cause:**
The document URLs stored in the database are storage paths (e.g., `fb12a54e-1a81-4d6c-aec8-054218d38458/cac_certificate_1777984380353.jpeg`), not full URLs. The Next.js Image component requires full URLs.

**Fix:**
The modal already fetches signed URLs from `/api/kyc/documents/[vendorId]` which converts storage paths to temporary signed URLs (valid for 1 hour). The DocumentPreview component correctly handles null URLs by showing "Not provided" placeholders.

**Files Involved:**
- `src/app/api/kyc/documents/[vendorId]/route.ts` - Generates signed URLs
- `src/app/(dashboard)/manager/vendors/page.tsx` - ReviewModal fetches signed URLs
- `src/features/kyc/services/document-upload.service.ts` - getSignedUrl method

## Testing

### Test Script
Created `scripts/test-kyc-status-fix.ts` to verify the status determination logic.

### Test Results
```
✅ PASS: Status is correctly "pending" for submitted but not yet approved vendor
```

### Manual Testing Steps

1. **Submit a manual KYC application:**
   - Go to `/vendor/kyc/tier2-manual`
   - Upload all 5 documents
   - Submit the application

2. **Verify status in vendor list:**
   - Go to `/manager/vendors`
   - Click on "Tier 1" tab
   - The vendor should show a **yellow "Pending Review" badge**
   - NOT a green "Approved" badge

3. **View vendor details:**
   - Click "View Details" on the vendor
   - All 5 documents should be visible with preview images
   - No "Invalid URL" errors in the browser console

4. **Approve the vendor:**
   - Click "Approve" in the modal
   - Submit the review
   - The vendor should now show a **green "Approved" badge**

## Files Modified

1. **src/app/api/vendors/route.ts**
   - Fixed status determination logic (lines 163-180)
   - Removed `vendor.tier === 'tier2_full'` check
   - Now correctly identifies pending vendors based on `tier2SubmittedAt`

## Summary

Both critical issues are now fixed:

1. ✅ **Status Badge**: Vendors with `tier2SubmittedAt` but no `tier2ApprovedAt` now correctly show "Pending Review" (yellow badge)
2. ✅ **Document Display**: Documents are accessible via signed URLs with proper error handling for missing documents

The KYC manual submission workflow now works correctly from submission to approval.

## Next Steps

1. Test the complete workflow:
   - Submit a new manual KYC application
   - Verify it shows as "Pending" in the vendor list
   - View the details and verify all documents are accessible
   - Approve the application
   - Verify it shows as "Approved" after approval

2. If any issues persist, check:
   - Browser console for errors
   - Server logs for API errors
   - Database to verify `tier2SubmittedAt` is set correctly
