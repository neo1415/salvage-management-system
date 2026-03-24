import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, bids, salvageCases, vendors, users } from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // Determine auction status based on tab
    const statusFilter = tab === 'active' 
      ? inArray(auctions.status, ['scheduled', 'active', 'extended'])
      : inArray(auctions.status, ['closed', 'cancelled']);

    // Fetch auctions with related data
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
      .orderBy(desc(auctions.createdAt))
      .limit(limit)
      .offset(offset);

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

    // Get watching counts for each auction
    const watchingData = await db
      .select({
        auctionId: auctions.id,
        watchingCount: auctions.watchingCount,
      })
      .from(auctions)
      .where(inArray(auctions.id, auctionIds));

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
          tier: item.vendor?.tier,
          profilePictureUrl: item.user?.profilePictureUrl,
        },
        user: {
          id: item.user?.id,
          fullName: item.user?.fullName,
          phone: item.user?.phone,
        },
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Group watching data by auction
    const watchingByAuction = watchingData.reduce((acc, item) => {
      acc[item.auctionId] = item.watchingCount;
      return acc;
    }, {} as Record<string, number>);

    // Format response
    const formattedData = auctionData.map(item => ({
      auction: {
        id: item.auction.id,
        startTime: item.auction.startTime,
        endTime: item.auction.endTime,
        originalEndTime: item.auction.originalEndTime,
        extensionCount: item.auction.extensionCount,
        currentBid: item.auction.currentBid,
        minimumIncrement: item.auction.minimumIncrement,
        status: item.auction.status,
        createdAt: item.auction.createdAt,
      },
      case: {
        id: item.case?.id,
        claimReference: item.case?.claimReference,
        assetType: item.case?.assetType,
        assetDetails: item.case?.assetDetails,
        marketValue: item.case?.marketValue,
        estimatedSalvageValue: item.case?.estimatedSalvageValue,
        reservePrice: item.case?.reservePrice,
        damageSeverity: item.case?.damageSeverity,
        photos: item.case?.photos,
        status: item.case?.status,
        locationName: item.case?.locationName,
        gpsLocation: item.case?.gpsLocation,
      },
      currentBidder: item.currentBidderVendor ? {
        vendor: {
          id: item.currentBidderVendor.id,
          businessName: item.currentBidderVendor.businessName,
          tier: item.currentBidderVendor.tier,
          profilePictureUrl: item.currentBidderUser?.profilePictureUrl,
        },
        user: {
          id: item.currentBidderUser?.id,
          fullName: item.currentBidderUser?.fullName,
          phone: item.currentBidderUser?.phone,
        },
      } : null,
      bidHistory: bidsByAuction[item.auction.id] || [],
      watchingCount: watchingByAuction[item.auction.id] || 0,
      paymentStatus: item.case?.status === 'sold' ? 'Payment Pending' : null,
    }));

    // Get total count for pagination
    const totalCount = await db
      .select({ count: auctions.id })
      .from(auctions)
      .where(statusFilter);

    return NextResponse.json({
      data: formattedData,
      pagination: {
        page,
        limit,
        total: totalCount.length,
        totalPages: Math.ceil(totalCount.length / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching bid history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bid history' },
      { status: 500 }
    );
  }
}