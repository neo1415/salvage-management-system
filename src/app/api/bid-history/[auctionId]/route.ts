import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, bids, salvageCases, vendors, users, payments } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ auctionId: string }> }
) {
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

    const { auctionId } = await params;

    // Fetch auction with related data
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
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (auctionData.length === 0) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const auction = auctionData[0];

    // Get complete bid history for this auction
    const bidHistory = await db
      .select({
        bid: bids,
        vendor: vendors,
        user: users,
      })
      .from(bids)
      .leftJoin(vendors, eq(bids.vendorId, vendors.id))
      .leftJoin(users, eq(vendors.userId, users.id))
      .where(eq(bids.auctionId, auctionId))
      .orderBy(desc(bids.createdAt));

    // Fetch payment status for this auction
    const paymentData = await db
      .select({
        payment: payments,
      })
      .from(payments)
      .where(eq(payments.auctionId, auctionId))
      .limit(1);

    const payment = paymentData[0]?.payment;

    // Format response
    const response = {
      auction: {
        id: auction.auction.id,
        startTime: auction.auction.startTime,
        endTime: auction.auction.endTime,
        originalEndTime: auction.auction.originalEndTime,
        extensionCount: auction.auction.extensionCount,
        currentBid: auction.auction.currentBid,
        minimumIncrement: auction.auction.minimumIncrement,
        status: auction.auction.status,
        createdAt: auction.auction.createdAt,
      },
      case: {
        id: auction.case?.id,
        claimReference: auction.case?.claimReference,
        assetType: auction.case?.assetType,
        assetDetails: auction.case?.assetDetails,
        marketValue: auction.case?.marketValue,
        estimatedSalvageValue: auction.case?.estimatedSalvageValue,
        reservePrice: auction.case?.reservePrice,
        damageSeverity: auction.case?.damageSeverity,
        photos: auction.case?.photos || [],
        voiceNotes: auction.case?.voiceNotes || [],
        status: auction.case?.status,
        locationName: auction.case?.locationName,
        gpsLocation: auction.case?.gpsLocation,
        aiAssessment: auction.case?.aiAssessment,
      },
      currentBidder: auction.currentBidderVendor ? {
        vendor: {
          id: auction.currentBidderVendor.id,
          businessName: auction.currentBidderVendor.businessName,
          tier: auction.currentBidderVendor.tier,
        },
        user: {
          id: auction.currentBidderUser?.id,
          fullName: auction.currentBidderUser?.fullName,
          phone: auction.currentBidderUser?.phone,
        },
      } : null,
      bidHistory: bidHistory.map(item => ({
        id: item.bid.id,
        amount: item.bid.amount,
        createdAt: item.bid.createdAt,
        vendor: {
          id: item.vendor?.id,
          businessName: item.vendor?.businessName,
          tier: item.vendor?.tier,
        },
        user: {
          id: item.user?.id,
          fullName: item.user?.fullName,
          phone: item.user?.phone,
        },
      })),
      watchingCount: auction.auction.watchingCount || 0,
      // Fix: Check actual payment status instead of hardcoding "Payment Pending"
      paymentStatus: payment 
        ? payment.status === 'verified' 
          ? 'Payment Completed' 
          : payment.status === 'rejected'
          ? 'Payment Rejected'
          : payment.status === 'overdue'
          ? 'Payment Overdue'
          : 'Payment Pending'
        : auction.case?.status === 'sold' 
        ? 'Payment Pending' 
        : null,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching auction details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auction details' },
      { status: 500 }
    );
  }
}