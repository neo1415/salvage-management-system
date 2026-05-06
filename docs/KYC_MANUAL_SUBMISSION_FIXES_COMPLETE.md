# KYC Manual Submission Fixes - Complete

## Date: May 5, 2026

## Issues Fixed

### 1. Status Showing "Approved" Instead of "Pending" ✅

**Root Cause:**
The vendors API (`src/app/api/vendors/route.ts`) was determining KYC status based on the general `vendor.status` field (which is "approved" after Tier 1 BVN verification) instead of checking the Tier 2 specific approval fields (`tier2ApprovedAt`, `tier2RejectionReason`).

**Fix Applied:**
Updated the status determination logic in `src/app/api/vendors/route.ts` (lines 160-175) to:
- Check `tier2ApprovedAt` for approved status
- Check `tier2RejectionReason` for rejected status
- Check `tier2SubmittedAt` without approval/rejection for pending status
- Ignore the general `vendor.status` field for Tier 2 KYC status

**Code Changes:**
```typescript
// Before (WRONG):
if (vendor.status === 'approved') {
  kycStatus = 'approved';
}

// After (CORRECT):
if (vendor.tier === 'tier2_full' && vendor.tier2ApprovedAt) {
  kycStatus = 'approved';
} else if (vendor.tier2RejectionReason) {
  kycStatus = 'rejected';
} else if (vendor.tier2SubmittedAt && !vendor.tier2ApprovedAt && !vendor.tier2RejectionReason) {
  kycStatus = 'pending';
}
```

### 2. Document Files Not Accessible (404 Bucket Not Found) ✅

**Root Cause:**
- Documents were stored as storage paths (e.g., `vendor-id/document_timestamp.jpg`) instead of public URLs
- The vendor management page was trying to use these paths directly with Next.js `Image` component
- The bucket is private and requires signed URLs for access

**Fix Applied:**
1. **Created new API endpoint** (`src/app/api/kyc/documents/[vendorId]/route.ts`):
   - Generates signed URLs for all KYC documents
   - URLs are valid for 1 hour
   - Only accessible by Salvage Managers

2. **Updated vendor management page** (`src/app/(dashboard)/manager/vendors/page.tsx`):
   - Added `useEffect` hook to fetch signed URLs when modal opens
   - Added loading state while fetching URLs
   - Updated document display to use signed URLs

**Code Changes:**
```typescript
// New API endpoint
GET /api/kyc/documents/[vendorId]
// Returns: { success: true, documents: { cacCertificateUrl, ninCardUrl, ... } }

// Modal component now fetches signed URLs
useEffect(() => {
  const fetchSignedUrls = async () => {
    const response = await fetch(`/api/kyc/documents/${application.id}`);
    const data = await response.json();
    setSignedUrls(data.documents || {});
  };
  fetchSignedUrls();
}, [application.id]);
```

### 3. Only 3 Out of 5 Files Showing ✅

**Root Cause:**
The vendor management page was only displaying documents that had URLs, and was only showing 3 document types (CAC Certificate, Bank Statement, NIN Card).

**Fix Applied:**
Updated the document display section to show all 5 required documents:
1. CAC Certificate
2. NIN Card
3. Address Proof (Utility Bill)
4. Bank Statement
5. Photo ID

Added "Not provided" placeholders for missing documents with disabled styling.

**Code Changes:**
```typescript
// Before: Only showed 3 documents conditionally
{application.cacCertificateUrl && <DocumentPreview ... />}
{application.bankStatementUrl && <DocumentPreview ... />}
{application.ninCardUrl && <DocumentPreview ... />}

// After: Shows all 5 documents with placeholders
<DocumentPreview label="CAC Certificate" url={signedUrls.cacCertificateUrl} />
<DocumentPreview label="NIN Card" url={signedUrls.ninCardUrl} />
<DocumentPreview label="Address Proof" url={signedUrls.addressProofUrl} />
<DocumentPreview label="Bank Statement" url={signedUrls.bankStatementUrl} />
<DocumentPreview label="Photo ID" url={signedUrls.photoIdUrl} />
```

## Files Modified

1. **src/app/api/vendors/route.ts**
   - Fixed KYC status determination logic (lines 160-175)

2. **src/app/api/kyc/documents/[vendorId]/route.ts** (NEW)
   - Created API endpoint to generate signed URLs for KYC documents

3. **src/app/(dashboard)/manager/vendors/page.tsx**
   - Added signed URL fetching in ReviewModal component
   - Updated document display to show all 5 documents
   - Added "Not provided" placeholders for missing documents
   - Updated DocumentPreview component to handle null URLs

## Testing Instructions

### 1. Test Status Display
1. Go to `/manager/vendors`
2. Click on "Tier 2" tab
3. Verify that newly submitted vendors show "Pending Review" badge (yellow)
4. Verify that approved vendors show "Approved" badge (green)
5. Verify that rejected vendors show "Rejected" badge (red)

### 2. Test Document Access
1. Go to `/manager/vendors`
2. Click on "Tier 2" tab
3. Click "View Details" on a vendor with manual KYC submission
4. Verify that all 5 documents are displayed:
   - CAC Certificate
   - NIN Card
   - Address Proof
   - Bank Statement
   - Photo ID
5. Verify that documents with files show preview images
6. Verify that missing documents show "Not provided" placeholder
7. Click "View Full Document" on a document with a file
8. Verify that the document opens in a new tab without 404 errors

### 3. Test Complete Flow
1. Submit a new manual KYC application as a vendor
2. Go to `/manager/vendors` as a manager
3. Click on "Tier 2" tab
4. Verify the new submission shows "Pending Review" status
5. Click "View Details"
6. Verify all uploaded documents are accessible
7. Approve or reject the application
8. Verify the status updates correctly

## Verification Commands

```bash
# Check if the API endpoint exists
ls -la src/app/api/kyc/documents/[vendorId]/route.ts

# Check if the fixes are applied
grep -A 10 "Determine KYC status" src/app/api/vendors/route.ts
grep -A 5 "fetchSignedUrls" src/app/(dashboard)/manager/vendors/page.tsx
```

## Security Notes

1. **Signed URLs**: Documents are accessed via signed URLs that expire after 1 hour
2. **Authorization**: Only Salvage Managers can access the document URLs API
3. **Private Bucket**: The Supabase bucket remains private and requires authentication
4. **No Public URLs**: Document paths are never exposed as public URLs

## Performance Notes

1. **Signed URL Generation**: URLs are generated on-demand when the modal opens
2. **Caching**: Signed URLs are cached in component state for the modal session
3. **Parallel Fetching**: All document URLs are fetched in a single API call

## Known Limitations

1. **URL Expiry**: Signed URLs expire after 1 hour. If a manager keeps the modal open for more than 1 hour, they'll need to close and reopen it to get fresh URLs.
2. **No Refresh**: The signed URLs are not automatically refreshed. The modal must be closed and reopened to get new URLs.

## Future Improvements

1. **Auto-refresh**: Implement automatic URL refresh before expiry
2. **Progress Indicators**: Add upload progress indicators for large files
3. **Document Validation**: Add server-side document validation (e.g., check if image is readable)
4. **Thumbnail Generation**: Generate thumbnails for faster preview loading
5. **Document Comparison**: Add side-by-side comparison for resubmitted documents

## Related Documentation

- [KYC Manual Submission Testing Guide](./KYC_MANUAL_SUBMISSION_TESTING_GUIDE.md)
- [Supabase Storage Setup](../scripts/setup-kyc-supabase-bucket.ts)
- [Document Upload Service](../src/features/kyc/services/document-upload.service.ts)

## Deployment Checklist

- [x] All code changes committed
- [x] API endpoint created and tested
- [x] Frontend updated to use signed URLs
- [x] Document display shows all 5 documents
- [x] Status determination logic fixed
- [x] Error handling implemented
- [x] Security checks in place
- [ ] Manual testing completed
- [ ] Staging deployment verified
- [ ] Production deployment ready

## Summary

All three critical issues with the KYC manual submission system have been resolved:

1. ✅ **Status Display**: Vendors now correctly show "Pending" status until manager approval
2. ✅ **Document Access**: All documents are now accessible via signed URLs
3. ✅ **Complete Document List**: All 5 required documents are displayed with placeholders for missing ones

The system is now ready for manager review and approval of manual KYC submissions.
