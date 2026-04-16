/**
 * PDF Export API
 * 
 * POST /api/reports/export/pdf
 * 
 * Returns print-friendly HTML that replicates the exact visual appearance
 * of report pages. Users can use browser's Print > Save as PDF functionality.
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

    // Generate print-friendly HTML that matches the page layout
    const html = generatePrintableHTML(reportType, data, filters);
    
    // Return HTML that user can print to PDF
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}

function generatePrintableHTML(reportType: string, data: any, filters: any): string {
  const title = reportType.replace(/-/g, ' ').toUpperCase() + ' Report';
  const formatCurrency = (amount: number) => `₦${amount?.toLocaleString() || '0'}`;
  const formatPercent = (value: number) => `${value?.toFixed(1) || '0'}%`;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #1f2937;
      background: white;
      padding: 2rem;
    }
    
    .header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 3px solid #800020;
    }
    
    .header h1 {
      color: #800020;
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    
    .header .metadata {
      color: #6b7280;
      font-size: 0.875rem;
    }
    
    .section {
      margin-bottom: 2rem;
      page-break-inside: avoid;
    }
    
    .section-title {
      color: #800020;
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .kpi-card {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem;
      background: #f9fafb;
    }
    
    .kpi-card.primary {
      border-left: 4px solid #800020;
    }
    
    .kpi-label {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }
    
    .kpi-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #1f2937;
    }
    
    .kpi-change {
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
    
    .kpi-change.positive {
      color: #059669;
    }
    
    .kpi-change.negative {
      color: #dc2626;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
      font-size: 0.875rem;
    }
    
    thead {
      background: #800020;
      color: white;
    }
    
    th {
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
    }
    
    td {
      padding: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }
    
    tbody tr:nth-child(even) {
      background: #f9fafb;
    }
    
    tbody tr:hover {
      background: #f3f4f6;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .font-bold {
      font-weight: 600;
    }
    
    .text-green {
      color: #059669;
    }
    
    .text-red {
      color: #dc2626;
    }
    
    .text-yellow {
      color: #d97706;
    }
    
    .capitalize {
      text-transform: capitalize;
    }
    
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 0.875rem;
    }
    
    .print-button {
      position: fixed;
      top: 1rem;
      right: 1rem;
      padding: 0.75rem 1.5rem;
      background: #800020;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
    }
    
    .print-button:hover {
      background: #600018;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .print-button {
        display: none;
      }
      
      .section {
        page-break-inside: avoid;
      }
      
      @page {
        margin: 1.5cm;
      }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ Print to PDF</button>
  
  <div class="header">
    <h1>${title}</h1>
    <div class="metadata">
      <p>Generated: ${new Date().toLocaleString()}</p>
      ${filters?.startDate && filters?.endDate ? `
        <p>Date Range: ${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}</p>
      ` : ''}
    </div>
  </div>

  ${generateExecutiveSummary(data, formatCurrency, formatPercent)}
  ${generateFinancialSection(data, formatCurrency, formatPercent)}
  ${generateOperationalSection(data, formatCurrency, formatPercent)}
  ${generatePerformanceSection(data, formatCurrency, formatPercent)}
  
  <div class="footer">
    <p>NEM Insurance Salvage Management System</p>
    <p>Report Version: ${data?.metadata?.reportVersion || '1.0'}</p>
  </div>
  
  <script>
    // Auto-print on load (optional - can be removed if not desired)
    // window.onload = () => setTimeout(() => window.print(), 500);
  </script>
</body>
</html>
  `.trim();
}

function generateExecutiveSummary(data: any, formatCurrency: Function, formatPercent: Function): string {
  if (!data?.executiveSummary) return '';
  
  const summary = data.executiveSummary;
  
  return `
  <div class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="kpi-grid">
      <div class="kpi-card primary">
        <div class="kpi-label">Total Revenue</div>
        <div class="kpi-value">${formatCurrency(summary.totalRevenue)}</div>
        <div class="kpi-change ${summary.revenueGrowth >= 0 ? 'positive' : 'negative'}">
          ${summary.revenueGrowth >= 0 ? '↑' : '↓'} ${formatPercent(Math.abs(summary.revenueGrowth))}
        </div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Total Cases</div>
        <div class="kpi-value">${summary.totalCases}</div>
        <div class="kpi-change ${summary.caseGrowth >= 0 ? 'positive' : 'negative'}">
          ${summary.caseGrowth >= 0 ? '↑' : '↓'} ${formatPercent(Math.abs(summary.caseGrowth))}
        </div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Auction Success Rate</div>
        <div class="kpi-value">${formatPercent(summary.auctionSuccessRate)}</div>
        <div class="kpi-label">Closed with winner</div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Avg Processing Time</div>
        <div class="kpi-value">${summary.avgProcessingTime?.toFixed(1) || '0'}</div>
        <div class="kpi-label">days</div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">System Health</div>
        <div class="kpi-value text-green">${summary.systemHealth}</div>
        <div class="kpi-label">score</div>
      </div>
    </div>
  </div>
  `;
}

function generateFinancialSection(data: any, formatCurrency: Function, formatPercent: Function): string {
  if (!data?.financial) return '';
  
  const financial = data.financial;
  
  return `
  <div class="section">
    <h2 class="section-title">Financial Performance</h2>
    
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Gross Profit</div>
        <div class="kpi-value">${formatCurrency(financial.profitability?.grossProfit || 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Profit Margin</div>
        <div class="kpi-value">${formatPercent(financial.profitability?.profitMargin || 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Operational Costs</div>
        <div class="kpi-value">${formatCurrency(financial.profitability?.operationalCosts || 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Net Profit</div>
        <div class="kpi-value text-green">${formatCurrency(financial.profitability?.netProfit || 0)}</div>
      </div>
    </div>
    
    ${financial.revenue?.topCases?.length > 0 ? `
    <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.125rem;">Top Revenue Cases</h3>
    <table>
      <thead>
        <tr>
          <th>Claim Reference</th>
          <th>Asset Type</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${financial.revenue.topCases.slice(0, 10).map((c: any) => `
          <tr>
            <td class="font-bold">${c.claimRef}</td>
            <td class="capitalize">${c.assetType}</td>
            <td class="text-right font-bold">${formatCurrency(c.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    ${financial.recovery ? `
    <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.125rem;">Recovery Rate Analysis</h3>
    <div class="kpi-card">
      <div class="kpi-label">Average Recovery Rate</div>
      <div class="kpi-value">${formatPercent(financial.recovery.averageRate)}</div>
      <div class="kpi-label">of market value</div>
    </div>
    ` : ''}
  </div>
  `;
}

function generateOperationalSection(data: any, formatCurrency: Function, formatPercent: Function): string {
  if (!data?.operational) return '';
  
  const operational = data.operational;
  
  return `
  <div class="section">
    <h2 class="section-title">Operational Performance</h2>
    
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Cases</div>
        <div class="kpi-value">${operational.cases?.total || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Auctions</div>
        <div class="kpi-value">${operational.auctions?.total || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Auction Success Rate</div>
        <div class="kpi-value text-green">${formatPercent(operational.auctions?.successRate || 0)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Documents Generated</div>
        <div class="kpi-value">${operational.documents?.totalGenerated || 0}</div>
      </div>
    </div>
    
    ${operational.auctions?.topAuctions?.length > 0 ? `
    <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.125rem;">Top Performing Auctions</h3>
    <table>
      <thead>
        <tr>
          <th>Claim Reference</th>
          <th class="text-center">Bidders</th>
          <th class="text-center">Total Bids</th>
          <th class="text-right">Winning Bid</th>
        </tr>
      </thead>
      <tbody>
        ${operational.auctions.topAuctions.slice(0, 10).map((a: any) => `
          <tr>
            <td class="font-bold">${a.claimRef}</td>
            <td class="text-center">${a.bidders}</td>
            <td class="text-center">${a.bids}</td>
            <td class="text-right font-bold">${formatCurrency(parseFloat(a.winningBid))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
  </div>
  `;
}

function generatePerformanceSection(data: any, formatCurrency: Function, formatPercent: Function): string {
  if (!data?.performance) return '';
  
  const performance = data.performance;
  
  return `
  <div class="section">
    <h2 class="section-title">Team Performance</h2>
    
    ${performance.teamMetrics ? `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Adjusters</div>
        <div class="kpi-value">${performance.teamMetrics.totalAdjusters}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg Quality Score</div>
        <div class="kpi-value">${performance.teamMetrics.avgQualityScore?.toFixed(1) || '0'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Top Performer</div>
        <div class="kpi-value" style="font-size: 1rem;">${performance.teamMetrics.topPerformer}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Active Vendors</div>
        <div class="kpi-value">${performance.teamMetrics.activeVendors}</div>
      </div>
    </div>
    ` : ''}
    
    ${performance.adjusters?.length > 0 ? `
    <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.125rem;">Claims Adjusters Performance</h3>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th class="text-center">Cases</th>
          <th class="text-center">Approval Rate</th>
          <th class="text-center">Avg Time (days)</th>
          <th class="text-right">Revenue</th>
          <th class="text-center">Quality Score</th>
        </tr>
      </thead>
      <tbody>
        ${performance.adjusters.slice(0, 10).map((adj: any) => `
          <tr>
            <td class="font-bold">${adj.name}</td>
            <td class="text-center">${adj.casesProcessed}</td>
            <td class="text-center ${adj.approvalRate >= 80 ? 'text-green' : ''}">${formatPercent(adj.approvalRate)}</td>
            <td class="text-center">${adj.avgProcessingTime?.toFixed(1) || '0'}</td>
            <td class="text-right font-bold">${formatCurrency(adj.revenue)}</td>
            <td class="text-center ${adj.qualityScore >= 80 ? 'text-green' : adj.qualityScore >= 60 ? 'text-yellow' : 'text-red'}">${adj.qualityScore?.toFixed(1) || '0'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    ${performance.vendors?.length > 0 ? `
    <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1.125rem;">Vendor Performance</h3>
    <table>
      <thead>
        <tr>
          <th>Business Name</th>
          <th class="text-center">Tier</th>
          <th class="text-center">Participated</th>
          <th class="text-center">Won</th>
          <th class="text-center">Win Rate</th>
          <th class="text-right">Total Spent</th>
        </tr>
      </thead>
      <tbody>
        ${performance.vendors.slice(0, 10).map((v: any) => `
          <tr>
            <td class="font-bold">${v.businessName}</td>
            <td class="text-center">Tier ${v.tier}</td>
            <td class="text-center">${v.auctionsParticipated}</td>
            <td class="text-center">${v.auctionsWon}</td>
            <td class="text-center ${v.winRate >= 50 ? 'text-green' : ''}">${formatPercent(v.winRate)}</td>
            <td class="text-right font-bold">${formatCurrency(v.totalSpent)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
  </div>
  `;
}


