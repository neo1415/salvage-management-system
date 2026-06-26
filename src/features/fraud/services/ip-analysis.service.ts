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

function normalizeIpAddress(ipAddress: string): string {
  const trimmed = ipAddress.trim().toLowerCase();
  if (!trimmed) return 'unknown';

  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }

  return trimmed;
}

function isUnusableIpForAnalysis(ipAddress: string): boolean {
  const normalized = normalizeIpAddress(ipAddress);
  if (!normalized || normalized === 'unknown') return true;
  if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') return true;
  return false;
}

export class IPAnalysisService {
  async analyzeBiddingPatterns(vendorId: string, ipAddress: string, auctionId?: string): Promise<void> {
    try {
      const enabled = await this.isIPFraudDetectionEnabled();
      if (!enabled) {
        console.log('IP fraud detection disabled by admin setting');
        return;
      }

      const normalizedIp = normalizeIpAddress(ipAddress);
      if (isUnusableIpForAnalysis(ipAddress)) {
        console.warn('[IP Fraud] Skipping analysis — IP address unavailable or unusable', {
          vendorId,
          auctionId,
          ipAddress: normalizedIp,
        });
        return;
      }

      const recentBids = await db
        .select()
        .from(bids)
        .where(
          and(
            sql`lower(trim(${bids.ipAddress})) = ${normalizedIp}`,
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
            sql`lower(trim(${bids.ipAddress})) = ${normalizedIp}`,
            gte(bids.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        )
        .groupBy(bids.auctionId)
        .having(sql`count(DISTINCT ${bids.vendorId}) > 1`);

      const competingAuctions = competingBids
        .filter((row) => Number(row.vendorCount || 0) > 1)
        .map((row) => row.auctionId);

      if (competingAuctions.length === 0) {
        // Same network / shared IP across accounts even on different auctions (lower severity).
        if (vendorIds.length >= 2) {
          const crossAuctionTarget = auctionId || recentBids.find((bid) => bid.auctionId)?.auctionId;
          if (crossAuctionTarget) {
            await this.createIPFraudAlert({
              ipAddress: normalizedIp,
              vendorIds,
              competingAuctions: Array.from(new Set(recentBids.map((bid) => bid.auctionId))),
              severity: 'medium',
              primaryAuctionId: crossAuctionTarget,
              reasonSuffix: `${vendorIds.length} vendor accounts share IP ${normalizedIp} across recent bids (cross-auction pattern)`,
            });
          }
        }
        return;
      }

      const targetAuctionId = auctionId && competingAuctions.includes(auctionId)
        ? auctionId
        : competingAuctions[0];

      await this.createIPFraudAlert({
        ipAddress: normalizedIp,
        vendorIds,
        competingAuctions,
        severity: 'high',
        primaryAuctionId: targetAuctionId,
        reasonSuffix: `${vendorIds.length} vendor accounts share IP ${normalizedIp} on the same auction`,
      });
    } catch (error) {
      console.error('Failed to analyze bidding patterns:', error);
    }
  }

  async analyzeIPClustering(ipAddress: string): Promise<IPClusterAnalysis> {
    const normalizedIp = normalizeIpAddress(ipAddress);

    if (isUnusableIpForAnalysis(ipAddress)) {
      return {
        ipAddress: normalizedIp,
        vendorIds: [],
        competingAuctions: [],
        isSuspicious: false,
        reason: 'IP address unavailable for clustering analysis',
      };
    }

    const vendorBids = await db
      .selectDistinct({ vendorId: bids.vendorId })
      .from(bids)
      .where(
        and(
          sql`lower(trim(${bids.ipAddress})) = ${normalizedIp}`,
          gte(bids.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      );

    const vendorIds = vendorBids.map((row) => row.vendorId);

    if (vendorIds.length <= 1) {
      return {
        ipAddress: normalizedIp,
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
          sql`lower(trim(${bids.ipAddress})) = ${normalizedIp}`,
          gte(bids.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      )
      .groupBy(bids.auctionId)
      .having(sql`count(DISTINCT ${bids.vendorId}) > 1`);

    const competingAuctions = competingBids.map((row) => row.auctionId);
    const isSuspicious = competingAuctions.length > 0;

    return {
      ipAddress: normalizedIp,
      vendorIds,
      competingAuctions,
      isSuspicious,
      reason: isSuspicious
        ? `${vendorIds.length} vendors from same IP bidding on ${competingAuctions.length} shared auctions`
        : `${vendorIds.length} vendors from same IP but not competing`,
    };
  }

  async rescanRecentIpClusters(days = 7): Promise<{ scanned: number; alertsCreated: number }> {
    const enabled = await this.isIPFraudDetectionEnabled();
    if (!enabled) {
      return { scanned: 0, alertsCreated: 0 };
    }

    const rows = await db.execute(sql`
      SELECT DISTINCT lower(trim(ip_address)) AS ip_address
      FROM bids
      WHERE created_at >= NOW() - (${days}::int * INTERVAL '1 day')
        AND ip_address IS NOT NULL
        AND trim(ip_address) <> ''
        AND lower(trim(ip_address)) NOT IN ('unknown', 'localhost', '127.0.0.1', '::1')
    `);

    const ipAddresses = Array.isArray(rows)
      ? rows
          .map((row: { ip_address?: string }) => row.ip_address)
          .filter((ip): ip is string => typeof ip === 'string' && !isUnusableIpForAnalysis(ip))
      : [];

    let alertsCreated = 0;
    for (const ip of ipAddresses) {
      const analysis = await this.analyzeIPClustering(ip);
      if (!analysis.isSuspicious || analysis.vendorIds.length < 2) continue;

      const primaryAuctionId = analysis.competingAuctions[0];
      if (!primaryAuctionId) continue;

      const existing = await this.getIPFraudHistory(ip);
      const hasRecentPending = existing.some(
        (alert) =>
          alert.status === 'pending' &&
          new Date(alert.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );
      if (hasRecentPending) continue;

      await this.createIPFraudAlert({
        ipAddress: analysis.ipAddress,
        vendorIds: analysis.vendorIds,
        competingAuctions: analysis.competingAuctions,
        severity: 'high',
        primaryAuctionId,
        reasonSuffix: analysis.reason,
      });
      alertsCreated += 1;
    }

    return { scanned: ipAddresses.length, alertsCreated };
  }

  private async createIPFraudAlert(data: {
    ipAddress: string;
    vendorIds: string[];
    competingAuctions: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    primaryAuctionId: string;
    reasonSuffix?: string;
  }): Promise<void> {
    const existingAlerts = await db
      .select({ id: fraudAlerts.id, metadata: fraudAlerts.metadata })
      .from(fraudAlerts)
      .where(
        and(
          eq(fraudAlerts.entityType, 'auction'),
          eq(fraudAlerts.entityId, data.primaryAuctionId),
          eq(fraudAlerts.status, 'pending'),
          gte(fraudAlerts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
        )
      )
      .limit(1);

    if (existingAlerts.length > 0) {
      const existing = existingAlerts[0];
      const metadata = (existing.metadata as { source?: string; vendorIds?: string[] } | null) ?? null;
      if (metadata?.source === 'ip_analysis') {
        const mergedVendorIds = Array.from(new Set([...(metadata.vendorIds ?? []), ...data.vendorIds]));
        await db
          .update(fraudAlerts)
          .set({
            flagReasons: [
              'Multiple vendors from the same IP address are bidding on the same auction',
              `${mergedVendorIds.length} vendor accounts share IP ${data.ipAddress}`,
            ],
            metadata: {
              source: 'ip_analysis',
              ipAddress: data.ipAddress,
              vendorIds: mergedVendorIds,
              competingAuctions: data.competingAuctions,
            },
          } as Partial<typeof fraudAlerts.$inferInsert>)
          .where(eq(fraudAlerts.id, existing.id));
      }
      return;
    }

    const { FraudDetectionService } = await import('@/features/intelligence/services/fraud-detection.service');
    const fraudService = new FraudDetectionService();

    await fraudService.createFraudAlert(
      'auction',
      data.primaryAuctionId,
      data.severity === 'critical' ? 95 : data.severity === 'high' ? 80 : data.severity === 'medium' ? 60 : 40,
      [
        data.severity === 'medium'
          ? 'Multiple vendor accounts share the same IP across recent bids'
          : 'Multiple vendors from the same IP address are bidding on the same auction',
        data.reasonSuffix || `${data.vendorIds.length} vendor accounts share IP ${data.ipAddress}`,
      ],
      {
        source: 'ip_analysis',
        ipAddress: data.ipAddress,
        vendorIds: data.vendorIds,
        competingAuctions: data.competingAuctions,
      }
    );
  }

  async getIPFraudHistory(ipAddress: string): Promise<typeof fraudAlerts.$inferSelect[]> {
    const normalizedIp = normalizeIpAddress(ipAddress);
    return await db
      .select()
      .from(fraudAlerts)
      .where(sql`${fraudAlerts.metadata}->>'ipAddress' = ${normalizedIp}`)
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
