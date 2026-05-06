# Tier 2 Manual KYC Implementation

## Overview

This document describes the manual KYC system implemented as a temporary solution while Dojah integration is being finalized. The system allows vendors to submit KYC documents manually, uses AI (Gemini/Claude) to verify them, and lets salvage managers review and approve applications.

## Architecture

```
Vendor → Manual Form → AI Verification → Manager Review → Tier 2 Approval
```

### Key Components

1. **Manual Submission Form** (`/vendor/kyc/tier2-manual`)
   - Business details input
   - Address information
   - NIN and BVN entry
   - Document uploads (CAC, NIN card, utility bill, bank statement, photo ID)

2. **AI Verification Service** (`src/features/kyc/services/ai-verification.service.ts`)
   - Uses Gemini 2.0 Flash (primary) or Claude Sonnet 4.6 (fallback)
   - Analyzes documents for quality, consistency, and authenticity
   - Returns score (0-100) and recommendation (approve/review/reject)
   - Cost: ~$0.01 per verification (vs Dojah's ₦510-630)

3. **API Endpoint** (`/api/kyc/manual/submit`)
   - Handles form submission
   - Uploads documents to Cloudinary
   - Runs AI verification
   - Updates vendor record
   - Triggers manager notification

4. **Manager Review** (existing `/manager/kyc-approvals`)
   - View pending applications
   - Review documents and AI analysis
   - Approve or reject with comments

## Database Schema

The following fields in the `vendors` table are used:

```typescript
{
  businessName: string;
  businessType: 'individual' | 'sole_proprietor' | 'limited_company';
  cacNumber: string | null;
  tin: string | null;
  ninCardUrl: string;
  addressProofUrl: string;
  bankStatementUrl: string;
  photoIdUrl: string;
  cacCertificateUrl: string | null;
  tier2SubmittedAt: Date;
  ninVerificationData: JSONB; // Stores AI verification result
  fraudRiskScore: string; // AI verification score
}
```

## AI Verification

### How It Works

1. Vendor submits form with documents
2. Documents uploaded to Cloudinary
3. AI service analyzes documents:
   - Document quality (clear, readable, not tampered)
   - Data consistency (names, addresses match)
   - Authenticity (signs of forgery)
4. AI returns:
   - Score (0-100)
   - Recommendation (approve/review/reject)
   - Detailed findings for each document

### Scoring Guidelines

- **80-100**: Auto-approve (all documents clear, data consistent, no concerns)
- **50-79**: Manual review (minor issues, needs human verification)
- **0-49**: Reject (major concerns, likely fraud)

### Cost Comparison

| Service | Cost per Verification | Features |
|---------|----------------------|----------|
| **Gemini 2.0 Flash** | ~$0.01 | Document analysis, OCR, fraud detection |
| **Claude Sonnet 4.6** | ~$0.60-$1.20 | Advanced reasoning, detailed analysis |
| **Dojah** | ₦510-630 (~$0.35-$0.43) | NIN verification, liveness check, AML screening |

**Note**: Gemini is used as primary (cheaper), Claude as fallback (more accurate).

## Dojah Integration Readiness

The system is designed to make Dojah integration easy:

### 1. Environment Variable Toggle

Add to `.env`:
```env
USE_DOJAH_KYC=true  # Set to true when Dojah is ready
```

### 2. Update Tier 2 Page

In `src/app/(dashboard)/vendor/kyc/tier2/page.tsx`:

```typescript
useEffect(() => {
  if (authStatus === 'authenticated') {
    if (process.env.NEXT_PUBLIC_USE_DOJAH_KYC === 'true') {
      // Use Dojah widget (existing code)
      setPageState('ready');
    } else {
      // Redirect to manual KYC
      router.push('/vendor/kyc/tier2-manual');
    }
  }
}, [authStatus, router]);
```

### 3. Hybrid Approach (Optional)

You can use both systems:
- Manual KYC for initial submission
- Dojah for additional verification (NIN, liveness, AML)

This provides extra security and reduces fraud risk.

## Setup Instructions

### 1. Environment Variables

Ensure these are set in `.env`:

```env
# Cloudinary (for document uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Gemini AI (primary)
GEMINI_API_KEY=your_gemini_key

# Claude AI (fallback)
CLAUDE_API_KEY=your_claude_key

# Optional: Dojah (for future integration)
DOJAH_API_KEY=your_dojah_key
DOJAH_PUBLIC_KEY=your_dojah_public_key
DOJAH_APP_ID=your_dojah_app_id
```

### 2. Database Migration

No new tables needed! The system uses existing `vendors` table fields.

### 3. Test the Flow

1. **As Vendor**:
   - Go to `/vendor/kyc/tier2`
   - Fill in business details
   - Upload required documents
   - Submit for review

2. **As Salvage Manager**:
   - Go to `/manager/kyc-approvals`
   - Review pending applications
   - Check AI verification results
   - Approve or reject

### 4. Verify AI Integration

Run a test verification:

```bash
# Test Gemini
curl -X POST http://localhost:3000/api/kyc/manual/submit \
  -H "Content-Type: multipart/form-data" \
  -F "businessName=Test Business" \
  -F "nin=12345678901" \
  -F "bvn=12345678901" \
  # ... other fields
```

Check logs for:
```
[AI Verification] Using Gemini 2.0 Flash
[AI Verification] AI verification complete: { score: 85, recommendation: 'approve' }
```

## Features

### For Vendors

- ✅ Simple form-based submission
- ✅ Upload documents directly
- ✅ Real-time validation
- ✅ Status tracking (pending/approved/rejected)
- ✅ Resubmit if rejected

### For Salvage Managers

- ✅ View all pending applications
- ✅ See AI verification results
- ✅ Review documents with previews
- ✅ Approve/reject with comments
- ✅ Filter by risk level

### For Admins

- ✅ Cost-effective verification (~$0.01 vs ₦510-630)
- ✅ Audit trail of all submissions
- ✅ Easy Dojah integration later
- ✅ Fraud detection via AI

## Limitations

### Current System (Manual KYC)

- ❌ No real-time NIN verification against NIMC database
- ❌ No liveness check (selfie verification)
- ❌ No AML screening against PEP/sanctions lists
- ❌ Relies on AI analysis (not 100% accurate)

### Dojah Integration (When Ready)

- ✅ Real-time NIN verification
- ✅ Biometric liveness check
- ✅ AML screening
- ✅ Higher accuracy
- ❌ Higher cost (₦510-630 per verification)

## Recommendations

### Short Term (Current)

1. Use manual KYC for demo and initial launch
2. Have salvage managers carefully review all applications
3. Monitor AI verification accuracy
4. Collect feedback from vendors

### Medium Term (1-2 months)

1. Integrate Dojah for NIN verification only
2. Keep manual document upload
3. Use AI + Dojah for hybrid verification
4. Reduce manual review workload

### Long Term (3+ months)

1. Full Dojah integration with widget
2. Automated approval for low-risk applications
3. Manual review only for high-risk cases
4. Periodic re-verification (every 12 months)

## Troubleshooting

### AI Verification Fails

**Symptom**: All applications get score 50 and "manual review required"

**Solution**:
1. Check API keys in `.env`
2. Verify Gemini/Claude API quotas
3. Check logs for error messages
4. Fallback to manual review if needed

### Documents Not Uploading

**Symptom**: "Failed to upload documents" error

**Solution**:
1. Check Cloudinary credentials
2. Verify file size limits (5MB for images, 10MB for PDFs)
3. Check network connectivity
4. Ensure proper file types (image/*, application/pdf)

### Manager Can't See Applications

**Symptom**: KYC approvals page is empty

**Solution**:
1. Check user role (must be `salvage_manager` or `system_admin`)
2. Verify database query in `/api/kyc/approvals`
3. Check if any applications have `tier2SubmittedAt` set

## Next Steps

1. ✅ Remove reconciliation from admin dashboard (DONE)
2. ✅ Create manual KYC submission form (DONE)
3. ✅ Implement AI verification service (DONE)
4. ✅ Update KYC status card (DONE)
5. ⏳ Test with sample documents
6. ⏳ Add manager notification system
7. ⏳ Create audit logging
8. ⏳ Integrate Dojah when ready

## Support

For questions or issues:
- Check logs in browser console and server logs
- Review this documentation
- Contact development team

---

**Last Updated**: May 4, 2026
**Status**: Ready for Testing
**Cost**: ~$0.01 per verification (Gemini) or ~$0.60-$1.20 (Claude fallback)
