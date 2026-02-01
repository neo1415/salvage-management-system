import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/auth-helpers';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { uploadFile } from '@/lib/storage/cloudinary';
import { logAction } from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import { extractNINFromDocument } from '@/lib/integrations/google-document-ai';
import { verifyNIN } from '@/lib/integrations/nin-verification';
import { verifyBankAccount } from '@/lib/integrations/paystack-bank-verification';
import { z } from 'zod';

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

    if (user.status !== 'verified_tier_1') {
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
      actionType: 'tier2_kyc_initiated' as any,
      entityType: 'kyc' as any,
      entityId: vendor.id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      deviceType: 'desktop' as any,
      userAgent: request.headers.get('user-agent') || 'unknown',
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
          actionType: (ninVerified ? 'nin_verified' : 'bvn_verification_failed') as any,
          entityType: 'kyc' as any,
          entityId: vendor.id,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          deviceType: 'desktop' as any,
          userAgent: request.headers.get('user-agent') || 'unknown',
          afterState: { nin: extractedNIN, message: ninVerificationMessage },
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
        actionType: (bankAccountVerified ? 'bank_details_verified' : 'bvn_verification_failed') as any,
        entityType: 'kyc' as any,
        entityId: vendor.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        deviceType: 'desktop' as any,
        userAgent: request.headers.get('user-agent') || 'unknown',
        afterState: { 
          accountNumber: bankAccountNumber, 
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
      actionType: 'cac_uploaded' as any,
      entityType: 'kyc' as any,
      entityId: vendor.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      deviceType: 'desktop' as any,
      userAgent: request.headers.get('user-agent') || 'unknown',
      afterState: { cacNumber, cacUrl },
    });

    // Log Tier 2 KYC submission
    await logAction({
      userId,
      actionType: 'tier2_kyc_submitted' as any,
      entityType: 'kyc' as any,
      entityId: vendor.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      deviceType: 'desktop' as any,
      userAgent: request.headers.get('user-agent') || 'unknown',
      afterState: {
        businessName,
        cacNumber,
        ninVerified,
        bankAccountVerified,
        documentsUploaded: {
          cac: cacUrl,
          bankStatement: bankStatementUrl,
          ninCard: ninCardUrl,
        },
      },
    });

    // Send SMS notification to vendor
    try {
      await smsService.sendSMS({
        to: user.phone,
        message: 'Your Tier 2 application is under review. We\'ll notify you within 24 hours. - NEM Salvage',
      });
    } catch (error) {
      console.error('Error sending SMS:', error);
    }

    // Send email notification to vendor
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Tier 2 KYC Application Submitted',
        html: `
          <h2>Tier 2 KYC Application Submitted</h2>
          <p>Dear ${user.fullName},</p>
          <p>Your Tier 2 KYC application has been submitted successfully and is now under review.</p>
          <h3>Verification Status:</h3>
          <ul>
            <li>BVN: ✓ Verified</li>
            <li>NIN: ${ninVerified ? '✓ Verified' : '⏳ Pending Review'}</li>
            <li>Bank Account: ${bankAccountVerified ? '✓ Verified' : '⏳ Pending Review'}</li>
            <li>CAC: ⏳ Pending Manual Review</li>
          </ul>
          <p>Our team will review your application within 24 hours. You'll receive a notification once the review is complete.</p>
          <p>Best regards,<br>NEM Salvage Management Team</p>
        `,
      });
    } catch (error) {
      console.error('Error sending email:', error);
    }

    // TODO: Notify Salvage Manager (implement notification system)
    // This could be done via email, SMS, or in-app notification

    return NextResponse.json({
      success: true,
      message: 'Tier 2 KYC application submitted successfully',
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
