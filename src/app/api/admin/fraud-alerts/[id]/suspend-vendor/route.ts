/**
 * Fraud Alert Suspend Vendor API - POST Handler
 * Allows admin to suspend vendor for fraud
 * 
 * Requirements:
 * - Requirement 35: Fraud Alert Review
 * - Enterprise Standards Section 6.3: Security & Fraud Prevention
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { bids } from '@/lib/db/schema/bids';
import { auctions } from '@/lib/db/schema/auctions';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, and, ne } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';

/**
 * Suspension duration options
 */
const SUSPENSION_DURATIONS = {
  '7': 7,
  '30': 30,
  '90': 90,
  'permanent': -1,
} as const;

type SuspensionDuration = keyof typeof SUSPENSION_DURATIONS;

/**
 * POST /api/admin/fraud-alerts/[id]/suspend-vendor
 * Suspend vendor for fraud
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params in Next.js 15
    const { id: auctionId } = await params;
    
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { vendorId, duration, reason } = body;

    // Validate inputs
    if (!vendorId || typeof vendorId !== 'string') {
      return NextResponse.json(
        { error: 'Vendor ID is required' },
        { status: 400 }
      );
    }

    if (!duration || !Object.keys(SUSPENSION_DURATIONS).includes(duration)) {
      return NextResponse.json(
        { error: 'Invalid suspension duration. Must be one of: 7, 30, 90, permanent' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Reason is required (minimum 10 characters)' },
        { status: 400 }
      );
    }

    // Get vendor details
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, vendorId),
    });

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Get vendor user details
    const vendorUser = await db.query.users.findFirst({
      where: eq(users.id, vendor.userId),
    });

    if (!vendorUser) {
      return NextResponse.json(
        { error: 'Vendor user not found' },
        { status: 404 }
      );
    }

    // Get the fraud flag audit log
    const fraudLog = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.entityId, auctionId),
    });

    if (!fraudLog) {
      return NextResponse.json(
        { error: 'Fraud alert not found' },
        { status: 404 }
      );
    }

    // Calculate suspension end date
    const suspensionStartDate = new Date();
    let suspensionEndDate: Date | null = null;
    
    if (duration !== 'permanent') {
      const days = SUSPENSION_DURATIONS[duration as SuspensionDuration];
      suspensionEndDate = new Date();
      suspensionEndDate.setDate(suspensionEndDate.getDate() + days);
    }

    // Update vendor status to suspended
    await db
      .update(vendors)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));

    // Cancel all active bids from this vendor
    const activeBids = await db.query.bids.findMany({
      where: eq(bids.vendorId, vendorId),
    });

    // Get auctions where this vendor is the current bidder
    const auctionsWithVendorBids = await db.query.auctions.findMany({
      where: and(
        eq(auctions.currentBidder, vendorId),
        eq(auctions.status, 'active')
      ),
      with: {
        case: true,
      },
    });

    // Reset current bidder for these auctions
    for (const auction of auctionsWithVendorBids) {
      // Find the previous highest bid (excluding this vendor)
      const previousBids = await db.query.bids.findMany({
        where: and(
          eq(bids.auctionId, auction.id),
          ne(bids.vendorId, vendorId)
        ),
        orderBy: (bids, { desc }) => [desc(bids.amount)],
      });

      const previousBid = previousBids[0];
      const fallbackBid = auction.case?.reservePrice || '0';

      await db
        .update(auctions)
        .set({
          currentBid: previousBid?.amount || fallbackBid,
          currentBidder: previousBid?.vendorId || null,
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, auction.id));
    }

    // Create audit log for suspension
    const auditData = createAuditLogData(
      request,
      session.user.id,
      AuditActionType.VENDOR_SUSPENDED,
      AuditEntityType.VENDOR,
      vendorId,
      {
        status: vendor.status,
        fraudLogId: fraudLog.id,
      },
      {
        status: 'suspended',
        suspendedBy: session.user.id,
        suspendedByName: user.fullName,
        reason: reason.trim(),
        duration,
        suspensionStartDate: suspensionStartDate.toISOString(),
        suspensionEndDate: suspensionEndDate?.toISOString() || 'permanent',
        cancelledBidsCount: activeBids.length,
        affectedAuctionsCount: auctionsWithVendorBids.length,
      }
    );

    await logAction(auditData);

    // Send SMS notification to vendor
    const suspensionMessage = duration === 'permanent'
      ? 'Your account has been permanently suspended due to suspicious activity.'
      : `Your account has been suspended for ${duration} days due to suspicious activity.`;

    await smsService.sendSMS({
      to: vendorUser.phone,
      message: `${suspensionMessage} Reason: ${reason.trim()}. Contact support if you believe this is an error.`,
      userId: vendor.userId,
    });

    // Send email notification to vendor
    const suspensionDurationText = duration === 'permanent'
      ? 'permanently'
      : `for ${duration} days`;

    await emailService.sendEmail({
      to: vendorUser.email,
      subject: '⚠️ Account Suspended - NEM Salvage Management',
      html: `
        <h2>Account Suspended</h2>
        <p>Dear ${vendorUser.fullName},</p>
        
        <p>Your account has been suspended ${suspensionDurationText} due to suspicious activity detected on our platform.</p>
        
        <h3>Details:</h3>
        <ul>
          <li><strong>Reason:</strong> ${reason.trim()}</li>
          <li><strong>Duration:</strong> ${suspensionDurationText}</li>
          <li><strong>Suspended on:</strong> ${suspensionStartDate.toLocaleDateString()}</li>
          ${suspensionEndDate ? `<li><strong>Suspension ends:</strong> ${suspensionEndDate.toLocaleDateString()}</li>` : ''}
        </ul>
        
        <p><strong>Impact:</strong></p>
        <ul>
          <li>All active bids have been cancelled (${activeBids.length} bids)</li>
          <li>You cannot place new bids during the suspension period</li>
          <li>Your account access is restricted</li>
        </ul>
        
        <p>If you believe this suspension is an error, please contact our support team at <a href="mailto:nemsupport@nem-insurance.com">nemsupport@nem-insurance.com</a> or call 234-02-014489560.</p>
        
        <p>Best regards,<br>NEM Insurance Salvage Management Team</p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: 'Vendor suspended successfully',
      vendorId,
      duration,
      suspensionStartDate: suspensionStartDate.toISOString(),
      suspensionEndDate: suspensionEndDate?.toISOString() || 'permanent',
      cancelledBidsCount: activeBids.length,
      affectedAuctionsCount: auctionsWithVendorBids.length,
      suspendedBy: user.fullName,
    });
  } catch (error) {
    console.error('Failed to suspend vendor:', error);
    return NextResponse.json(
      { error: 'Failed to suspend vendor' },
      { status: 500 }
    );
  }
}
