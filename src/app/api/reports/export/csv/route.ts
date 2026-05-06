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

function generatePaymentAnalyticsCSV(csv: string, data: any): string {
  // Summary metrics
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  csv += `Total Payments,${data.summary?.totalPayments || 0}\n`;
  csv += `Total Amount,${data.summary?.totalAmount || 0}\n`;
  csv += `Success Rate,${data.summary?.successRate || 0}%\n`;
  csv += `Average Payment Time,${data.summary?.averagePaymentTime || 0} hours\n`;
  csv += '\n';

  // Payment method breakdown
  if (data.byMethod && data.byMethod.length > 0) {
    csv += 'PAYMENT METHOD BREAKDOWN\n';
    csv += 'Method,Count,Total Amount,Percentage,Success Rate\n';
    data.byMethod.forEach((method: any) => {
      csv += `${method.method || 'Unknown'},${method.count || 0},${method.totalAmount || 0},${method.percentage || 0}%,${method.successRate || 0}%\n`;
    });
    csv += '\n';
  }

  // Payment status breakdown
  if (data.byStatus && data.byStatus.length > 0) {
    csv += 'PAYMENT STATUS BREAKDOWN\n';
    csv += 'Status,Count,Total Amount,Percentage\n';
    data.byStatus.forEach((status: any) => {
      csv += `${status.status || 'Unknown'},${status.count || 0},${status.totalAmount || 0},${status.percentage || 0}%\n`;
    });
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
  // Summary metrics
  csv += 'SUMMARY METRICS\n';
  csv += 'Metric,Value\n';
  csv += `Total Revenue,${data.summary?.totalRevenue || 0}\n`;
  csv += `Total Costs,${data.summary?.totalCosts || 0}\n`;
  csv += `Net Profit,${data.summary?.netProfit || 0}\n`;
  csv += `Profit Margin,${data.summary?.profitMargin || 0}%\n`;
  csv += '\n';

  // Cost breakdown
  if (data.costs && data.costs.length > 0) {
    csv += 'COST BREAKDOWN\n';
    csv += 'Category,Amount,Percentage\n';
    data.costs.forEach((cost: any) => {
      csv += `${cost.category || 'Unknown'},${cost.amount || 0},${cost.percentage || 0}%\n`;
    });
    csv += '\n';
  }

  // Revenue breakdown
  if (data.revenue && data.revenue.length > 0) {
    csv += 'REVENUE BREAKDOWN\n';
    csv += 'Source,Amount,Percentage\n';
    data.revenue.forEach((rev: any) => {
      csv += `${rev.source || 'Unknown'},${rev.amount || 0},${rev.percentage || 0}%\n`;
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
    csv += 'Asset Type,Revenue,Count,Average Recovery Rate\n';
    data.byAssetType.forEach((asset: any) => {
      csv += `${asset.assetType || 'Unknown'},${asset.revenue || 0},${asset.count || 0},${asset.recoveryRate || 0}%\n`;
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
    csv += 'Claim Reference,Adjuster,Asset Type,Market Value,Processing Time,Revenue,Status\n';
    data.breakdowns.cases.forEach((c: any) => {
      csv += `${c.claimReference || ''},"${c.adjusterName || ''}",${c.assetType || ''},${c.marketValue || 0},${c.processingTime || 0},${c.revenue || 0},${c.status || ''}\n`;
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
    csv += `Total Cases,${data.summary.totalCases || 0}\n`;
    csv += `Average Processing Time,${data.summary.avgProcessingTime || 0} hours\n`;
    csv += `Approval Rate,${data.summary.approvalRate || 0}%\n`;
  }
  csv += '\n';

  if (data.cases && data.cases.length > 0) {
    csv += 'CASE DETAILS\n';
    csv += 'Claim Reference,Adjuster,Asset Type,Status,Processing Time,Created Date\n';
    data.cases.forEach((c: any) => {
      csv += `${c.claimReference || ''},"${c.adjusterName || ''}",${c.assetType || ''},${c.status || ''},${c.processingTime || 0},${c.createdAt || ''}\n`;
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
    csv += `Total Auctions,${data.summary.totalAuctions || 0}\n`;
    csv += `Success Rate,${data.summary.successRate || 0}%\n`;
    csv += `Average Bids per Auction,${data.summary.avgBidsPerAuction || 0}\n`;
  }
  csv += '\n';

  if (data.auctions && data.auctions.length > 0) {
    csv += 'AUCTION DETAILS\n';
    csv += 'Case Reference,Starting Bid,Winning Bid,Bidders,Total Bids,Status\n';
    data.auctions.forEach((a: any) => {
      csv += `${a.caseReference || ''},${a.startingBid || 0},${a.winningBid || 0},${a.uniqueBidders || 0},${a.totalBids || 0},${a.status || ''}\n`;
    });
  }

  return csv;
}

function generateVendorPerformanceCSV(csv: string, data: any): string {
  csv += 'VENDOR PERFORMANCE METRICS\n';
  csv += 'Metric,Value\n';
  if (data.summary) {
    csv += `Total Vendors,${data.summary.totalVendors || 0}\n`;
    csv += `Average Win Rate,${data.summary.avgWinRate || 0}%\n`;
    csv += `Average Payment Rate,${data.summary.avgPaymentRate || 0}%\n`;
  }
  csv += '\n';

  if (data.vendors && data.vendors.length > 0) {
    csv += 'VENDOR DETAILS\n';
    csv += 'Vendor Name,Tier,Participated,Won,Win Rate,Total Spent,Payment Rate\n';
    data.vendors.forEach((v: any) => {
      csv += `"${v.businessName || ''}",${v.tier || 0},${v.auctionsParticipated || 0},${v.auctionsWon || 0},${v.winRate || 0}%,${v.totalSpent || 0},${v.paymentRate || 0}%\n`;
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
  // Fallback for unknown report types
  csv += 'REPORT DATA\n';
  csv += JSON.stringify(data, null, 2);
  return csv;
}
