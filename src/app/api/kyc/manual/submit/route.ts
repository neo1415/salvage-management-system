import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';
import { getEncryptionService } from '@/features/kyc/services/encryption.service';
import { getKYCNotificationService } from '@/features/kyc/services/notification.service';
import { getDocumentUploadService } from '@/features/kyc/services/document-upload.service';

/**
 * POST /api/kyc/manual/submit
 * Manual Tier 2 KYC submission endpoint
 * Accepts form data with business details, personal info, bank account, and document uploads
 * 
 * IMPLEMENTATION STATUS:
 * ✅ Document upload to Supabase Storage implemented
 * ✅ Address fields stored in ninVerificationData for manager review
 * ✅ All sensitive data (NIN, BVN) encrypted before storage
 * ✅ File validation (type, size) implemented
 * ✅ Comprehensive error handling
 * 
 * FIELDS EXPECTED:
 * - businessName, businessType, cacNumber (optional), tin (optional)
 * - address, city, state (for address verification)
 * - nin, bvn (encrypted before storage)
 * - bankName, accountName, accountNumber
 * - Files: cacCertificate (if not individual), ninCard, utilityBill, bankStatement, photoId
 * 
 * FIELDS STORED IN DATABASE:
 * - businessName, businessType, cacNumber, tin
 * - ninEncrypted, bvnEncrypted
 * - bankName, bankAccountName, bankAccountNumber
 * - ninVerificationData (contains address data and NIN details)
 * - Document URLs: cacCertificateUrl, ninCardUrl, addressProofUrl, bankStatementUrl, photoIdUrl
 * - tier2SubmittedAt
 * 
 * SECURITY MEASURES:
 * - File type validation (only images and PDFs)
 * - File size limits (5MB per file)
 * - Encrypted storage for sensitive data (NIN, BVN)
 * - Private Supabase bucket (requires authentication)
 * - Transaction-based database updates (rollback on failure)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get vendor record
    const [vendor] = await db
      .select({ id: vendors.id, businessName: vendors.businessName })
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
    }

    // Parse form data with size limit check
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error('[Manual KYC Submit] FormData parse error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to parse form data. Please ensure each file is under 5MB and try again.',
          details: 'If you are uploading images, they will be automatically compressed. Please refresh and try again.'
        },
        { status: 400 }
      );
    }
    
    const businessName = formData.get('businessName') as string;
    const businessType = formData.get('businessType') as string;
    const cacNumber = formData.get('cacNumber') as string;
    const tin = formData.get('tin') as string;
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const state = formData.get('state') as string;
    const nin = formData.get('nin') as string;
    const bvn = formData.get('bvn') as string;
    const bankName = formData.get('bankName') as string;
    const accountName = formData.get('accountName') as string;
    const accountNumber = formData.get('accountNumber') as string;

    // Validate required fields
    if (!businessName || !nin || !bvn || !bankName || !accountName || !accountNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: businessName, nin, bvn, bankName, accountName, accountNumber' },
        { status: 400 }
      );
    }

    // Validate address fields (required for address verification)
    if (!address || !city || !state) {
      return NextResponse.json(
        { error: 'Missing required address fields: address, city, state' },
        { status: 400 }
      );
    }

    // Get files from form data
    const cacCertificate = formData.get('cacCertificate') as File | null;
    const ninCard = formData.get('ninCard') as File | null;
    const utilityBill = formData.get('utilityBill') as File | null;
    const bankStatement = formData.get('bankStatement') as File | null;
    const photoId = formData.get('photoId') as File | null;

    // Validate required documents
    if (!ninCard || !utilityBill || !bankStatement || !photoId) {
      return NextResponse.json(
        { error: 'Missing required documents: ninCard, utilityBill, bankStatement, photoId' },
        { status: 400 }
      );
    }

    // Validate CAC certificate for non-individual businesses
    if (businessType !== 'individual' && !cacCertificate) {
      return NextResponse.json(
        { error: 'CAC certificate is required for non-individual businesses' },
        { status: 400 }
      );
    }

    // SERVER-SIDE FILE SIZE VALIDATION
    // Maximum 5MB per file (5 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const filesToValidate: Array<{ file: File; name: string }> = [
      { file: ninCard, name: 'NIN Card' },
      { file: utilityBill, name: 'Utility Bill' },
      { file: bankStatement, name: 'Bank Statement' },
      { file: photoId, name: 'Photo ID' },
    ];

    if (cacCertificate) {
      filesToValidate.push({ file: cacCertificate, name: 'CAC Certificate' });
    }

    // Check each file size
    const oversizedFiles: string[] = [];
    for (const { file, name } of filesToValidate) {
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        oversizedFiles.push(`${name} (${sizeMB}MB)`);
      }
    }

    if (oversizedFiles.length > 0) {
      return NextResponse.json(
        {
          error: `The following files exceed the 5MB limit: ${oversizedFiles.join(', ')}`,
          details: 'Please compress your images or use smaller files. Images should be automatically compressed on upload - try refreshing the page and uploading again.',
        },
        { status: 400 }
      );
    }

    // Validate file types
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const invalidFiles: string[] = [];
    
    // Log file types for debugging
    console.log('[Manual KYC Submit] File type validation:');
    for (const { file, name } of filesToValidate) {
      console.log(`  ${name}: type="${file.type}", size=${file.size}, name="${file.name}"`);
      if (!ALLOWED_TYPES.includes(file.type)) {
        invalidFiles.push(`${name} (${file.type || 'undefined'})`);
      }
    }

    if (invalidFiles.length > 0) {
      console.error('[Manual KYC Submit] Invalid file types detected:', invalidFiles);
      return NextResponse.json(
        {
          error: `Invalid file types: ${invalidFiles.join(', ')}`,
          details: 'Only JPEG, PNG, WebP images and PDF files are allowed. Please ensure your files are in the correct format.',
        },
        { status: 400 }
      );
    }

    // Upload documents to Supabase Storage
    const uploadService = getDocumentUploadService();
    
    const documentsToUpload = [
      { file: ninCard, type: 'nin_card' as const },
      { file: utilityBill, type: 'utility_bill' as const },
      { file: bankStatement, type: 'bank_statement' as const },
      { file: photoId, type: 'photo_id' as const },
    ];

    // Add CAC certificate if provided
    if (cacCertificate) {
      documentsToUpload.push({ file: cacCertificate, type: 'cac_certificate' as const });
    }

    const { results, errors } = await uploadService.uploadMultipleDocuments(
      documentsToUpload,
      vendor.id
    );

    // Check for upload errors
    if (Object.keys(errors).length > 0) {
      const errorMessages = Object.entries(errors)
        .map(([type, err]) => `${type}: ${err.error}`)
        .join(', ');
      
      return NextResponse.json(
        { error: `Document upload failed: ${errorMessages}` },
        { status: 400 }
      );
    }

    // Encrypt sensitive data
    const enc = getEncryptionService();
    const ninEncrypted = enc.encrypt(nin);
    const bvnEncrypted = enc.encrypt(bvn);

    // Prepare address data for ninVerificationData
    const addressData = {
      address,
      city,
      state,
      submittedAt: new Date().toISOString(),
      // Store NIN details for manager review (encrypted NIN is in ninEncrypted field)
      ninLastFourDigits: nin.slice(-4),
    };

    // Update vendor record in a transaction
    await db.transaction(async (tx) => {
      await tx
        .update(vendors)
        .set({
          businessName,
          businessType: businessType as 'individual' | 'sole_proprietor' | 'limited_company',
          cacNumber: cacNumber || null,
          tin: tin || null,
          ninEncrypted,
          bvnEncrypted,
          bankName,
          bankAccountName: accountName,
          bankAccountNumber: accountNumber,
          // Store address data in ninVerificationData for manager review
          ninVerificationData: addressData,
          // Store document PATHS (not public URLs) for signed URL generation
          cacCertificateUrl: results.cac_certificate?.path || null,
          ninCardUrl: results.nin_card?.path || null,
          addressProofUrl: results.utility_bill?.path || null,
          bankStatementUrl: results.bank_statement?.path || null,
          photoIdUrl: results.photo_id?.path || null,
          tier2SubmittedAt: new Date(),
          // CRITICAL FIX: Do NOT set tier2ApprovedAt or change tier here
          // The vendor should remain in pending_review status until manager approves
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendor.id));
    });

    // Send notification
    const notify = getKYCNotificationService();
    await notify.sendKYCUnderReviewNotification({
      vendorId: vendor.id,
      userId,
      phone: session.user.phone ?? '',
      email: session.user.email ?? '',
      fullName: session.user.name ?? '',
    });

    return NextResponse.json({
      success: true,
      message: 'KYC application submitted successfully',
      documentsUploaded: Object.keys(results),
    });
  } catch (error) {
    console.error('[Manual KYC Submit] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit KYC application' },
      { status: 500 }
    );
  }
}
