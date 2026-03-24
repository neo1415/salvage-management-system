import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateDocument } from '@/features/documents/services/document.service';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';

/**
 * Admin Manual Document Generation API
 * 
 * POST /api/admin/auctions/[id]/generate-documents
 * 
 * Manually trigger document generation for a closed auction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or finance
    if (session.user.role !== 'admin' && session.user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Finance access required' },
        { status: 403 }
      );
    }

    const { id: auctionId } = await params;

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.status !== 'closed') {
      return NextResponse.json(
        { error: 'Auction must be closed to generate documents' },
        { status: 400 }
      );
    }

    if (!auction.currentBidder) {
      return NextResponse.json(
        { error: 'No winner for this auction' },
        { status: 400 }
      );
    }

    // Get vendor details
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, auction.currentBidder))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: 'Winner vendor not found' }, { status: 404 });
    }

    const results = {
      billOfSale: { success: false, error: '', documentId: '' },
      liabilityWaiver: { success: false, error: '', documentId: '' },
      pickupAuthorization: { success: false, error: '', documentId: '' },
    };

    // Generate Bill of Sale
    try {
      const document = await generateDocument(auctionId, vendor.id, 'bill_of_sale', session.user.id);
      results.billOfSale.success = true;
      results.billOfSale.documentId = document.id;

      // Log successful generation
      await logAction(
        createAuditLogData(
          request,
          vendor.userId,
          AuditActionType.DOCUMENT_GENERATED,
          AuditEntityType.AUCTION,
          auctionId,
          undefined,
          {
            documentType: 'bill_of_sale',
            documentId: document.id,
            vendorId: vendor.id,
            timestamp: new Date().toISOString(),
            context: 'admin_manual_generation',
            adminUserId: session.user.id,
          }
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stackTrace = error instanceof Error ? error.stack : undefined;
      
      results.billOfSale.error = errorMessage;
      console.error('Failed to generate Bill of Sale:', error);

      // Log failure to audit trail
      await logAction(
        createAuditLogData(
          request,
          vendor.userId,
          AuditActionType.DOCUMENT_GENERATION_FAILED,
          AuditEntityType.AUCTION,
          auctionId,
          undefined,
          {
            error: errorMessage,
            stackTrace,
            documentType: 'bill_of_sale',
            vendorId: vendor.id,
            timestamp: new Date().toISOString(),
            context: 'admin_manual_generation',
            adminUserId: session.user.id,
          }
        )
      );
    }

    // Generate Liability Waiver
    try {
      const document = await generateDocument(auctionId, vendor.id, 'liability_waiver', session.user.id);
      results.liabilityWaiver.success = true;
      results.liabilityWaiver.documentId = document.id;

      // Log successful generation
      await logAction(
        createAuditLogData(
          request,
          vendor.userId,
          AuditActionType.DOCUMENT_GENERATED,
          AuditEntityType.AUCTION,
          auctionId,
          undefined,
          {
            documentType: 'liability_waiver',
            documentId: document.id,
            vendorId: vendor.id,
            timestamp: new Date().toISOString(),
            context: 'admin_manual_generation',
            adminUserId: session.user.id,
          }
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stackTrace = error instanceof Error ? error.stack : undefined;
      
      results.liabilityWaiver.error = errorMessage;
      console.error('Failed to generate Liability Waiver:', error);

      // Log failure to audit trail
      await logAction(
        createAuditLogData(
          request,
          vendor.userId,
          AuditActionType.DOCUMENT_GENERATION_FAILED,
          AuditEntityType.AUCTION,
          auctionId,
          undefined,
          {
            error: errorMessage,
            stackTrace,
            documentType: 'liability_waiver',
            vendorId: vendor.id,
            timestamp: new Date().toISOString(),
            context: 'admin_manual_generation',
            adminUserId: session.user.id,
          }
        )
      );
    }

    // Generate Pickup Authorization
    // WARNING: Pickup authorization should normally only be generated AFTER payment is complete.
    // This manual generation is for admin override purposes only (e.g., fixing data issues).
    try {
      const document = await generateDocument(auctionId, vendor.id, 'pickup_authorization', session.user.id);
      results.pickupAuthorization.success = true;
      results.pickupAuthorization.documentId = document.id;

      // Log successful generation
      await logAction(
        createAuditLogData(
          request,
          vendor.userId,
          AuditActionType.DOCUMENT_GENERATED,
          AuditEntityType.AUCTION,
          auctionId,
          undefined,
          {
            documentType: 'pickup_authorization',
            documentId: document.id,
            vendorId: vendor.id,
            timestamp: new Date().toISOString(),
            context: 'admin_manual_generation',
            adminUserId: session.user.id,
            warning: 'Manual pickup authorization generation - normally only after payment',
          }
        )
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stackTrace = error instanceof Error ? error.stack : undefined;
      
      results.pickupAuthorization.error = errorMessage;
      console.error('Failed to generate Pickup Authorization:', error);

      // Log failure to audit trail
      await logAction(
        createAuditLogData(
          request,
          vendor.userId,
          AuditActionType.DOCUMENT_GENERATION_FAILED,
          AuditEntityType.AUCTION,
          auctionId,
          undefined,
          {
            error: errorMessage,
            stackTrace,
            documentType: 'pickup_authorization',
            vendorId: vendor.id,
            timestamp: new Date().toISOString(),
            context: 'admin_manual_generation',
            adminUserId: session.user.id,
          }
        )
      );
    }

    const successCount = Object.values(results).filter((r) => r.success).length;
    const totalCount = Object.keys(results).length;

    if (successCount === 0) {
      return NextResponse.json(
        {
          error: 'Failed to generate any documents',
          details: results,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${successCount}/${totalCount} documents successfully`,
      results,
    });
  } catch (error) {
    console.error('Admin generate documents API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate documents' },
      { status: 500 }
    );
  }
}
