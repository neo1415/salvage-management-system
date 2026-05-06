# KYC Manual Submission Testing Guide

## Quick Reference

This guide provides step-by-step instructions for testing the KYC manual submission fixes.

## Prerequisites

- Access to the application as both a vendor and a manager
- Test documents ready (images or PDFs)
- Supabase bucket configured (run `npx tsx scripts/setup-kyc-supabase-bucket.ts` if needed)

## Test Scenario 1: Submit Manual KYC as Vendor

### Steps:
1. **Login as a vendor** (Tier 1 - BVN verified)
2. **Navigate to KYC page**: `/vendor/kyc/tier2-manual`
3. **Fill in the form**:
   - Business Name: "Test Business Ltd"
   - Business Type: "Limited Company"
   - CAC Number: "RC123456"
   - TIN: "12345678-0001"
   - NIN: "12345678901"
   - BVN: "12345678901"
   - Bank Name: "GTBank"
   - Account Name: "Test Business Ltd"
   - Account Number: "0123456789"
   - Address: "123 Test Street"
   - City: "Lagos"
   - State: "Lagos"

4. **Upload documents**:
   - CAC Certificate (image or PDF)
   - NIN Card (image)
   - Utility Bill (image or PDF)
   - Bank Statement (image or PDF)
   - Photo ID (image)

5. **Submit the form**

### Expected Results:
- ✅ Form submits successfully
- ✅ Success message: "KYC application submitted successfully"
- ✅ All 5 documents uploaded
- ✅ No file type validation errors
- ✅ No bucket not found errors

## Test Scenario 2: View Pending Submission as Manager

### Steps:
1. **Login as a manager** (Salvage Manager role)
2. **Navigate to vendor management**: `/manager/vendors`
3. **Click on "Tier 2" tab**
4. **Verify the vendor list**:
   - Look for the vendor you just submitted KYC for
   - Check the status badge

### Expected Results:
- ✅ Vendor appears in the Tier 2 list
- ✅ Status badge shows "Pending Review" (yellow badge with clock icon)
- ✅ NOT showing "Approved" (green badge)
- ✅ Business name is displayed correctly
- ✅ Contact information is visible

## Test Scenario 3: Review Documents

### Steps:
1. **From the Tier 2 vendor list**, click "View Details" on the pending vendor
2. **Wait for the modal to load**
3. **Scroll to "Uploaded Documents" section**
4. **Verify all 5 documents are displayed**:
   - CAC Certificate
   - NIN Card
   - Address Proof (Utility Bill)
   - Bank Statement
   - Photo ID

5. **Check document previews**:
   - Images should show thumbnail previews
   - PDFs should show a PDF icon
   - Missing documents should show "Not provided" placeholder

6. **Click "View Full Document"** on each document
7. **Verify the document opens in a new tab**

### Expected Results:
- ✅ Modal opens without errors
- ✅ Loading indicator shows while fetching signed URLs
- ✅ All 5 document slots are visible
- ✅ Uploaded documents show previews
- ✅ Missing documents show "Not provided" with disabled styling
- ✅ "View Full Document" button works for uploaded documents
- ✅ Documents open in new tab without 404 errors
- ✅ No "Bucket not found" errors
- ✅ No "Invalid URL" errors in browser console

## Test Scenario 4: Approve/Reject Submission

### Steps:
1. **From the review modal**, scroll to "Review Decision" section
2. **Click "Approve"** button
3. **Optionally add a comment**
4. **Click "Submit Review"**
5. **Wait for the submission to complete**
6. **Close the modal**
7. **Verify the vendor list updates**

### Expected Results:
- ✅ Review submission succeeds
- ✅ Modal closes automatically
- ✅ Vendor list refreshes
- ✅ Vendor status changes to "Approved" (green badge)
- ✅ Vendor moves to approved section if filtered

### Alternative: Test Rejection
1. **Click "Reject"** instead of "Approve"
2. **Enter a rejection reason** (required)
3. **Submit the review**

### Expected Results:
- ✅ Rejection requires a comment
- ✅ Submission succeeds
- ✅ Vendor status changes to "Rejected" (red badge)
- ✅ Rejection reason is visible in vendor details

## Test Scenario 5: Filter and Search

### Steps:
1. **From `/manager/vendors`**, click "Tier 2" tab
2. **Click "Pending" filter button**
3. **Verify only pending vendors are shown**
4. **Click "Approved" filter button**
5. **Verify only approved vendors are shown**
6. **Use the search bar** to search by:
   - Business name
   - Contact name
   - Email
   - CAC number

### Expected Results:
- ✅ Filters work correctly
- ✅ Search returns matching results
- ✅ Status badges are correct for each filter
- ✅ No approved vendors show in pending filter
- ✅ No pending vendors show in approved filter

## Test Scenario 6: Missing Documents

### Steps:
1. **Submit a new KYC application** with only 3 out of 5 documents
2. **As a manager**, view the submission details
3. **Check the document section**

### Expected Results:
- ✅ All 5 document slots are visible
- ✅ Uploaded documents show previews
- ✅ Missing documents show "Not provided" placeholder
- ✅ "Not Available" button is disabled for missing documents
- ✅ No errors or crashes

## Test Scenario 7: Document URL Expiry

### Steps:
1. **Open a vendor review modal**
2. **Wait for signed URLs to load**
3. **Keep the modal open for more than 1 hour**
4. **Try to view a document**

### Expected Results:
- ✅ Document may fail to load after 1 hour (expected behavior)
- ✅ Closing and reopening the modal generates fresh URLs
- ✅ Fresh URLs work correctly

## Browser Console Checks

### What to Look For:
1. **No errors** related to:
   - "Invalid URL"
   - "Bucket not found"
   - "Failed to construct URL"
   - "404 Not Found"

2. **Expected logs**:
   - `[Manual KYC Submit] File type validation:` (during submission)
   - `✅ Cache HIT/MISS: vendors:list:...` (when loading vendor list)

### How to Check:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Clear console
4. Perform the test scenarios
5. Check for errors (red text)

## API Response Checks

### Test Document URLs API:
```bash
# Replace {vendorId} with actual vendor ID
curl -X GET http://localhost:3000/api/kyc/documents/{vendorId} \
  -H "Cookie: your-session-cookie"
```

### Expected Response:
```json
{
  "success": true,
  "documents": {
    "cacCertificateUrl": "https://...signed-url...",
    "ninCardUrl": "https://...signed-url...",
    "addressProofUrl": "https://...signed-url...",
    "bankStatementUrl": "https://...signed-url...",
    "photoIdUrl": "https://...signed-url..."
  }
}
```

## Troubleshooting

### Issue: "Bucket not found" error
**Solution**: Run the bucket setup script:
```bash
npx tsx scripts/setup-kyc-supabase-bucket.ts
```

### Issue: Documents not loading
**Solution**: 
1. Check Supabase credentials in `.env`
2. Verify bucket exists in Supabase dashboard
3. Check browser console for errors

### Issue: Status still showing "Approved" for pending vendors
**Solution**:
1. Clear browser cache
2. Restart the development server
3. Check that the API fix is applied in `src/app/api/vendors/route.ts`

### Issue: Only 3 documents showing
**Solution**:
1. Check that the frontend fix is applied in `src/app/(dashboard)/manager/vendors/page.tsx`
2. Verify all 5 document types are in the grid

## Success Criteria

All tests pass when:
- ✅ Vendors show correct status (Pending/Approved/Rejected)
- ✅ All 5 documents are displayed (with placeholders for missing ones)
- ✅ Documents are accessible without 404 errors
- ✅ Signed URLs work correctly
- ✅ Approval/rejection workflow functions properly
- ✅ No console errors related to URLs or buckets
- ✅ Filters and search work correctly

## Regression Testing

After fixes, verify these still work:
- ✅ Tier 0 and Tier 1 vendor lists
- ✅ BVN verification flow
- ✅ Dojah KYC flow (if implemented)
- ✅ Vendor dashboard
- ✅ Manager dashboard

## Performance Testing

Monitor these metrics:
- Document upload time (should be < 5 seconds per file)
- Signed URL generation time (should be < 2 seconds for all 5 URLs)
- Modal load time (should be < 3 seconds)
- Vendor list load time (should be < 2 seconds for 50 vendors)

## Security Testing

Verify these security measures:
- ✅ Only managers can access document URLs API
- ✅ Signed URLs expire after 1 hour
- ✅ Bucket is private (not publicly accessible)
- ✅ File type validation works
- ✅ File size limits are enforced
- ✅ Sensitive data (NIN, BVN) is encrypted

## Next Steps

After all tests pass:
1. Deploy to staging environment
2. Perform smoke tests on staging
3. Get manager approval for production deployment
4. Deploy to production
5. Monitor for errors in production logs

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check the server logs for API errors
3. Verify Supabase configuration
4. Review the fix documentation: `docs/KYC_MANUAL_SUBMISSION_FIXES_COMPLETE.md`
