/**
 * Profitability Service
 * 
 * Implements profitability analysis and ROI calculations
 * Task 8: Profitability Reports Service
 */

import { ReportFilters } from '../../types';
import { FinancialDataRepository } from '../repositories/financial-data.repository';

export interface ProfitabilityReport {
  summary: {
    totalCases: number;
    totalClaimsPaid: number;
    totalSalvageRecovered: number;
    totalNetLoss: number;
    averageRecoveryRate: number;
    roi: number;
  };
  byAssetType: Array<{
    assetType: string;
    count: number;
    claimsPaid: number;
    salvageRecovered: number;
    netLoss: number;
    recoveryRate: number;
    roi: number;
  }>;
  profitDistribution: {
    profitable: number;
    breakEven: number;
    loss: number;
  };
  topPerformers: Array<{
    caseId: string;
    claimReference: string;
    assetType: string;
    salvageRecovery: number;
    recoveryRate: number;
    roi: number;
  }>;
  bottomPerformers: Array<{
    caseId: string;
    claimReference: string;
    assetType: string;
    salvageRecovery: number;
    recoveryRate: number;
    roi: number;
  }>;
  trend: Array<{
    date: string;
    salvageRecovered: number;
    recoveryRate: number;
    roi: number;
  }>;
}

export class ProfitabilityService {
  /**
   * Generate comprehensive profitability report
   */
  static async generateReport(filters: ReportFilters): Promise<ProfitabilityReport> {
    // Get profitability data
    const data = await FinancialDataRepository.getProfitabilityData(filters);

    // Calculate profit distribution
    const profitDistribution = this.calculateProfitDistribution(data.details);

    // Get top and bottom performers
    const performers = this.getPerformers(data.details);

    // Calculate trend
    const trend = this.calculateTrend(data.details);

    // Calculate ROI for summary
    const summaryWithROI = {
      ...data.summary,
      roi: data.summary.totalClaimsPaid > 0 
        ? Math.round((data.summary.totalSalvageRecovered / data.summary.totalClaimsPaid) * 10000) / 100
        : 0,
    };

    // Convert byAssetType object to array with ROI
    const byAssetTypeArray = Object.entries(data.byAssetType).map(([assetType, metrics]) => ({
      assetType,
      count: metrics.count,
      claimsPaid: metrics.claimsPaid,
      salvageRecovered: metrics.salvageRecovered,
      netLoss: metrics.netLoss,
      recoveryRate: metrics.recoveryRate,
      roi: metrics.claimsPaid > 0 
        ? Math.round((metrics.salvageRecovered / metrics.claimsPaid) * 10000) / 100
        : 0,
    }));

    return {
      summary: summaryWithROI,
      byAssetType: byAssetTypeArray,
      profitDistribution,
      topPerformers: performers.top,
      bottomPerformers: performers.bottom,
      trend,
    };
  }

  /**
   * Calculate profit distribution
   */
  private static calculateProfitDistribution(data: any[]) {
    // In salvage recovery, "profitable" means high recovery rate (>50%)
    const profitable = data.filter(item => item.recoveryRate > 50).length;
    const breakEven = data.filter(item => item.recoveryRate >= 20 && item.recoveryRate <= 50).length;
    const loss = data.filter(item => item.recoveryRate < 20).length;

    return {
      profitable,
      breakEven,
      loss,
    };
  }

  /**
   * Get top and bottom performers
   */
  private static getPerformers(data: any[]) {
    const sorted = [...data].sort((a, b) => b.recoveryRate - a.recoveryRate);

    const formatPerformer = (item: any) => ({
      caseId: item.caseId,
      claimReference: item.claimReference,
      assetType: item.assetType,
      salvageRecovery: parseFloat(item.salvageRecovery),
      recoveryRate: item.recoveryRate,
      roi: item.recoveryRate, // Recovery rate IS the ROI for salvage
    });

    return {
      top: sorted.slice(0, 10).map(formatPerformer),
      bottom: sorted.slice(-10).reverse().map(formatPerformer),
    };
  }

  /**
   * Calculate profitability trend over time
   */
  private static calculateTrend(data: any[]) {
    const grouped: Record<string, {
      salvageRecovered: number;
      claimsPaid: number;
    }> = {};

    for (const item of data) {
      const date = new Date(item.createdAt).toISOString().split('T')[0];
      
      if (!grouped[date]) {
        grouped[date] = { salvageRecovered: 0, claimsPaid: 0 };
      }

      grouped[date].salvageRecovered += parseFloat(item.salvageRecovery);
      grouped[date].claimsPaid += parseFloat(item.marketValue);
    }

    // Check if grouped is empty
    if (Object.keys(grouped).length === 0) return [];

    return Object.entries(grouped)
      .map(([date, data]) => {
        const recoveryRate = data.claimsPaid > 0 
          ? (data.salvageRecovered / data.claimsPaid) * 100
          : 0;
        const roi = recoveryRate; // Recovery rate IS the ROI

        return {
          date,
          salvageRecovered: Math.round(data.salvageRecovered * 100) / 100,
          recoveryRate: Math.round(recoveryRate * 100) / 100,
          roi: Math.round(roi * 100) / 100,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
