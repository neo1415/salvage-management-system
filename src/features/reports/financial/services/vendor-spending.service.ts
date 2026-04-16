/**
 * Vendor Spending Analysis Service
 * 
 * Implements comprehensive vendor spending analytics
 * Task 7: Vendor Spending Analysis Service
 */

import { ReportFilters } from '../../types';
import { FinancialDataRepository, VendorSpendingData } from '../repositories/financial-data.repository';

export interface VendorSpendingReport {
  summary: {
    totalVendors: number;
    totalSpent: number;
    averageSpendPerVendor: number;
    topSpenderPercentage: number;
  };
  topSpenders: VendorSpendingData[];
  byTier: Array<{
    tier: string;
    vendorCount: number;
    totalSpent: number;
    averageSpent: number;
    percentage: number;
  }>;
  byAssetType: Array<{
    assetType: string;
    totalSpent: number;
    vendorCount: number;
    percentage: number;
  }>;
  spendingConcentration: {
    top10Percentage: number;
    top20Percentage: number;
    herfindahlIndex: number;
  };
  lifetimeValue: {
    highest: VendorSpendingData;
    average: number;
    median: number;
  };
}

export class VendorSpendingService {
  /**
   * Generate comprehensive vendor spending report
   */
  static async generateReport(filters: ReportFilters): Promise<VendorSpendingReport> {
    // Get vendor spending data
    const vendorData = await FinancialDataRepository.getVendorSpendingData(filters);

    // Calculate summary
    const summary = this.calculateSummary(vendorData);

    // Get top spenders
    const topSpenders = vendorData.slice(0, 20); // Top 20

    // Group by tier
    const byTier = this.calculateByTier(vendorData);

    // Group by asset type
    const byAssetType = this.calculateByAssetType(vendorData);

    // Calculate spending concentration
    const spendingConcentration = this.calculateConcentration(vendorData);

    // Calculate lifetime value stats
    const lifetimeValue = this.calculateLifetimeValue(vendorData);

    return {
      summary,
      topSpenders,
      byTier,
      byAssetType,
      spendingConcentration,
      lifetimeValue,
    };
  }

  /**
   * Calculate summary statistics
   */
  private static calculateSummary(data: VendorSpendingData[]) {
    const totalSpent = data.reduce((sum, v) => sum + v.totalSpent, 0);
    const averageSpendPerVendor = data.length > 0 ? totalSpent / data.length : 0;
    
    const topSpenderSpent = data.length > 0 ? data[0].totalSpent : 0;
    const topSpenderPercentage = totalSpent > 0 ? (topSpenderSpent / totalSpent) * 100 : 0;

    return {
      totalVendors: data.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      averageSpendPerVendor: Math.round(averageSpendPerVendor * 100) / 100,
      topSpenderPercentage: Math.round(topSpenderPercentage * 100) / 100,
    };
  }

  /**
   * Calculate metrics by vendor tier
   */
  private static calculateByTier(data: VendorSpendingData[]) {
    const grouped: Record<string, VendorSpendingData[]> = {};
    
    for (const vendor of data) {
      if (!grouped[vendor.tier]) {
        grouped[vendor.tier] = [];
      }
      grouped[vendor.tier].push(vendor);
    }

    const totalSpent = data.reduce((sum, v) => sum + v.totalSpent, 0);

    // Check if grouped is empty
    if (Object.keys(grouped).length === 0) return [];

    return Object.entries(grouped).map(([tier, vendors]) => {
      const tierSpent = vendors.reduce((sum, v) => sum + v.totalSpent, 0);
      const percentage = totalSpent > 0 ? (tierSpent / totalSpent) * 100 : 0;

      return {
        tier,
        vendorCount: vendors.length,
        totalSpent: Math.round(tierSpent * 100) / 100,
        averageSpent: Math.round((tierSpent / vendors.length) * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }

  /**
   * Calculate metrics by asset type
   */
  private static calculateByAssetType(data: VendorSpendingData[]) {
    const assetTypeMap: Record<string, { spent: number; vendors: Set<string> }> = {};

    for (const vendor of data) {
      for (const [assetType, amount] of Object.entries(vendor.assetTypeBreakdown)) {
        if (!assetTypeMap[assetType]) {
          assetTypeMap[assetType] = { spent: 0, vendors: new Set() };
        }
        assetTypeMap[assetType].spent += amount;
        assetTypeMap[assetType].vendors.add(vendor.vendorId);
      }
    }

    const totalSpent = Object.values(assetTypeMap).reduce((sum, data) => sum + data.spent, 0);

    // Check if assetTypeMap is empty
    if (Object.keys(assetTypeMap).length === 0) return [];

    return Object.entries(assetTypeMap).map(([assetType, data]) => {
      const percentage = totalSpent > 0 ? (data.spent / totalSpent) * 100 : 0;

      return {
        assetType,
        totalSpent: Math.round(data.spent * 100) / 100,
        vendorCount: data.vendors.size,
        percentage: Math.round(percentage * 100) / 100,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }

  /**
   * Calculate spending concentration metrics
   */
  private static calculateConcentration(data: VendorSpendingData[]) {
    const totalSpent = data.reduce((sum, v) => sum + v.totalSpent, 0);

    // Top 10 percentage
    const top10Spent = data.slice(0, 10).reduce((sum, v) => sum + v.totalSpent, 0);
    const top10Percentage = totalSpent > 0 ? (top10Spent / totalSpent) * 100 : 0;

    // Top 20 percentage
    const top20Spent = data.slice(0, 20).reduce((sum, v) => sum + v.totalSpent, 0);
    const top20Percentage = totalSpent > 0 ? (top20Spent / totalSpent) * 100 : 0;

    // Herfindahl-Hirschman Index (market concentration)
    const herfindahlIndex = data.reduce((sum, v) => {
      const marketShare = totalSpent > 0 ? v.totalSpent / totalSpent : 0;
      return sum + (marketShare * marketShare * 10000);
    }, 0);

    return {
      top10Percentage: Math.round(top10Percentage * 100) / 100,
      top20Percentage: Math.round(top20Percentage * 100) / 100,
      herfindahlIndex: Math.round(herfindahlIndex * 100) / 100,
    };
  }

  /**
   * Calculate lifetime value statistics
   */
  private static calculateLifetimeValue(data: VendorSpendingData[]) {
    if (data.length === 0) {
      return {
        highest: {} as VendorSpendingData,
        average: 0,
        median: 0,
      };
    }

    const sorted = [...data].sort((a, b) => b.totalSpent - a.totalSpent);
    const average = data.reduce((sum, v) => sum + v.totalSpent, 0) / data.length;
    const median = sorted[Math.floor(sorted.length / 2)].totalSpent;

    return {
      highest: sorted[0],
      average: Math.round(average * 100) / 100,
      median: Math.round(median * 100) / 100,
    };
  }
}
