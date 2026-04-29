/**
 * PDF Generator Service
 * Generates properly formatted PDF files from report data
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

export interface PDFGeneratorOptions {
  reportType: string;
  reportTitle: string;
  data: any;
  filters?: {
    startDate?: string;
    endDate?: string;
  };
}

export class PDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;
  private readonly primaryColor = [128, 0, 32]; // #800020
  private readonly textColor = [31, 41, 55]; // #1f2937
  private readonly grayColor = [107, 114, 128]; // #6b7280

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  generate(options: PDFGeneratorOptions): ArrayBuffer {
    this.addHeader(options.reportTitle, options.filters);
    this.addContent(options.reportType, options.data);
    this.addFooter();
    
    // Use arraybuffer output for proper binary data
    return this.doc.output('arraybuffer');
  }

  private addHeader(title: string, filters?: { startDate?: string; endDate?: string }) {
    // Company logo area (placeholder)
    this.doc.setFillColor(...this.primaryColor);
    this.doc.rect(this.margin, this.margin, this.pageWidth - 2 * this.margin, 0.5, 'F');

    // Title
    this.doc.setFontSize(24);
    this.doc.setTextColor(...this.primaryColor);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.pageWidth / 2, this.margin + 15, { align: 'center' });

    // Subtitle
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.grayColor);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('NEM Insurance Salvage Management System', this.pageWidth / 2, this.margin + 22, { align: 'center' });

    // Metadata
    this.doc.setFontSize(9);
    const generatedDate = new Date().toLocaleString('en-NG', { 
      dateStyle: 'full', 
      timeStyle: 'short' 
    });
    this.doc.text(`Generated: ${generatedDate}`, this.pageWidth / 2, this.margin + 28, { align: 'center' });

    if (filters?.startDate && filters?.endDate) {
      const startDate = new Date(filters.startDate).toLocaleDateString('en-NG', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      const endDate = new Date(filters.endDate).toLocaleDateString('en-NG', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      this.doc.text(`Date Range: ${startDate} - ${endDate}`, this.pageWidth / 2, this.margin + 33, { align: 'center' });
      this.currentY = this.margin + 40;
    } else {
      this.currentY = this.margin + 35;
    }

    // Separator line
    this.doc.setDrawColor(...this.primaryColor);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 10;
  }

  private addContent(reportType: string, data: any) {
    switch (reportType) {
      case 'master-report':
      case 'kpi-dashboard':
        this.addKPIDashboardContent(data);
        break;
      case 'revenue-analysis':
        this.addRevenueAnalysisContent(data);
        break;
      case 'profitability':
        this.addProfitabilityContent(data);
        break;
      case 'payment-analytics':
        this.addPaymentAnalyticsContent(data);
        break;
      case 'vendor-spending':
        this.addVendorSpendingContent(data);
        break;
      case 'auction-performance':
        this.addAuctionPerformanceContent(data);
        break;
      case 'case-processing':
        this.addCaseProcessingContent(data);
        break;
      case 'vendor-performance':
        this.addVendorPerformanceContent(data);
        break;
      case 'document-management':
        this.addDocumentManagementContent(data);
        break;
      case 'my-performance':
      case 'adjusters':
      case 'finance':
      case 'managers':
      case 'team-performance':
        this.addUserPerformanceContent(data);
        break;
      default:
        this.addGenericContent(data);
    }
  }

  private addKPIDashboardContent(data: any) {
    const financial = data.financial || {};
    const operational = data.operational || {};
    const performance = data.performance || {};

    // Financial Performance Section
    this.addSectionTitle('Financial Performance');
    this.addMetricsGrid([
      { label: 'Total Revenue', value: this.formatCurrency(financial.totalRevenue || 0), highlight: true },
      { label: 'Average Recovery Rate', value: `${financial.averageRecoveryRate || 0}%` },
      { label: 'Profit Margin', value: `${financial.profitMargin || 0}%` },
      { label: 'Revenue Growth', value: `${(financial.revenueGrowth || 0).toFixed(2)}%` },
    ]);

    // Operational Performance Section
    this.addSectionTitle('Operational Performance');
    this.addMetricsGrid([
      { label: 'Total Cases', value: `${operational.totalCases || 0}` },
      { label: 'Case Processing Time', value: `${(operational.caseProcessingTime || 0).toFixed(2)} days` },
      { label: 'Auction Success Rate', value: `${operational.auctionSuccessRate || 0}%` },
      { label: 'Vendor Participation Rate', value: `${operational.vendorParticipationRate || 0}%` },
    ]);

    // Team Performance Section
    this.addSectionTitle('Team Performance');
    this.addMetricsGrid([
      { label: 'Top Adjuster Performance', value: `${performance.topAdjusterPerformance || 0} cases` },
      { label: 'Average Adjuster Performance', value: `${(performance.averageAdjusterPerformance || 0).toFixed(2)} cases` },
      { label: 'Payment Verification Rate', value: `${(performance.paymentVerificationRate || 0).toFixed(2)}%` },
      { label: 'Document Completion Rate', value: `${performance.documentCompletionRate || 0}%` },
    ]);

    // Add tables if data exists
    if (data.breakdowns?.adjusters && data.breakdowns.adjusters.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Adjuster Performance');
      this.addTable(
        ['Adjuster', 'Cases', 'Approved', 'Approval Rate', 'Avg Time', 'Revenue', 'Quality'],
        data.breakdowns.adjusters.slice(0, 20).map((adj: any) => [
          adj.name,
          adj.totalCases.toString(),
          adj.approved.toString(),
          `${adj.approvalRate}%`,
          `${adj.avgProcessingTime.toFixed(1)}d`,
          this.formatCurrency(adj.revenue),
          adj.qualityScore.toFixed(1),
        ])
      );
    }

    if (data.breakdowns?.vendors && data.breakdowns.vendors.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Vendor Performance');
      this.addTable(
        ['Vendor', 'Participated', 'Won', 'Win Rate', 'Total Spent', 'Avg Bid', 'Payment Rate'],
        data.breakdowns.vendors.slice(0, 20).map((vendor: any) => [
          vendor.businessName,
          vendor.auctionsParticipated.toString(),
          vendor.auctionsWon.toString(),
          `${vendor.winRate.toFixed(1)}%`,
          this.formatCurrency(vendor.totalSpent),
          this.formatCurrency(vendor.avgBid),
          `${vendor.paymentRate.toFixed(1)}%`,
        ])
      );
    }
  }

  private addRevenueAnalysisContent(data: any) {
    this.addSectionTitle('Revenue Summary');
    this.addMetricsGrid([
      { label: 'Total Revenue', value: this.formatCurrency(data.totalRevenue || 0), highlight: true },
      { label: 'Average Recovery Rate', value: `${data.averageRecoveryRate || 0}%` },
      { label: 'Revenue Growth', value: `${(data.revenueGrowth || 0).toFixed(2)}%` },
      { label: 'Total Cases', value: `${data.totalCases || 0}` },
    ]);

    if (data.revenueByMonth && data.revenueByMonth.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Revenue by Month');
      this.addTable(
        ['Month', 'Revenue', 'Cases', 'Avg per Case'],
        data.revenueByMonth.map((item: any) => [
          new Date(item.month).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' }),
          this.formatCurrency(item.revenue),
          item.cases?.toString() || '0',
          this.formatCurrency(item.avgPerCase || 0),
        ])
      );
    }
  }

  private addProfitabilityContent(data: any) {
    this.addSectionTitle('Profitability Summary');
    this.addMetricsGrid([
      { label: 'Total Revenue', value: this.formatCurrency(data.totalRevenue || 0), highlight: true },
      { label: 'Total Costs', value: this.formatCurrency(data.totalCosts || 0) },
      { label: 'Net Profit', value: this.formatCurrency(data.netProfit || 0) },
      { label: 'Profit Margin', value: `${(data.profitMargin || 0).toFixed(2)}%` },
    ]);
  }

  private addPaymentAnalyticsContent(data: any) {
    this.addSectionTitle('Payment Analytics Summary');
    this.addMetricsGrid([
      { label: 'Total Payments', value: `${data.totalPayments || 0}` },
      { label: 'Total Amount', value: this.formatCurrency(data.totalAmount || 0), highlight: true },
      { label: 'Average Payment', value: this.formatCurrency(data.averagePayment || 0) },
      { label: 'Success Rate', value: `${(data.successRate || 0).toFixed(2)}%` },
    ]);
  }

  private addVendorSpendingContent(data: any) {
    this.addSectionTitle('Vendor Spending Summary');
    this.addMetricsGrid([
      { label: 'Total Spending', value: this.formatCurrency(data.totalSpending || 0), highlight: true },
      { label: 'Active Vendors', value: `${data.activeVendors || 0}` },
      { label: 'Average Spend', value: this.formatCurrency(data.averageSpend || 0) },
      { label: 'Payment Rate', value: `${(data.paymentRate || 0).toFixed(2)}%` },
    ]);
  }

  private addAuctionPerformanceContent(data: any) {
    const summary = data.summary || {};
    
    this.addSectionTitle('Auction Performance Summary');
    this.addMetricsGrid([
      { label: 'Total Auctions', value: `${summary.totalAuctions || 0}`, highlight: true },
      { label: 'Success Rate', value: `${summary.successRate || 0}%` },
      { label: 'Avg Bids/Auction', value: `${summary.averageBidsPerAuction || 0}` },
      { label: 'Total Revenue', value: this.formatCurrency(summary.totalRevenue || 0) },
    ]);

    if (data.byAssetType && data.byAssetType.length > 0) {
      this.checkPageBreak(60);
      this.addSectionTitle('Performance by Asset Type');
      this.addTable(
        ['Asset Type', 'Count', 'Success Rate', 'Avg Bids', 'Total Revenue'],
        data.byAssetType.map((item: any) => [
          item.assetType,
          item.count.toString(),
          `${item.successRate}%`,
          item.averageBids.toString(),
          this.formatCurrency(item.totalRevenue),
        ])
      );
    }
  }

  private addCaseProcessingContent(data: any) {
    this.addSectionTitle('Case Processing Summary');
    this.addMetricsGrid([
      { label: 'Total Cases', value: `${data.totalCases || 0}`, highlight: true },
      { label: 'Avg Processing Time', value: `${(data.avgProcessingTime || 0).toFixed(2)} days` },
      { label: 'Approval Rate', value: `${(data.approvalRate || 0).toFixed(2)}%` },
      { label: 'Quality Score', value: `${(data.qualityScore || 0).toFixed(2)}` },
    ]);
  }

  private addVendorPerformanceContent(data: any) {
    this.addSectionTitle('Vendor Performance Summary');
    this.addMetricsGrid([
      { label: 'Active Vendors', value: `${data.activeVendors || 0}`, highlight: true },
      { label: 'Avg Participation', value: `${(data.avgParticipation || 0).toFixed(2)}%` },
      { label: 'Avg Win Rate', value: `${(data.avgWinRate || 0).toFixed(2)}%` },
      { label: 'Total Spent', value: this.formatCurrency(data.totalSpent || 0) },
    ]);
  }

  private addDocumentManagementContent(data: any) {
    this.addSectionTitle('Document Management Summary');
    this.addMetricsGrid([
      { label: 'Total Documents', value: `${data.totalDocuments || 0}`, highlight: true },
      { label: 'Completion Rate', value: `${(data.completionRate || 0).toFixed(2)}%` },
      { label: 'Avg Generation Time', value: `${(data.avgGenerationTime || 0).toFixed(2)} mins` },
      { label: 'Compliance Rate', value: `${(data.complianceRate || 0).toFixed(2)}%` },
    ]);
  }

  private addUserPerformanceContent(data: any) {
    this.addSectionTitle('Performance Summary');
    this.addMetricsGrid([
      { label: 'Total Cases', value: `${data.totalCases || 0}`, highlight: true },
      { label: 'Approval Rate', value: `${(data.approvalRate || 0).toFixed(2)}%` },
      { label: 'Avg Processing Time', value: `${(data.avgProcessingTime || 0).toFixed(2)} days` },
      { label: 'Quality Score', value: `${(data.qualityScore || 0).toFixed(2)}` },
    ]);
  }

  private addGenericContent(data: any) {
    this.addSectionTitle('Report Data');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.textColor);
    this.doc.text('Report data available. Please contact support for detailed formatting.', this.margin, this.currentY);
    this.currentY += 10;
  }

  private addSectionTitle(title: string) {
    this.checkPageBreak(20);
    this.doc.setFontSize(14);
    this.doc.setTextColor(...this.primaryColor);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.currentY);
    this.currentY += 8;
  }

  private addMetricsGrid(metrics: Array<{ label: string; value: string; highlight?: boolean }>) {
    const cols = 2;
    const rows = Math.ceil(metrics.length / cols);
    const colWidth = (this.pageWidth - 2 * this.margin) / cols;
    const rowHeight = 20;

    this.checkPageBreak(rows * rowHeight + 10);

    metrics.forEach((metric, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = this.margin + col * colWidth;
      const y = this.currentY + row * rowHeight;

      // Background
      if (metric.highlight) {
        this.doc.setFillColor(254, 242, 242); // Light red background
        this.doc.rect(x + 2, y - 5, colWidth - 4, rowHeight - 2, 'F');
      } else {
        this.doc.setFillColor(249, 250, 251); // Light gray background
        this.doc.rect(x + 2, y - 5, colWidth - 4, rowHeight - 2, 'F');
      }

      // Border
      this.doc.setDrawColor(229, 231, 235);
      this.doc.setLineWidth(0.1);
      this.doc.rect(x + 2, y - 5, colWidth - 4, rowHeight - 2);

      // Label
      this.doc.setFontSize(9);
      this.doc.setTextColor(...this.grayColor);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(metric.label, x + 5, y);

      // Value
      this.doc.setFontSize(14);
      this.doc.setTextColor(...this.textColor);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(metric.value, x + 5, y + 8);
    });

    this.currentY += rows * rowHeight + 10;
  }

  private addTable(headers: string[], rows: string[][]) {
    this.checkPageBreak(60);

    (this.doc as any).autoTable({
      startY: this.currentY,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: this.primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: this.textColor,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      margin: { left: this.margin, right: this.margin },
      tableWidth: 'auto',
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addFooter() {
    const pageCount = (this.doc as any).internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Footer line
      this.doc.setDrawColor(...this.grayColor);
      this.doc.setLineWidth(0.1);
      this.doc.line(this.margin, this.pageHeight - 15, this.pageWidth - this.margin, this.pageHeight - 15);
      
      // Footer text
      this.doc.setFontSize(8);
      this.doc.setTextColor(...this.grayColor);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(
        'NEM Insurance Salvage Management System | Confidential',
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
      
      // Page number
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.pageWidth - this.margin,
        this.pageHeight - 10,
        { align: 'right' }
      );
    }
  }

  private checkPageBreak(requiredSpace: number) {
    if (this.currentY + requiredSpace > this.pageHeight - 25) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  private formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}

export function generatePDFFilename(reportType: string, filters?: { startDate?: string; endDate?: string }): string {
  const reportName = reportType
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('_');
  
  if (filters?.startDate && filters?.endDate) {
    const start = new Date(filters.startDate).toISOString().split('T')[0];
    const end = new Date(filters.endDate).toISOString().split('T')[0];
    return `${reportName}_${start}_to_${end}.pdf`;
  }
  
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${reportName}_${date}.pdf`;
}
