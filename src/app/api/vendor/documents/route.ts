/**
 * Vendor Documents API
 * GET /api/vendor/documents
 * 
 * Lists all documents for the authenticated vendor across all auctions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, desc } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
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

    // Fetch all documents for vendor with auction and case details
    const documents = await db
      .select({
        document: releaseForms,
        auction: auctions,
        case: salvageCases,
      })
      .from(releaseForms)
      .innerJoin(auctions, eq(releaseForms.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(releaseForms.vendorId, vendorId))
      .orderBy(desc(releaseForms.createdAt));

    // Group documents by status
    const grouped = {
      pending: documents.filter((doc) => doc.document.status === 'pending'),
      signed: documents.filter((doc) => doc.document.status === 'signed'),
      voided: documents.filter((doc) => doc.document.status === 'voided'),
      expired: documents.filter((doc) => doc.document.status === 'expired'),
    };

    // Get recent activity
    const recentActivity = documents.slice(0, 10).map((doc) => {
      const assetDetails = doc.case.assetDetails as {
        make?: string;
        model?: string;
        year?: number;
      };
      return {
        id: doc.document.id,
        type: doc.document.documentType,
        title: doc.document.title,
        status: doc.document.status,
        auctionId: doc.auction.id,
        assetDescription: `${assetDetails.make || ''} ${assetDetails.model || ''} ${assetDetails.year || ''}`.trim() || doc.case.assetType,
        createdAt: doc.document.createdAt,
        signedAt: doc.document.signedAt,
      };
    });

    // Format documents for frontend consumption
    const formattedDocuments = documents.map((doc) => {
      const assetDetails = doc.case.assetDetails as {
        make?: string;
        model?: string;
        year?: number;
      };
      const assetDescription = `${assetDetails.make || ''} ${assetDetails.model || ''} ${assetDetails.year || ''}`.trim() || doc.case.assetType;
      
      return {
        id: doc.document.id,
        auctionId: doc.document.auctionId,
        documentType: doc.document.documentType,
        title: doc.document.title,
        status: doc.document.status,
        pdfUrl: doc.document.pdfUrl,
        createdAt: doc.document.createdAt.toISOString(),
        signedAt: doc.document.signedAt?.toISOString() || null,
        expiresAt: null, // Documents don't expire in current implementation
        documentData: {
          assetDescription,
          salePrice: doc.auction.currentBid ? parseFloat(doc.auction.currentBid) : undefined,
          pickupAuthCode: (doc.document.documentData as { pickupAuthCode?: string })?.pickupAuthCode,
        },
      };
    });

    return NextResponse.json({
      status: 'success',
      documents: formattedDocuments, // Frontend expects this at root level
      data: {
        documents: formattedDocuments,
        grouped: {
          pending: grouped.pending.map((doc) => ({
            ...doc.document,
            auction: doc.auction,
            case: doc.case,
          })),
          signed: grouped.signed.map((doc) => ({
            ...doc.document,
            auction: doc.auction,
            case: doc.case,
          })),
          voided: grouped.voided.map((doc) => ({
            ...doc.document,
            auction: doc.auction,
            case: doc.case,
          })),
          expired: grouped.expired.map((doc) => ({
            ...doc.document,
            auction: doc.auction,
            case: doc.case,
          })),
        },
        counts: {
          total: documents.length,
          pending: grouped.pending.length,
          signed: grouped.signed.length,
          voided: grouped.voided.length,
          expired: grouped.expired.length,
        },
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Vendor documents error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch documents',
      },
      { status: 500 }
    );
  }
}
