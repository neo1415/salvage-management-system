/**
 * Operational Report Services
 * 
 * All operational reporting services in one file for efficiency
 * Tasks 12-15: Case Processing, Auction Performance, Document Management, Vendor Performance
 */

import { ReportFilters } from '../../types';
import { OperationalDataRepository } from '../repositories/operational-data.repository';
import { DataAggregationService } from '../../services/data-aggregation.service';

// ============================================================================
// TASK 12: Case Processing Metrics Service
// ============================================================================

export interface CaseProcessingReport {
  summary: {
    totalCases: number;
    averageProcessingTimeHours: number;
    approvalRate: number;
    pendingCases: number;
    approvedCases: number;
    rejectedCases: number;
  };
  byAssetType: Array<{
    assetType: string;
    count: number;
    averageProcessingTime: number;
    approvalRate: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  byAdjuster: Array<{
    adjusterId: string;
    adjusterName: string;
    casesProcessed: number;
    averageProcessingTime: number;
    approvalRate: number;
  }>;
  trend: Array<{
    date: string;
    count: number;
    approved: number;
    rejected: number;
  }>;
  bottlenecks: Array<{
    stage: string;
    averageTime: number;
    caseCount: number;
  }>;
}

export class CaseProcessingService {
  static async generateReport(filters: ReportFilters): Promise<CaseProcessingReport> {
    const data = await OperationalDataRepository.getCaseProcessingData(filters) || [];

    const summary = this.calculateSummary(data);
    const byAssetType = this.calculateByAssetType(data) || [];
    const byStatus = this.calculateByStatus(data) || [];
    const byAdjuster = this.calculateByAdjuster(data) || [];
    const trend = this.calculateTrend(data) || [];
    const bottlenecks = this.identifyBottlenecks(data) || [];

    return { summary, byAssetType, byStatus, byAdjuster, trend, bottlenecks };
  }

  private static calculateSummary(data: any[]) {
    const approved = data.filter(c => c.status === 'approved').length;
    const rejected = data.filter(c => c.status === 'rejected').length;
    const pending = data.filter(c => c.status === 'pending').length;
    
    const withProcessingTime = data.filter(c => c.processingTimeHours !== null);
    const avgProcessingTime = withProcessingTime.length > 0
      ? withProcessingTime.reduce((sum, c) => sum + (c.processingTimeHours || 0), 0) / withProcessingTime.length
      : 0;

    const approvalRate = (approved + rejected) > 0 ? (approved / (approved + rejected)) * 100 : 0;

    return {
      totalCases: data.length,
      averageProcessingTimeHours: Math.round(avgProcessingTime * 100) / 100,
      approvalRate: Math.round(approvalRate * 100) / 100,
      pendingCases: pending,
      approvedCases: approved,
      rejectedCases: rejected,
    };
  }

  private static calculateByAssetType(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped = DataAggregationService.groupBy(data, 'assetType');
    
    // Check if grouped is empty or null
    if (!grouped || Object.keys(grouped).length === 0) return [];
    
    return Object.entries(grouped).map(([assetType, items]) => {
      const approved = items.filter(c => c.status === 'approved').length;
      const rejected = items.filter(c => c.status === 'rejected').length;
      const approvalRate = (approved + rejected) > 0 ? (approved / (approved + rejected)) * 100 : 0;
      
      const withTime = items.filter(c => c.processingTimeHours !== null);
      const avgTime = withTime.length > 0
        ? withTime.reduce((sum, c) => sum + (c.processingTimeHours || 0), 0) / withTime.length
        : 0;

      return {
        assetType,
        count: items.length,
        averageProcessingTime: Math.round(avgTime * 100) / 100,
        approvalRate: Math.round(approvalRate * 100) / 100,
      };
    });
  }

  private static calculateByStatus(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped = DataAggregationService.groupBy(data, 'status');
    
    // Check if grouped is empty or null
    if (!grouped || Object.keys(grouped).length === 0) return [];
    
    return Object.entries(grouped).map(([status, items]) => ({
      status,
      count: items.length,
      percentage: Math.round((items.length / data.length) * 10000) / 100,
    }));
  }

  private static calculateByAdjuster(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped = DataAggregationService.groupBy(data, 'adjusterId');
    
    // Check if grouped is empty or null
    if (!grouped || Object.keys(grouped).length === 0) return [];
    
    return Object.entries(grouped).map(([adjusterId, items]) => {
      const approved = items.filter(c => c.status === 'approved').length;
      const rejected = items.filter(c => c.status === 'rejected').length;
      const approvalRate = (approved + rejected) > 0 ? (approved / (approved + rejected)) * 100 : 0;
      
      const withTime = items.filter(c => c.processingTimeHours !== null);
      const avgTime = withTime.length > 0
        ? withTime.reduce((sum, c) => sum + (c.processingTimeHours || 0), 0) / withTime.length
        : 0;

      return {
        adjusterId,
        adjusterName: items[0].adjusterName,
        casesProcessed: items.length,
        averageProcessingTime: Math.round(avgTime * 100) / 100,
        approvalRate: Math.round(approvalRate * 100) / 100,
      };
    }).sort((a, b) => b.casesProcessed - a.casesProcessed);
  }

  private static calculateTrend(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped: Record<string, { count: number; approved: number; rejected: number }> = {};

    for (const item of data) {
      const date = new Date(item.createdAt).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { count: 0, approved: 0, rejected: 0 };
      }
      grouped[date].count++;
      if (item.status === 'approved') grouped[date].approved++;
      if (item.status === 'rejected') grouped[date].rejected++;
    }

    // Check if grouped is empty
    if (Object.keys(grouped).length === 0) return [];

    return Object.entries(grouped)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private static identifyBottlenecks(data: any[]) {
    if (data.length === 0) return [];
    
    // Identify stages with longest processing times
    const stages = [
      { stage: 'Submission to Approval', data: data.filter(c => c.processingTimeHours !== null) },
    ];

    return stages.map(({ stage, data: stageData }) => {
      const avgTime = stageData.length > 0
        ? stageData.reduce((sum, c) => sum + (c.processingTimeHours || 0), 0) / stageData.length
        : 0;

      return {
        stage,
        averageTime: Math.round(avgTime * 100) / 100,
        caseCount: stageData.length,
      };
    });
  }
}

// ============================================================================
// TASK 13: Auction Performance Service
// ============================================================================

export interface AuctionPerformanceReport {
  summary: {
    totalAuctions: number;
    successRate: number;
    averageBidsPerAuction: number;
    averageUniqueBidders: number;
    reserveMetRate: number;
    averageDurationHours: number;
  };
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  bidding: {
    totalBids: number;
    averageBidsPerAuction: number;
    competitiveAuctions: number;
    singleBidderAuctions: number;
  };
  timing: {
    averageDuration: number;
    shortestDuration: number;
    longestDuration: number;
  };
  trend: Array<{
    date: string;
    auctionCount: number;
    successRate: number;
    averageBids: number;
  }>;
}

export class AuctionPerformanceService {
  static async generateReport(filters: ReportFilters): Promise<AuctionPerformanceReport> {
    const data = await OperationalDataRepository.getAuctionPerformanceData(filters) || [];

    return {
      summary: this.calculateSummary(data),
      byStatus: this.calculateByStatus(data) || [],
      bidding: this.calculateBiddingMetrics(data),
      timing: this.calculateTimingMetrics(data),
      trend: this.calculateTrend(data) || [],
    };
  }

  private static calculateSummary(data: any[]) {
    const successful = data.filter(a => a.status === 'closed' && a.winnerId).length;
    const successRate = data.length > 0 ? (successful / data.length) * 100 : 0;
    
    const totalBids = data.reduce((sum, a) => sum + a.bidCount, 0);
    const avgBids = data.length > 0 ? totalBids / data.length : 0;
    
    const totalUniqueBidders = data.reduce((sum, a) => sum + a.uniqueBidders, 0);
    const avgUniqueBidders = data.length > 0 ? totalUniqueBidders / data.length : 0;
    
    const reserveMet = data.filter(a => a.reserveMet).length;
    const reserveMetRate = data.length > 0 ? (reserveMet / data.length) * 100 : 0;
    
    const avgDuration = data.length > 0
      ? data.reduce((sum, a) => sum + a.durationHours, 0) / data.length
      : 0;

    return {
      totalAuctions: data.length,
      successRate: Math.round(successRate * 100) / 100,
      averageBidsPerAuction: Math.round(avgBids * 100) / 100,
      averageUniqueBidders: Math.round(avgUniqueBidders * 100) / 100,
      reserveMetRate: Math.round(reserveMetRate * 100) / 100,
      averageDurationHours: Math.round(avgDuration * 100) / 100,
    };
  }

  private static calculateByStatus(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped = DataAggregationService.groupBy(data, 'status');
    if (!grouped || Object.keys(grouped).length === 0) return [];
    
    return Object.entries(grouped).map(([status, items]) => ({
      status,
      count: items.length,
      percentage: Math.round((items.length / data.length) * 10000) / 100,
    }));
  }

  private static calculateBiddingMetrics(data: any[]) {
    const totalBids = data.reduce((sum, a) => sum + a.bidCount, 0);
    const avgBids = data.length > 0 ? totalBids / data.length : 0;
    // Competitive = 2+ unique bidders (actual competition between vendors)
    const competitive = data.filter(a => a.uniqueBidders >= 2).length;
    const singleBidder = data.filter(a => a.uniqueBidders === 1).length;

    return {
      totalBids,
      averageBidsPerAuction: Math.round(avgBids * 100) / 100,
      competitiveAuctions: competitive,
      singleBidderAuctions: singleBidder,
    };
  }

  private static calculateTimingMetrics(data: any[]) {
    if (data.length === 0) {
      return { averageDuration: 0, shortestDuration: 0, longestDuration: 0 };
    }

    const durations = data.map(a => a.durationHours).sort((a, b) => a - b);
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    return {
      averageDuration: Math.round(avg * 100) / 100,
      shortestDuration: Math.round(durations[0] * 100) / 100,
      longestDuration: Math.round(durations[durations.length - 1] * 100) / 100,
    };
  }

  private static calculateTrend(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped: Record<string, { count: number; successful: number; totalBids: number }> = {};

    for (const item of data) {
      const date = new Date(item.startTime).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { count: 0, successful: 0, totalBids: 0 };
      }
      grouped[date].count++;
      if (item.status === 'closed' && item.winnerId) grouped[date].successful++;
      grouped[date].totalBids += item.bidCount;
    }

    // Check if grouped is empty
    if (Object.keys(grouped).length === 0) return [];

    return Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        auctionCount: data.count,
        successRate: data.count > 0 ? Math.round((data.successful / data.count) * 10000) / 100 : 0,
        averageBids: data.count > 0 ? Math.round((data.totalBids / data.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

// ============================================================================
// TASK 14: Document Management Metrics Service (Simplified)
// ============================================================================

export interface DocumentManagementReport {
  summary: {
    note: string;
  };
}

export class DocumentManagementService {
  static async generateReport(filters: ReportFilters): Promise<DocumentManagementReport> {
    // Document management metrics would require document table queries
    // Simplified for now - can be expanded when document schema is available
    return {
      summary: {
        note: 'Document management metrics available when document tracking is implemented',
      },
    };
  }
}

// ============================================================================
// TASK 15: Vendor Performance Service
// ============================================================================

export interface VendorPerformanceReport {
  summary: {
    totalVendors: number;
    averageWinRate: number;
    averageParticipationRate: number;
    topPerformerWinRate: number;
  };
  rankings: Array<{
    rank: number;
    vendorId: string;
    vendorName: string;
    tier: string;
    totalBids: number;
    totalWins: number;
    winRate: number;
    participationRate: number;
  }>;
  byTier: Array<{
    tier: string;
    vendorCount: number;
    averageWinRate: number;
    averageParticipationRate: number;
  }>;
  engagement: {
    highlyActive: number;
    moderatelyActive: number;
    lowActivity: number;
  };
}

export class VendorPerformanceService {
  static async generateReport(filters: ReportFilters): Promise<VendorPerformanceReport> {
    const data = await OperationalDataRepository.getVendorPerformanceData(filters) || [];

    return {
      summary: this.calculateSummary(data),
      rankings: this.calculateRankings(data) || [],
      byTier: this.calculateByTier(data) || [],
      engagement: this.calculateEngagement(data),
    };
  }

  private static calculateSummary(data: any[]) {
    const avgWinRate = data.length > 0
      ? data.reduce((sum, v) => sum + v.winRate, 0) / data.length
      : 0;
    
    const avgParticipation = data.length > 0
      ? data.reduce((sum, v) => sum + v.participationRate, 0) / data.length
      : 0;
    
    const topPerformer = data.length > 0 ? data[0].winRate : 0;

    return {
      totalVendors: data.length,
      averageWinRate: Math.round(avgWinRate * 100) / 100,
      averageParticipationRate: Math.round(avgParticipation * 100) / 100,
      topPerformerWinRate: Math.round(topPerformer * 100) / 100,
    };
  }

  private static calculateRankings(data: any[]) {
    if (data.length === 0) return [];
    
    return data.map((vendor, index) => ({
      rank: index + 1,
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      tier: vendor.tier,
      totalBids: vendor.totalBids,
      totalWins: vendor.totalWins,
      winRate: vendor.winRate,
      participationRate: vendor.participationRate,
    })).slice(0, 20); // Top 20
  }

  private static calculateByTier(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped: Record<string, any[]> = {};
    
    for (const vendor of data) {
      if (!grouped[vendor.tier]) grouped[vendor.tier] = [];
      grouped[vendor.tier].push(vendor);
    }

    // Check if grouped is empty
    if (Object.keys(grouped).length === 0) return [];

    return Object.entries(grouped).map(([tier, vendors]) => {
      const avgWinRate = vendors.reduce((sum, v) => sum + v.winRate, 0) / vendors.length;
      const avgParticipation = vendors.reduce((sum, v) => sum + v.participationRate, 0) / vendors.length;

      return {
        tier,
        vendorCount: vendors.length,
        averageWinRate: Math.round(avgWinRate * 100) / 100,
        averageParticipationRate: Math.round(avgParticipation * 100) / 100,
      };
    });
  }

  private static calculateEngagement(data: any[]) {
    const highlyActive = data.filter(v => v.participationRate >= 50).length;
    const moderatelyActive = data.filter(v => v.participationRate >= 20 && v.participationRate < 50).length;
    const lowActivity = data.filter(v => v.participationRate < 20).length;

    return { highlyActive, moderatelyActive, lowActivity };
  }
}
