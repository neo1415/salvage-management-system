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
import { fraudAlerts as intelligenceFraudAlerts } from '@/lib/db/schema/intelligence';
import { providerVerificationRecords } from '@/lib/db/schema/provider-verifications';
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

    // Check if user is admin or salvage manager
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!user || !['system_admin', 'salvage_manager'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Salvage Manager access required' },
        { status: 403 }
      );
    }

    // Get all fraud flag audit logs
    const fraudLogs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.actionType, AuditActionType.FRAUD_FLAG_RAISED),
      orderBy: [desc(auditLogs.createdAt)],
      limit: 100, // Limit to last 100 fraud alerts
    });

    const intelligenceAlerts = await db
      .select()
      .from(intelligenceFraudAlerts)
      .orderBy(desc(intelligenceFraudAlerts.riskScore), desc(intelligenceFraudAlerts.createdAt))
      .limit(100);

    // Get unique auction IDs and vendor IDs
    const intelligenceAuctionIds = intelligenceAlerts
      .filter(alert => alert.entityType === 'auction')
      .map(alert => alert.entityId);
    const auctionIds = [...new Set([...fraudLogs.map(log => log.entityId), ...intelligenceAuctionIds])];
    const intelligenceVendorEntityIds = intelligenceAlerts
      .filter(alert => alert.entityType === 'vendor')
      .map(alert => alert.entityId);
    const vendorIds = [...new Set(fraudLogs.map(log => {
      const afterState = log.afterState as { vendorId?: string } | null;
      return afterState?.vendorId;
    }).filter(Boolean).concat(
      intelligenceVendorEntityIds,
      intelligenceAlerts.flatMap((alert) => {
        const metadata = alert.metadata as { vendorIds?: string[] } | null;
        return metadata?.vendorIds || [];
      })
    ))] as string[];

    // Fetch auction details
    const auctionDetails = auctionIds.length > 0
      ? await db.query.auctions.findMany({
          where: inArray(auctions.id, auctionIds),
          with: {
            case: true,
          },
        })
      : [];

    // Fetch vendor details
    const vendorDetails = vendorIds.length > 0
      ? await db.query.vendors.findMany({
          where: inArray(vendors.id, vendorIds),
        })
      : [];

    // Fetch user details for vendors
    const directUserIds = intelligenceAlerts
      .filter(alert => alert.entityType === 'user')
      .map(alert => alert.entityId);
    const userIds = [...new Set([...vendorDetails.map(v => v.userId), ...directUserIds])];
    const userDetails = userIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, userIds),
        })
      : [];

    // Fetch bids for each auction
    const auctionBids = auctionIds.length > 0
      ? await db.query.bids.findMany({
          where: inArray(bids.auctionId, auctionIds),
          orderBy: [desc(bids.createdAt)],
        })
      : [];

    // Check if fraud flags have been dismissed
    const dismissedFlags = auctionIds.length > 0
      ? await db.query.auditLogs.findMany({
          where: and(
            eq(auditLogs.actionType, AuditActionType.FRAUD_FLAG_DISMISSED),
            inArray(auditLogs.entityId, auctionIds)
          ),
        })
      : [];

    const dismissedAuctionIds = new Set(dismissedFlags.map(log => log.entityId));

    const providerReferences = [
      ...new Set(intelligenceAlerts
        .map((alert) => {
          const metadata = alert.metadata as { providerReference?: string } | null;
          return metadata?.providerReference;
        })
        .filter(Boolean) as string[])
    ];

    const providerRecordsByReference = providerReferences.length > 0
      ? await db
          .select()
          .from(providerVerificationRecords)
          .where(inArray(providerVerificationRecords.providerReference, providerReferences))
          .orderBy(desc(providerVerificationRecords.updatedAt))
      : [];
    const providerRecordsByVendor = vendorIds.length > 0
      ? await db
          .select()
          .from(providerVerificationRecords)
          .where(inArray(providerVerificationRecords.vendorId, vendorIds))
          .orderBy(desc(providerVerificationRecords.updatedAt))
      : [];
    const providerRecords = [...providerRecordsByReference, ...providerRecordsByVendor];

    const intelligenceAlertIds = intelligenceAlerts.map((alert) => alert.id);
    const timelineEntityIds = [...new Set([...intelligenceAlertIds, ...vendorIds])];
    const alertTimelineLogs = timelineEntityIds.length > 0
      ? await db.query.auditLogs.findMany({
          where: inArray(auditLogs.entityId, timelineEntityIds),
          orderBy: [desc(auditLogs.createdAt)],
          limit: 200,
        })
      : [];

    // Format fraud alerts
    const auditFraudAlerts = fraudLogs
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
          alertSource: 'audit',
        };
      });

    const intelligenceFraudAlertsFormatted = intelligenceAlerts.map(alert => {
      const metadata = alert.metadata as {
        ipAddress?: string;
        vendorIds?: string[];
        competingAuctions?: string[];
        source?: string;
        providerReference?: string;
        workflowReference?: string;
        verificationType?: string;
        riskLevel?: string;
        checksCompleted?: string[];
        failedChecks?: string[];
        reasonCodes?: string[];
        reviewHistory?: Array<{
          action: string;
          reason?: string;
          actorId?: string;
          actorName?: string;
          createdAt: string;
        }>;
      } | null;
      const auction = alert.entityType === 'auction'
        ? auctionDetails.find(a => a.id === alert.entityId)
        : undefined;
      const primaryVendorId = alert.entityType === 'vendor'
        ? alert.entityId
        : metadata?.vendorIds?.[0] || '';
      const vendor = vendorDetails.find(v => v.id === primaryVendorId);
      const directUser = alert.entityType === 'user'
        ? userDetails.find(u => u.id === alert.entityId)
        : undefined;
      const auctionBidList = auctionBids.filter(b => b.auctionId === alert.entityId);
      const linkedProviderRecord = providerRecords.find(record =>
        (metadata?.providerReference && record.providerReference === metadata.providerReference) ||
        (primaryVendorId && record.vendorId === primaryVendorId)
      );
      const normalizedProviderResult = (linkedProviderRecord?.normalizedResult as Record<string, unknown> | null) ?? null;
      const timeline = alertTimelineLogs
        .filter(log => log.entityId === alert.id || log.entityId === primaryVendorId || log.entityId === alert.entityId)
        .slice(0, 12)
        .map(log => ({
          id: log.id,
          actionType: log.actionType,
          entityType: log.entityType,
          entityId: log.entityId,
          createdAt: log.createdAt,
          afterState: log.afterState,
        }));

      return {
        id: alert.id,
        status: alert.status,
        severity: alert.riskScore >= 90 ? 'critical' : alert.riskScore >= 75 ? 'high' : alert.riskScore >= 50 ? 'medium' : 'low',
        riskScore: alert.riskScore,
        entityType: alert.entityType,
        entityId: alert.entityId,
        auctionId: alert.entityId,
        vendorId: primaryVendorId,
        bidAmount: auction?.currentBid || '0',
        patterns: alert.flagReasons,
        reasonCodes: metadata?.reasonCodes || alert.flagReasons,
        details: alert.flagReasons.map(reason => ({
          pattern: metadata?.source === 'dojah'
            ? 'Dojah KYC risk'
            : metadata?.source === 'ip_analysis' ? 'IP fraud detection' : 'Fraud detection',
          evidence: reason,
        })),
        evidenceSummary: {
          source: metadata?.source || 'intelligence',
          providerReference: metadata?.providerReference,
          workflowReference: metadata?.workflowReference,
          verificationType: metadata?.verificationType,
          riskLevel: metadata?.riskLevel,
          checksCompleted: metadata?.checksCompleted || [],
          failedChecks: metadata?.failedChecks || [],
          ipAddress: metadata?.ipAddress,
          pendingReason: normalizedProviderResult?.pendingReason,
          providerMessage: normalizedProviderResult?.providerMessage,
          amlStatus: normalizedProviderResult?.amlStatus,
          amlMatchDetails: normalizedProviderResult?.amlMatchDetails,
        },
        providerVerification: linkedProviderRecord ? {
          id: linkedProviderRecord.id,
          provider: linkedProviderRecord.provider,
          providerReference: linkedProviderRecord.providerReference,
          workflowReference: linkedProviderRecord.workflowReference,
          verificationType: linkedProviderRecord.verificationType,
          status: linkedProviderRecord.status,
          riskLevel: linkedProviderRecord.riskLevel,
          checksCompleted: linkedProviderRecord.checksCompleted,
          pendingChecks: linkedProviderRecord.pendingChecks,
          failedChecks: linkedProviderRecord.failedChecks,
          reasonCodes: linkedProviderRecord.reasonCodes,
          displayMessage: linkedProviderRecord.displayMessage,
          updatedAt: linkedProviderRecord.updatedAt,
        } : null,
        relatedLinks: {
          kycReview: primaryVendorId ? `/manager/kyc-approvals/${primaryVendorId}` : null,
          vendor: primaryVendorId ? `/manager/vendors` : null,
        },
        timeline,
        reviewHistory: metadata?.reviewHistory || [],
        flaggedAt: alert.createdAt,
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
        } : directUser ? {
          id: '',
          businessName: null,
          tier: 'n/a',
          status: directUser.status,
          performanceStats: { totalBids: 0, totalWins: 0, winRate: 0, avgPaymentTimeHours: 0, onTimePickupRate: 0, fraudFlags: 0 },
          rating: '0.00',
          user: {
            id: directUser.id,
            fullName: directUser.fullName,
            email: directUser.email,
            phone: directUser.phone,
          },
        } : null,
        bidHistory: auctionBidList.map(bid => ({
          id: bid.id,
          vendorId: bid.vendorId,
          amount: bid.amount,
          ipAddress: bid.ipAddress,
          deviceType: bid.deviceType,
          createdAt: bid.createdAt,
        })),
        alertSource: 'intelligence',
      };
    });

    const fraudAlerts = [...intelligenceFraudAlertsFormatted, ...auditFraudAlerts]
      .sort((a, b) => new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime());

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
