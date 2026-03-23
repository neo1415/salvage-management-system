/**
 * Admin Confirm Pickup API
 * 
 * POST /api/admin/auctions/[id]/confirm-pickup
 * Allows admin to confirm vendor has collected the item
 * 
 * Requirements: Requirement 5 - Pickup Confirmation Workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db';
import { auctions, salvageCases, vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createNotification } from '@/features/notifications/services/notification.service';
import { logAction, AuditActionType, AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Await params in Next.js 15+
    const { id: auctionId } = await params;
    const body = await request.json();
    const { notes } = body;

    // Fetch auction
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Verify vendor has confirmed pickup
    if (!auction.pickupConfirmedVendor) {
      return NextResponse.json(
        { error: 'Vendor must confirm pickup before admin confirmation' },
        { status: 400 }
      );
    }

    // Verify admin has not already confirmed
    if (auction.pickupConfirmedAdmin) {
      return NextResponse.json(
        { error: 'Pickup already confirmed by admin' },
        { status: 400 }
      );
    }

    // Update auction with admin confirmation
    const [updatedAuction] = await db
      .update(auctions)
      .set({
        pickupConfirmedAdmin: true,
        pickupConfirmedAdminAt: new Date(),
        pickupConfirmedAdminBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(auctions.id, auctionId))
      .returning();

    // Update case status to sold (transaction complete)
    await db
      .update(salvageCases)
      .set({
        status: 'sold',
        updatedAt: new Date(),
      })
      .where(eq(salvageCases.id, auction.caseId));

    // Get vendor details for notification
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, auction.currentBidder!))
      .limit(1);

    if (vendor) {
      const [vendorUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, vendor.userId))
        .limit(1);

      if (vendorUser) {
        // Send notification to vendor
        await createNotification({
          userId: vendorUser.id,
          type: 'PICKUP_CONFIRMED_ADMIN',
          title: 'Pickup Confirmed - Transaction Complete',
          message: `Admin confirmed pickup for auction ${auctionId}. Transaction is now complete.`,
          data: {
            auctionId,
            vendorId: vendor.id,
            confirmedAt: updatedAuction.pickupConfirmedAdminAt?.toISOString() || new Date().toISOString(),
            confirmedBy: session.user.name || 'Admin',
          },
        });

        console.log(`✅ Admin ${session.user.id} confirmed pickup for auction ${auctionId}`);
        console.log(`📧 Sent notification to vendor ${vendorUser.id}`);
      }
    }

    // Create audit log entry
    await logAction({
      userId: session.user.id,
      actionType: AuditActionType.PICKUP_CONFIRMED_ADMIN,
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: getIpAddress(request.headers),
      deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') || ''),
      userAgent: request.headers.get('user-agent') || 'unknown',
      beforeState: {
        pickupConfirmedAdmin: false,
        caseStatus: 'pending',
      },
      afterState: {
        pickupConfirmedAdmin: true,
        pickupConfirmedAdminAt: updatedAuction.pickupConfirmedAdminAt?.toISOString(),
        pickupConfirmedAdminBy: session.user.id,
        adminName: session.user.name || 'Admin',
        caseStatus: 'sold',
        notes: notes || null,
      },
    });

    return NextResponse.json({
      success: true,
      auction: {
        id: updatedAuction.id,
        pickupConfirmedAdmin: updatedAuction.pickupConfirmedAdmin,
        pickupConfirmedAdminAt: updatedAuction.pickupConfirmedAdminAt,
        pickupConfirmedAdminBy: updatedAuction.pickupConfirmedAdminBy,
      },
      message: 'Pickup confirmed successfully',
      notes: notes || null,
    });
  } catch (error) {
    console.error('Error confirming pickup:', error);
    return NextResponse.json(
      { error: 'Failed to confirm pickup' },
      { status: 500 }
    );
  }
}
