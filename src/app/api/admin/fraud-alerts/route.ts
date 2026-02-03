/**
 * Fraud Alerts API - GET Handler
 * Retrieves all fraud alerts for admin review
 * 
 * Requirements:
 * - Requirement 35: Fraud Alert Review
 * - Enterprise Standards Section 6.3: Security & Fraud Prevention
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { bids } from '@/lib/db/schema/bids';
import { auctions } from '@/lib/db/schema/auctions';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { AuditActionType } from '@/lib/utils/audit-logger';

/**
 * GET /api/admin/fraud-alerts
 * Retrieve all fraud alerts
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get all fraud flag audit logs
    const fraudLogs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.actionType, AuditActionType.FRAUD_FLAG_RAISED),
      orderBy: [desc(auditLogs.createdAt)],
      limit: 100, // Limit to last 100 fraud alerts
    });

    // Get unique auction IDs and vendor IDs
    const auctionIds = [...new Set(fraudLogs.map(log => log.entityId))];
    const vendorIds = [...new Set(fraudLogs.map(log => {
      const afterState = log.afterState as { vendorId?: string } | null;
      return afterState?.vendorId;
    }).filter(Boolean))] as string[];

    // Fetch auction details
    const auctionDetails = await db.query.auctions.findMany({
      where: inArray(auctions.id, auctionIds),
      with: {
        case: true,
      },
    });

    // Fetch vendor details
    const vendorDetails = await db.query.vendors.findMany({
      where: inArray(vendors.id, vendorIds),
    });

    // Fetch user details for vendors
    const userIds = vendorDetails.map(v => v.userId);
    const userDetails = await db.query.users.findMany({
      where: inArray(users.id, userIds),
    });

    // Fetch bids for each auction
    const auctionBids = await db.query.bids.findMany({
      where: inArray(bids.auctionId, auctionIds),
      orderBy: [desc(bids.createdAt)],
    });

    // Check if fraud flags have been dismissed
    const dismissedFlags = await db.query.auditLogs.findMany({
      where: and(
        eq(auditLogs.actionType, AuditActionType.FRAUD_FLAG_DISMISSED),
        inArray(auditLogs.entityId, auctionIds)
      ),
    });

    const dismissedAuctionIds = new Set(dismissedFlags.map(log => log.entityId));

    // Format fraud alerts
    const fraudAlerts = fraudLogs
      .filter(log => !dismissedAuctionIds.has(log.entityId)) // Exclude dismissed flags
      .map(log => {
        const afterState = log.afterState as {
          auctionId?: string;
          vendorId?: string;
          bidAmount?: number;
          patterns?: string[];
          details?: Array<{ pattern: string; evidence: string }>;
        } | null;

        const auction = auctionDetails.find(a => a.id === log.entityId);
        const vendor = vendorDetails.find(v => v.id === afterState?.vendorId);
        const auctionBidList = auctionBids.filter(b => b.auctionId === log.entityId);

        return {
          id: log.id,
          auctionId: log.entityId,
          vendorId: afterState?.vendorId,
          bidAmount: afterState?.bidAmount,
          patterns: afterState?.patterns || [],
          details: afterState?.details || [],
          flaggedAt: log.createdAt,
          auction: auction ? {
            id: auction.id,
            status: auction.status,
            currentBid: auction.currentBid,
            endTime: auction.endTime,
            case: auction.case ? {
              id: auction.case.id,
              assetType: auction.case.assetType,
              marketValue: auction.case.marketValue,
              claimReference: auction.case.claimReference,
            } : null,
          } : null,
          vendor: vendor ? {
            id: vendor.id,
            businessName: vendor.businessName,
            tier: vendor.tier,
            status: vendor.status,
            performanceStats: vendor.performanceStats,
            rating: vendor.rating,
            user: (() => {
              const user = userDetails.find(u => u.id === vendor.userId);
              return user ? {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
              } : null;
            })(),
          } : null,
          bidHistory: auctionBidList.map(bid => ({
            id: bid.id,
            vendorId: bid.vendorId,
            amount: bid.amount,
            ipAddress: bid.ipAddress,
            deviceType: bid.deviceType,
            createdAt: bid.createdAt,
          })),
        };
      });

    return NextResponse.json({
      success: true,
      fraudAlerts,
      total: fraudAlerts.length,
    });
  } catch (error) {
    console.error('Failed to fetch fraud alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fraud alerts' },
      { status: 500 }
    );
  }
}
