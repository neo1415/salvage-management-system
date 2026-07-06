/**
 * CSV Export API
 * 
 * POST /api/reports/export/csv
 * 
 * Exports report data as CSV format with comprehensive data extraction
 * Note: Charts and visualizations are excluded from CSV exports
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ExportService } from '@/features/export/services/export.service';
import { formatNgnAmount } from '@/lib/utils/format-ngn';
import type { PaymentAnalyticsReport } from '@/features/reports/financial/services/payment-analytics.service';
import type { VendorSpendingReport } from '@/features/reports/financial/services/vendor-spending.service';
import type { ProfitabilityReport } from '@/features/reports/financial/services/profitability.service';
import type { RevenueAnalysisReport } from '@/features/reports/financial/services/revenue-analysis.service';
import type { KPIDashboardReport } from '@/features/reports/executive/services/kpi-dashboard.service';
import type {
  AuctionPerformanceReport,
  CaseProcessingReport,
  DocumentManagementReport,
  VendorPerformanceReport,
} from '@/features/reports/operational/services';

interface ExportFilters {
  startDate?: string;
  endDate?: string;
  assetTypes?: string[];
  regions?: string[];
  branches?: string[];
}

type UserPerformanceExport = {
  summary?: Record<string, string | number | null | undefined>;
  performance?: Array<Record<string, string | number | null | undefined>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function money(value: number | string | null | undefined): string {
  return formatNgnAmount(value, { decimals: 0, empty: 'NGN 0' });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { reportType, data, filters } = body;

    // Generate CSV based on report type
    const csv = generateCSV(reportType, data, filters);
    
    const filename = ExportService.generateFilename(reportType, 'csv');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}

function generateCSV(reportType: string, data: unknown, filters?: ExportFilters): string {
  const reportTitle = reportType.replace(/-/g, ' ').toUpperCase();
  let csv = `${reportTitle} Report\n`;
  csv += `Generated: ${new Date().toLocaleString()}\n`;
  
  // Add filter information
  if (filters) {
    csv += `\nFilters Applied:\n`;
    if (filters.startDate) csv += `Start Date,${new Date(filters.startDate).toLocaleDateString()}\n`;
    if (filters.endDate) csv += `End Date,${new Date(filters.endDate).toLocaleDateString()}\n`;
    if (filters.assetTypes && filters.assetTypes.length > 0) {
      csv += `Asset Types,"${filters.assetTypes.join(', ')}"\n`;
    }
    if (filters.regions && filters.regions.length > 0) {
      csv += `Regions,"${filters.regions.join(', ')}"\n`;
    }
    if (filters.branches && filters.branches.length > 0) {
      csv += `Branches,"${filters.branches.join(', ')}"\n`;
    }
  }
  csv += '\n';

  // Route to specific report generator
  switch (reportType) {
    case 'payment-analytics':
      return generatePaymentAnalyticsCSV(csv, data as PaymentAnalyticsReport);
    case 'vendor-spending':
      return generateVendorSpendingCSV(csv, data as VendorSpendingReport);
    case 'profitability':
      return generateProfitabilityCSV(csv, data as ProfitabilityReport);
    case 'revenue-analysis':
      return generateRevenueAnalysisCSV(csv, data as RevenueAnalysisReport);
    case 'kpi-dashboard':
      return generateKPIDashboardCSV(csv, data as KPIDashboardReport);
    case 'case-processing':
      return generateCaseProcessingCSV(csv, data as CaseProcessingReport);
    case 'document-management':
      return generateDocumentManagementCSV(csv, data as DocumentManagementReport);
    case 'auction-performance':
      return generateAuctionPerformanceCSV(csv, data as AuctionPerformanceReport);
    case 'vendor-performance':
      return generateVendorPerformanceCSV(csv, data as VendorPerformanceReport);
    case 'my-performance':
    case 'team-performance':
    case 'managers':
    case 'finance':
    case 'adjusters':
      return generateUserPerformanceCSV(csv, data as UserPerformanceExport, reportType);
    default:
      return generateGenericCSV(csv, data);
  }
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values: unknown[]): string {
  return `${values.map(csvValue).join(',')}\n`;
}

function generatePaymentAnalyticsCSV(csv: string, data: PaymentAnalyticsReport): string {
  // Summary metrics
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  csv += csvRow(['Total Payments', data.summary?.totalPayments || 0]);
  csv += csvRow(['Verified Payment Amount', money(data.summary?.totalAmount)]);
  csv += csvRow(['Success Rate', `${data.summary?.successRate || 0}%`]);
  csv += csvRow(['Average Payment Time', `${data.summary?.averageProcessingTimeHours || 0} hours`]);
  csv += '\n';

  // Payment method breakdown
  if (data.byMethod && data.byMethod.length > 0) {
    csv += 'PAYMENT METHOD BREAKDOWN\n';
    csv += 'Method,Count,Total Amount,Percentage,Success Rate\n';
    data.byMethod.forEach((method) => {
      const percentage = data.summary.totalPayments > 0
        ? (method.count / data.summary.totalPayments) * 100
        : 0;
      csv += csvRow([method.method || 'Unknown', method.count || 0, money(method.totalAmount), `${percentage.toFixed(2)}%`, `${method.successRate || 0}%`]);
    });
    csv += csvRow(['TOTAL', data.byMethod.reduce((sum, method) => sum + (method.count || 0), 0), money(data.byMethod.reduce((sum, method) => sum + (method.totalAmount || 0), 0)), '100%', '']);
    csv += '\n';
  }

  // Payment status breakdown
  if (data.byStatus && data.byStatus.length > 0) {
    csv += 'PAYMENT STATUS BREAKDOWN\n';
    csv += 'Status,Count,Total Amount,Percentage\n';
    data.byStatus.forEach((status) => {
      csv += csvRow([status.status || 'Unknown', status.count || 0, money(status.totalAmount), `${status.percentage || 0}%`]);
    });
    csv += csvRow(['TOTAL', data.byStatus.reduce((sum, status) => sum + (status.count || 0), 0), money(data.byStatus.reduce((sum, status) => sum + (status.totalAmount || 0), 0)), '100%']);
    csv += '\n';
  }

  return csv;
}

function generateVendorSpendingCSV(csv: string, data: VendorSpendingReport): string {
  // Summary metrics
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  csv += `Total Spending,${money(data.summary?.totalSpent)}\n`;
  csv += `Total Vendors,${data.summary?.totalVendors || 0}\n`;
  csv += `Average Spending per Vendor,${money(data.summary?.averageSpendPerVendor)}\n`;
  csv += '\n';

  // Vendor spending table
  if (data.topSpenders.length > 0) {
    csv += 'VENDOR SPENDING DETAILS\n';
    csv += 'Vendor Name,Tier,Total Spent,Transactions,Average Transaction,First Purchase,Last Purchase\n';
    data.topSpenders.forEach((vendor) => {
      csv += csvRow([vendor.vendorName || 'Unknown', vendor.tier, money(vendor.totalSpent), vendor.transactionCount, money(vendor.averageTransaction), vendor.firstPurchase, vendor.lastPurchase]);
    });
    csv += '\n';
  }

  // Spending by asset type
  if (data.byAssetType && data.byAssetType.length > 0) {
    csv += 'SPENDING BY ASSET TYPE\n';
    csv += 'Asset Type,Total Spent,Count\n';
    data.byAssetType.forEach((asset) => {
      csv += `${asset.assetType || 'Unknown'},${money(asset.totalSpent)},${asset.vendorCount || 0}\n`;
    });
    csv += '\n';
  }

  return csv;
}

function generateProfitabilityCSV(csv: string, data: ProfitabilityReport): string {
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  if (data.summary) {
    csv += csvRow(['Total Cases', data.summary.totalCases || 0]);
    csv += csvRow(['Total Claims Paid', money(data.summary.totalClaimsPaid)]);
    csv += csvRow(['Total Salvage Recovered', money(data.summary.totalSalvageRecovered)]);
    csv += csvRow(['Total Net Loss', money(data.summary.totalNetLoss)]);
    csv += csvRow(['Average Recovery Rate', `${data.summary.averageRecoveryRate || 0}%`]);
    csv += csvRow(['ROI', `${data.summary.roi || 0}%`]);
  }
  csv += '\n';

  if (data.byBranch && data.byBranch.length > 0) {
    csv += 'BRANCH PROFITABILITY\n';
    csv += 'Branch,Cases,Claims Paid,Salvage Recovered,Net Loss,Recovery Rate,ROI\n';
    data.byBranch.forEach((branch) => {
      csv += csvRow([
        branch.label || 'Unassigned',
        branch.count || 0,
        money(branch.claimsPaid),
        money(branch.salvageRecovered),
        money(branch.netLoss),
        `${branch.recoveryRate || 0}%`,
        `${branch.roi || 0}%`,
      ]);
    });
    csv += '\n';
  }

  if (data.byBroker && data.byBroker.length > 0) {
    csv += 'BROKER / AGENCY PROFITABILITY\n';
    csv += 'Channel,Type,Cases,Claims Paid,Salvage Recovered,Net Loss,Recovery Rate,ROI\n';
    data.byBroker.forEach((broker) => {
      csv += csvRow([
        broker.label || 'Unassigned',
        broker.channelType || 'unassigned',
        broker.count || 0,
        broker.claimsPaid || 0,
        broker.salvageRecovered || 0,
        broker.netLoss || 0,
        `${broker.recoveryRate || 0}%`,
        `${broker.roi || 0}%`,
      ]);
    });
    csv += '\n';
  }

  if (data.itemBreakdown && data.itemBreakdown.length > 0) {
    csv += 'CASE DETAIL\n';
    csv += 'Claim,Policy,Branch,Broker Agency,Asset,Market Value,Salvage Recovered,Net Loss,Recovery Rate,ROI,Date\n';
    data.itemBreakdown.forEach((row) => {
      csv += csvRow([
        row.claimReference || '',
        row.policyNumber || '',
        row.branchName || '',
        row.channelLabel || '',
        row.assetType || '',
        money(row.marketValue),
        money(row.salvageRecovery),
        money(row.netLoss),
        `${row.recoveryRate || 0}%`,
        `${row.roi || 0}%`,
        row.date || '',
      ]);
    });
    csv += '\n';
  }

  return csv;
}

function generateRevenueAnalysisCSV(csv: string, data: RevenueAnalysisReport): string {
  // Summary metrics
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  csv += `Total Revenue,${money(data.summary?.totalRevenue)}\n`;
  csv += `Average Recovery Rate,${data.summary?.averageRecoveryRate || 0}%\n`;
  csv += `Total Cases,${data.summary?.totalCases || 0}\n`;
  csv += '\n';

  // Revenue by asset type
  if (data.byAssetType && data.byAssetType.length > 0) {
    csv += 'REVENUE BY ASSET TYPE\n';
    csv += 'Asset Type,Claims Paid,Salvage Recovered,Count,Average Recovery Rate\n';
    data.byAssetType.forEach((asset) => {
      csv += `${asset.assetType || 'Unknown'},${asset.claimsPaid || 0},${asset.salvageRecovered || 0},${asset.count || 0},${asset.recoveryRate || 0}%\n`;
    });
    csv += '\n';
  }

  if (data.byBranch && data.byBranch.length > 0) {
    csv += 'REVENUE BY BRANCH\n';
    csv += 'Branch,Claims Paid,Salvage Recovered,Net Loss,Count,Recovery Rate\n';
    data.byBranch.forEach((branch) => {
      csv += csvRow([
        branch.branchName || 'Unassigned',
        branch.claimsPaid || 0,
        branch.salvageRecovered || 0,
        branch.netLoss || 0,
        branch.count || 0,
        `${branch.recoveryRate || 0}%`,
      ]);
    });
    csv += '\n';
  }

  if (data.byBroker && data.byBroker.length > 0) {
    csv += 'REVENUE BY BROKER / AGENCY\n';
    csv += 'Channel,Type,Claims Paid,Salvage Recovered,Net Loss,Count,Recovery Rate\n';
    data.byBroker.forEach((broker) => {
      csv += csvRow([
        broker.channelName || 'Unassigned',
        broker.channelType || 'unassigned',
        broker.claimsPaid || 0,
        broker.salvageRecovered || 0,
        broker.netLoss || 0,
        broker.count || 0,
        `${broker.recoveryRate || 0}%`,
      ]);
    });
    csv += '\n';
  }

  if (data.itemBreakdown && data.itemBreakdown.length > 0) {
    csv += 'CASE DETAIL\n';
    csv += 'Claim,Policy,Branch,Broker Agency,Asset,Market Value,Salvage Recovered,Net Loss,Recovery Rate,ROI,Date\n';
    data.itemBreakdown.forEach((row) => {
      csv += csvRow([
        row.claimReference || '',
        row.policyNumber || '',
        row.branchName || '',
        row.channelLabel || '',
        row.assetType || '',
        money(row.marketValue),
        money(row.salvageRecovery),
        money(row.netLoss),
        `${row.recoveryRate || 0}%`,
        `${row.roi || 0}%`,
        row.date || '',
      ]);
    });
    csv += '\n';
  }

  if (data.trend.length > 0) {
    csv += 'REVENUE BY PERIOD\n';
    csv += 'Date,Claims Paid,Salvage Recovered,Recovery Rate,Count\n';
    data.trend.forEach((period) => {
      csv += csvRow([period.date, period.claimsPaid, period.salvageRecovered, `${period.recoveryRate}%`, period.count]);
    });
    csv += '\n';
  }

  return csv;
}

function generateKPIDashboardCSV(csv: string, data: KPIDashboardReport): string {
  // Financial KPIs
  csv += 'FINANCIAL KPIs\n';
  csv += 'Metric,Value\n';
  if (data.financial) {
    csv += `Total Revenue,${money(data.financial.totalRevenue)}\n`;
    csv += `Recovery Rate,${data.financial.averageRecoveryRate || 0}%\n`;
    csv += `Profit Margin,${data.financial.profitMargin || 0}%\n`;
    csv += `Revenue Growth,${data.financial.revenueGrowth || 0}%\n`;
  }
  csv += '\n';

  // Operational KPIs
  csv += 'OPERATIONAL KPIs\n';
  csv += 'Metric,Value\n';
  if (data.operational) {
    csv += `Total Cases,${data.operational.totalCases || 0}\n`;
    csv += `Case Processing Time,${data.operational.caseProcessingTime || 0} hours\n`;
    csv += `Auction Success Rate,${data.operational.auctionSuccessRate || 0}%\n`;
    csv += `Vendor Participation Rate,${data.operational.vendorParticipationRate || 0}%\n`;
  }
  csv += '\n';

  // Performance KPIs
  csv += 'PERFORMANCE KPIs\n';
  csv += 'Metric,Value\n';
  if (data.performance) {
    csv += `Top Adjuster Performance,${data.performance.topAdjusterPerformance || 0}\n`;
    csv += `Average Adjuster Performance,${data.performance.averageAdjusterPerformance || 0}\n`;
    csv += `Payment Verification Rate,${data.performance.paymentVerificationRate || 0}%\n`;
    csv += `Document Completion Rate,${data.performance.documentCompletionRate || 0}%\n`;
  }
  csv += '\n';

  // Cases breakdown
  if (data.breakdowns?.cases && data.breakdowns.cases.length > 0) {
    csv += 'CASES BREAKDOWN\n';
    csv += 'Claim Reference,Adjuster,Branch,Asset Type,Market Value,Processing Time,Revenue,Status\n';
    data.breakdowns.cases.forEach((c) => {
      csv += `${c.claimReference || ''},"${c.adjusterName || ''}","${c.branchName || 'Unassigned'}",${c.assetType || ''},${c.marketValue || 0},${c.processingTime || 0},${c.revenue || 0},${c.status || ''}\n`;
    });
    csv += '\n';
  }

  if (data.breakdowns?.branches && data.breakdowns.branches.length > 0) {
    csv += 'BRANCH RECOVERY BREAKDOWN\n';
    csv += 'Branch,Total Cases,Sold Cases,Claims Value,Verified Recovery,Recovery Rate\n';
    data.breakdowns.branches.forEach((branch) => {
      csv += `"${branch.branchName || 'Unassigned'}",${branch.totalCases || 0},${branch.soldCases || 0},${branch.claimsValue || 0},${branch.verifiedRecovery || 0},${branch.recoveryRate || 0}%\n`;
    });
    csv += '\n';
  }

  // Auctions breakdown
  if (data.breakdowns?.auctions && data.breakdowns.auctions.length > 0) {
    csv += 'AUCTIONS BREAKDOWN\n';
    csv += 'Case Reference,Bidders,Total Bids,Starting Bid,Winning Bid,Winner,Status\n';
    data.breakdowns.auctions.forEach((a) => {
      csv += `${a.caseReference || ''},${a.uniqueBidders || 0},${a.totalBids || 0},${a.startingBid || 0},${a.winningBid || 0},"${a.winnerName || '-'}",${a.status || ''}\n`;
    });
    csv += '\n';
  }

  // Adjusters breakdown
  if (data.breakdowns?.adjusters && data.breakdowns.adjusters.length > 0) {
    csv += 'ADJUSTERS BREAKDOWN\n';
    csv += 'Adjuster,Cases,Approved,Rejected,Approval Rate,Avg Time,Revenue,Quality Score\n';
    data.breakdowns.adjusters.forEach((adj) => {
      csv += `"${adj.name || ''}",${adj.totalCases || 0},${adj.approved || 0},${adj.rejected || 0},${adj.approvalRate || 0}%,${adj.avgProcessingTime || 0},${adj.revenue || 0},${adj.qualityScore || 0}\n`;
    });
    csv += '\n';
  }

  // Vendors breakdown
  if (data.breakdowns?.vendors && data.breakdowns.vendors.length > 0) {
    csv += 'VENDORS BREAKDOWN\n';
    csv += 'Vendor,Tier,Participated,Won,Win Rate,Total Spent,Avg Bid,Payment Rate\n';
    data.breakdowns.vendors.forEach((v) => {
      csv += `"${v.businessName || ''}",${v.tier || 0},${v.auctionsParticipated || 0},${v.auctionsWon || 0},${v.winRate || 0}%,${v.totalSpent || 0},${v.avgBid || 0},${v.paymentRate || 0}%\n`;
    });
    csv += '\n';
  }

  return csv;
}

function generateCaseProcessingCSV(csv: string, data: CaseProcessingReport): string {
  csv += 'CASE PROCESSING METRICS\n';
  csv += 'Metric,Value\n';
  if (data.summary) {
    csv += csvRow(['Total Cases', data.summary.totalCases || 0]);
    csv += csvRow(['Average Processing Time', `${data.summary.averageProcessingTimeDays || 0} days`]);
    csv += csvRow(['Approval Rate', `${data.summary.approvalRate || 0}%`]);
    csv += csvRow(['Pending Cases', data.summary.pendingCases || 0]);
    csv += csvRow(['Approved Cases', data.summary.approvedCases || 0]);
    csv += csvRow(['Active Auction Cases', data.summary.activeAuctionCases || 0]);
    csv += csvRow(['Awaiting Payment Cases', data.summary.awaitingPaymentCases || 0]);
    csv += csvRow(['Sold Cases', data.summary.soldCases || 0]);
    csv += csvRow(['Total Market Value', money(data.summary.totalMarketValue)]);
    csv += csvRow(['Total Salvage Value', money(data.summary.totalSalvageValue)]);
  }
  csv += '\n';

  if (data.byStatus && data.byStatus.length > 0) {
    csv += 'STATUS BREAKDOWN\n';
    csv += 'Status,Count,Percentage\n';
    data.byStatus.forEach((s) => {
      csv += csvRow([s.status || 'Unknown', s.count || 0, `${s.percentage || 0}%`]);
    });
    csv += '\n';
  }

  if (data.byBranch && data.byBranch.length > 0) {
    csv += 'BRANCH PROCESSING PERFORMANCE\n';
    csv += 'Branch,Cases Processed,Sold,Approval Rate,Average Processing Days,Total Market Value,Total Salvage Value\n';
    data.byBranch.forEach((branch) => {
      csv += csvRow([
        branch.branchName || 'Unassigned',
        branch.casesProcessed || 0,
        branch.soldCases || 0,
        `${branch.approvalRate || 0}%`,
        branch.averageProcessingTime || 0,
        branch.totalMarketValue || 0,
        branch.totalSalvageValue || 0,
      ]);
    });
    csv += '\n';
  }

  if (data.byAssetType && data.byAssetType.length > 0) {
    csv += 'CASE DETAILS BY ASSET TYPE\n';
    csv += 'Asset Type,Claim Reference,Branch,Status,Market Value,Salvage Value,Processing Days,Created Date\n';
    data.byAssetType.forEach((asset) => {
      (asset.cases || []).forEach((c) => {
        csv += csvRow([asset.assetType || 'Unknown', c.claimReference || '', c.branchName || 'Unassigned', c.status || '', c.marketValue || 0, c.salvageValue || 0, c.processingDays || 0, c.createdAt || '']);
      });
    });
  }

  return csv;
}

function generateDocumentManagementCSV(csv: string, data: DocumentManagementReport): string {
  csv += 'DOCUMENT MANAGEMENT METRICS\n';
  csv += 'Metric,Value\n';
  csv += csvRow(['Status', data.summary.note]);
  csv += '\n';

  return csv;
}

function generateAuctionPerformanceCSV(csv: string, data: AuctionPerformanceReport): string {
  csv += 'AUCTION PERFORMANCE METRICS\n';
  csv += 'Metric,Value\n';
  if (data.summary) {
    csv += csvRow(['Total Auctions', data.summary.totalAuctions || 0]);
    csv += csvRow(['Success Rate', `${data.summary.successRate || 0}%`]);
    csv += csvRow(['Average Bids per Auction', data.summary.averageBidsPerAuction || 0]);
    csv += csvRow(['Average Unique Bidders', data.summary.averageUniqueBidders || 0]);
    csv += csvRow(['Reserve Met Rate', `${data.summary.reserveMetRate || 0}%`]);
    csv += csvRow(['Verified Auction Revenue', data.summary.totalRevenue || 0]);
    csv += csvRow(['Average Winning Bid', data.summary.averageWinningBid || 0]);
  }
  csv += '\n';

  if (data.byStatus && data.byStatus.length > 0) {
    csv += 'STATUS BREAKDOWN\n';
    csv += 'Status,Count,Percentage\n';
    data.byStatus.forEach((s) => {
      csv += csvRow([s.status || 'Unknown', s.count || 0, `${s.percentage || 0}%`]);
    });
    csv += '\n';
  }

  if (data.byBranch && data.byBranch.length > 0) {
    csv += 'BRANCH AUCTION PERFORMANCE\n';
    csv += 'Branch,Auctions,Successful,Success Rate,Total Revenue,Average Winning Bid,Average Bids\n';
    data.byBranch.forEach((branch) => {
      csv += csvRow([
        branch.branchName || 'Unassigned',
        branch.auctionCount || 0,
        branch.successfulAuctions || 0,
        `${branch.successRate || 0}%`,
        branch.totalRevenue || 0,
        branch.averageWinningBid || 0,
        branch.averageBids || 0,
      ]);
    });
    csv += '\n';
  }

  if (data.byBroker && data.byBroker.length > 0) {
    csv += 'BROKER / AGENCY AUCTION PERFORMANCE\n';
    csv += 'Channel,Type,Auctions,Successful,Success Rate,Total Revenue,Average Winning Bid,Average Bids\n';
    data.byBroker.forEach((broker) => {
      csv += csvRow([
        broker.channelName || 'Unassigned',
        broker.channelType || 'unassigned',
        broker.auctionCount || 0,
        broker.successfulAuctions || 0,
        `${broker.successRate || 0}%`,
        broker.totalRevenue || 0,
        broker.averageWinningBid || 0,
        broker.averageBids || 0,
      ]);
    });
    csv += '\n';
  }

  if (data.auctionList && data.auctionList.length > 0) {
    csv += 'AUCTION DETAILS\n';
    csv += 'Auction ID,Claim Reference,Policy Number,Branch,Broker Agency,Asset Type,Start Time,End Time,Duration Hours,Reserve Price,Winning Bid,Unique Bidders,Total Bids,Status,Successful,Pickup Status,Possessing Vendor,Picked Up\n';
    data.auctionList.forEach((a) => {
      csv += csvRow([
        a.auctionId || '',
        a.claimReference || '',
        a.policyNumber || '',
        a.branchName || 'Unassigned',
        a.channelLabel || '',
        a.assetType || '',
        a.startTime || '',
        a.endTime || '',
        a.durationHours || 0,
        a.reservePrice || 0,
        a.winningBid || 0,
        a.uniqueBidders || 0,
        a.bidCount || 0,
        a.status || '',
        a.isSuccessful ? 'Yes' : 'No',
        a.pickupStatus || '',
        a.pickupVendorName || '',
        a.pickedUpAt || '',
      ]);
    });
    csv += csvRow([
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      data.auctionList.reduce((sum, auction) => sum + (auction.winningBid || 0), 0),
      '',
      data.auctionList.reduce((sum, auction) => sum + (auction.bidCount || 0), 0),
      '',
      '',
      '',
      '',
      '',
    ]);
  }

  return csv;
}

function generateVendorPerformanceCSV(csv: string, data: VendorPerformanceReport): string {
  csv += 'VENDOR PERFORMANCE METRICS\n';
  csv += 'Metric,Value\n';
  if (data.summary) {
    csv += csvRow(['Total Vendors', data.summary.totalVendors || 0]);
    csv += csvRow(['Average Win Rate', `${data.summary.averageWinRate || 0}%`]);
    csv += csvRow(['Average Participation', `${data.summary.averageParticipationRate || 0}%`]);
  }
  csv += '\n';

  if (data.rankings && data.rankings.length > 0) {
    csv += 'VENDOR RANKINGS\n';
    csv += 'Rank,Vendor Name,Tier,Bids,Wins,Win Rate,Verified Spend,Completed Pickups,Pending Pickups,On-Time Pickup Rate,Average Pickup Hours\n';
    data.rankings.forEach((v) => {
      csv += csvRow([
        v.rank || '',
        v.vendorName || '',
        v.tier || '',
        v.totalBids || 0,
        v.totalWins || 0,
        `${v.winRate || 0}%`,
        v.totalSpent || 0,
        v.completedPickups || 0,
        v.pendingPickups || 0,
        `${v.onTimePickupRate || 0}%`,
        v.averagePickupHours ?? '',
      ]);
    });
    csv += '\n';
  }

  return csv;
}

function generateUserPerformanceCSV(csv: string, data: UserPerformanceExport, reportType: string): string {
  csv += `${reportType.toUpperCase().replace(/-/g, ' ')} METRICS\n`;
  csv += 'Metric,Value\n';
  if (data.summary) {
    Object.entries(data.summary).forEach(([key, value]) => {
      csv += `${key.replace(/([A-Z])/g, ' $1').trim()},${value}\n`;
    });
  }
  csv += '\n';

  if (data.performance && data.performance.length > 0) {
    csv += 'PERFORMANCE DETAILS\n';
    const headers = Object.keys(data.performance[0]);
    csv += headers.join(',') + '\n';
    data.performance.forEach((p) => {
      csv += headers.map(h => {
        const val = p[h];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',') + '\n';
    });
  }

  return csv;
}

function generateGenericCSV(csv: string, data: unknown): string {
  const root = isRecord(data) ? data : {};
  const breakdowns = isRecord(root.breakdowns) ? root.breakdowns : {};
  const operational = isRecord(root.operational) ? root.operational : {};
  const branchRows =
    recordArray(root.byBranch).length > 0 ? recordArray(root.byBranch) :
    recordArray(breakdowns.branches).length > 0 ? recordArray(breakdowns.branches) :
    recordArray(operational.branches);

  if (branchRows.length > 0) {
    csv += 'BRANCH PERFORMANCE\n';
    csv += 'Branch,Cases,Claims Value,Verified Recovery,Recovery Rate\n';
    branchRows.forEach((branch) => {
      const cases = branch.totalCases ?? branch.count ?? branch.casesProcessed ?? branch.auctionCount ?? 0;
      const claimsValue = branch.claimsValue ?? branch.claimsPaid ?? branch.totalMarketValue ?? 0;
      const recovery = branch.verifiedRecovery ?? branch.salvageRecovered ?? branch.totalSalvageValue ?? branch.totalRevenue ?? 0;
      csv += csvRow([
        branch.branchName || 'Unassigned',
        cases,
        claimsValue,
        recovery,
        `${branch.recoveryRate ?? branch.successRate ?? branch.approvalRate ?? 0}%`,
      ]);
    });
    csv += '\n';
  }

  // Fallback for unknown report types
  csv += 'REPORT DATA\n';
  csv += JSON.stringify(data, null, 2);
  return csv;
}
