/**
 * Financial Data Repository
 * 
 * Repository layer for financial data access
 * Task 4: Financial Data Repository
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, vendors } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, inArray, desc, type AnyColumn } from 'drizzle-orm';
import { ReportFilters } from '../../types';
import { resolveReportIsoDateRange } from '../../utils/report-date-range';

type RawRevenueRow = Record<string, string>;

export interface RevenueData {
  caseId: string;
  claimReference: string;
  policyNumber: string | null;
  assetType: string;
  marketValue: string; // ACV - what insurance paid out
  salvageRecovery: string; // What we recovered from auction
  recoveryRate: number; // Percentage of ACV recovered
  netLoss: number; // ACV - Salvage Recovery
  createdAt: Date;
  region?: string;
  branchName: string;
  brokerName: string | null;
  agencyName: string | null;
}

export interface PaymentData {
  paymentId: string;
  amount: string;
  status: string;
  method: string;
  createdAt: Date;
  verifiedAt: Date | null;
  processingTimeHours: number | null;
  vendorId: string;
  vendorName: string;
  auctionId: string | null; // Can be null for registration fees
}

export interface VendorSpendingData {
  vendorId: string;
  vendorName: string;
  tier: string;
  totalSpent: number;
  transactionCount: number;
  averageTransaction: number;
  firstPurchase: Date;
  lastPurchase: Date;
  assetTypeBreakdown: Record<string, number>;
}

export class FinancialDataRepository {
  /**
   * Build date range condition
   */
  private static buildDateCondition(dateColumn: AnyColumn, startDate?: string, endDate?: string) {
    const conditions = [];
    if (startDate) conditions.push(gte(dateColumn, new Date(startDate)));
    if (endDate) conditions.push(lte(dateColumn, new Date(endDate)));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Get revenue data with recovery calculations
   * 
   * FIX: Use DISTINCT ON to avoid duplicate cases when multiple payments exist
   * Get the LATEST payment per case (highest payment.created_at)
   */
  static async getRevenueData(filters: ReportFilters): Promise<RevenueData[]> {
    const { startDate, endDate } = resolveReportIsoDateRange(filters.startDate, filters.endDate);
    const branchFilter = filters.branches && filters.branches.length > 0
      ? sql`AND COALESCE(sc.branch_name, 'Unassigned') IN (${sql.join(filters.branches.map(branch => sql`${branch}`), sql`, `)})`
      : sql``;
    const assetTypeFilter = filters.assetTypes && filters.assetTypes.length > 0
      ? sql`AND sc.asset_type IN (${sql.join(filters.assetTypes.map(assetType => sql`${assetType}`), sql`, `)})`
      : sql``;
    const brokerFilter = filters.brokers && filters.brokers.length > 0
      ? sql`AND sc.broker_name IN (${sql.join(filters.brokers.map((broker) => sql`${broker}`), sql`, `)})`
      : sql``;

    // Use raw SQL with DISTINCT ON to handle duplicate payments per case
    // Get the LATEST verified payment per case
    const results = await db.execute(sql`
      SELECT DISTINCT ON (sc.id)
        sc.id as case_id,
        sc.claim_reference,
        sc.policy_number,
        sc.asset_type,
        sc.market_value,
        sc.broker_name,
        sc.agency_name,
        COALESCE(sc.branch_name, 'Unassigned') as branch_name,
        sc.created_at,
        sc.location_name,
        COALESCE(a.final_settled_amount, p.amount) as payment_amount,
        p.status as payment_status
      FROM payments p
      INNER JOIN auctions a ON p.auction_id = a.id
      INNER JOIN salvage_cases sc ON a.case_id = sc.id
      WHERE p.created_at >= ${startDate}::timestamp
        AND p.created_at <= ${endDate}::timestamp
        AND p.status = 'verified'
        AND p.auction_id IS NOT NULL
        AND p.vendor_id = a.current_bidder
        AND sc.status != 'draft'
        AND sc.claim_reference NOT LIKE 'TEST%'
        ${branchFilter}
        ${assetTypeFilter}
        ${brokerFilter}
      ORDER BY sc.id, p.verified_at DESC NULLS LAST, p.created_at DESC
    `) as unknown as RawRevenueRow[];

    return results.map((row) => {
      const marketValue = parseFloat(row.market_value || '0'); // ACV - claim payout
      // Only use actual verified payment amounts, not bids
      const salvageRecovery = parseFloat(row.payment_amount || '0');
      const netLoss = marketValue - salvageRecovery; // Loss after salvage recovery
      const recoveryRate = marketValue > 0 ? (salvageRecovery / marketValue) * 100 : 0;

      // Extract region from locationName (format: "City, State")
      let region = 'Unknown';
      if (row.location_name) {
        const parts = row.location_name.split(',');
        if (parts.length >= 2) {
          region = parts[1].trim(); // Get state/region
        } else {
          region = row.location_name.trim();
        }
      }

      return {
        caseId: row.case_id,
        claimReference: row.claim_reference,
        policyNumber: row.policy_number || null,
        assetType: row.asset_type,
        marketValue: row.market_value,
        salvageRecovery: salvageRecovery.toString(),
        recoveryRate: Math.round(recoveryRate * 100) / 100,
        netLoss: Math.round(netLoss * 100) / 100,
        createdAt: new Date(row.created_at),
        region,
        branchName: row.branch_name || 'Unassigned',
        brokerName: row.broker_name || null,
        agencyName: row.agency_name || null,
      };
    });
  }

  /**
   * Case-scoped filters for payment queries joined through auction → salvage case.
   */
  private static buildPaymentCaseScopeConditions(filters: ReportFilters) {
    const conditions = [];
    const hasCaseScope =
      (filters.branches && filters.branches.length > 0) ||
      (filters.brokers && filters.brokers.length > 0) ||
      (filters.assetTypes && filters.assetTypes.length > 0);

    if (hasCaseScope) {
      conditions.push(sql`${payments.auctionId} IS NOT NULL`);
    }

    if (filters.branches && filters.branches.length > 0) {
      conditions.push(
        sql`COALESCE(${salvageCases.branchName}, 'Unassigned') IN (${sql.join(
          filters.branches.map((branch) => sql`${branch}`),
          sql`, `
        )})`
      );
    }

    if (filters.brokers && filters.brokers.length > 0) {
      conditions.push(
        sql`${salvageCases.brokerName} IN (${sql.join(
          filters.brokers.map((broker) => sql`${broker}`),
          sql`, `
        )})`
      );
    }

    if (filters.assetTypes && filters.assetTypes.length > 0) {
      conditions.push(
        sql`${salvageCases.assetType} IN (${sql.join(
          filters.assetTypes.map((assetType) => sql`${assetType}`),
          sql`, `
        )})`
      );
    }

    return conditions;
  }

  /**
   * Get payment analytics data
   */
  static async getPaymentData(filters: ReportFilters): Promise<PaymentData[]> {
    const conditions = [];

    // Date range
    const dateCondition = this.buildDateCondition(
      payments.createdAt,
      filters.startDate,
      filters.endDate
    );
    if (dateCondition) conditions.push(dateCondition);

    // Status filter
    if (filters.status && filters.status.length > 0) {
      const validStatuses = filters.status.filter((status): status is 'pending' | 'verified' | 'rejected' | 'overdue' =>
        ['pending', 'verified', 'rejected', 'overdue'].includes(status)
      );
      if (validStatuses.length > 0) {
        conditions.push(inArray(payments.status, validStatuses));
      }
    }

    // Vendor filter
    if (filters.vendorIds && filters.vendorIds.length > 0) {
      conditions.push(inArray(payments.vendorId, filters.vendorIds));
    }

    conditions.push(...this.buildPaymentCaseScopeConditions(filters));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        paymentId: payments.id,
        amount: payments.amount,
        status: payments.status,
        paymentMethod: payments.paymentMethod,
        createdAt: payments.createdAt,
        verifiedAt: payments.verifiedAt,
        vendorId: payments.vendorId,
        vendorBusinessName: vendors.businessName,
        userFullName: sql<string>`u.full_name`,
        auctionId: payments.auctionId,
      })
      .from(payments)
      .leftJoin(vendors, eq(payments.vendorId, vendors.id))
      .leftJoin(sql`users u`, sql`${vendors.userId} = u.id`)
      .leftJoin(auctions, eq(payments.auctionId, auctions.id))
      .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt));

    return results.map(row => {
      let processingTimeHours: number | null = null;
      if (row.verifiedAt && row.createdAt) {
        const diffMs = row.verifiedAt.getTime() - row.createdAt.getTime();
        processingTimeHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      return {
        paymentId: row.paymentId,
        amount: row.amount,
        status: row.status,
        method: row.paymentMethod || 'unknown',
        createdAt: row.createdAt,
        verifiedAt: row.verifiedAt,
        processingTimeHours,
        vendorId: row.vendorId,
        vendorName: row.vendorBusinessName || row.userFullName || 'Unknown',
        auctionId: row.auctionId,
      };
    });
  }

  /**
   * Get registration fee payment data
   */
  static async getRegistrationFeeData(filters: ReportFilters): Promise<PaymentData[]> {
    const conditions = [];

    // Date range
    const dateCondition = this.buildDateCondition(
      payments.createdAt,
      filters.startDate,
      filters.endDate
    );
    if (dateCondition) conditions.push(dateCondition);

    // Only registration fee payments (no auction ID and registration reference).
    // Other no-auction payments can be wallet/deposit noise and must not inflate revenue.
    conditions.push(sql`${payments.auctionId} IS NULL`);
    conditions.push(sql`${payments.paymentReference} LIKE 'REG-%'`);

    // Status filter
    if (filters.status && filters.status.length > 0) {
      const validStatuses = filters.status.filter((status): status is 'pending' | 'verified' | 'rejected' | 'overdue' =>
        ['pending', 'verified', 'rejected', 'overdue'].includes(status)
      );
      if (validStatuses.length > 0) {
        conditions.push(inArray(payments.status, validStatuses));
      }
    }

    // Vendor filter
    if (filters.vendorIds && filters.vendorIds.length > 0) {
      conditions.push(inArray(payments.vendorId, filters.vendorIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        paymentId: payments.id,
        amount: payments.amount,
        status: payments.status,
        paymentMethod: payments.paymentMethod,
        createdAt: payments.createdAt,
        verifiedAt: payments.verifiedAt,
        vendorId: payments.vendorId,
        vendorBusinessName: vendors.businessName,
        userFullName: sql<string>`u.full_name`,
      })
      .from(payments)
      .leftJoin(vendors, eq(payments.vendorId, vendors.id))
      .leftJoin(sql`users u`, sql`${vendors.userId} = u.id`)
      .where(whereClause)
      .orderBy(desc(payments.createdAt));

    return results.map(row => {
      let processingTimeHours: number | null = null;
      if (row.verifiedAt && row.createdAt) {
        const diffMs = row.verifiedAt.getTime() - row.createdAt.getTime();
        processingTimeHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      // Use business_name if available, otherwise fall back to user's full_name
      const vendorName = row.vendorBusinessName || row.userFullName || 'Unknown';

      return {
        paymentId: row.paymentId,
        amount: row.amount,
        status: row.status,
        method: row.paymentMethod || 'unknown',
        createdAt: row.createdAt,
        verifiedAt: row.verifiedAt,
        processingTimeHours,
        vendorId: row.vendorId,
        vendorName,
        auctionId: '', // No auction for registration fees
      };
    });
  }

  /**
   * Get vendor spending data
   */
  static async getVendorSpendingData(filters: ReportFilters): Promise<VendorSpendingData[]> {
    const conditions = [];

    // Date range
    const dateCondition = this.buildDateCondition(
      payments.createdAt,
      filters.startDate,
      filters.endDate
    );
    if (dateCondition) conditions.push(dateCondition);

    // Only verified payments (completed in this system means verified)
    conditions.push(eq(payments.status, 'verified'));

    // Vendor filter
    if (filters.vendorIds && filters.vendorIds.length > 0) {
      conditions.push(inArray(payments.vendorId, filters.vendorIds));
    }

    if (filters.branches && filters.branches.length > 0) {
      conditions.push(
        sql`COALESCE(${salvageCases.branchName}, 'Unassigned') IN (${sql.join(
          filters.branches.map((branch) => sql`${branch}`),
          sql`, `
        )})`
      );
    }

    if (filters.brokers && filters.brokers.length > 0) {
      conditions.push(
        sql`${salvageCases.brokerName} IN (${sql.join(
          filters.brokers.map((broker) => sql`${broker}`),
          sql`, `
        )})`
      );
    }

    if (filters.assetTypes && filters.assetTypes.length > 0) {
      conditions.push(
        sql`${salvageCases.assetType} IN (${sql.join(
          filters.assetTypes.map((assetType) => sql`${assetType}`),
          sql`, `
        )})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all payments with vendor and case details
    const paymentResults = await db
      .select({
        vendorId: payments.vendorId,
        vendorBusinessName: vendors.businessName,
        userFullName: sql<string>`u.full_name`,
        vendorTier: vendors.tier,
        amount: payments.amount,
        createdAt: payments.createdAt,
        assetType: salvageCases.assetType,
      })
      .from(payments)
      .leftJoin(vendors, eq(payments.vendorId, vendors.id))
      .leftJoin(sql`users u`, sql`${vendors.userId} = u.id`)
      .leftJoin(auctions, eq(payments.auctionId, auctions.id))
      .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(whereClause);

    // Group by vendor
    const vendorMap = new Map<string, {
      vendorName: string;
      tier: string;
      amounts: number[];
      dates: Date[];
      assetTypes: Record<string, number>;
    }>();

    for (const row of paymentResults) {
      if (!vendorMap.has(row.vendorId)) {
        // Use business_name if available, otherwise fall back to user's full_name
        const vendorName = row.vendorBusinessName || row.userFullName || 'Unknown';
        
        vendorMap.set(row.vendorId, {
          vendorName,
          tier: row.vendorTier || 'bronze',
          amounts: [],
          dates: [],
          assetTypes: {},
        });
      }

      const vendor = vendorMap.get(row.vendorId)!;
      const amount = parseFloat(row.amount);
      vendor.amounts.push(amount);
      vendor.dates.push(row.createdAt);

      if (row.assetType) {
        vendor.assetTypes[row.assetType] = (vendor.assetTypes[row.assetType] || 0) + amount;
      }
    }

    // Convert to array and calculate totals
    return Array.from(vendorMap.entries()).map(([vendorId, data]) => {
      const totalSpent = data.amounts.reduce((sum, amt) => sum + amt, 0);
      const transactionCount = data.amounts.length;
      const averageTransaction = totalSpent / transactionCount;
      const sortedDates = data.dates.sort((a, b) => a.getTime() - b.getTime());

      return {
        vendorId,
        vendorName: data.vendorName,
        tier: data.tier,
        totalSpent: Math.round(totalSpent * 100) / 100,
        transactionCount,
        averageTransaction: Math.round(averageTransaction * 100) / 100,
        firstPurchase: sortedDates[0],
        lastPurchase: sortedDates[sortedDates.length - 1],
        assetTypeBreakdown: Object.fromEntries(
          Object.entries(data.assetTypes).map(([type, amt]) => [
            type,
            Math.round(amt * 100) / 100,
          ])
        ),
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent); // Sort by total spent descending
  }

  /**
   * Get salvage recovery performance data
   */
  static async getProfitabilityData(filters: ReportFilters) {
    const revenueData = await this.getRevenueData(filters);

    // Calculate recovery metrics (not "profit" - this is insurance salvage)
    const totalClaimsPaid = revenueData.reduce((sum, row) => sum + parseFloat(row.marketValue), 0);
    const totalSalvageRecovered = revenueData.reduce((sum, row) => sum + parseFloat(row.salvageRecovery), 0);
    const totalNetLoss = totalClaimsPaid - totalSalvageRecovered;
    const averageRecoveryRate = totalClaimsPaid > 0 ? (totalSalvageRecovered / totalClaimsPaid) * 100 : 0;

    // Group by asset type
    const byAssetType: Record<string, {
      count: number;
      claimsPaid: number;
      salvageRecovered: number;
      netLoss: number;
      recoveryRate: number;
    }> = {};

    for (const row of revenueData) {
      if (!byAssetType[row.assetType]) {
        byAssetType[row.assetType] = {
          count: 0,
          claimsPaid: 0,
          salvageRecovered: 0,
          netLoss: 0,
          recoveryRate: 0,
        };
      }

      const type = byAssetType[row.assetType];
      type.count++;
      type.claimsPaid += parseFloat(row.marketValue);
      type.salvageRecovered += parseFloat(row.salvageRecovery);
      type.netLoss += row.netLoss;
    }

    // Calculate recovery rates
    for (const type of Object.values(byAssetType)) {
      type.recoveryRate = type.claimsPaid > 0 ? (type.salvageRecovered / type.claimsPaid) * 100 : 0;
      type.claimsPaid = Math.round(type.claimsPaid * 100) / 100;
      type.salvageRecovered = Math.round(type.salvageRecovered * 100) / 100;
      type.netLoss = Math.round(type.netLoss * 100) / 100;
      type.recoveryRate = Math.round(type.recoveryRate * 100) / 100;
    }

    return {
      summary: {
        totalCases: revenueData.length,
        totalClaimsPaid: Math.round(totalClaimsPaid * 100) / 100,
        totalSalvageRecovered: Math.round(totalSalvageRecovered * 100) / 100,
        totalNetLoss: Math.round(totalNetLoss * 100) / 100,
        averageRecoveryRate: Math.round(averageRecoveryRate * 100) / 100,
      },
      byAssetType,
      details: revenueData,
    };
  }

  /**
   * Get payment aging data
   */
  static async getPaymentAgingData(filters: ReportFilters) {
    const paymentData = await this.getPaymentData(filters);
    const now = new Date();

    const aging = {
      current: [] as PaymentData[],
      overdue1to7: [] as PaymentData[],
      overdue8to30: [] as PaymentData[],
      overdue31to60: [] as PaymentData[],
      overdue60plus: [] as PaymentData[],
    };

    for (const payment of paymentData) {
      if (payment.status === 'verified') {
        aging.current.push(payment);
        continue;
      }

      const daysSinceCreated = Math.floor(
        (now.getTime() - payment.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceCreated <= 7) {
        aging.current.push(payment);
      } else if (daysSinceCreated <= 30) {
        aging.overdue1to7.push(payment);
      } else if (daysSinceCreated <= 60) {
        aging.overdue8to30.push(payment);
      } else if (daysSinceCreated <= 90) {
        aging.overdue31to60.push(payment);
      } else {
        aging.overdue60plus.push(payment);
      }
    }

    return {
      summary: {
        total: paymentData.length,
        current: aging.current.length,
        overdue1to7: aging.overdue1to7.length,
        overdue8to30: aging.overdue8to30.length,
        overdue31to60: aging.overdue31to60.length,
        overdue60plus: aging.overdue60plus.length,
      },
      details: aging,
    };
  }
}
