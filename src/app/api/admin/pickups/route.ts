/**
 * Admin Pickup Confirmations API
 * 
 * GET /api/admin/pickups
 * Fetches list of auctions pending admin pickup confirmation
 * 
 * Requirements: Requirement 5 - Pickup Confirmation Workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { auctions, salvageCases, vendors, users, payments } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or manager
    const allowedRoles = ['admin', 'salvage_manager', 'system_admin'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending'; // 'pending' | 'all'
    const sortBy = searchParams.get('sortBy') || 'confirmedAt'; // 'confirmedAt' | 'amount' | 'claimRef'
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // 'asc' | 'desc'

    // Fetch auctions where vendor confirmed but admin has not
    const pendingPickups = await db
      .select({
        auction: {
          id: auctions.id,
          caseId: auctions.caseId,
          currentBid: auctions.currentBid,
          pickupConfirmedVendor: auctions.pickupConfirmedVendor,
          pickupConfirmedVendorAt: auctions.pickupConfirmedVendorAt,
          pickupConfirmedAdmin: auctions.pickupConfirmedAdmin,
          pickupConfirmedAdminAt: auctions.pickupConfirmedAdminAt,
          pickupConfirmedAdminBy: auctions.pickupConfirmedAdminBy,
          status: auctions.status,
          endTime: auctions.endTime,
        },
        case: {
          id: salvageCases.id,
          claimReference: salvageCases.claimReference,
          assetType: salvageCases.assetType,
          assetDetails: salvageCases.assetDetails,
          status: salvageCases.status,
        },
        vendor: {
          id: vendors.id,
          businessName: vendors.businessName,
        },
        vendorUser: {
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
        },
        payment: {
          id: payments.id,
          amount: payments.amount,
          status: payments.status,
          paymentMethod: payments.paymentMethod,
        },
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .innerJoin(vendors, eq(auctions.currentBidder, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .leftJoin(payments, eq(payments.auctionId, auctions.id))
      .where(
        status === 'pending'
          ? and(
              eq(auctions.pickupConfirmedVendor, true),
              eq(auctions.pickupConfirmedAdmin, false)
            )
          : undefined
      )
      .orderBy(
        sortOrder === 'desc'
          ? desc(auctions.pickupConfirmedVendorAt)
          : auctions.pickupConfirmedVendorAt
      );

    // Format response
    const formattedPickups = pendingPickups.map((pickup) => ({
      auctionId: pickup.auction.id,
      claimReference: pickup.case.claimReference,
      assetType: pickup.case.assetType,
      assetDetails: pickup.case.assetDetails,
      amount: pickup.auction.currentBid,
      vendor: {
        id: pickup.vendor.id,
        businessName: pickup.vendor.businessName,
        fullName: pickup.vendorUser.fullName,
        email: pickup.vendorUser.email,
        phone: pickup.vendorUser.phone,
      },
      vendorConfirmation: {
        confirmed: pickup.auction.pickupConfirmedVendor,
        confirmedAt: pickup.auction.pickupConfirmedVendorAt,
      },
      adminConfirmation: {
        confirmed: pickup.auction.pickupConfirmedAdmin,
        confirmedAt: pickup.auction.pickupConfirmedAdminAt,
        confirmedBy: pickup.auction.pickupConfirmedAdminBy,
      },
      payment: pickup.payment
        ? {
            id: pickup.payment.id,
            amount: pickup.payment.amount,
            status: pickup.payment.status,
            paymentMethod: pickup.payment.paymentMethod,
          }
        : null,
      auctionStatus: pickup.auction.status,
      caseStatus: pickup.case.status,
      auctionEndTime: pickup.auction.endTime,
    }));

    // Apply sorting if needed
    if (sortBy === 'amount') {
      formattedPickups.sort((a, b) => {
        const amountA = parseFloat(a.amount || '0');
        const amountB = parseFloat(b.amount || '0');
        return sortOrder === 'desc' ? amountB - amountA : amountA - amountB;
      });
    } else if (sortBy === 'claimRef') {
      formattedPickups.sort((a, b) => {
        const comparison = a.claimReference.localeCompare(b.claimReference);
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return NextResponse.json({
      success: true,
      pickups: formattedPickups,
      count: formattedPickups.length,
    });
  } catch (error) {
    console.error('Error fetching pickup confirmations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pickup confirmations' },
      { status: 500 }
    );
  }
}
