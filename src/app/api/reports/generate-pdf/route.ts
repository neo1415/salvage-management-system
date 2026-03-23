import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';

/**
 * POST /api/reports/generate-pdf
 * Generate mobile-optimized PDF report from report data
 * 
 * Request Body:
 * - reportType: 'recovery-summary' | 'vendor-rankings' | 'payment-aging'
 * - data: report data object
 * - title: report title
 * - dateRange: { start: string, end: string }
 * 
 * Returns:
 * - PDF file as application/pdf (< 2MB)
 * 
 * Note: This implementation uses a simple HTML-based approach.
 * For production, consider using a dedicated PDF library like pdfkit or puppeteer.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !['salvage_manager', 'finance_officer', 'system_admin'].includes(session.user.role)) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Only Salvage Managers, Finance Officers, and Admins can generate reports',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { reportType, data, title, dateRange } = body;

    if (!reportType || !data || !title) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'reportType, data, and title are required',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    // Generate HTML content based on report type
    let htmlContent = '';

    switch (reportType) {
      case 'recovery-summary':
        htmlContent = generateRecoverySummaryHTML(data, title, dateRange);
        break;
      case 'vendor-rankings':
        htmlContent = generateVendorRankingsHTML(data, title, dateRange);
        break;
      case 'payment-aging':
        htmlContent = generatePaymentAgingHTML(data, title, dateRange);
        break;
      default:
        return NextResponse.json(
          {
            status: 'error',
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid reportType. Must be recovery-summary, vendor-rankings, or payment-aging',
              timestamp: new Date().toISOString(),
            },
          },
          { status: 400 }
        );
    }

    // For now, return HTML that can be printed to PDF by the browser
    // In production, use a library like puppeteer or pdfkit for server-side PDF generation
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="${reportType}-${Date.now()}.html"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate PDF report',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

function generateRecoverySummaryHTML(
  data: {
    summary: {
      totalCases: number;
      totalMarketValue: number;
      totalRecoveryValue: number;
      averageRecoveryRate: number;
      dateRange: { start: string; end: string };
    };
    byAssetType: Array<{
      assetType: string;
      count: number;
      marketValue: number;
      recoveryValue: number;
      recoveryRate: number;
    }>;
    trend: Array<{
      date: string;
      marketValue: number;
      recoveryValue: number;
      recoveryRate: number;
      count: number;
    }>;
  },
  title: string,
  dateRange: { start: string; end: string }
): string {
  const { summary, byAssetType, trend } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @media print {
      @page { size: A4; margin: 1cm; }
      body { margin: 0; }
    }
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-size: 12px;
      line-height: 1.4;
    }
    h1 { color: #800020; font-size: 20px; margin-bottom: 10px; }
    h2 { color: #800020; font-size: 16px; margin-top: 20px; margin-bottom: 10px; }
    .header { border-bottom: 2px solid #800020; padding-bottom: 10px; margin-bottom: 20px; }
    .date-range { color: #666; font-size: 11px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; }
    .summary-card { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .summary-label { font-size: 10px; color: #666; text-transform: uppercase; }
    .summary-value { font-size: 18px; font-weight: bold; color: #800020; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    th { background: #800020; color: white; padding: 8px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="date-range">
      Period: ${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}
    </div>
    <div class="date-range">Generated: ${new Date().toLocaleString()}</div>
  </div>

  <h2>Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Cases</div>
      <div class="summary-value">${summary.totalCases}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Recovery Rate</div>
      <div class="summary-value">${summary.averageRecoveryRate.toFixed(2)}%</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Market Value</div>
      <div class="summary-value">₦${summary.totalMarketValue.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Recovery Value</div>
      <div class="summary-value">₦${summary.totalRecoveryValue.toLocaleString()}</div>
    </div>
  </div>

  <h2>Recovery by Asset Type</h2>
  <table>
    <thead>
      <tr>
        <th>Asset Type</th>
        <th>Count</th>
        <th>Market Value</th>
        <th>Recovery Value</th>
        <th>Recovery Rate</th>
      </tr>
    </thead>
    <tbody>
      ${byAssetType
        .map(
          (item: any) => `
        <tr>
          <td style="text-transform: capitalize;">${item.assetType}</td>
          <td>${item.count}</td>
          <td>₦${item.marketValue.toLocaleString()}</td>
          <td>₦${item.recoveryValue.toLocaleString()}</td>
          <td>${item.recoveryRate.toFixed(2)}%</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  ${
    trend.length > 0
      ? `
  <h2>Daily Recovery Trend</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Cases</th>
        <th>Market Value</th>
        <th>Recovery Value</th>
        <th>Recovery Rate</th>
      </tr>
    </thead>
    <tbody>
      ${trend
        .map(
          (item: any) => `
        <tr>
          <td>${new Date(item.date).toLocaleDateString()}</td>
          <td>${item.count}</td>
          <td>₦${item.marketValue.toLocaleString()}</td>
          <td>₦${item.recoveryValue.toLocaleString()}</td>
          <td>${item.recoveryRate.toFixed(2)}%</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  `
      : ''
  }

  <div class="footer">
    <p>NEM Insurance Plc - Salvage Management System</p>
    <p>199 Ikorodu Road, Obanikoro, Lagos | Phone: 234-02-014489560</p>
  </div>

  <script>
    // Auto-print when loaded (optional)
    // window.onload = () => window.print();
  </script>
</body>
</html>
  `;
}

function generateVendorRankingsHTML(
  data: {
    rankings: Array<{
      rank: number;
      vendorId: string;
      businessName: string;
      fullName: string;
      tier: string;
      totalBids: number;
      totalWins: number;
      totalSpent: number;
      avgPaymentTimeHours: number;
      onTimePickupRate: number;
      rating: string;
    }>;
  },
  title: string,
  dateRange: { start: string; end: string }
): string {
  const { rankings } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @media print {
      @page { size: A4; margin: 1cm; }
      body { margin: 0; }
    }
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-size: 12px;
      line-height: 1.4;
    }
    h1 { color: #800020; font-size: 20px; margin-bottom: 10px; }
    .header { border-bottom: 2px solid #800020; padding-bottom: 10px; margin-bottom: 20px; }
    .date-range { color: #666; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
    th { background: #800020; color: white; padding: 8px; text-align: left; font-size: 10px; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .rank { font-weight: bold; color: #800020; }
    .top3 { background: #FFD700 !important; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="date-range">
      Period: ${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}
    </div>
    <div class="date-range">Generated: ${new Date().toLocaleString()}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Vendor</th>
        <th>Tier</th>
        <th>Bids</th>
        <th>Wins</th>
        <th>Total Spent</th>
        <th>Win Rate</th>
        <th>Avg Payment Time</th>
        <th>Rating</th>
      </tr>
    </thead>
    <tbody>
      ${rankings
        .map(
          (vendor: any) => {
            const winRate = vendor.totalBids > 0 ? ((vendor.totalWins / vendor.totalBids) * 100) : 0;
            const avgPaymentTime = vendor.avgPaymentTimeHours || 0;
            const rating = parseFloat(vendor.rating) || 0;
            
            return `
        <tr class="${vendor.rank <= 3 ? 'top3' : ''}">
          <td class="rank">${vendor.rank}</td>
          <td>${vendor.businessName}</td>
          <td style="text-transform: uppercase;">${vendor.tier.replace('_', ' ')}</td>
          <td>${vendor.totalBids}</td>
          <td>${vendor.totalWins}</td>
          <td>₦${vendor.totalSpent.toLocaleString()}</td>
          <td>${winRate.toFixed(1)}%</td>
          <td>${avgPaymentTime.toFixed(1)}h</td>
          <td>${rating.toFixed(1)} ⭐</td>
        </tr>
      `;
          }
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>NEM Insurance Plc - Salvage Management System</p>
    <p>199 Ikorodu Road, Obanikoro, Lagos | Phone: 234-02-014489560</p>
  </div>
</body>
</html>
  `;
}

function generatePaymentAgingHTML(
  data: {
    summary: {
      totalPayments: number;
      totalAmount: number;
      averageAge: number;
    };
    payments: Array<{
      claimReference: string;
      vendorName: string;
      amount: string;
      dueDate: Date;
      ageInDays: number;
      status: string;
    }>;
  },
  title: string,
  dateRange: { start: string; end: string }
): string {
  const { summary, payments } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @media print {
      @page { size: A4; margin: 1cm; }
      body { margin: 0; }
    }
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-size: 12px;
      line-height: 1.4;
    }
    h1 { color: #800020; font-size: 20px; margin-bottom: 10px; }
    h2 { color: #800020; font-size: 16px; margin-top: 20px; margin-bottom: 10px; }
    .header { border-bottom: 2px solid #800020; padding-bottom: 10px; margin-bottom: 20px; }
    .date-range { color: #666; font-size: 11px; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; }
    .summary-card { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .summary-label { font-size: 10px; color: #666; text-transform: uppercase; }
    .summary-value { font-size: 18px; font-weight: bold; color: #800020; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
    th { background: #800020; color: white; padding: 8px; text-align: left; font-size: 10px; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .status-verified { color: green; font-weight: bold; }
    .status-pending { color: orange; font-weight: bold; }
    .status-overdue { color: red; font-weight: bold; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="date-range">
      Period: ${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}
    </div>
    <div class="date-range">Generated: ${new Date().toLocaleString()}</div>
  </div>

  <h2>Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Payments</div>
      <div class="summary-value">${summary.totalPayments}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Amount</div>
      <div class="summary-value">₦${summary.totalAmount.toLocaleString()}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Average Age (Days)</div>
      <div class="summary-value">${summary.averageAge.toFixed(1)}</div>
    </div>
  </div>

  <h2>Payment Details (Top 50)</h2>
  <table>
    <thead>
      <tr>
        <th>Claim Ref</th>
        <th>Vendor</th>
        <th>Amount</th>
        <th>Status</th>
        <th>Method</th>
        <th>Hours Overdue</th>
        <th>Aging</th>
      </tr>
    </thead>
    <tbody>
      ${payments
        .slice(0, 50)
        .map(
          (payment: any) => {
            const hoursOverdue = payment.hoursOverdue || 0;
            const agingBucket = payment.agingBucket || 'Current';
            const paymentMethod = payment.paymentMethod || 'paystack';
            
            return `
        <tr>
          <td>${payment.claimReference}</td>
          <td>${payment.vendorName}</td>
          <td>₦${payment.amount.toLocaleString()}</td>
          <td class="status-${payment.status}">${payment.status.toUpperCase()}</td>
          <td>${paymentMethod.replace('_', ' ').toUpperCase()}</td>
          <td>${hoursOverdue > 0 ? hoursOverdue.toFixed(1) : '-'}</td>
          <td>${agingBucket}</td>
        </tr>
      `;
          }
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>NEM Insurance Plc - Salvage Management System</p>
    <p>199 Ikorodu Road, Obanikoro, Lagos | Phone: 234-02-014489560</p>
  </div>
</body>
</html>
  `;
}
