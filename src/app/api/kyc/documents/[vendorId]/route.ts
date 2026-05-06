import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { getDocumentUploadService } from '@/features/kyc/services/document-upload.service';

/**
 * KYC Documents API - Generate signed URLs for vendor documents
 * 
 * GET /api/kyc/documents/[vendorId]
 * Returns signed URLs for all KYC documents for a vendor
 * 
 * Requirements: 7, NFR5.3
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is a Salvage Manager
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user || user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Only Salvage Managers can view KYC documents' },
        { status: 403 }
      );
    }

    const { vendorId } = await params;

    // Fetch vendor with document paths
    const [vendor] = await db
      .select({
        cacCertificateUrl: vendors.cacCertificateUrl,
        ninCardUrl: vendors.ninCardUrl,
        addressProofUrl: vendors.addressProofUrl,
        bankStatementUrl: vendors.bankStatementUrl,
        photoIdUrl: vendors.photoIdUrl,
      })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Generate signed URLs for all documents
    const uploadService = getDocumentUploadService();
    const signedUrls: Record<string, string | null> = {};

    // Generate signed URLs for each document (valid for 1 hour)
    if (vendor.cacCertificateUrl) {
      signedUrls.cacCertificateUrl = await uploadService.getSignedUrl(vendor.cacCertificateUrl, 3600);
    }
    if (vendor.ninCardUrl) {
      signedUrls.ninCardUrl = await uploadService.getSignedUrl(vendor.ninCardUrl, 3600);
    }
    if (vendor.addressProofUrl) {
      signedUrls.addressProofUrl = await uploadService.getSignedUrl(vendor.addressProofUrl, 3600);
    }
    if (vendor.bankStatementUrl) {
      signedUrls.bankStatementUrl = await uploadService.getSignedUrl(vendor.bankStatementUrl, 3600);
    }
    if (vendor.photoIdUrl) {
      signedUrls.photoIdUrl = await uploadService.getSignedUrl(vendor.photoIdUrl, 3600);
    }

    return NextResponse.json({
      success: true,
      documents: signedUrls,
    });
  } catch (error) {
    console.error('[KYC Documents] Error generating signed URLs:', error);
    return NextResponse.json(
      { error: 'Failed to generate document URLs' },
      { status: 500 }
    );
  }
}
