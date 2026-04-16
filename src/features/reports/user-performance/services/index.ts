/**
 * User Performance Report Services
 * 
 * All user performance reporting services
 * Tasks 18-21: User Performance Data Repository and Services
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, bids, users } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray, desc, count, sum } from 'drizzle-orm';
import { ReportFilters } from '../../types';

// ============================================================================
// TASK 18: User Performance Data Repository
// ============================================================================

class UserPerformanceRepository {
  private static buildDateCondition(dateColumn: any, startDate?: string, endDate?: string) {
    const conditions = [];
    if (startDate) conditions.push(gte(dateColumn, new Date(startDate)));
    if (endDate) conditions.push(lte(dateColumn, new Date(endDate)));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  static async getAdjusterPerformanceData(filters: ReportFilters) {
    // Build conditions array
    const conditions = [];
    
    // Date range conditions - convert string dates to Date objects if needed
    if (filters.startDate) {
      const startDate = typeof filters.startDate === 'string' ? new Date(filters.startDate) : filters.startDate;
      conditions.push(gte(salvageCases.createdAt, startDate));
    }
    if (filters.endDate) {
      const endDate = typeof filters.endDate === 'string' ? new Date(filters.endDate) : filters.endDate;
      conditions.push(lte(salvageCases.createdAt, endDate));
    }
    
    // User IDs filter - use inArray for proper array handling
    if (filters.userIds && filters.userIds.length > 0) {
      conditions.push(inArray(salvageCases.createdBy, filters.userIds));
    }

    // Execute query using drizzle query builder
    const results = await db
      .select({
        adjusterId: salvageCases.createdBy,
        adjusterName: users.fullName,
        caseId: salvageCases.id,
        status: salvageCases.status,
        marketValue: salvageCases.marketValue,
        createdAt: salvageCases.createdAt,
        approvedAt: salvageCases.approvedAt,
        currentBid: auctions.currentBid,
        paymentAmount: payments.amount,
      })
      .from(salvageCases)
      .leftJoin(users, eq(salvageCases.createdBy, users.id))
      .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
      .leftJoin(
        payments,
        and(
          eq(auctions.id, payments.auctionId),
          eq(payments.status, 'verified')
        )
      )
      .where(and(...conditions))
      .orderBy(desc(salvageCases.createdAt));

    return results;
  }

  static async getFinancePerformanceData(filters: ReportFilters) {
    const conditions = [];
    const dateCondition = this.buildDateCondition(payments.createdAt, filters.startDate, filters.endDate);
    if (dateCondition) conditions.push(dateCondition);

    let query = db
      .select({
        paymentId: payments.id,
        amount: payments.amount,
        status: payments.status,
        paymentMethod: payments.paymentMethod,
        createdAt: payments.createdAt,
        verifiedAt: payments.verifiedAt,
      })
      .from(payments);

    // Apply where clause if conditions exist
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query;
  }
}

// ============================================================================
// TASK 19: Claims Adjuster Metrics Service
// ============================================================================

export interface AdjusterMetricsReport {
  summary: {
    totalAdjusters: number;
    totalCasesProcessed: number;
    averageCasesPerAdjuster: number;
    averageProcessingTimeHours: number;
    averageApprovalRate: number;
    totalRevenueGenerated: number;
  };
  adjusterPerformance: Array<{
    adjusterId: string;
    adjusterName: string;
    casesProcessed: number;
    averageProcessingTime: number;
    approvalRate: number;
    rejectionRate: number;
    recoveryRate: number;
    directRevenue: number;
    indirectRevenue: number;
    totalRevenue: number;
    performanceScore: number;
  }>;
  topPerformers: Array<{
    adjusterId: string;
    adjusterName: string;
    metric: string;
    value: number;
  }>;
}

export class AdjusterMetricsService {
  static async generateReport(filters: ReportFilters): Promise<AdjusterMetricsReport> {
    const data = await UserPerformanceRepository.getAdjusterPerformanceData(filters);

    // Group by adjuster
    const adjusterMap = new Map<string, any[]>();
    for (const row of data) {
      if (!adjusterMap.has(row.adjusterId)) {
        adjusterMap.set(row.adjusterId, []);
      }
      adjusterMap.get(row.adjusterId)!.push(row);
    }

    const adjusterPerformance = Array.from(adjusterMap.entries()).map(([adjusterId, cases]) => {
      const approved = cases.filter(c => c.status === 'approved').length;
      const rejected = cases.filter(c => c.status === 'draft' && c.approvedAt !== null).length;
      const total = approved + rejected;
      
      const approvalRate = total > 0 ? (approved / total) * 100 : 0;
      const rejectionRate = total > 0 ? (rejected / total) * 100 : 0;

      const withTime = cases.filter(c => c.approvedAt);
      const avgTime = withTime.length > 0
        ? withTime.reduce((sum, c) => {
            const diff = c.approvedAt!.getTime() - c.createdAt.getTime();
            return sum + (diff / (1000 * 60 * 60));
          }, 0) / withTime.length
        : 0;

      const totalMarketValue = cases.reduce((sum, c) => sum + parseFloat(c.marketValue || '0'), 0);
      const totalRecovery = cases.reduce((sum, c) => sum + parseFloat(c.paymentAmount || c.currentBid || '0'), 0);
      const recoveryRate = totalMarketValue > 0 ? (totalRecovery / totalMarketValue) * 100 : 0;

      const directRevenue = totalRecovery;
      const indirectRevenue = 0; // Could calculate based on efficiency savings
      const totalRevenue = directRevenue + indirectRevenue;

      // Performance score (0-100)
      const performanceScore = Math.min(100, (
        (approvalRate * 0.3) +
        (recoveryRate * 0.4) +
        (Math.min(100, (cases.length / 10) * 100) * 0.3)
      ));

      return {
        adjusterId,
        adjusterName: cases[0]?.adjusterName || 'Unknown',
        casesProcessed: cases.length,
        averageProcessingTime: Math.round(avgTime * 100) / 100,
        approvalRate: Math.round(approvalRate * 100) / 100,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        recoveryRate: Math.round(recoveryRate * 100) / 100,
        directRevenue: Math.round(directRevenue * 100) / 100,
        indirectRevenue: Math.round(indirectRevenue * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        performanceScore: Math.round(performanceScore * 100) / 100,
      };
    }).sort((a, b) => b.performanceScore - a.performanceScore);

    const summary = {
      totalAdjusters: adjusterPerformance.length,
      totalCasesProcessed: data.length,
      averageCasesPerAdjuster: adjusterPerformance.length > 0 ? Math.round(data.length / adjusterPerformance.length) : 0,
      averageProcessingTimeHours: adjusterPerformance.length > 0
        ? Math.round((adjusterPerformance.reduce((sum, a) => sum + a.averageProcessingTime, 0) / adjusterPerformance.length) * 100) / 100
        : 0,
      averageApprovalRate: adjusterPerformance.length > 0
        ? Math.round((adjusterPerformance.reduce((sum, a) => sum + a.approvalRate, 0) / adjusterPerformance.length) * 100) / 100
        : 0,
      totalRevenueGenerated: Math.round(adjusterPerformance.reduce((sum, a) => sum + a.totalRevenue, 0) * 100) / 100,
    };

    const topPerformers = adjusterPerformance.length > 0 ? [
      { 
        adjusterId: adjusterPerformance[0].adjusterId, 
        adjusterName: adjusterPerformance[0].adjusterName, 
        metric: 'Performance Score', 
        value: adjusterPerformance[0].performanceScore 
      },
      { 
        adjusterId: [...adjusterPerformance].sort((a, b) => b.casesProcessed - a.casesProcessed)[0].adjusterId, 
        adjusterName: [...adjusterPerformance].sort((a, b) => b.casesProcessed - a.casesProcessed)[0].adjusterName, 
        metric: 'Cases Processed', 
        value: [...adjusterPerformance].sort((a, b) => b.casesProcessed - a.casesProcessed)[0].casesProcessed 
      },
      { 
        adjusterId: [...adjusterPerformance].sort((a, b) => b.totalRevenue - a.totalRevenue)[0].adjusterId, 
        adjusterName: [...adjusterPerformance].sort((a, b) => b.totalRevenue - a.totalRevenue)[0].adjusterName, 
        metric: 'Revenue Generated', 
        value: [...adjusterPerformance].sort((a, b) => b.totalRevenue - a.totalRevenue)[0].totalRevenue 
      },
    ] : [];

    return { summary, adjusterPerformance, topPerformers };
  }
}

// ============================================================================
// TASK 20: Finance Officer Metrics Service
// ============================================================================

export interface FinanceMetricsReport {
  summary: {
    totalPaymentsProcessed: number;
    totalAmountProcessed: number;
    averageVerificationTimeHours: number;
    autoVerificationRate: number;
    paymentAccuracy: number;
  };
  financePerformance: {
    paymentsProcessed: number;
    averageProcessingTime: number;
    autoVerificationRate: number;
    successRate: number;
    revenueImpact: number;
  };
}

export class FinanceMetricsService {
  static async generateReport(filters: ReportFilters): Promise<FinanceMetricsReport> {
    const data = await UserPerformanceRepository.getFinancePerformanceData(filters);

    const totalAmount = data.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const verified = data.filter(p => p.status === 'verified').length;
    
    const verifiedWithTime = data.filter(p => p.verifiedAt);
    const avgVerificationTime = verifiedWithTime.length > 0
      ? verifiedWithTime.reduce((sum, p) => {
          const diff = p.verifiedAt!.getTime() - p.createdAt.getTime();
          return sum + (diff / (1000 * 60 * 60));
        }, 0) / verifiedWithTime.length
      : 0;

    const autoVerified = data.filter(p => {
      if (!p.verifiedAt) return false;
      const diff = p.verifiedAt.getTime() - p.createdAt.getTime();
      return (diff / (1000 * 60 * 60)) < 1; // Less than 1 hour = auto
    }).length;

    const autoVerificationRate = data.length > 0 ? (autoVerified / data.length) * 100 : 0;
    const successRate = data.length > 0 ? (verified / data.length) * 100 : 0;

    return {
      summary: {
        totalPaymentsProcessed: data.length,
        totalAmountProcessed: Math.round(totalAmount * 100) / 100,
        averageVerificationTimeHours: Math.round(avgVerificationTime * 100) / 100,
        autoVerificationRate: Math.round(autoVerificationRate * 100) / 100,
        paymentAccuracy: Math.round(successRate * 100) / 100,
      },
      financePerformance: {
        paymentsProcessed: data.length,
        averageProcessingTime: Math.round(avgVerificationTime * 100) / 100,
        autoVerificationRate: Math.round(autoVerificationRate * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        revenueImpact: Math.round(totalAmount * 100) / 100,
      },
    };
  }
}

// ============================================================================
// TASK 21: Manager & Admin Metrics Service
// ============================================================================

export interface ManagerMetricsReport {
  summary: {
    totalCasesManaged: number;
    totalRevenueGenerated: number;
    teamProductivity: number;
    operationalEfficiency: number;
  };
  teamPerformance: {
    adjusters: number;
    averageCasesPerAdjuster: number;
    teamApprovalRate: number;
    teamRecoveryRate: number;
  };
}

export class ManagerMetricsService {
  static async generateReport(filters: ReportFilters): Promise<ManagerMetricsReport> {
    const adjusterData = await UserPerformanceRepository.getAdjusterPerformanceData(filters);

    const uniqueAdjusters = new Set(adjusterData.map(d => d.adjusterId)).size;
    const avgCasesPerAdjuster = uniqueAdjusters > 0 ? adjusterData.length / uniqueAdjusters : 0;

    const approved = adjusterData.filter(c => c.status === 'approved').length;
    const rejected = adjusterData.filter(c => c.status === 'draft' && c.approvedAt !== null).length;
    const total = approved + rejected;
    const teamApprovalRate = total > 0 ? (approved / total) * 100 : 0;

    const totalMarketValue = adjusterData.reduce((sum, c) => sum + parseFloat(c.marketValue || '0'), 0);
    const totalRecovery = adjusterData.reduce((sum, c) => sum + parseFloat(c.paymentAmount || c.currentBid || '0'), 0);
    const teamRecoveryRate = totalMarketValue > 0 ? (totalRecovery / totalMarketValue) * 100 : 0;

    const teamProductivity = Math.min(100, avgCasesPerAdjuster * 10);
    const operationalEfficiency = (teamApprovalRate + teamRecoveryRate) / 2;

    return {
      summary: {
        totalCasesManaged: adjusterData.length,
        totalRevenueGenerated: Math.round(totalRecovery * 100) / 100,
        teamProductivity: Math.round(teamProductivity * 100) / 100,
        operationalEfficiency: Math.round(operationalEfficiency * 100) / 100,
      },
      teamPerformance: {
        adjusters: uniqueAdjusters,
        averageCasesPerAdjuster: Math.round(avgCasesPerAdjuster * 100) / 100,
        teamApprovalRate: Math.round(teamApprovalRate * 100) / 100,
        teamRecoveryRate: Math.round(teamRecoveryRate * 100) / 100,
      },
    };
  }
}

// ============================================================================
// My Performance Service (Role-Specific)
// ============================================================================

export interface MyPerformanceReport {
  casesProcessed: number;
  avgProcessingTime: number;
  approvalRate: number;
  qualityScore: number;
  trends: Array<{ period: string; cases: number; quality: number }>;
  revenueContribution: number;
  // Manager-specific fields
  teamBreakdown?: Array<{
    adjusterId: string;
    adjusterName: string;
    casesSubmitted: number;
    casesApproved: number;
    casesRejected: number;
    approvalRate: number;
    avgProcessingTime: number;
    revenue: number;
  }>;
  pendingApproval?: number;
}

export class MyPerformanceService {
  static async generateReport(filters: ReportFilters, userId: string, userRole: string): Promise<MyPerformanceReport> {
    if (userRole === 'salvage_manager') {
      return this.generateManagerTeamReport(filters, userId);
    } else {
      return this.generateAdjusterPersonalReport(filters, userId);
    }
  }

  /**
   * Claims Adjuster Personal Report
   * Shows cases THEY CREATED and their outcomes
   */
  private static async generateAdjusterPersonalReport(filters: ReportFilters, userId: string): Promise<MyPerformanceReport> {
    const userFilters = { ...filters, userIds: [userId] };
    const data = await UserPerformanceRepository.getAdjusterPerformanceData(userFilters) || [];

    // Cases that were approved (moved forward in the workflow)
    const approved = data.filter(c => 
      c.status === 'approved' || c.status === 'active_auction' || c.status === 'sold'
    ).length;
    
    // Cases that were rejected (have approvedAt but are back in draft status)
    const rejected = data.filter(c => 
      c.status === 'draft' && c.approvedAt !== null
    ).length;
    
    const total = approved + rejected;
    const approvalRate = total > 0 ? (approved / total) * 100 : 0;

    // Processing time: from creation to approval/rejection
    const withDecision = data.filter(c => c.approvedAt);
    const avgProcessingTime = withDecision.length > 0
      ? withDecision.reduce((sum, c) => {
          const diff = c.approvedAt!.getTime() - c.createdAt.getTime();
          return sum + (diff / (1000 * 60 * 60 * 24));
        }, 0) / withDecision.length
      : 0;

    // Revenue: actual verified payments from cases (regardless of status)
    const revenue = data
      .filter(c => c.paymentAmount)
      .reduce((sum, c) => sum + parseFloat(c.paymentAmount || '0'), 0);

    // Quality Score: Composite metric (0-100)
    // - Approval Rate (40%): How many cases get approved
    // - Low Rejection Rate (30%): How few cases get rejected  
    // - Processing Efficiency (30%): How quickly cases are processed
    const rejectionRate = total > 0 ? (rejected / total) * 100 : 0;
    const lowRejectionScore = 100 - rejectionRate;
    
    // Processing efficiency: Compare actual time vs target (2 days = 48 hours)
    const targetProcessingDays = 2;
    const processingEfficiency = avgProcessingTime > 0 
      ? Math.max(0, 100 - ((avgProcessingTime / targetProcessingDays) * 100))
      : 0;
    
    const qualityScore = (
      (approvalRate * 0.4) +
      (lowRejectionScore * 0.3) +
      (processingEfficiency * 0.3)
    );

    // Trends by week
    const trendMap = new Map<string, { cases: number; approved: number }>();
    for (const item of data) {
      const date = new Date(item.createdAt);
      const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
      const period = weekStart.toISOString().split('T')[0];
      
      if (!trendMap.has(period)) {
        trendMap.set(period, { cases: 0, approved: 0 });
      }
      const trend = trendMap.get(period)!;
      trend.cases++;
      if (item.status === 'approved' || item.status === 'active_auction' || item.status === 'sold') {
        trend.approved++;
      }
    }

    const trends = trendMap.size === 0 ? [] : Array.from(trendMap.entries())
      .map(([period, data]) => ({
        period,
        cases: data.cases,
        quality: data.cases > 0 ? (data.approved / data.cases) * 100 : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-8);

    return {
      casesProcessed: data.length,
      avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      approvalRate: Math.round(approvalRate * 100) / 100,
      qualityScore: Math.round(qualityScore * 100) / 100,
      trends,
      revenueContribution: Math.round(revenue * 100) / 100,
    };
  }

  /**
   * Salvage Manager Team Report
   * Shows ALL adjusters' performance and cases pending approval
   */
  private static async generateManagerTeamReport(filters: ReportFilters, managerId: string): Promise<MyPerformanceReport> {
    const startDate = filters.startDate ? new Date(filters.startDate) : new Date('2000-01-01');
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date('2099-12-31');

    // Get all cases in date range with adjuster info
    const allCases = await db
      .select({
        id: salvageCases.id,
        status: salvageCases.status,
        createdBy: salvageCases.createdBy,
        createdAt: salvageCases.createdAt,
        approvedBy: salvageCases.approvedBy,
        approvedAt: salvageCases.approvedAt,
        adjusterName: users.fullName,
        currentBid: auctions.currentBid,
        paymentAmount: payments.amount,
      })
      .from(salvageCases)
      .leftJoin(users, eq(salvageCases.createdBy, users.id))
      .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
      .leftJoin(
        payments,
        and(
          eq(auctions.id, payments.auctionId),
          eq(payments.status, 'verified')
        )
      )
      .where(
        and(
          gte(salvageCases.createdAt, startDate),
          lte(salvageCases.createdAt, endDate)
        )
      );

    // Count pending approvals
    const pendingApproval = allCases.filter(c => c.status === 'pending_approval').length;

    // Group by adjuster
    const adjusterMap = new Map<string, typeof allCases>();
    for (const caseItem of allCases) {
      if (!adjusterMap.has(caseItem.createdBy)) {
        adjusterMap.set(caseItem.createdBy, []);
      }
      adjusterMap.get(caseItem.createdBy)!.push(caseItem);
    }

    // Calculate per-adjuster metrics
    const teamBreakdown = Array.from(adjusterMap.entries()).map(([adjusterId, cases]) => {
      const approved = cases.filter(c => 
        c.status === 'approved' || c.status === 'active_auction' || c.status === 'sold'
      ).length;
      const rejected = cases.filter(c => c.status === 'draft' && c.approvedAt).length;
      const total = approved + rejected;

      const withDecision = cases.filter(c => c.approvedAt);
      const avgTime = withDecision.length > 0
        ? withDecision.reduce((sum, c) => {
            const diff = c.approvedAt!.getTime() - c.createdAt.getTime();
            return sum + (diff / (1000 * 60 * 60 * 24));
          }, 0) / withDecision.length
        : 0;

      const revenue = cases
        .filter(c => c.paymentAmount)
        .reduce((sum, c) => sum + parseFloat(c.paymentAmount || '0'), 0);

      return {
        adjusterId,
        adjusterName: cases[0]?.adjusterName || 'Unknown',
        casesSubmitted: cases.length,
        casesApproved: approved,
        casesRejected: rejected,
        approvalRate: total > 0 ? Math.round((approved / total) * 100 * 100) / 100 : 0,
        avgProcessingTime: Math.round(avgTime * 100) / 100,
        revenue: Math.round(revenue * 100) / 100,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Overall team metrics
    const totalCases = allCases.length;
    const totalApproved = allCases.filter(c => 
      c.status === 'approved' || c.status === 'active_auction' || c.status === 'sold'
    ).length;
    const totalRejected = allCases.filter(c => 
      c.status === 'draft' && c.approvedAt !== null
    ).length;
    const totalDecided = totalApproved + totalRejected;
    const teamApprovalRate = totalDecided > 0 ? (totalApproved / totalDecided) * 100 : 0;

    const allWithDecision = allCases.filter(c => c.approvedAt);
    const teamAvgTime = allWithDecision.length > 0
      ? allWithDecision.reduce((sum, c) => {
          const diff = c.approvedAt!.getTime() - c.createdAt.getTime();
          return sum + (diff / (1000 * 60 * 60 * 24));
        }, 0) / allWithDecision.length
      : 0;

    const totalRevenue = allCases
      .filter(c => c.paymentAmount)
      .reduce((sum, c) => sum + parseFloat(c.paymentAmount || '0'), 0);

    // Team quality score: Composite metric matching adjuster calculation
    const teamRejectionRate = totalDecided > 0 ? (totalRejected / totalDecided) * 100 : 0;
    const teamLowRejectionScore = 100 - teamRejectionRate;
    
    const targetProcessingDays = 2;
    const teamProcessingEfficiency = teamAvgTime > 0
      ? Math.max(0, 100 - ((teamAvgTime / targetProcessingDays) * 100))
      : 0;
    
    const teamQualityScore = (
      (teamApprovalRate * 0.4) +
      (teamLowRejectionScore * 0.3) +
      (teamProcessingEfficiency * 0.3)
    );

    // Trends by week
    const trendMap = new Map<string, { cases: number; approved: number }>();
    for (const item of allCases) {
      const date = new Date(item.createdAt);
      const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
      const period = weekStart.toISOString().split('T')[0];
      
      if (!trendMap.has(period)) {
        trendMap.set(period, { cases: 0, approved: 0 });
      }
      const trend = trendMap.get(period)!;
      trend.cases++;
      if (item.status === 'approved' || item.status === 'active_auction' || item.status === 'sold') {
        trend.approved++;
      }
    }

    const trends = trendMap.size === 0 ? [] : Array.from(trendMap.entries())
      .map(([period, data]) => ({
        period,
        cases: data.cases,
        quality: data.cases > 0 ? (data.approved / data.cases) * 100 : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-8);

    return {
      casesProcessed: totalCases,
      avgProcessingTime: Math.round(teamAvgTime * 100) / 100,
      approvalRate: Math.round(teamApprovalRate * 100) / 100,
      qualityScore: Math.round(teamQualityScore * 100) / 100,
      trends,
      revenueContribution: Math.round(totalRevenue * 100) / 100,
      teamBreakdown,
      pendingApproval,
    };
  }
}
