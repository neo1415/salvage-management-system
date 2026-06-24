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
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${reportType}-${new Date().toISOString().split('T')[0]}.csv"`,
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

function generateCSV(reportType: string, data: any, filters: any): string {
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
      return generatePaymentAnalyticsCSV(csv, data);
    case 'vendor-spending':
      return generateVendorSpendingCSV(csv, data);
    case 'profitability':
      return generateProfitabilityCSV(csv, data);
    case 'revenue-analysis':
      return generateRevenueAnalysisCSV(csv, data);
    case 'kpi-dashboard':
      return generateKPIDashboardCSV(csv, data);
    case 'case-processing':
      return generateCaseProcessingCSV(csv, data);
    case 'document-management':
      return generateDocumentManagementCSV(csv, data);
    case 'auction-performance':
      return generateAuctionPerformanceCSV(csv, data);
    case 'vendor-performance':
      return generateVendorPerformanceCSV(csv, data);
    case 'my-performance':
    case 'team-performance':
    case 'managers':
    case 'finance':
    case 'adjusters':
      return generateUserPerformanceCSV(csv, data, reportType);
    default:
      return generateGenericCSV(csv, data);
  }
}

function csvValue(value: any): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values: any[]): string {
  return `${values.map(csvValue).join(',')}\n`;
}

function generatePaymentAnalyticsCSV(csv: string, data: any): string {
  // Summary metrics
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  csv += csvRow(['Total Payments', data.summary?.totalPayments || 0]);
  csv += csvRow(['Verified Payment Amount', data.summary?.totalAmount || 0]);
  csv += csvRow(['Success Rate', `${data.summary?.successRate || 0}%`]);
  csv += csvRow(['Average Payment Time', `${data.summary?.averagePaymentTime || 0} hours`]);
  csv += '\n';

  // Payment method breakdown
  if (data.byMethod && data.byMethod.length > 0) {
    csv += 'PAYMENT METHOD BREAKDOWN\n';
    csv += 'Method,Count,Total Amount,Percentage,Success Rate\n';
    data.byMethod.forEach((method: any) => {
      csv += csvRow([method.method || 'Unknown', method.count || 0, method.totalAmount || 0, `${method.percentage || 0}%`, `${method.successRate || 0}%`]);
    });
    csv += csvRow(['TOTAL', data.byMethod.reduce((sum: number, m: any) => sum + (m.count || 0), 0), data.byMethod.reduce((sum: number, m: any) => sum + (m.totalAmount || 0), 0), '100%', '']);
    csv += '\n';
  }

  // Payment status breakdown
  if (data.byStatus && data.byStatus.length > 0) {
    csv += 'PAYMENT STATUS BREAKDOWN\n';
    csv += 'Status,Count,Total Amount,Percentage\n';
    data.byStatus.forEach((status: any) => {
      csv += csvRow([status.status || 'Unknown', status.count || 0, status.totalAmount || 0, `${status.percentage || 0}%`]);
    });
    csv += csvRow(['TOTAL', data.byStatus.reduce((sum: number, s: any) => sum + (s.count || 0), 0), data.byStatus.reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0), '100%']);
    csv += '\n';
  }

  return csv;
}

function generateVendorSpendingCSV(csv: string, data: any): string {
  // Summary metrics
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  csv += `Total Spending,${data.summary?.totalSpending || 0}\n`;
  csv += `Total Vendors,${data.summary?.totalVendors || 0}\n`;
  csv += `Average Spending per Vendor,${data.summary?.averageSpending || 0}\n`;
  csv += '\n';

  // Vendor spending table
  if (data.vendors && data.vendors.length > 0) {
    csv += 'VENDOR SPENDING DETAILS\n';
    csv += 'Vendor Name,Total Spent,Auctions Won,Average Bid,Payment Rate\n';
    data.vendors.forEach((vendor: any) => {
      csv += `"${vendor.businessName || 'Unknown'}",${vendor.totalSpent || 0},${vendor.auctionsWon || 0},${vendor.avgBid || 0},${vendor.paymentRate || 0}%\n`;
    });
    csv += '\n';
  }

  // Spending by asset type
  if (data.byAssetType && data.byAssetType.length > 0) {
    csv += 'SPENDING BY ASSET TYPE\n';
    csv += 'Asset Type,Total Spent,Count\n';
    data.byAssetType.forEach((asset: any) => {
      csv += `${asset.assetType || 'Unknown'},${asset.totalSpent || 0},${asset.count || 0}\n`;
    });
    csv += '\n';
  }

  return csv;
}

function generateProfitabilityCSV(csv: string, data: any): string {
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  if (data.summary) {
    csv += csvRow(['Total Cases', data.summary.totalCases || 0]);
    csv += csvRow(['Total Claims Paid', data.summary.totalClaimsPaid || 0]);
    csv += csvRow(['Total Salvage Recovered', data.summary.totalSalvageRecovered || 0]);
    csv += csvRow(['Total Net Loss', data.summary.totalNetLoss || 0]);
    csv += csvRow(['Average Recovery Rate', `${data.summary.averageRecoveryRate || 0}%`]);
    csv += csvRow(['ROI', `${data.summary.roi || 0}%`]);
  }
  csv += '\n';

  if (data.byBranch && data.byBranch.length > 0) {
    csv += 'BRANCH PROFITABILITY\n';
    csv += 'Branch,Cases,Claims Paid,Salvage Recovered,Net Loss,Recovery Rate,ROI\n';
    data.byBranch.forEach((branch: any) => {
      csv += csvRow([
        branch.label || branch.branchName || 'Unassigned',
        branch.count || 0,
        branch.claimsPaid || 0,
        branch.salvageRecovered || 0,
        branch.netLoss || 0,
        `${branch.recoveryRate || 0}%`,
        `${branch.roi || 0}%`,
      ]);
    });
    csv += '\n';
  }

  if (data.byBroker && data.byBroker.length > 0) {
    csv += 'BROKER / AGENCY PROFITABILITY\n';
    csv += 'Channel,Type,Cases,Claims Paid,Salvage Recovered,Net Loss,Recovery Rate,ROI\n';
    data.byBroker.forEach((broker: any) => {
      csv += csvRow([
        broker.label || broker.channelName || 'Unassigned',
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
    data.itemBreakdown.forEach((row: any) => {
      csv += csvRow([
        row.claimReference || '',
        row.policyNumber || '',
        row.branchName || '',
        row.channelLabel || '',
        row.assetType || '',
        row.marketValue || 0,
        row.salvageRecovery || 0,
        row.netLoss || 0,
        `${row.recoveryRate || 0}%`,
        `${row.roi || 0}%`,
        row.date || '',
      ]);
    });
    csv += '\n';
  }

  return csv;
}

function generateRevenueAnalysisCSV(csv: string, data: any): string {
  // Summary metrics
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  csv += `Total Revenue,${data.summary?.totalRevenue || 0}\n`;
  csv += `Average Recovery Rate,${data.summary?.averageRecoveryRate || 0}%\n`;
  csv += `Total Cases,${data.summary?.totalCases || 0}\n`;
  csv += '\n';

  // Revenue by asset type
  if (data.byAssetType && data.byAssetType.length > 0) {
    csv += 'REVENUE BY ASSET TYPE\n';
    csv += 'Asset Type,Claims Paid,Salvage Recovered,Count,Average Recovery Rate\n';
    data.byAssetType.forEach((asset: any) => {
      csv += `${asset.assetType || 'Unknown'},${asset.claimsPaid || 0},${asset.salvageRecovered || asset.revenue || 0},${asset.count || 0},${asset.recoveryRate || 0}%\n`;
    });
    csv += '\n';
  }

  if (data.byBranch && data.byBranch.length > 0) {
    csv += 'REVENUE BY BRANCH\n';
    csv += 'Branch,Claims Paid,Salvage Recovered,Net Loss,Count,Recovery Rate\n';
    data.byBranch.forEach((branch: any) => {
      csv += csvRow([
        branch.branchName || branch.label || 'Unassigned',
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
    data.byBroker.forEach((broker: any) => {
      csv += csvRow([
        broker.label || broker.channelName || 'Unassigned',
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
    data.itemBreakdown.forEach((row: any) => {
      csv += csvRow([
        row.claimReference || '',
        row.policyNumber || '',
        row.branchName || '',
        row.channelLabel || '',
        row.assetType || '',
        row.marketValue || 0,
        row.salvageRecovery || 0,
        row.netLoss || 0,
        `${row.recoveryRate || 0}%`,
        `${row.roi || 0}%`,
        row.date || '',
      ]);
    });
    csv += '\n';
  }

  // Revenue by period
  if (data.byPeriod && data.byPeriod.length > 0) {
    csv += 'REVENUE BY PERIOD\n';
    csv += 'Period,Revenue,Count\n';
    data.byPeriod.forEach((period: any) => {
      csv += `${period.period || 'Unknown'},${period.revenue || 0},${period.count || 0}\n`;
    });
    csv += '\n';
  }

  return csv;
}

function generateKPIDashboardCSV(csv: string, data: any): string {
  // Financial KPIs
  csv += 'FINANCIAL KPIs\n';
  csv += 'Metric,Value\n';
  if (data.financial) {
    csv += `Total Revenue,${data.financial.totalRevenue || 0}\n`;
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
    data.breakdowns.cases.forEach((c: any) => {
      csv += `${c.claimReference || ''},"${c.adjusterName || ''}","${c.branchName || 'Unassigned'}",${c.assetType || ''},${c.marketValue || 0},${c.processingTime || 0},${c.revenue || 0},${c.status || ''}\n`;
    });
    csv += '\n';
  }

  if (data.breakdowns?.branches && data.breakdowns.branches.length > 0) {
    csv += 'BRANCH RECOVERY BREAKDOWN\n';
    csv += 'Branch,Total Cases,Sold Cases,Claims Value,Verified Recovery,Recovery Rate\n';
    data.breakdowns.branches.forEach((branch: any) => {
      csv += `"${branch.branchName || 'Unassigned'}",${branch.totalCases || 0},${branch.soldCases || 0},${branch.claimsValue || 0},${branch.verifiedRecovery || 0},${branch.recoveryRate || 0}%\n`;
    });
    csv += '\n';
  }

  // Auctions breakdown
  if (data.breakdowns?.auctions && data.breakdowns.auctions.length > 0) {
    csv += 'AUCTIONS BREAKDOWN\n';
    csv += 'Case Reference,Bidders,Total Bids,Starting Bid,Winning Bid,Winner,Status\n';
    data.breakdowns.auctions.forEach((a: any) => {
      csv += `${a.caseReference || ''},${a.uniqueBidders || 0},${a.totalBids || 0},${a.startingBid || 0},${a.winningBid || 0},"${a.winnerName || '-'}",${a.status || ''}\n`;
    });
    csv += '\n';
  }

  // Adjusters breakdown
  if (data.breakdowns?.adjusters && data.breakdowns.adjusters.length > 0) {
    csv += 'ADJUSTERS BREAKDOWN\n';
    csv += 'Adjuster,Cases,Approved,Rejected,Approval Rate,Avg Time,Revenue,Quality Score\n';
    data.breakdowns.adjusters.forEach((adj: any) => {
      csv += `"${adj.name || ''}",${adj.totalCases || 0},${adj.approved || 0},${adj.rejected || 0},${adj.approvalRate || 0}%,${adj.avgProcessingTime || 0},${adj.revenue || 0},${adj.qualityScore || 0}\n`;
    });
    csv += '\n';
  }

  // Vendors breakdown
  if (data.breakdowns?.vendors && data.breakdowns.vendors.length > 0) {
    csv += 'VENDORS BREAKDOWN\n';
    csv += 'Vendor,Tier,Participated,Won,Win Rate,Total Spent,Avg Bid,Payment Rate\n';
    data.breakdowns.vendors.forEach((v: any) => {
      csv += `"${v.businessName || ''}",${v.tier || 0},${v.auctionsParticipated || 0},${v.auctionsWon || 0},${v.winRate || 0}%,${v.totalSpent || 0},${v.avgBid || 0},${v.paymentRate || 0}%\n`;
    });
    csv += '\n';
  }

  return csv;
}

function generateCaseProcessingCSV(csv: string, data: any): string {
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
    csv += csvRow(['Total Market Value', data.summary.totalMarketValue || 0]);
    csv += csvRow(['Total Salvage Value', data.summary.totalSalvageValue || 0]);
  }
  csv += '\n';

  if (data.byStatus && data.byStatus.length > 0) {
    csv += 'STATUS BREAKDOWN\n';
    csv += 'Status,Count,Percentage\n';
    data.byStatus.forEach((s: any) => {
      csv += csvRow([s.status || 'Unknown', s.count || 0, `${s.percentage || 0}%`]);
    });
    csv += '\n';
  }

  if (data.byBranch && data.byBranch.length > 0) {
    csv += 'BRANCH PROCESSING PERFORMANCE\n';
    csv += 'Branch,Cases Processed,Approved,Rejected,Approval Rate,Average Processing Days,Total Market Value,Total Salvage Value\n';
    data.byBranch.forEach((branch: any) => {
      csv += csvRow([
        branch.branchName || 'Unassigned',
        branch.casesProcessed || 0,
        branch.approvedCases || 0,
        branch.rejectedCases || 0,
        `${branch.approvalRate || 0}%`,
        branch.avgProcessingDays || 0,
        branch.totalMarketValue || 0,
        branch.totalSalvageValue || 0,
      ]);
    });
    csv += '\n';
  }

  if (data.byAssetType && data.byAssetType.length > 0) {
    csv += 'CASE DETAILS BY ASSET TYPE\n';
    csv += 'Asset Type,Claim Reference,Branch,Status,Market Value,Salvage Value,Processing Days,Created Date\n';
    data.byAssetType.forEach((asset: any) => {
      (asset.cases || []).forEach((c: any) => {
        csv += csvRow([asset.assetType || 'Unknown', c.claimReference || '', c.branchName || 'Unassigned', c.status || '', c.marketValue || 0, c.salvageValue || 0, c.processingDays || 0, c.createdAt || '']);
      });
    });
  }

  return csv;
}

function generateDocumentManagementCSV(csv: string, data: any): string {
  csv += 'DOCUMENT MANAGEMENT METRICS\n';
  csv += 'Metric,Value\n';
  if (data.summary) {
    csv += `Total Documents,${data.summary.totalDocuments || 0}\n`;
    csv += `Completion Rate,${data.summary.completionRate || 0}%\n`;
    csv += `Average Time to Complete,${data.summary.avgTimeToComplete || 0} hours\n`;
  }
  csv += '\n';

  if (data.documents && data.documents.length > 0) {
    csv += 'DOCUMENT DETAILS\n';
    csv += 'Case Reference,Document Type,Status,Completion Time\n';
    data.documents.forEach((d: any) => {
      csv += `${d.caseReference || ''},${d.documentType || ''},${d.status || ''},${d.completionTime || 0}\n`;
    });
  }

  return csv;
}

function generateAuctionPerformanceCSV(csv: string, data: any): string {
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
    data.byStatus.forEach((s: any) => {
      csv += csvRow([s.status || 'Unknown', s.count || 0, `${s.percentage || 0}%`]);
    });
    csv += '\n';
  }

  if (data.byBranch && data.byBranch.length > 0) {
    csv += 'BRANCH AUCTION PERFORMANCE\n';
    csv += 'Branch,Auctions,Successful,Success Rate,Total Revenue,Average Winning Bid,Average Bids\n';
    data.byBranch.forEach((branch: any) => {
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
    data.byBroker.forEach((broker: any) => {
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
    data.auctionList.forEach((a: any) => {
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
      data.auctionList.reduce((sum: number, a: any) => sum + (a.winningBid || 0), 0),
      '',
      data.auctionList.reduce((sum: number, a: any) => sum + (a.bidCount || 0), 0),
      '',
      '',
      '',
      '',
      '',
    ]);
  }

  return csv;
}

function generateVendorPerformanceCSV(csv: string, data: any): string {
  csv += 'VENDOR PERFORMANCE METRICS\n';
  csv += 'Metric,Value\n';
  if (data.summary) {
    csv += csvRow(['Total Vendors', data.summary.totalVendors || 0]);
    csv += csvRow(['Average Win Rate', `${data.summary.averageWinRate || data.summary.avgWinRate || 0}%`]);
    csv += csvRow(['Average Participation', `${data.summary.averageParticipationRate || 0}%`]);
  }
  csv += '\n';

  if (data.rankings && data.rankings.length > 0) {
    csv += 'VENDOR RANKINGS\n';
    csv += 'Rank,Vendor Name,Tier,Bids,Wins,Win Rate,Verified Spend,Completed Pickups,Pending Pickups,On-Time Pickup Rate,Average Pickup Hours\n';
    data.rankings.forEach((v: any) => {
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

  if (data.vendors && data.vendors.length > 0) {
    csv += 'VENDOR DETAILS\n';
    csv += 'Vendor Name,Tier,Participated,Won,Win Rate,Verified Spend,Payment Rate\n';
    data.vendors.forEach((v: any) => {
      csv += csvRow([
        v.businessName || v.vendorName || '',
        v.tier || 0,
        v.auctionsParticipated || v.totalBids || 0,
        v.auctionsWon || v.totalWins || 0,
        `${v.winRate || 0}%`,
        v.totalSpent || 0,
        `${v.paymentRate || 0}%`,
      ]);
    });
  }

  return csv;
}

function generateUserPerformanceCSV(csv: string, data: any, reportType: string): string {
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
    data.performance.forEach((p: any) => {
      csv += headers.map(h => {
        const val = p[h];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(',') + '\n';
    });
  }

  return csv;
}

function generateGenericCSV(csv: string, data: any): string {
  const branchRows =
    Array.isArray(data.byBranch) ? data.byBranch :
    Array.isArray(data.breakdowns?.branches) ? data.breakdowns.branches :
    Array.isArray(data.operational?.branches) ? data.operational.branches :
    [];

  if (branchRows.length > 0) {
    csv += 'BRANCH PERFORMANCE\n';
    csv += 'Branch,Cases,Claims Value,Verified Recovery,Recovery Rate\n';
    branchRows.forEach((branch: any) => {
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
