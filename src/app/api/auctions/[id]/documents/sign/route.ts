/**
 * Sign Document API
 * POST /api/auctions/[id]/documents/sign
 * 
 * Generates and signs a document with a digital signature.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { generateDocument, signDocument } from '@/features/documents/services/document.service';
import { validateSignature } from '@/features/documents/services/signature.service';
import { logAction, AuditActionType, AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';
import { notifyDocumentSigned, notifyPaymentUnlocked } from '@/features/notifications/services/notification.service';
import { emailService } from '@/features/notifications/services/email.service';
import { documentReadyTemplate } from '@/features/notifications/templates/document-ready.template';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: auctionId } = await params;

    // Parse request body
    const body = await request.json();
    const { documentType, signatureData } = body as {
      documentType: 'liability_waiver' | 'bill_of_sale' | 'pickup_authorization' | 'salvage_certificate';
      signatureData: string;
    };

    // Validate inputs
    if (!documentType || !signatureData) {
      return NextResponse.json(
        { status: 'error', message: 'Document type and signature data are required' },
        { status: 400 }
      );
    }

    // Validate signature
    if (!validateSignature(signatureData)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid signature format' },
        { status: 400 }
      );
    }

    // Get vendor ID from session
    const vendorId = session.user.vendorId;
    if (!vendorId) {
      return NextResponse.json(
        { status: 'error', message: 'Vendor profile not found' },
        { status: 403 }
      );
    }

    // Extract request metadata
    const ipAddress = getIpAddress(request.headers);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = getDeviceTypeFromUserAgent(userAgent);

    // Generate document
    const document = await generateDocument(
      auctionId,
      vendorId,
      documentType,
      session.user.id
    );

    // Sign document
    const signedDocument = await signDocument(
      document.id,
      vendorId,
      signatureData,
      ipAddress,
      deviceType,
      userAgent
    );

    // Get vendor details for notifications
    const [vendor] = await db
      .select({
        vendor: vendors,
        user: users,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (vendor) {
      // Send notification
      await notifyDocumentSigned(vendor.user.id, signedDocument.id);

      // Send email with document
      await emailService.sendEmail({
        to: vendor.user.email,
        subject: `Document Signed: ${signedDocument.title}`,
        html: documentReadyTemplate({
          vendorName: vendor.user.fullName,
          documentType: signedDocument.documentType,
          documentTitle: signedDocument.title,
          auctionId,
          assetDescription: 'Salvage Item',
          downloadUrl: `${process.env.NEXTAUTH_URL}/vendor/documents`,
        }),
      });
    }

    // Audit log
    await logAction({
      userId: session.user.id,
      actionType: AuditActionType.DOCUMENT_SIGNED,
      entityType: AuditEntityType.DOCUMENT,
      entityId: signedDocument.id,
      ipAddress,
      deviceType,
      userAgent,
      beforeState: { status: 'pending' },
      afterState: { status: 'signed', signedAt: signedDocument.signedAt },
    });

    // NOTE: Fund release is NO LONGER automatic after document signing.
    // Vendor must now choose payment method (wallet, paystack, or hybrid) via PaymentOptions modal.
    // The auction status is updated to 'awaiting_payment' in the signDocument function.

    return NextResponse.json({
      status: 'success',
      data: { document: signedDocument },
      message: 'Document signed successfully',
    });
  } catch (error) {
    console.error('Sign document error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to sign document',
      },
      { status: 500 }
    );
  }
}
