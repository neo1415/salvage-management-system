import { after, NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { getEncryptionService } from '@/features/kyc/services/encryption.service';
import { getKYCNotificationService } from '@/features/kyc/services/notification.service';
import { createRoleNotifications } from '@/features/notifications/services/notification.service';
import { getDocumentUploadService } from '@/features/kyc/services/document-upload.service';
import { getDojahService } from '@/features/kyc/services/dojah.service';
import { getProviderVerificationService } from '@/features/kyc/services/provider-verification.service';
import { buildDojahReference } from '@/features/kyc/utils/dojah-reference';
import type { NormalizedVerificationResult } from '@/features/kyc/types/provider-verification.types';

/**
 * POST /api/kyc/manual/submit
 * Manual Tier 2 KYC submission endpoint
 * Accepts form data with business details, identity details, address, and document uploads.
 * 
 * IMPLEMENTATION STATUS:
 * ✅ Document upload to Supabase Storage implemented
 * ✅ Address fields stored in ninVerificationData for manager review
 * ✅ All sensitive data (NIN, BVN) encrypted before storage
 * ✅ File validation (type, size) implemented
 * ✅ Comprehensive error handling
 * 
 * FIELDS EXPECTED:
 * - businessName, businessType, cacNumber
 * - address, city, state (for address verification)
 * - nin, bvn (BVN required only if Tier 1 has not already verified it)
 * - businessDocumentType, governmentIdType
 * - Files: businessDocument, governmentIdDocument, addressProof
 * 
 * FIELDS STORED IN DATABASE:
 * - businessName, businessType, cacNumber
 * - ninEncrypted, bvnEncrypted
 * - ninVerificationData (contains address data and NIN details)
 * - Document URLs: cacCertificateUrl, ninCardUrl, addressProofUrl, photoIdUrl
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
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        bvnVerifiedAt: vendors.bvnVerifiedAt,
        registrationFeePaid: vendors.registrationFeePaid,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        dateOfBirth: users.dateOfBirth,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
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
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const state = formData.get('state') as string;
    const nin = formData.get('nin') as string;
    const bvn = (formData.get('bvn') as string | null)?.trim() || '';
    const businessDocumentType = (formData.get('businessDocumentType') as string | null) || 'cac_certificate';
    const governmentIdType = (formData.get('governmentIdType') as string | null) || 'nin_slip';
    const needsBvn = !vendor.bvnVerifiedAt;

    // Validate required fields
    if (!businessName || !businessType || !nin || (needsBvn && !bvn)) {
      return NextResponse.json(
        { error: needsBvn ? 'Missing required fields: businessName, businessType, nin, bvn' : 'Missing required fields: businessName, businessType, nin' },
        { status: 400 }
      );
    }

    if (!/^\d{11}$/.test(nin)) {
      return NextResponse.json({ error: 'NIN must be exactly 11 digits.' }, { status: 400 });
    }

    if (needsBvn && !/^\d{11}$/.test(bvn)) {
      return NextResponse.json({ error: 'BVN must be exactly 11 digits.' }, { status: 400 });
    }

    // Validate address fields (required for address verification)
    if (!address || !city || !state) {
      return NextResponse.json(
        { error: 'Missing required address fields: address, city, state' },
        { status: 400 }
      );
    }

    // Get files from form data
    const businessDocument = formData.get('businessDocument') as File | null;
    const governmentIdDocument = formData.get('governmentIdDocument') as File | null;
    const addressProof = formData.get('addressProof') as File | null;

    // Validate required documents
    if (!governmentIdDocument || !addressProof) {
      return NextResponse.json(
        { error: 'Missing required documents: governmentIdDocument, addressProof' },
        { status: 400 }
      );
    }

    // Validate business document for non-individual businesses
    if (businessType !== 'individual' && !businessDocument) {
      return NextResponse.json(
        { error: 'Business registration document is required for non-individual businesses' },
        { status: 400 }
      );
    }

    // SERVER-SIDE FILE SIZE VALIDATION
    // Maximum 5MB per file (5 * 1024 * 1024 bytes)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const filesToValidate: Array<{ file: File; name: string }> = [
      { file: governmentIdDocument, name: 'Government ID' },
      { file: addressProof, name: 'Proof of Address' },
    ];

    if (businessDocument) {
      filesToValidate.push({ file: businessDocument, name: 'Business Document' });
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
    
    const documentsToUpload: Array<{
      file: File;
      type: 'cac_certificate' | 'nin_card' | 'utility_bill' | 'bank_statement' | 'photo_id' | 'selfie';
    }> = [
      { file: governmentIdDocument, type: 'photo_id' as const },
      { file: addressProof, type: 'utility_bill' as const },
    ];

    // Add business registration document if provided
    if (businessDocument) {
      documentsToUpload.push({ file: businessDocument, type: 'cac_certificate' as const });
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
    const bvnEncrypted = bvn ? enc.encrypt(bvn) : null;

    // Prepare address data for ninVerificationData
    const addressData = {
      address,
      city,
      state,
      submittedAt: new Date().toISOString(),
      // Store NIN details for manager review (encrypted NIN is in ninEncrypted field)
      ninLastFourDigits: nin.slice(-4),
      businessDocumentType,
      governmentIdType,
      bvnLastFourDigits: bvn ? bvn.slice(-4) : undefined,
      bvnSource: vendor.bvnVerifiedAt ? 'tier1_verified' : 'tier2_submitted',
    };
    const providerReference = buildDojahReference(vendor.id);
    const providerEvidence = await collectHybridProviderEvidence({
      providerReference,
      fullName: vendor.fullName ?? session.user.name ?? businessName,
      dateOfBirth: vendor.dateOfBirth ? new Date(vendor.dateOfBirth).toISOString().slice(0, 10) : undefined,
      nin,
      bvn,
      cacNumber,
      businessName,
      businessType,
      businessDocumentType,
      governmentIdType,
      addressData,
      documents: {
        addressProof: results.utility_bill?.path,
        photoId: results.photo_id?.path,
        businessDocument: results.cac_certificate?.path,
      },
      bvnAlreadyVerified: Boolean(vendor.bvnVerifiedAt),
    });

    // Update vendor record in a transaction
    await db.transaction(async (tx) => {
      await tx
        .update(vendors)
        .set({
          businessName,
          businessType,
          cacNumber: cacNumber || null,
          ninEncrypted,
          ...(bvnEncrypted ? { bvnEncrypted } : {}),
          // Store address data in ninVerificationData for manager review
          ninVerificationData: addressData,
          // Store document PATHS (not public URLs) for signed URL generation
          cacCertificateUrl: results.cac_certificate?.path || null,
          ninCardUrl: results.photo_id?.path || null,
          addressProofUrl: results.utility_bill?.path || null,
          photoIdUrl: results.photo_id?.path || null,
          photoIdType: governmentIdType,
          tier2SubmittedAt: new Date(),
          tier2DojahReferenceId: providerReference,
          amlScreeningData: providerEvidence.normalizedResult.dojahEvidenceSummary ?? null,
          amlRiskLevel: providerEvidence.riskLevel,
          amlScreenedAt: providerEvidence.checksCompleted.includes('aml_screening') ? new Date() : null,
          fraudRiskScore: providerEvidence.riskLevel === 'critical'
            ? '95'
            : providerEvidence.riskLevel === 'high'
              ? '80'
              : providerEvidence.riskLevel === 'medium'
                ? '55'
                : '20',
          fraudFlags: providerEvidence.reasonCodes,
          // CRITICAL FIX: Do NOT set tier2ApprovedAt or change tier here
          // The vendor should remain in pending_review status until manager approves
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendor.id));
    });

    await getProviderVerificationService().persistVerification({
      userId,
      vendorId: vendor.id,
      actorId: userId,
      result: providerEvidence,
      rawPayload: {
        source: 'nem_hybrid_tier2_submit',
        dojahEvidence: providerEvidence.normalizedResult.dojahEvidenceSummary,
      },
    }).catch((error) => {
      console.error('[Manual KYC Submit] Provider evidence persistence failed:', error);
    });

    after(async () => {
      const notify = getKYCNotificationService();
      await Promise.allSettled([
        notify.sendKYCUnderReviewNotification({
          vendorId: vendor.id,
          userId,
          phone: session.user.phone ?? '',
          email: session.user.email ?? '',
          fullName: session.user.name ?? '',
        }),
        createRoleNotifications(['salvage_manager', 'system_admin'], {
          type: 'tier2_pending_review',
          title: 'Tier 2 KYC Pending Review',
          message: `${session.user.name || 'A vendor'} submitted Tier 2 verification for approval.`,
          data: {
            vendorId: vendor.id,
            url: '/manager/kyc-approvals',
          },
        }),
      ]).then((results) => {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error('[Manual KYC Submit] Deferred notification failed', {
              index,
              error: result.reason,
            });
          }
        });
      });
    });

    return NextResponse.json({
      success: true,
      message: 'KYC application submitted successfully',
      documentsUploaded: Object.keys(results),
      providerReference,
      livenessRequired: true,
    });
  } catch (error) {
    console.error('[Manual KYC Submit] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit KYC application' },
      { status: 500 }
    );
  }
}

type HybridEvidenceInput = {
  providerReference: string;
  fullName: string;
  dateOfBirth?: string;
  nin: string;
  bvn: string;
  cacNumber?: string;
  businessName: string;
  businessType: string;
  businessDocumentType: string;
  governmentIdType: string;
  addressData: Record<string, unknown>;
  documents: Record<string, string | undefined>;
  bvnAlreadyVerified: boolean;
};

function riskLevelFromFailures(failedChecks: string[]): NormalizedVerificationResult['riskLevel'] {
  if (failedChecks.some((check) => ['aml_screening', 'nin_lookup'].includes(check))) return 'high';
  if (failedChecks.length >= 2) return 'medium';
  return 'low';
}

function splitName(fullName: string): { firstName: string; middleName?: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unknown', lastName: 'Unknown' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
    lastName: parts[parts.length - 1],
  };
}

async function collectHybridProviderEvidence(input: HybridEvidenceInput): Promise<NormalizedVerificationResult> {
  const checksCompleted = new Set<string>([
    'nem_business_profile_submitted',
    'nem_address_submitted',
    'nem_documents_uploaded',
  ]);
  const pendingChecks = new Set<string>(['manager_identity_review', 'manager_document_review', 'dojah_liveness']);
  const failedChecks = new Set<string>();
  const reasonCodes = new Set<string>();
  const dojahEvidenceSummary: Record<string, unknown> = {};

  if (input.bvnAlreadyVerified) checksCompleted.add('tier1_bvn_verified');
  else if (input.bvn) pendingChecks.add('tier2_bvn_validation');
  else pendingChecks.add('tier1_bvn_verification');

  try {
    const dojah = getDojahService();

    if (!input.bvnAlreadyVerified && input.bvn) {
      try {
        const bvnName = splitName(input.fullName);
        const bvnResult = await dojah.validateBVN({
          bvn: input.bvn,
          firstName: bvnName.firstName,
          middleName: bvnName.middleName,
          lastName: bvnName.lastName,
          dateOfBirth: input.dateOfBirth,
          customerReference: `${input.providerReference}-bvn`,
        });
        checksCompleted.add('tier2_bvn_validation');
        pendingChecks.delete('tier2_bvn_validation');
        dojahEvidenceSummary.bvn = {
          status: bvnResult.status ?? null,
          message: bvnResult.message ?? null,
          bvnValid: bvnResult.entity?.bvn?.status ?? null,
          firstNameConfidence: bvnResult.entity?.first_name?.confidence_value ?? null,
          lastNameConfidence: bvnResult.entity?.last_name?.confidence_value ?? null,
          dobMatched: bvnResult.entity?.dob?.status ?? null,
          lastFour: input.bvn.slice(-4),
        };
        if (bvnResult.status === false || bvnResult.entity?.bvn?.status === false) {
          failedChecks.add('tier2_bvn_validation');
          reasonCodes.add('dojah_bvn_validation_failed');
        }
      } catch (error) {
        pendingChecks.add('tier2_bvn_validation');
        reasonCodes.add('dojah_bvn_validation_unavailable');
        dojahEvidenceSummary.bvn = {
          status: 'unavailable',
          message: error instanceof Error ? error.message : 'BVN validation unavailable',
          lastFour: input.bvn.slice(-4),
        };
      }
    }

    try {
      const ninResult = await dojah.verifyNINAdvanced(input.nin);
      const providerName = extractPersonNameFromProviderResult(ninResult);
      const providerBirthDate = extractBirthDateFromProviderResult(ninResult);
      const nameMatched = nameLooksClose(input.fullName, providerName);
      const dobMatched = !input.dateOfBirth || !providerBirthDate || providerBirthDate === input.dateOfBirth;
      checksCompleted.add('nin_lookup');
      dojahEvidenceSummary.nin = {
        status: ninResult.status ?? null,
        message: ninResult.message ?? null,
        hasEntity: Boolean(ninResult.entity),
        providerName: providerName || null,
        nameMatched,
        dobMatched,
        lastFour: input.nin.slice(-4),
      };
      if (ninResult.status === false || (providerName && (!nameMatched || !dobMatched))) {
        failedChecks.add('nin_lookup');
        reasonCodes.add('dojah_nin_lookup_failed');
      }
    } catch (error) {
      pendingChecks.add('nin_lookup');
      reasonCodes.add('dojah_nin_lookup_unavailable');
      dojahEvidenceSummary.nin = {
        status: 'unavailable',
        message: error instanceof Error ? error.message : 'NIN lookup unavailable',
        lastFour: input.nin.slice(-4),
      };
    }

    if (input.cacNumber?.trim()) {
      try {
        const cacResult = await dojah.verifyCAC(input.cacNumber.trim(), input.businessName);
        checksCompleted.add('business_registration_lookup');
        const providerError = providerErrorMessage(cacResult);
        const providerBusinessName = extractBusinessNameFromCACResult(cacResult);
        const nameMatch = businessNameLooksClose(input.businessName, providerBusinessName);
        dojahEvidenceSummary.cac = {
          status: cacResult.status ?? null,
          message: cacResult.message ?? null,
          hasEntity: Boolean(cacResult.entity),
          providerBusinessName: providerBusinessName || null,
          businessNameMatched: nameMatch,
          submittedBusinessName: input.businessName,
          submittedBusinessType: input.businessType,
          registrationNumberLastFour: input.cacNumber.trim().slice(-4),
        };
        if (providerError && /unable to reach|unavailable|timeout|service/i.test(providerError)) {
          pendingChecks.add('business_registration_lookup');
          reasonCodes.add('dojah_cac_lookup_unavailable');
        } else if (cacResult.status === false) {
          failedChecks.add('business_registration_lookup');
          reasonCodes.add('dojah_cac_lookup_failed');
        }
      } catch (error) {
        pendingChecks.add('business_registration_lookup');
        reasonCodes.add('dojah_cac_lookup_unavailable');
        dojahEvidenceSummary.cac = {
          status: 'unavailable',
          message: error instanceof Error ? error.message : 'Business registration lookup unavailable',
          submittedBusinessName: input.businessName,
          submittedBusinessType: input.businessType,
          registrationNumberLastFour: input.cacNumber.trim().slice(-4),
        };
      }
    } else {
      pendingChecks.add('business_registration_lookup');
    }

    if (input.dateOfBirth) {
      try {
        const amlResult = await dojah.screenAML(input.fullName, input.dateOfBirth);
        checksCompleted.add('aml_screening');
        dojahEvidenceSummary.aml = {
          status: amlResult.status ?? null,
          hasPepHits: (amlResult.entity?.pep?.length ?? 0) > 0,
          hasSanctionHits: (amlResult.entity?.sanctions?.length ?? 0) > 0,
          hasAdverseMediaHits: (amlResult.entity?.adverse_media?.length ?? 0) > 0,
        };
        if (
          (amlResult.entity?.pep?.length ?? 0) > 0 ||
          (amlResult.entity?.sanctions?.length ?? 0) > 0 ||
          (amlResult.entity?.adverse_media?.length ?? 0) > 0
        ) {
          failedChecks.add('aml_screening');
          reasonCodes.add('dojah_aml_flagged');
        }
      } catch (error) {
        pendingChecks.add('aml_screening');
        reasonCodes.add('dojah_aml_unavailable');
        dojahEvidenceSummary.aml = {
          status: 'unavailable',
          message: error instanceof Error ? error.message : 'AML screening unavailable',
        };
      }
    } else {
      pendingChecks.add('aml_screening');
      reasonCodes.add('date_of_birth_missing_for_aml');
    }
  } catch (error) {
    pendingChecks.add('provider_api_checks');
    reasonCodes.add('dojah_provider_unavailable');
    dojahEvidenceSummary.provider = {
      status: 'unavailable',
      message: error instanceof Error ? error.message : 'Dojah provider unavailable',
    };
  }

  const failed = [...failedChecks];
  const riskLevel = riskLevelFromFailures(failed);

  return {
    provider: 'dojah',
    providerReference: input.providerReference,
    workflowReference: 'nem-hybrid-tier2',
    verificationType: 'tier2',
    status: 'review_required',
    riskLevel,
    checksCompleted: [...checksCompleted],
    pendingChecks: [...pendingChecks],
    failedChecks: failed,
    reasonCodes: [...reasonCodes],
    displayMessage: 'Tier 2 evidence was submitted through NEM Salvage and is ready for internal review.',
    normalizedResult: {
      verificationMode: 'nem_hybrid_manual_review',
      verificationStatus: 'submitted_for_review',
      providerMessage: 'NEM Salvage collected business, address, and government ID evidence directly. Dojah API checks are used as supporting evidence when available.',
      nemSubmittedProfile: {
        fullName: input.fullName,
        businessName: input.businessName,
        businessType: input.businessType,
        businessRegistrationNumber: input.cacNumber ? `****${input.cacNumber.slice(-4)}` : 'Not provided',
      },
      documentMetadata: {
        businessDocumentType: input.businessDocumentType,
        governmentIdType: input.governmentIdType,
        businessDocument: Boolean(input.documents.businessDocument),
        addressProof: Boolean(input.documents.addressProof),
        photoId: Boolean(input.documents.photoId),
      },
      addressStatus: 'submitted_for_manual_review',
      addressData: input.addressData,
      maskedIdentityValue: `****${input.nin.slice(-4)}`,
      livenessScore: null,
      biometricMatchScore: null,
      livenessStatus: 'pending_liveness',
      dojahEvidenceSummary,
    },
  };
}

function normalizeBusinessName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(plc|ltd|limited|incorporated|inc|company|co|nigeria|ng|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nameLooksClose(expected: string, actual?: string | null): boolean {
  if (!actual) return false;
  const left = normalizeBusinessName(expected);
  const right = normalizeBusinessName(actual);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftTokens = new Set(left.split(/\s+/).filter((token) => token.length > 1));
  const rightTokens = right.split(/\s+/).filter((token) => token.length > 1);
  if (!leftTokens.size || !rightTokens.length) return false;
  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.length) >= 0.55;
}

function businessNameLooksClose(expected: string, actual?: string | null): boolean {
  return nameLooksClose(expected, actual);
}

function providerErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const error = record.error ?? record.message;
  return typeof error === 'string' && error.trim() ? error.trim() : null;
}

function extractPersonNameFromProviderResult(value: unknown): string | null {
  const seen = new Set<unknown>();
  const fullNameKeys = ['full_name', 'fullName', 'name'];
  const partKeys = ['firstname', 'first_name', 'middlename', 'middle_name', 'surname', 'last_name', 'lastname'];

  function walk(node: unknown): string | null {
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    }

    const record = node as Record<string, unknown>;
    for (const key of fullNameKeys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    const parts = partKeys
      .map((key) => record[key])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (parts.length >= 2) return parts.join(' ');

    for (const child of Object.values(record)) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }

  return walk(value);
}

function extractBirthDateFromProviderResult(value: unknown): string | null {
  const seen = new Set<unknown>();
  const dateKeys = new Set(['birthdate', 'birth_date', 'date_of_birth', 'dob', 'dateOfBirth']);

  function walk(node: unknown): string | null {
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    }

    const record = node as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (dateKeys.has(key) && (typeof child === 'string' || child instanceof Date)) {
        const value = String(child).slice(0, 10);
        if (value) return value;
      }
    }

    for (const child of Object.values(record)) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }

  return walk(value);
}

function extractBusinessNameFromCACResult(value: unknown): string | null {
  const seen = new Set<unknown>();
  const keys = new Set([
    'company_name',
    'companyName',
    'business_name',
    'businessName',
    'registered_name',
    'registeredName',
    'name',
  ]);

  function walk(node: unknown): string | null {
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    }

    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const child = record[key];
      if (keys.has(key) && typeof child === 'string' && child.trim()) {
        return child.trim();
      }
    }

    for (const child of Object.values(record)) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }

  return walk(value);
}
