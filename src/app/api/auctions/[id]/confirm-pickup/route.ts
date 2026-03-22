/**
 * Vendor Pickup Confirmation Endpoint
 * 
 * POST /api/auctions/[id]/confirm-pickup
 * 
 * Allows vendors to confirm they have collected the salvage item by providing
 * the pickup authorization code. Updates auction status and notifies Admin/Manager.
 * 
 * Requirements: Requirement 5 - Pickup Confirmation Workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and, or } from 'drizzle-orm';
import { createNotification } from '@/features/notifications/services/notification.service';
import { logAction, AuditActionType, AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

interface ConfirmPickupRequest {
  vendorId: string;
  pickupAuthCode: string;
}

interface ConfirmPickupResponse {
  success: boolean;
  auction: {
    id: string;
    pickupConfirmedVendor: boolean;
    pickupConfirmedVendorAt: string;
  };
  message?: string;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ConfirmPickupResponse>> {
  try {
    // Await params in Next.js 15+
    const { id: auctionId } = await params;

    // Parse request body
    const body: ConfirmPickupRequest = await request.json();
    const { vendorId, pickupAuthCode } = body;

    // Validate required fields
    if (!vendorId || !pickupAuthCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: vendorId and pickupAuthCode',
        } as ConfirmPickupResponse,
        { status: 400 }
      );
    }

    // Fetch auction
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Auction not found',
        } as ConfirmPickupResponse,
        { status: 404 }
      );
    }

    // Verify vendor is the winner
    if (auction.currentBidder !== vendorId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only the auction winner can confirm pickup',
        } as ConfirmPickupResponse,
        { status: 403 }
      );
    }

    // Check if already confirmed by vendor
    if (auction.pickupConfirmedVendor) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pickup already confirmed by vendor',
        } as ConfirmPickupResponse,
        { status: 400 }
      );
    }

    // Fetch pickup authorization document to validate code
    const [pickupAuthDoc] = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendorId),
          eq(releaseForms.documentType, 'pickup_authorization')
        )
      )
      .limit(1);

    if (!pickupAuthDoc) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pickup authorization document not found',
        } as ConfirmPickupResponse,
        { status: 404 }
      );
    }

    // Validate pickup authorization code
    const storedCode = pickupAuthDoc.documentData?.pickupAuthCode;
    if (!storedCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pickup authorization code not generated yet',
        } as ConfirmPickupResponse,
        { status: 400 }
      );
    }

    if (storedCode !== pickupAuthCode.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pickup authorization code',
        } as ConfirmPickupResponse,
        { status: 400 }
      );
    }

    // Update auction with vendor pickup confirmation
    const [updatedAuction] = await db
      .update(auctions)
      .set({
        pickupConfirmedVendor: true,
        pickupConfirmedVendorAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(auctions.id, auctionId))
      .returning();

    // Get vendor details for notification
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vendor not found',
        } as ConfirmPickupResponse,
        { status: 404 }
      );
    }

    const [vendorUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);

    // Send notifications to all Admin and Manager users
    const adminAndManagerUsers = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.role, 'system_admin'),
          eq(users.role, 'salvage_manager')
        )
      );

    // Create notifications for each admin/manager
    const notificationPromises = adminAndManagerUsers.map((user) =>
      createNotification({
        userId: user.id,
        type: 'PICKUP_CONFIRMED_VENDOR',
        title: 'Vendor Confirmed Pickup',
        message: `${vendorUser?.fullName || 'Vendor'} confirmed pickup for auction ${auctionId}. Admin confirmation required.`,
        data: {
          auctionId,
          vendorId,
          vendorName: vendorUser?.fullName || 'Unknown',
          confirmedAt: updatedAuction.pickupConfirmedVendorAt?.toISOString() || new Date().toISOString(),
        },
      })
    );

    await Promise.all(notificationPromises);

    // Log vendor pickup confirmation
    await logAction({
      userId: vendor.userId,
      actionType: AuditActionType.PICKUP_CONFIRMED_VENDOR,
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: getIpAddress(request.headers),
      deviceType: getDeviceTypeFromUserAgent(request.headers.get('user-agent') || ''),
      userAgent: request.headers.get('user-agent') || 'unknown',
      beforeState: {
        pickupConfirmedVendor: false,
      },
      afterState: {
        pickupConfirmedVendor: true,
        pickupConfirmedVendorAt: updatedAuction.pickupConfirmedVendorAt?.toISOString(),
        pickupAuthCode,
        vendorId,
        vendorName: vendorUser?.fullName || 'Unknown',
      },
    });

    console.log(`✅ Vendor ${vendorId} confirmed pickup for auction ${auctionId}`);
    console.log(`📧 Sent notifications to ${adminAndManagerUsers.length} admin/manager users`);

    return NextResponse.json(
      {
        success: true,
        auction: {
          id: updatedAuction.id,
          pickupConfirmedVendor: updatedAuction.pickupConfirmedVendor || false,
          pickupConfirmedVendorAt: updatedAuction.pickupConfirmedVendorAt?.toISOString() || '',
        },
        message: 'Pickup confirmed successfully. Admin will verify shortly.',
      } as ConfirmPickupResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Error confirming pickup:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm pickup',
      } as ConfirmPickupResponse,
      { status: 500 }
    );
  }
}
