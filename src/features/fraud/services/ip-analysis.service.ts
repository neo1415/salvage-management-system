import { db } from '@/lib/db';
import { bids } from '@/lib/db/schema/bids';
import { algorithmConfig, fraudAlerts } from '@/lib/db/schema/intelligence';
import { eq, and, gte, inArray, sql, countDistinct } from 'drizzle-orm';

interface IPClusterAnalysis {
  ipAddress: string;
  vendorIds: string[];
  competingAuctions: string[];
  isSuspicious: boolean;
  reason: string;
}

export class IPAnalysisService {
  async analyzeBiddingPatterns(vendorId: string, ipAddress: string): Promise<void> {
    try {
      const enabled = await this.isIPFraudDetectionEnabled();
      if (!enabled) {
        console.log('IP fraud detection disabled by admin setting');
        return;
      }

      const recentBids = await db
        .select()
        .from(bids)
        .where(
          and(
            eq(bids.ipAddress, ipAddress),
            gte(bids.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        );

      const uniqueVendors = new Set(recentBids.map((bid) => bid.vendorId));

      if (uniqueVendors.size <= 1) {
        return;
      }

      const vendorIds = Array.from(uniqueVendors);
      const competingBids = await db
        .select({
          auctionId: bids.auctionId,
          vendorCount: countDistinct(bids.vendorId),
        })
        .from(bids)
        .where(
          and(
            inArray(bids.vendorId, vendorIds),
            gte(bids.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        )
        .groupBy(bids.auctionId)
        .having(sql`count(DISTINCT ${bids.vendorId}) > 1`);

      const competingAuctions = competingBids
        .filter((row) => Number(row.vendorCount || 0) > 1)
        .map((row) => row.auctionId);

      if (competingAuctions.length === 0) {
        return;
      }

      await this.createIPFraudAlert({
        ipAddress,
        vendorIds,
        competingAuctions,
        severity: 'high',
      });
    } catch (error) {
      console.error('Failed to analyze bidding patterns:', error);
    }
  }

  async analyzeIPClustering(ipAddress: string): Promise<IPClusterAnalysis> {
    const vendorBids = await db
      .selectDistinct({ vendorId: bids.vendorId })
      .from(bids)
      .where(
        and(
          eq(bids.ipAddress, ipAddress),
          gte(bids.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      );

    const vendorIds = vendorBids.map((row) => row.vendorId);

    if (vendorIds.length <= 1) {
      return {
        ipAddress,
        vendorIds,
        competingAuctions: [],
        isSuspicious: false,
        reason: 'Single vendor from this IP',
      };
    }

    const competingBids = await db
      .select({
        auctionId: bids.auctionId,
        vendorCount: countDistinct(bids.vendorId),
      })
      .from(bids)
      .where(
        and(
          inArray(bids.vendorId, vendorIds),
          gte(bids.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(bids.auctionId)
      .having(sql`count(DISTINCT ${bids.vendorId}) > 1`);

    const competingAuctions = competingBids.map((row) => row.auctionId);
    const isSuspicious = competingAuctions.length > 0;

    return {
      ipAddress,
      vendorIds,
      competingAuctions,
      isSuspicious,
      reason: isSuspicious
        ? `${vendorIds.length} vendors from same IP bidding on ${competingAuctions.length} shared auctions`
        : `${vendorIds.length} vendors from same IP but not competing`,
    };
  }

  private async createIPFraudAlert(data: {
    ipAddress: string;
    vendorIds: string[];
    competingAuctions: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    const primaryAuctionId = data.competingAuctions[0];
    if (!primaryAuctionId) {
      return;
    }

    const existingAlert = await db
      .select({ id: fraudAlerts.id })
      .from(fraudAlerts)
      .where(
        and(
          eq(fraudAlerts.entityType, 'auction'),
          eq(fraudAlerts.entityId, primaryAuctionId),
          eq(fraudAlerts.status, 'pending'),
          gte(fraudAlerts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
        )
      )
      .limit(1);

    if (existingAlert.length > 0) {
      return;
    }

    const { FraudDetectionService } = await import('@/features/intelligence/services/fraud-detection.service');
    const fraudService = new FraudDetectionService();

    await fraudService.createFraudAlert(
      'auction',
      primaryAuctionId,
      data.severity === 'critical' ? 95 : data.severity === 'high' ? 80 : data.severity === 'medium' ? 60 : 40,
      [
        'Multiple vendors from the same IP address are bidding on the same auction',
        `${data.vendorIds.length} vendor accounts share IP ${data.ipAddress}`,
      ],
      {
        source: 'ip_analysis',
        ipAddress: data.ipAddress,
        vendorIds: data.vendorIds,
        competingAuctions: data.competingAuctions,
      }
    );
  }

  async getIPFraudHistory(ipAddress: string): Promise<any[]> {
    return await db
      .select()
      .from(fraudAlerts)
      .where(sql`${fraudAlerts.metadata}->>'ipAddress' = ${ipAddress}`)
      .orderBy(sql`${fraudAlerts.createdAt} DESC`);
  }

  async isIPFlagged(ipAddress: string): Promise<boolean> {
    const alerts = await this.getIPFraudHistory(ipAddress);
    return alerts.some((alert) => alert.status === 'pending' || alert.status === 'confirmed');
  }

  private async isIPFraudDetectionEnabled(): Promise<boolean> {
    try {
      const [setting] = await db
        .select({
          configValue: algorithmConfig.configValue,
          isActive: algorithmConfig.isActive,
        })
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'fraud.ip_detection_enabled'))
        .limit(1);

      if (!setting) {
        return true;
      }

      return setting.isActive && setting.configValue !== false;
    } catch (error) {
      console.error('Failed to read IP fraud detection setting:', error);
      return true;
    }
  }
}

export const ipAnalysisService = new IPAnalysisService();
