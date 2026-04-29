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
// FIX: Make consistent with Master Report + add comprehensive metrics
// ============================================================================

export interface CaseProcessingReport {
  summary: {
    totalCases: number;
    averageProcessingTimeDays: number;
    approvalRate: number;
    pendingCases: number;
    approvedCases: number;
    soldCases: number;
    activeAuctionCases: number;
    cancelledCases: number;
    totalMarketValue: number;
    totalSalvageValue: number;
    averageMarketValue: number;
    averageSalvageValue: number;
  };
  byAssetType: Array<{
    assetType: string;
    count: number;
    averageProcessingTime: number;
    approvalRate: number;
    totalMarketValue: number;
    totalSalvageValue: number;
    averageMarketValue: number;
    cases: Array<{
      claimReference: string;
      status: string;
      marketValue: number;
      salvageValue: number;
      processingDays: number;
      createdAt: string;
    }>;
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
    sold: number;
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
    // FIX: Match Master Report status categories
    const approved = data.filter(c => c.status === 'approved').length;
    const sold = data.filter(c => c.status === 'sold').length;
    const activeAuction = data.filter(c => c.status === 'active_auction').length;
    const pending = data.filter(c => c.status === 'pending_approval').length;
    const cancelled = data.filter(c => c.status === 'cancelled').length;
    
    // FIX: Convert hours to days (Master Report uses days)
    const withProcessingTime = data.filter(c => c.processingTimeHours !== null && c.processingTimeHours !== undefined);
    const avgProcessingHours = withProcessingTime.length > 0
      ? withProcessingTime.reduce((sum, c) => sum + (c.processingTimeHours || 0), 0) / withProcessingTime.length
      : 0;
    const avgProcessingDays = avgProcessingHours / 24;

    // FIX: Approval rate = (approved + sold + active_auction) / total (Master Report logic)
    const approvedTotal = approved + sold + activeAuction;
    const approvalRate = data.length > 0 ? (approvedTotal / data.length) * 100 : 0;

    // Calculate value metrics
    const totalMarketValue = data.reduce((sum, c) => sum + parseFloat(c.marketValue || '0'), 0);
    const totalSalvageValue = data.reduce((sum, c) => sum + parseFloat(c.estimatedSalvageValue || '0'), 0);
    const averageMarketValue = data.length > 0 ? totalMarketValue / data.length : 0;
    const averageSalvageValue = data.length > 0 ? totalSalvageValue / data.length : 0;

    return {
      totalCases: data.length,
      averageProcessingTimeDays: isNaN(avgProcessingDays) ? 0 : Math.round(avgProcessingDays * 100) / 100,
      approvalRate: isNaN(approvalRate) ? 0 : Math.round(approvalRate * 100) / 100,
      pendingCases: pending,
      approvedCases: approved,
      soldCases: sold,
      activeAuctionCases: activeAuction,
      cancelledCases: cancelled,
      totalMarketValue: Math.round(totalMarketValue),
      totalSalvageValue: Math.round(totalSalvageValue),
      averageMarketValue: Math.round(averageMarketValue),
      averageSalvageValue: Math.round(averageSalvageValue),
    };
  }

  private static calculateByAssetType(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped = DataAggregationService.groupBy(data, 'assetType');
    
    // Check if grouped is empty or null
    if (!grouped || Object.keys(grouped).length === 0) return [];
    
    return Object.entries(grouped).map(([assetType, items]) => {
      // FIX: Match Master Report approval logic
      const approved = items.filter(c => ['approved', 'active_auction', 'sold'].includes(c.status)).length;
      const approvalRate = items.length > 0 ? (approved / items.length) * 100 : 0;
      
      // FIX: Convert hours to days
      const withTime = items.filter(c => c.processingTimeHours !== null && c.processingTimeHours !== undefined);
      const avgHours = withTime.length > 0
        ? withTime.reduce((sum, c) => sum + (c.processingTimeHours || 0), 0) / withTime.length
        : 0;
      const avgDays = avgHours / 24;

      // Calculate value metrics
      const totalMarketValue = items.reduce((sum, c) => sum + parseFloat(c.marketValue || '0'), 0);
      const totalSalvageValue = items.reduce((sum, c) => sum + parseFloat(c.estimatedSalvageValue || '0'), 0);
      const averageMarketValue = items.length > 0 ? totalMarketValue / items.length : 0;

      // Build case list with details
      const cases = items.map(c => ({
        claimReference: c.claimReference,
        status: c.status,
        marketValue: Math.round(parseFloat(c.marketValue || '0')),
        salvageValue: Math.round(parseFloat(c.estimatedSalvageValue || '0')),
        processingDays: c.processingTimeHours ? Math.round((c.processingTimeHours / 24) * 10) / 10 : 0,
        createdAt: new Date(c.createdAt).toISOString().split('T')[0],
      })).sort((a, b) => b.marketValue - a.marketValue); // Sort by market value descending

      return {
        assetType,
        count: items.length,
        averageProcessingTime: isNaN(avgDays) ? 0 : Math.round(avgDays * 100) / 100,
        approvalRate: isNaN(approvalRate) ? 0 : Math.round(approvalRate * 100) / 100,
        totalMarketValue: Math.round(totalMarketValue),
        totalSalvageValue: Math.round(totalSalvageValue),
        averageMarketValue: Math.round(averageMarketValue),
        cases,
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
      // FIX: Match Master Report approval logic
      const approved = items.filter(c => ['approved', 'active_auction', 'sold'].includes(c.status)).length;
      const approvalRate = items.length > 0 ? (approved / items.length) * 100 : 0;
      
      // FIX: Convert hours to days
      const withTime = items.filter(c => c.processingTimeHours !== null && c.processingTimeHours !== undefined);
      const avgHours = withTime.length > 0
        ? withTime.reduce((sum, c) => sum + (c.processingTimeHours || 0), 0) / withTime.length
        : 0;
      const avgDays = avgHours / 24;

      return {
        adjusterId,
        adjusterName: items[0].adjusterName,
        casesProcessed: items.length,
        averageProcessingTime: isNaN(avgDays) ? 0 : Math.round(avgDays * 100) / 100,
        approvalRate: isNaN(approvalRate) ? 0 : Math.round(approvalRate * 100) / 100,
      };
    }).sort((a, b) => b.casesProcessed - a.casesProcessed);
  }

  private static calculateTrend(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped: Record<string, { count: number; approved: number; sold: number }> = {};

    for (const item of data) {
      const date = new Date(item.createdAt).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { count: 0, approved: 0, sold: 0 };
      }
      grouped[date].count++;
      if (item.status === 'approved') grouped[date].approved++;
      if (item.status === 'sold') grouped[date].sold++;
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
      { stage: 'Submission to Approval', data: data.filter(c => c.processingTimeHours !== null && c.processingTimeHours !== undefined) },
    ];

    return stages.map(({ stage, data: stageData }) => {
      // FIX: Convert hours to days
      const avgHours = stageData.length > 0
        ? stageData.reduce((sum, c) => sum + (c.processingTimeHours || 0), 0) / stageData.length
        : 0;
      const avgDays = avgHours / 24;

      return {
        stage,
        averageTime: isNaN(avgDays) ? 0 : Math.round(avgDays * 100) / 100,
        caseCount: stageData.length,
      };
    });
  }
}

// ============================================================================
// TASK 13: Auction Performance Service - ENHANCED
// ============================================================================

export interface AuctionPerformanceReport {
  summary: {
    totalAuctions: number;
    successRate: number;
    averageBidsPerAuction: number;
    averageUniqueBidders: number;
    reserveMetRate: number;
    averageDurationHours: number;
    totalRevenue: number;
    averageWinningBid: number;
    priceRealizationRate: number;
    uniqueVendorsParticipating: number;
    vendorEngagementRate: number;
  };
  byAssetType: Array<{
    assetType: string;
    count: number;
    successRate: number;
    averageBids: number;
    reserveMetRate: number;
    totalRevenue: number;
    averageWinningBid: number;
    competitiveAuctions: number;
  }>;
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
    noBidAuctions: number;
    biddingWarFrequency: number;
    averageBidIncrement: number;
    bidDensity: number;
  };
  timing: {
    averageDuration: number;
    shortestDuration: number;
    longestDuration: number;
    averageTimeToFirstBid: number;
    lastMinuteBiddingRate: number;
  };
  vendorParticipation: {
    uniqueVendors: number;
    averageVendorsPerAuction: number;
    repeatBidderRate: number;
    newVsReturningRatio: number;
  };
  competitionLevels: {
    noBids: number;
    oneBidder: number;
    twoToThreeBidders: number;
    fourPlusBidders: number;
  };
  financialMetrics: {
    totalRevenue: number;
    averageWinningBid: number;
    averageReservePrice: number;
    priceRealizationRate: number;
    revenueByAssetType: Array<{
      assetType: string;
      revenue: number;
      percentage: number;
    }>;
  };
  trend: Array<{
    date: string;
    auctionCount: number;
    successRate: number;
    averageBids: number;
    uniqueBidders: number;
    revenue: number;
  }>;
  auctionList: Array<{
    auctionId: string;
    claimReference: string;
    assetType: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    bidCount: number;
    uniqueBidders: number;
    winningBid: number | null;
    reservePrice: number;
    status: string;
    isSuccessful: boolean;
  }>;
  insights: {
    bestPerforming: Array<{
      metric: string;
      value: string;
      description: string;
    }>;
    underperforming: Array<{
      metric: string;
      value: string;
      description: string;
    }>;
    recommendations: string[];
  };
}

export class AuctionPerformanceService {
  static async generateReport(filters: ReportFilters): Promise<AuctionPerformanceReport> {
    const data = await OperationalDataRepository.getAuctionPerformanceData(filters) || [];

    return {
      summary: this.calculateSummary(data),
      byAssetType: this.calculateByAssetType(data) || [],
      byStatus: this.calculateByStatus(data) || [],
      bidding: this.calculateBiddingMetrics(data),
      timing: this.calculateTimingMetrics(data),
      vendorParticipation: this.calculateVendorParticipation(data),
      competitionLevels: this.calculateCompetitionLevels(data),
      financialMetrics: this.calculateFinancialMetrics(data),
      trend: this.calculateTrend(data) || [],
      auctionList: this.buildAuctionList(data),
      insights: this.generateInsights(data),
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

    // Financial metrics
    const successfulAuctions = data.filter(a => a.status === 'closed' && a.winnerId && a.winningBid);
    const totalRevenue = successfulAuctions.reduce((sum, a) => sum + parseFloat(a.winningBid || '0'), 0);
    const avgWinningBid = successfulAuctions.length > 0 ? totalRevenue / successfulAuctions.length : 0;
    
    const auctionsWithReserve = data.filter(a => a.reservePrice && a.winningBid);
    const priceRealization = auctionsWithReserve.length > 0
      ? auctionsWithReserve.reduce((sum, a) => sum + (parseFloat(a.winningBid) / parseFloat(a.reservePrice) * 100), 0) / auctionsWithReserve.length
      : 0;

    // Vendor metrics
    const uniqueVendors = new Set(data.flatMap(a => a.bidderIds || [])).size;
    const vendorEngagement = data.length > 0 ? (uniqueVendors / data.length) * 100 : 0;

    return {
      totalAuctions: data.length,
      successRate: Math.round(successRate * 100) / 100,
      averageBidsPerAuction: Math.round(avgBids * 100) / 100,
      averageUniqueBidders: Math.round(avgUniqueBidders * 100) / 100,
      reserveMetRate: Math.round(reserveMetRate * 100) / 100,
      averageDurationHours: Math.round(avgDuration * 100) / 100,
      totalRevenue: Math.round(totalRevenue),
      averageWinningBid: Math.round(avgWinningBid),
      priceRealizationRate: Math.round(priceRealization * 100) / 100,
      uniqueVendorsParticipating: uniqueVendors,
      vendorEngagementRate: Math.round(vendorEngagement * 100) / 100,
    };
  }

  private static calculateByAssetType(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped = DataAggregationService.groupBy(data, 'assetType');
    if (!grouped || Object.keys(grouped).length === 0) return [];
    
    return Object.entries(grouped).map(([assetType, items]) => {
      const successful = items.filter(a => a.status === 'closed' && a.winnerId).length;
      const successRate = items.length > 0 ? (successful / items.length) * 100 : 0;
      
      const totalBids = items.reduce((sum, a) => sum + a.bidCount, 0);
      const avgBids = items.length > 0 ? totalBids / items.length : 0;
      
      const reserveMet = items.filter(a => a.reserveMet).length;
      const reserveMetRate = items.length > 0 ? (reserveMet / items.length) * 100 : 0;
      
      const successfulItems = items.filter(a => a.status === 'closed' && a.winnerId && a.winningBid);
      const totalRevenue = successfulItems.reduce((sum, a) => sum + parseFloat(a.winningBid || '0'), 0);
      const avgWinningBid = successfulItems.length > 0 ? totalRevenue / successfulItems.length : 0;
      
      const competitive = items.filter(a => a.uniqueBidders >= 2).length;

      return {
        assetType,
        count: items.length,
        successRate: Math.round(successRate * 100) / 100,
        averageBids: Math.round(avgBids * 100) / 100,
        reserveMetRate: Math.round(reserveMetRate * 100) / 100,
        totalRevenue: Math.round(totalRevenue),
        averageWinningBid: Math.round(avgWinningBid),
        competitiveAuctions: competitive,
      };
    });
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
    const competitive = data.filter(a => a.uniqueBidders >= 2).length;
    const singleBidder = data.filter(a => a.uniqueBidders === 1).length;
    const noBids = data.filter(a => a.bidCount === 0).length;
    const biddingWars = data.filter(a => a.bidCount >= 5).length;
    
    // Calculate average bid increment (if available)
    const auctionsWithIncrements = data.filter(a => a.averageBidIncrement);
    const avgIncrement = auctionsWithIncrements.length > 0
      ? auctionsWithIncrements.reduce((sum, a) => sum + a.averageBidIncrement, 0) / auctionsWithIncrements.length
      : 0;
    
    // Bid density (bids per hour)
    const totalDuration = data.reduce((sum, a) => sum + a.durationHours, 0);
    const bidDensity = totalDuration > 0 ? totalBids / totalDuration : 0;

    return {
      totalBids,
      averageBidsPerAuction: Math.round(avgBids * 100) / 100,
      competitiveAuctions: competitive,
      singleBidderAuctions: singleBidder,
      noBidAuctions: noBids,
      biddingWarFrequency: biddingWars,
      averageBidIncrement: Math.round(avgIncrement),
      bidDensity: Math.round(bidDensity * 100) / 100,
    };
  }

  private static calculateTimingMetrics(data: any[]) {
    if (data.length === 0) {
      return { 
        averageDuration: 0, 
        shortestDuration: 0, 
        longestDuration: 0,
        averageTimeToFirstBid: 0,
        lastMinuteBiddingRate: 0,
      };
    }

    const durations = data.map(a => a.durationHours).sort((a, b) => a - b);
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    
    // Time to first bid
    const auctionsWithFirstBid = data.filter(a => a.timeToFirstBidMinutes !== null);
    const avgTimeToFirstBid = auctionsWithFirstBid.length > 0
      ? auctionsWithFirstBid.reduce((sum, a) => sum + a.timeToFirstBidMinutes, 0) / auctionsWithFirstBid.length
      : 0;
    
    // Last minute bidding
    const auctionsWithLastMinuteBids = data.filter(a => a.lastMinuteBids > 0).length;
    const lastMinuteRate = data.length > 0 ? (auctionsWithLastMinuteBids / data.length) * 100 : 0;

    return {
      averageDuration: Math.round(avg * 100) / 100,
      shortestDuration: Math.round(durations[0] * 100) / 100,
      longestDuration: Math.round(durations[durations.length - 1] * 100) / 100,
      averageTimeToFirstBid: Math.round(avgTimeToFirstBid),
      lastMinuteBiddingRate: Math.round(lastMinuteRate * 100) / 100,
    };
  }

  private static calculateVendorParticipation(data: any[]) {
    const allBidders = data.flatMap(a => a.bidderIds || []);
    const uniqueVendors = new Set(allBidders).size;
    const avgVendorsPerAuction = data.length > 0 ? allBidders.length / data.length : 0;
    
    // Repeat bidders (vendors who bid on multiple auctions)
    const bidderCounts = new Map<string, number>();
    allBidders.forEach(bidderId => {
      bidderCounts.set(bidderId, (bidderCounts.get(bidderId) || 0) + 1);
    });
    const repeatBidders = Array.from(bidderCounts.values()).filter(count => count > 1).length;
    const repeatRate = uniqueVendors > 0 ? (repeatBidders / uniqueVendors) * 100 : 0;
    
    // New vs returning (simplified - would need historical data for accurate calculation)
    const newVsReturning = 1.0; // Placeholder

    return {
      uniqueVendors,
      averageVendorsPerAuction: Math.round(avgVendorsPerAuction * 100) / 100,
      repeatBidderRate: Math.round(repeatRate * 100) / 100,
      newVsReturningRatio: newVsReturning,
    };
  }

  private static calculateCompetitionLevels(data: any[]) {
    return {
      noBids: data.filter(a => a.bidCount === 0).length,
      oneBidder: data.filter(a => a.uniqueBidders === 1).length,
      twoToThreeBidders: data.filter(a => a.uniqueBidders >= 2 && a.uniqueBidders <= 3).length,
      fourPlusBidders: data.filter(a => a.uniqueBidders >= 4).length,
    };
  }

  private static calculateFinancialMetrics(data: any[]) {
    const successfulAuctions = data.filter(a => a.status === 'closed' && a.winnerId && a.winningBid);
    const totalRevenue = successfulAuctions.reduce((sum, a) => sum + parseFloat(a.winningBid || '0'), 0);
    const avgWinningBid = successfulAuctions.length > 0 ? totalRevenue / successfulAuctions.length : 0;
    
    const auctionsWithReserve = data.filter(a => a.reservePrice);
    const avgReservePrice = auctionsWithReserve.length > 0
      ? auctionsWithReserve.reduce((sum, a) => sum + parseFloat(a.reservePrice), 0) / auctionsWithReserve.length
      : 0;
    
    const priceRealizationAuctions = data.filter(a => a.reservePrice && a.winningBid);
    const priceRealization = priceRealizationAuctions.length > 0
      ? priceRealizationAuctions.reduce((sum, a) => sum + (parseFloat(a.winningBid) / parseFloat(a.reservePrice) * 100), 0) / priceRealizationAuctions.length
      : 0;
    
    // Revenue by asset type
    const grouped = DataAggregationService.groupBy(successfulAuctions, 'assetType');
    const revenueByAssetType = grouped && Object.keys(grouped).length > 0
      ? Object.entries(grouped).map(([assetType, items]) => {
          const revenue = items.reduce((sum, a) => sum + parseFloat(a.winningBid || '0'), 0);
          return {
            assetType,
            revenue: Math.round(revenue),
            percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 10000) / 100 : 0,
          };
        })
      : [];

    return {
      totalRevenue: Math.round(totalRevenue),
      averageWinningBid: Math.round(avgWinningBid),
      averageReservePrice: Math.round(avgReservePrice),
      priceRealizationRate: Math.round(priceRealization * 100) / 100,
      revenueByAssetType,
    };
  }

  private static calculateTrend(data: any[]) {
    if (data.length === 0) return [];
    
    const grouped: Record<string, { 
      count: number; 
      successful: number; 
      totalBids: number;
      uniqueBidders: Set<string>;
      revenue: number;
    }> = {};

    for (const item of data) {
      const date = new Date(item.startTime).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = { count: 0, successful: 0, totalBids: 0, uniqueBidders: new Set(), revenue: 0 };
      }
      grouped[date].count++;
      if (item.status === 'closed' && item.winnerId) {
        grouped[date].successful++;
        grouped[date].revenue += parseFloat(item.winningBid || '0');
      }
      grouped[date].totalBids += item.bidCount;
      (item.bidderIds || []).forEach((id: string) => grouped[date].uniqueBidders.add(id));
    }

    if (Object.keys(grouped).length === 0) return [];

    return Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        auctionCount: data.count,
        successRate: data.count > 0 ? Math.round((data.successful / data.count) * 10000) / 100 : 0,
        averageBids: data.count > 0 ? Math.round((data.totalBids / data.count) * 100) / 100 : 0,
        uniqueBidders: data.uniqueBidders.size,
        revenue: Math.round(data.revenue),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private static buildAuctionList(data: any[]) {
    return data.map(a => ({
      auctionId: a.auctionId,
      claimReference: a.claimReference,
      assetType: a.assetType,
      startTime: new Date(a.startTime).toISOString(),
      endTime: new Date(a.endTime).toISOString(),
      durationHours: Math.round(a.durationHours * 100) / 100,
      bidCount: a.bidCount,
      uniqueBidders: a.uniqueBidders,
      winningBid: a.winningBid ? Math.round(parseFloat(a.winningBid)) : null,
      reservePrice: Math.round(parseFloat(a.reservePrice || '0')),
      status: a.status,
      isSuccessful: a.status === 'closed' && !!a.winnerId,
    })).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  private static generateInsights(data: any[]) {
    const bestPerforming: Array<{ metric: string; value: string; description: string }> = [];
    const underperforming: Array<{ metric: string; value: string; description: string }> = [];
    const recommendations: string[] = [];

    if (data.length === 0) {
      return { bestPerforming, underperforming, recommendations };
    }

    // Analyze by asset type
    const grouped = DataAggregationService.groupBy(data, 'assetType');
    if (grouped && Object.keys(grouped).length > 0) {
      const assetTypeStats = Object.entries(grouped).map(([assetType, items]) => ({
        assetType,
        successRate: items.filter(a => a.status === 'closed' && a.winnerId).length / items.length * 100,
        avgBids: items.reduce((sum, a) => sum + a.bidCount, 0) / items.length,
      }));

      const bestAsset = assetTypeStats.reduce((max, curr) => curr.successRate > max.successRate ? curr : max);
      const worstAsset = assetTypeStats.reduce((min, curr) => curr.successRate < min.successRate ? curr : min);

      if (bestAsset.successRate > 50) {
        bestPerforming.push({
          metric: 'Best Asset Type',
          value: `${bestAsset.assetType} (${Math.round(bestAsset.successRate)}% success)`,
          description: `${bestAsset.assetType} auctions have the highest success rate`,
        });
      }

      if (worstAsset.successRate < 30) {
        underperforming.push({
          metric: 'Underperforming Asset Type',
          value: `${worstAsset.assetType} (${Math.round(worstAsset.successRate)}% success)`,
          description: `${worstAsset.assetType} auctions need attention`,
        });
        recommendations.push(`Consider reviewing reserve prices or marketing strategy for ${worstAsset.assetType} auctions`);
      }
    }

    // No-bid auctions
    const noBidCount = data.filter(a => a.bidCount === 0).length;
    if (noBidCount > 0) {
      const noBidRate = (noBidCount / data.length) * 100;
      underperforming.push({
        metric: 'No-Bid Auctions',
        value: `${noBidCount} auctions (${Math.round(noBidRate)}%)`,
        description: 'Auctions that received no bids',
      });
      if (noBidRate > 20) {
        recommendations.push('High no-bid rate detected. Consider reviewing reserve prices and vendor outreach');
      }
    }

    // Competitive auctions
    const competitive = data.filter(a => a.uniqueBidders >= 3).length;
    if (competitive > 0) {
      const competitiveRate = (competitive / data.length) * 100;
      if (competitiveRate > 40) {
        bestPerforming.push({
          metric: 'High Competition',
          value: `${competitive} auctions (${Math.round(competitiveRate)}%)`,
          description: 'Auctions with 3+ bidders showing strong competition',
        });
      }
    }

    // Duration analysis
    const avgDuration = data.reduce((sum, a) => sum + a.durationHours, 0) / data.length;
    const successful = data.filter(a => a.status === 'closed' && a.winnerId);
    const avgSuccessfulDuration = successful.length > 0
      ? successful.reduce((sum, a) => sum + a.durationHours, 0) / successful.length
      : 0;

    if (avgSuccessfulDuration > avgDuration * 1.2) {
      recommendations.push('Successful auctions tend to run longer. Consider extending auction duration');
    }

    return { bestPerforming, underperforming, recommendations };
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
