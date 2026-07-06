import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/auth-helpers';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { uploadFile } from '@/lib/storage/cloudinary';
import {
  AuditActionType,
  AuditEntityType,
  getDeviceTypeFromUserAgent,
  getIpAddress,
  logAction,
} from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import { extractNINFromDocument } from '@/lib/integrations/google-document-ai';
import { verifyNIN } from '@/lib/integrations/nin-verification';
import { verifyBankAccount } from '@/lib/integrations/paystack-bank-verification';
import { z } from 'zod';
import { appPath } from '@/features/notifications/templates/email-urls';
import { brandTeamName, getEmailBranding } from '@/features/notifications/templates/email-branding';
import {
  businessPolicyService,
  getBusinessPolicyRuntimeMode,
  isBusinessPolicyEnforcementEnabled,
  logPolicyDecision,
  resolveTier2Access,
} from '@/features/business-policy';
import { recordImageUploadMetadataBatch } from '@/features/media/services/image-upload-metadata.service';

/**
 * Tier 2 KYC API
 * Handles full business documentation verification for vendors
 *
 * Requirements:
 * - Accept document uploads (CAC certificate, bank statement, NIN card)
 * - Upload documents to Cloudinary with encryption
 * - Extract NIN from ID using Google Document AI OCR
 * - Verify NIN via API
 * - Verify bank account via Paystack Bank Account Resolution API
 * - Validate CAC number against SCUML/CAC database (if available)
 * - Set status to 'pending' for manual review
 * - Notify Salvage Manager
 * - Send SMS + Email to vendor
 */

// Validation schema
const tier2KYCSchema = z.object({
  businessName: z.string().min(2, 'Business name is required'),
  cacNumber: z.string().min(5, 'CAC number is required'),
  tin: z.string().optional(),
  bankAccountNumber: z.string().regex(/^\d{10}$/, 'Bank account must be 10 digits'),
  bankCode: z.string().min(3, 'Bank code is required'),
  bankName: z.string().min(2, 'Bank name is required'),
});

function maskLast4(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return `***${value.slice(-4)}`;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check if user is a vendor
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.role !== 'vendor') {
      return NextResponse.json(
        { error: 'Only vendors can submit Tier 2 KYC' },
        { status: 403 }
      );
    }

    // Check if vendor exists and is Tier 1
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    const ipAddress = getIpAddress(request.headers);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = getDeviceTypeFromUserAgent(userAgent);

    const policy = await businessPolicyService.getEffectivePolicy();
    const branding = await getEmailBranding();
    const tier2AccessDecision = resolveTier2Access(policy, {
      tier: vendor.tier === 'tier2_full' ? 'tier2_full' : vendor.tier === 'tier1_bvn' ? 'tier1_bvn' : 'tier0',
      bvnVerified: Boolean(vendor.bvnVerifiedAt),
      registrationFeePaid: Boolean(vendor.registrationFeePaid),
    });

    await logPolicyDecision({
      userId,
      entityType: AuditEntityType.KYC,
      entityId: vendor.id,
      ipAddress,
      userAgent,
      deviceType,
      decision: tier2AccessDecision.decision,
      context: {
        source: 'api/vendors/tier2-kyc',
        runtimeMode: getBusinessPolicyRuntimeMode(),
      },
    }).catch((error) => {
      console.warn('[BusinessPolicy] Failed to audit legacy Tier 2 access decision', {
        vendorId: vendor.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    const policyEnforcementEnabled = isBusinessPolicyEnforcementEnabled();

    if (!tier2AccessDecision.allowed && policyEnforcementEnabled) {
      return NextResponse.json(
        {
          error: 'Tier 2 KYC is not available',
          message: tier2AccessDecision.message,
          reason: tier2AccessDecision.value,
        },
        { status: 403 }
      );
    }

    if (user.status !== 'verified_tier_1' && !(policyEnforcementEnabled && tier2AccessDecision.allowed)) {
      return NextResponse.json(
        { error: 'You must complete Tier 1 KYC before applying for Tier 2' },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();

    const businessName = formData.get('businessName') as string;
    const cacNumber = formData.get('cacNumber') as string;
    const tin = formData.get('tin') as string | null;
    const bankAccountNumber = formData.get('bankAccountNumber') as string;
    const bankCode = formData.get('bankCode') as string;
    const bankName = formData.get('bankName') as string;

    const cacCertificate = formData.get('cacCertificate') as File | null;
    const bankStatement = formData.get('bankStatement') as File | null;
    const ninCard = formData.get('ninCard') as File | null;

    // Validate required fields
    const validation = tier2KYCSchema.safeParse({
      businessName,
      cacNumber,
      tin: tin || undefined,
      bankAccountNumber,
      bankCode,
      bankName,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Validate file uploads
    if (!cacCertificate || !bankStatement || !ninCard) {
      return NextResponse.json(
        { error: 'All documents are required: CAC certificate, bank statement, and NIN card' },
        { status: 400 }
      );
    }

    // Validate file sizes
    if (cacCertificate.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'CAC certificate must be less than 5MB' },
        { status: 400 }
      );
    }

    if (bankStatement.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Bank statement must be less than 10MB' },
        { status: 400 }
      );
    }

    if (ninCard.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'NIN card must be less than 5MB' },
        { status: 400 }
      );
    }

    // Log KYC initiation
    await logAction({
      userId,
      actionType: AuditActionType.TIER2_KYC_INITIATED,
      entityType: AuditEntityType.KYC,
      entityId: vendor.id,
      ipAddress,
      deviceType,
      userAgent,
      afterState: { businessName, cacNumber },
    });

    // Upload documents to Cloudinary
    const cacBuffer = Buffer.from(await cacCertificate.arrayBuffer());
    const bankStatementBuffer = Buffer.from(await bankStatement.arrayBuffer());
    const ninCardBuffer = Buffer.from(await ninCard.arrayBuffer());

    const [cacUpload, bankStatementUpload, ninCardUpload] = await Promise.all([
      uploadFile(cacBuffer, { folder: `kyc-documents/${vendor.id}`, publicId: 'cac-certificate' }),
      uploadFile(bankStatementBuffer, { folder: `kyc-documents/${vendor.id}`, publicId: 'bank-statement' }),
      uploadFile(ninCardBuffer, { folder: `kyc-documents/${vendor.id}`, publicId: 'nin-card' }),
    ]);

    const cacUrl = cacUpload.secureUrl;
    const bankStatementUrl = bankStatementUpload.secureUrl;
    const ninCardUrl = ninCardUpload.secureUrl;

    await recordImageUploadMetadataBatch([
      {
        file: cacCertificate,
        buffer: cacBuffer,
        url: cacUrl,
        index: 0,
        purpose: 'kyc_cac_certificate',
      },
      {
        file: bankStatement,
        buffer: bankStatementBuffer,
        url: bankStatementUrl,
        index: 1,
        purpose: 'kyc_bank_statement',
      },
      {
        file: ninCard,
        buffer: ninCardBuffer,
        url: ninCardUrl,
        index: 2,
        purpose: 'kyc_nin_card',
      },
    ].filter((document) => document.file.type.startsWith('image/')).map((document) => ({
      entityType: 'kyc_document',
      entityId: vendor.id,
      imageUrl: document.url,
      imageIndex: document.index,
      purpose: document.purpose,
      uploadedBy: userId,
      serverBuffer: document.buffer,
      fallbackMimeType: document.file.type,
      clientMetadata: {
        index: document.index,
        name: document.file.name,
        size: document.file.size,
        type: document.file.type,
        lastModified: document.file.lastModified,
        captureSource: 'server_upload',
      },
    })));

    // Extract NIN from uploaded ID using Google Document AI
    let extractedNIN: string | null = null;
    let ninVerified = false;
    let ninVerificationMessage = '';

    try {
      const ninData = await extractNINFromDocument(
        ninCardBuffer,
        ninCard.type || 'image/jpeg'
      );

      extractedNIN = ninData.nin;

      if (extractedNIN) {
        // Verify NIN against government database
        const ninVerification = await verifyNIN(
          extractedNIN,
          user.fullName,
          user.dateOfBirth.toISOString().split('T')[0]
        );

        ninVerified = ninVerification.verified;
        ninVerificationMessage = ninVerification.message;

        await logAction({
          userId,
          actionType: ninVerified
            ? AuditActionType.NIN_VERIFIED
            : AuditActionType.BVN_VERIFICATION_FAILED,
          entityType: AuditEntityType.KYC,
          entityId: vendor.id,
          ipAddress,
          deviceType,
          userAgent,
          afterState: { nin: maskLast4(extractedNIN), message: ninVerificationMessage },
        });
      }
    } catch (error) {
      console.error('Error extracting/verifying NIN:', error);
      ninVerificationMessage = 'NIN extraction failed. Manual review required.';
    }

    // Verify bank account using Paystack
    let bankAccountVerified = false;
    let bankAccountName: string | null = null;
    let bankVerificationMessage = '';

    try {
      const bankVerification = await verifyBankAccount(bankAccountNumber, bankCode);

      bankAccountVerified = bankVerification.verified;
      bankAccountName = bankVerification.accountName;
      bankVerificationMessage = bankVerification.message;

      // Check if account name matches business name (fuzzy match)
      if (bankAccountVerified && bankAccountName) {
        const normalizedAccountName = bankAccountName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedBusinessName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (!normalizedAccountName.includes(normalizedBusinessName) &&
            !normalizedBusinessName.includes(normalizedAccountName)) {
          bankVerificationMessage += ' Warning: Account name does not match business name.';
        }
      }

      await logAction({
        userId,
        actionType: bankAccountVerified
          ? AuditActionType.BANK_DETAILS_VERIFIED
          : AuditActionType.BVN_VERIFICATION_FAILED,
        entityType: AuditEntityType.KYC,
        entityId: vendor.id,
        ipAddress,
        deviceType,
        userAgent,
        afterState: {
          accountNumber: maskLast4(bankAccountNumber),
          accountName: bankAccountName,
          message: bankVerificationMessage
        },
      });
    } catch (error) {
      console.error('Error verifying bank account:', error);
      bankVerificationMessage = 'Bank verification failed. Manual review required.';
    }

    // Update vendor record
    await db
      .update(vendors)
      .set({
        businessName,
        cacNumber,
        tin: tin || null,
        bankAccountNumber,
        bankName,
        bankAccountName: bankAccountName || null,
        cacCertificateUrl: cacUrl,
        bankStatementUrl: bankStatementUrl,
        ninCardUrl: ninCardUrl,
        ninVerified: ninVerified ? new Date() : null,
        bankAccountVerified: bankAccountVerified ? new Date() : null,
        status: 'pending', // Pending manager approval
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendor.id));

    // Log CAC upload
    await logAction({
      userId,
      actionType: AuditActionType.CAC_UPLOADED,
      entityType: AuditEntityType.KYC,
      entityId: vendor.id,
      ipAddress,
      deviceType,
      userAgent,
      afterState: { cacNumber, documentUploaded: true },
    });

    // Log Tier 2 KYC submission
    await logAction({
      userId,
      actionType: AuditActionType.TIER2_KYC_SUBMITTED,
      entityType: AuditEntityType.KYC,
      entityId: vendor.id,
      ipAddress,
      deviceType,
      userAgent,
      afterState: {
        businessName,
        cacNumber,
        ninVerified,
        bankAccountVerified,
        documentsUploaded: {
          cac: Boolean(cacUrl),
          bankStatement: Boolean(bankStatementUrl),
          ninCard: Boolean(ninCardUrl),
        },
      },
    });

    // Send SMS notification to vendor
    try {
      await smsService.sendSMS({
        to: user.phone,
        message: `${branding.brandName}: Your verification application is under review. We'll notify you once it has been reviewed.`,
      });
    } catch (error) {
      console.error('Error sending SMS:', error);
    }

    // Send email notification to vendor
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Verification Application Submitted',
        html: `
          <h2>Verification Application Submitted</h2>
          <p>Dear ${user.fullName},</p>
          <p>Your verification application has been submitted successfully and is now under review.</p>
          <h3>Verification Status:</h3>
          <ul>
            <li>BVN: ✓ Verified</li>
            <li>NIN: ${ninVerified ? '✓ Verified' : '⏳ Pending Review'}</li>
            <li>Bank Account: ${bankAccountVerified ? '✓ Verified' : '⏳ Pending Review'}</li>
            <li>CAC: ⏳ Pending Manual Review</li>
          </ul>
          <p>Our team will review your application. You'll receive a notification once the review is complete.</p>
          <p>Best regards,<br>${brandTeamName(branding)}</p>
        `,
      });
    } catch (error) {
      console.error('Error sending email:', error);
    }

    // Notify Salvage Manager about new Tier 2 KYC submission
    try {
      // Get all Salvage Managers
      const managers = await db
        .select()
        .from(users)
        .where(eq(users.role, 'salvage_manager'));

      // Send notification to each manager
      for (const manager of managers) {
        // Send SMS notification
        if (manager.phone) {
          await smsService.sendSMS({
            to: manager.phone,
            message:`New verification application from ${businessName} (${vendor.businessName || 'N/A'}). Please review in the manager dashboard.`,
          });
        }

        // Send email notification
        if (manager.email) {
          await emailService.sendEmail({
            to: manager.email,
            subject: 'New Verification Application - Action Required',
            html: `
              <h2>New Verification Application</h2>
              <p>A vendor has submitted a verification application that requires your review.</p>
              <h3>Vendor Details:</h3>
              <ul>
                <li><strong>Business Name:</strong> ${businessName}</li>
                <li><strong>CAC Number:</strong> ${cacNumber}</li>
                <li><strong>Bank Account:</strong> ${bankAccountNumber} (${bankName})</li>
                <li><strong>Vendor Name:</strong> ${vendor.businessName || 'N/A'}</li>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Phone:</strong> ${user.phone || 'N/A'}</li>
              </ul>
              <h3>Verification Status:</h3>
              <ul>
                <li><strong>BVN:</strong> ✓ Verified</li>
                <li><strong>NIN:</strong> ${ninVerified ? '✓ Verified' : '✗ Not Verified'}</li>
                <li><strong>Bank Account:</strong> ${bankAccountVerified ? '✓ Verified' : '✗ Not Verified'}</li>
                <li><strong>CAC:</strong> Pending Manual Review</li>
              </ul>
              <p>Please log in to the admin panel to review the application and uploaded documents.</p>
              <p><a href="${appPath('/manager/vendors')}" style="background-color: ${branding.primaryColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Review Application</a></p>
              <p>Best regards,<br>${brandTeamName(branding)}</p>
            `,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying managers:', error);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Verification application submitted successfully',
      data: {
        status: 'pending',
        verificationStatus: {
          bvn: true,
          nin: ninVerified,
          bankAccount: bankAccountVerified,
          cac: false, // Requires manual review
        },
        documents: {
          cacCertificate: cacUrl,
          bankStatement: bankStatementUrl,
          ninCard: ninCardUrl,
        },
        extractedNIN,
        bankAccountName,
      },
    });
  } catch (error) {
    console.error('Error processing Tier 2 KYC:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
