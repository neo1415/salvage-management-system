/**
 * Revenue Analysis Service
 * 
 * Implements revenue and recovery analysis reporting
 * Task 5: Revenue & Recovery Analysis Service
 */

import { ReportFilters } from '../../types';
import { FinancialDataRepository } from '../repositories/financial-data.repository';
import { DataAggregationService } from '../../services/data-aggregation.service';

export interface RevenueAnalysisReport {
  summary: {
    totalCases: number;
    totalClaimsPaid: number; // Market value = ACV paid out
    totalSalvageRecovered: number; // What we got from auctions
    totalRegistrationFees: number; // Registration fees collected
    totalRevenue: number; // Salvage + Registration fees
    totalNetLoss: number; // Claims paid - Total revenue
    averageRecoveryRate: number; // % of claims recovered through salvage
  };
  byAssetType: Array<{
    assetType: string;
    count: number;
    claimsPaid: number;
    salvageRecovered: number;
    netLoss: number;
    recoveryRate: number;
  }>;
  byRegion?: Array<{
    region: string;
    count: number;
    claimsPaid: number;
    salvageRecovered: number;
    recoveryRate: number;
  }>;
  itemBreakdown: Array<{
    claimReference: string;
    assetType: string;
    marketValue: number;
    salvageRecovery: number;
    netLoss: number;
    recoveryRate: number;
    region: string;
    date: string;
  }>;
  registrationFees: Array<{
    vendorName: string;
    amount: number;
    paymentMethod: string;
    date: string;
    status: string;
  }>;
  trend: Array<{
    date: string;
    claimsPaid: number;
    salvageRecovered: number;
    recoveryRate: number;
    count: number;
  }>;
  forecast?: {
    nextMonth: {
      expectedRecovery: number;
      confidence: number;
    };
    nextQuarter: {
      expectedRecovery: number;
      confidence: number;
    };
  };
}

export class RevenueAnalysisService {
  /**
   * Generate comprehensive salvage recovery analysis report
   */
  static async generateReport(filters: ReportFilters): Promise<RevenueAnalysisReport> {
    // Get revenue data (auction payments)
    const revenueData = await FinancialDataRepository.getRevenueData(filters);

    // Get registration fee data
    const registrationFeeData = await FinancialDataRepository.getRegistrationFeeData(filters);

    // Calculate summary statistics
    const totalClaimsPaid = revenueData.reduce((sum, row) => sum + parseFloat(row.marketValue), 0);
    const totalSalvageRecovered = revenueData.reduce((sum, row) => sum + parseFloat(row.salvageRecovery), 0);
    const totalRegistrationFees = registrationFeeData
      .filter(fee => fee.status === 'verified')
      .reduce((sum, fee) => sum + parseFloat(fee.amount), 0);
    const totalRevenue = totalSalvageRecovered + totalRegistrationFees;
    const totalNetLoss = totalClaimsPaid - totalRevenue;
    const averageRecoveryRate = totalClaimsPaid > 0 ? (totalSalvageRecovered / totalClaimsPaid) * 100 : 0;

    // Group by asset type
    const byAssetType = this.calculateByAssetType(revenueData);

    // Group by region
    const byRegion = this.calculateByRegion(revenueData);

    // Create item breakdown
    const itemBreakdown = revenueData.map(row => ({
      claimReference: row.claimReference,
      assetType: row.assetType,
      marketValue: parseFloat(row.marketValue),
      salvageRecovery: parseFloat(row.salvageRecovery),
      netLoss: row.netLoss,
      recoveryRate: row.recoveryRate,
      region: row.region || 'Unknown',
      date: row.createdAt.toISOString().split('T')[0],
    }));

    // Create registration fees breakdown
    const registrationFees = registrationFeeData.map(fee => ({
      vendorName: fee.vendorName,
      amount: parseFloat(fee.amount),
      paymentMethod: fee.method,
      date: fee.createdAt.toISOString().split('T')[0],
      status: fee.status,
    }));

    // Calculate trend
    const trend = this.calculateTrend(revenueData);

    // Generate forecast
    const forecast = this.generateForecast(trend);

    return {
      summary: {
        totalCases: revenueData.length,
        totalClaimsPaid: Math.round(totalClaimsPaid * 100) / 100,
        totalSalvageRecovered: Math.round(totalSalvageRecovered * 100) / 100,
        totalRegistrationFees: Math.round(totalRegistrationFees * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalNetLoss: Math.round(totalNetLoss * 100) / 100,
        averageRecoveryRate: Math.round(averageRecoveryRate * 100) / 100,
      },
      byAssetType,
      byRegion,
      itemBreakdown,
      registrationFees,
      trend,
      forecast,
    };
  }

  /**
   * Calculate metrics by asset type
   */
  private static calculateByAssetType(data: any[]) {
    const grouped = DataAggregationService.groupBy(data, 'assetType');
    if (!grouped || Object.keys(grouped).length === 0) return [];
    
    return Object.entries(grouped).map(([assetType, items]) => {
      const claimsPaid = items.reduce((sum, item) => sum + parseFloat(item.marketValue), 0);
      const salvageRecovered = items.reduce((sum, item) => sum + parseFloat(item.salvageRecovery), 0);
      const netLoss = claimsPaid - salvageRecovered;
      const recoveryRate = claimsPaid > 0 ? (salvageRecovered / claimsPaid) * 100 : 0;

      return {
        assetType,
        count: items.length,
        claimsPaid: Math.round(claimsPaid * 100) / 100,
        salvageRecovered: Math.round(salvageRecovered * 100) / 100,
        netLoss: Math.round(netLoss * 100) / 100,
        recoveryRate: Math.round(recoveryRate * 100) / 100,
      };
    }).sort((a, b) => b.salvageRecovered - a.salvageRecovered);
  }

  /**
   * Calculate metrics by region
   */
  private static calculateByRegion(data: any[]) {
    const grouped = DataAggregationService.groupBy(data, 'region');
    if (!grouped || Object.keys(grouped).length === 0) return [];
    
    return Object.entries(grouped).map(([region, items]) => {
      const claimsPaid = items.reduce((sum, item) => sum + parseFloat(item.marketValue), 0);
      const salvageRecovered = items.reduce((sum, item) => sum + parseFloat(item.salvageRecovery), 0);
      const recoveryRate = claimsPaid > 0 ? (salvageRecovered / claimsPaid) * 100 : 0;

      return {
        region: region || 'Unknown',
        count: items.length,
        claimsPaid: Math.round(claimsPaid * 100) / 100,
        salvageRecovered: Math.round(salvageRecovered * 100) / 100,
        recoveryRate: Math.round(recoveryRate * 100) / 100,
      };
    }).sort((a, b) => b.salvageRecovered - a.salvageRecovered);
  }

  /**
   * Calculate salvage recovery trend over time
   */
  private static calculateTrend(data: any[]) {
    const grouped: Record<string, {
      claimsPaid: number;
      salvageRecovered: number;
      count: number;
    }> = {};

    for (const item of data) {
      const date = new Date(item.createdAt).toISOString().split('T')[0];
      
      if (!grouped[date]) {
        grouped[date] = { claimsPaid: 0, salvageRecovered: 0, count: 0 };
      }

      grouped[date].claimsPaid += parseFloat(item.marketValue);
      grouped[date].salvageRecovered += parseFloat(item.salvageRecovery);
      grouped[date].count++;
    }

    return Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        claimsPaid: Math.round(data.claimsPaid * 100) / 100,
        salvageRecovered: Math.round(data.salvageRecovered * 100) / 100,
        recoveryRate: data.claimsPaid > 0 
          ? Math.round((data.salvageRecovered / data.claimsPaid) * 10000) / 100 
          : 0,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Generate salvage recovery forecast based on historical trend
   */
  private static generateForecast(trend: any[]) {
    if (trend.length < 7) {
      return undefined; // Need at least 7 days of data
    }

    // Simple linear regression for forecasting
    const recentTrend = trend.slice(-30); // Last 30 days
    const avgDailyRecovery = recentTrend.reduce((sum, day) => sum + day.salvageRecovered, 0) / recentTrend.length;

    // Calculate growth rate
    const firstHalf = recentTrend.slice(0, Math.floor(recentTrend.length / 2));
    const secondHalf = recentTrend.slice(Math.floor(recentTrend.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, day) => sum + day.salvageRecovered, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, day) => sum + day.salvageRecovered, 0) / secondHalf.length;
    
    const growthRate = firstHalfAvg > 0 ? (secondHalfAvg - firstHalfAvg) / firstHalfAvg : 0;

    // Forecast next month (30 days)
    const nextMonthRecovery = avgDailyRecovery * 30 * (1 + growthRate);
    
    // Forecast next quarter (90 days)
    const nextQuarterRecovery = avgDailyRecovery * 90 * (1 + growthRate);

    // Confidence based on data consistency
    const variance = this.calculateVariance(recentTrend.map(d => d.salvageRecovered));
    const confidence = Math.max(0.5, Math.min(0.95, 1 - (variance / (avgDailyRecovery * avgDailyRecovery))));

    return {
      nextMonth: {
        expectedRecovery: Math.round(nextMonthRecovery * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
      },
      nextQuarter: {
        expectedRecovery: Math.round(nextQuarterRecovery * 100) / 100,
        confidence: Math.round(confidence * 0.85 * 100) / 100, // Lower confidence for longer term
      },
    };
  }

  /**
   * Calculate variance for confidence calculation
   */
  private static calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
}
