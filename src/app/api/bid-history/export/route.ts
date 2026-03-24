import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, bids, salvageCases, vendors, users } from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { ExportService } from '@/features/export/services/export.service';

/**
 * Export Bid History API
 * 
 * Exports bid history data to CSV or PDF format
 * Only includes actual bids (excludes "watching" auctions)
 * Respects auction status filters (active/completed)
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.8
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has manager, adjuster, or admin role
    const allowedRoles = ['salvage_manager', 'claims_adjuster', 'system_admin'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'active';
    const format = searchParams.get('format') || 'csv';

    // Determine auction status based on tab
    const statusFilter = tab === 'active' 
      ? inArray(auctions.status, ['scheduled', 'active', 'extended'])
      : inArray(auctions.status, ['closed', 'cancelled']);

    // Fetch all auctions with related data (no pagination for export)
    const auctionData = await db
      .select({
        auction: auctions,
        case: salvageCases,
        currentBidderVendor: vendors,
        currentBidderUser: users,
      })
      .from(auctions)
      .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .leftJoin(vendors, eq(auctions.currentBidder, vendors.id))
      .leftJoin(users, eq(vendors.userId, users.id))
      .where(statusFilter)
      .orderBy(desc(auctions.createdAt));

    // Get bid history for each auction
    const auctionIds = auctionData.map(item => item.auction.id);
    
    const bidHistory = await db
      .select({
        bid: bids,
        vendor: vendors,
        user: users,
      })
      .from(bids)
      .leftJoin(vendors, eq(bids.vendorId, vendors.id))
      .leftJoin(users, eq(vendors.userId, users.id))
      .where(inArray(bids.auctionId, auctionIds))
      .orderBy(desc(bids.createdAt));

    // Group bid history by auction
    const bidsByAuction = bidHistory.reduce((acc, item) => {
      const auctionId = item.bid.auctionId;
      if (!acc[auctionId]) {
        acc[auctionId] = [];
      }
      acc[auctionId].push({
        id: item.bid.id,
        amount: item.bid.amount,
        createdAt: item.bid.createdAt,
        vendor: {
          id: item.vendor?.id,
          businessName: item.vendor?.businessName,
        },
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Format data for export
    // Only include auctions with actual bids (exclude "watching" auctions)
    const exportData = auctionData
      .filter(item => bidsByAuction[item.auction.id]?.length > 0)
      .map(item => {
        const assetName = getAssetName(item.case);
        const bids = bidsByAuction[item.auction.id] || [];
        const status = getAuctionStatus(item.auction);
        const finalPrice = item.auction.status === 'closed' ? item.auction.currentBid : null;

        return {
          auctionId: item.auction.id,
          assetName,
          bidAmount: item.auction.currentBid || '0',
          bidDate: bids[0]?.createdAt || item.auction.createdAt,
          status,
          finalPrice: finalPrice || 'N/A',
        };
      });

    if (exportData.length === 0) {
      return NextResponse.json(
        { error: 'No bid history data to export' },
        { status: 400 }
      );
    }

    // Generate filename
    const filename = ExportService.generateFilename('bid-history', format);

    if (format === 'csv') {
      // Generate CSV
      const csv = ExportService.generateCSV({
        filename,
        columns: [
          { key: 'auctionId', header: 'Auction ID' },
          { key: 'assetName', header: 'Asset Name' },
          { key: 'bidAmount', header: 'Bid Amount' },
          { 
            key: 'bidDate', 
            header: 'Bid Date',
            format: (value) => new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })
          },
          { key: 'status', header: 'Status' },
          { key: 'finalPrice', header: 'Final Price' },
        ],
        data: exportData,
      });

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else if (format === 'pdf') {
      // Generate PDF
      const pdfBuffer = await ExportService.generatePDF({
        filename,
        columns: [
          { key: 'auctionId', header: 'Auction ID' },
          { key: 'assetName', header: 'Asset Name' },
          { key: 'bidAmount', header: 'Bid Amount' },
          { 
            key: 'bidDate', 
            header: 'Bid Date',
            format: (value) => new Date(value).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos' })
          },
          { key: 'status', header: 'Status' },
          { key: 'finalPrice', header: 'Final Price' },
        ],
        data: exportData,
        title: 'BID HISTORY REPORT',
      });

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Use csv or pdf.' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error exporting bid history:', error);
    return NextResponse.json(
      { error: 'Failed to export bid history' },
      { status: 500 }
    );
  }
}

/**
 * Get asset name from case details
 */
function getAssetName(caseData: any): string {
  if (!caseData) return 'Unknown Asset';

  const { assetType, assetDetails } = caseData;
  
  if (assetType === 'vehicle' && assetDetails?.make && assetDetails?.model) {
    return `${assetDetails.year || ''} ${assetDetails.make} ${assetDetails.model}`.trim();
  }
  
  if (assetType === 'electronics' && assetDetails?.brand) {
    return `${assetDetails.brand} ${assetDetails.model || 'Device'}`.trim();
  }
  
  if (assetType === 'property' && assetDetails?.propertyType) {
    return assetDetails.propertyType;
  }
  
  return `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} Asset`;
}

/**
 * Get auction status (Won/Lost/Active)
 */
function getAuctionStatus(auction: any): string {
  switch (auction.status) {
    case 'active':
    case 'extended':
    case 'scheduled':
      return 'Active';
    case 'closed':
      return 'Won';
    case 'cancelled':
      return 'Lost';
    default:
      return auction.status;
  }
}
