/**
 * PDF Report Content Generators
 * 
 * Each function generates HTML content that matches the exact layout
 * of the corresponding report page.
 */

// ============================================================================
// MASTER REPORT
// ============================================================================
export function generateMasterReportContent(data: any, formatCurrency: Function, formatPercent: Function, formatDate: Function): string {
  return `
    <!-- Executive Summary -->
    <div class="card">
      <h3 class="card-title">Executive Summary</h3>
      <div class="grid grid-cols-4">
        <div class="metric-card primary">
          <div class="metric-label">Total Revenue</div>
          <div class="metric-value">${formatCurrency(data.summary?.totalRevenue || 0)}</div>
          ${data.summary?.revenueChange ? `
            <div class="metric-change ${data.summary.revenueChange >= 0 ? 'positive' : 'negative'}">
              ${data.summary.revenueChange >= 0 ? '↑' : '↓'} ${Math.abs(data.summary.revenueChange)}%
            </div>
          ` : ''}
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Cases</div>
          <div class="metric-value">${data.summary?.totalCases || 0}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Active Auctions</div>
          <div class="metric-value">${data.summary?.activeAuctions || 0}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Processing Time</div>
          <div class="metric-value">${data.summary?.avgProcessingTime || 0}d</div>
        </div>
      </div>
    </div>

    <!-- Financial Overview -->
    <div class="card">
      <h3 class="card-title">Financial Overview</h3>
      <div class="grid grid-cols-3">
        <div class="metric-card">
          <div class="metric-label">Auction Revenue</div>
          <div class="metric-value">${formatCurrency(data.financial?.auctionRevenue || 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Registration Fees</div>
          <div class="metric-value">${formatCurrency(data.financial?.registrationFees || 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Expenses</div>
          <div class="metric-value">${formatCurrency(data.financial?.totalExpenses || 0)}</div>
        </div>
      </div>
    </div>

    <!-- Operational Metrics -->
    <div class="card">
      <h3 class="card-title">Operational Metrics</h3>
      <div class="grid grid-cols-4">
        <div class="metric-card">
          <div class="metric-label">Cases Processed</div>
          <div class="metric-value">${data.operational?.casesProcessed || 0}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Auctions Completed</div>
          <div class="metric-value">${data.operational?.auctionsCompleted || 0}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Success Rate</div>
          <div class="metric-value">${data.operational?.successRate || 0}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Vendor Participation</div>
          <div class="metric-value">${data.operational?.vendorParticipation || 0}</div>
        </div>
      </div>
    </div>

    ${data.trends && data.trends.length > 0 ? `
    <!-- Key Trends -->
    <div class="card">
      <h3 class="card-title">Key Trends</h3>
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th class="text-right">Revenue</th>
            <th class="text-right">Cases</th>
            <th class="text-right">Auctions</th>
            <th class="text-right">Avg Value</th>
          </tr>
        </thead>
        <tbody>
          ${data.trends.map((trend: any) => `
            <tr>
              <td class="font-semibold">${trend.period}</td>
              <td class="text-right">${formatCurrency(trend.revenue)}</td>
              <td class="text-right">${trend.cases}</td>
              <td class="text-right">${trend.auctions}</td>
              <td class="text-right">${formatCurrency(trend.avgValue)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
  `;
}

// ============================================================================
// PROFITABILITY REPORT
// ============================================================================
export function generateProfitabilityContent(data: any, formatCurrency: Function, formatPercent: Function, formatDate: Function): string {
  return `
    <!-- Profitability Summary -->
    <div class="card">
      <h3 class="card-title">Profitability Summary</h3>
      <div class="grid grid-cols-4">
        <div class="metric-card primary">
          <div class="metric-label">Total Revenue</div>
          <div class="metric-value">${formatCurrency(data.summary?.totalRevenue || 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Costs</div>
          <div class="metric-value">${formatCurrency(data.summary?.totalCosts || 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Net Profit</div>
          <div class="metric-value ${(data.summary?.netProfit || 0) >= 0 ? 'text-green' : 'text-red'}">
            ${formatCurrency(data.summary?.netProfit || 0)}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Profit Margin</div>
          <div class="metric-value ${(data.summary?.profitMargin || 0) >= 0 ? 'text-green' : 'text-red'}">
            ${formatPercent(data.summary?.profitMargin || 0)}
          </div>
        </div>
      </div>
    </div>

    <!-- Revenue Breakdown -->
    <div class="card">
      <h3 class="card-title">Revenue Breakdown</h3>
      <div class="grid grid-cols-3">
        <div class="metric-card">
          <div class="metric-label">Auction Sales</div>
          <div class="metric-value">${formatCurrency(data.revenue?.auctionSales || 0)}</div>
          <div class="metric-change text-gray">${formatPercent(data.revenue?.auctionSalesPercent || 0)} of total</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Registration Fees</div>
          <div class="metric-value">${formatCurrency(data.revenue?.registrationFees || 0)}</div>
          <div class="metric-change text-gray">${formatPercent(data.revenue?.registrationFeesPercent || 0)} of total</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Other Income</div>
          <div class="metric-value">${formatCurrency(data.revenue?.otherIncome || 0)}</div>
          <div class="metric-change text-gray">${formatPercent(data.revenue?.otherIncomePercent || 0)} of total</div>
        </div>
      </div>
    </div>

    <!-- Cost Breakdown -->
    <div class="card">
      <h3 class="card-title">Cost Breakdown</h3>
      <div class="grid grid-cols-4">
        <div class="metric-card">
          <div class="metric-label">Operational Costs</div>
          <div class="metric-value">${formatCurrency(data.costs?.operational || 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Storage Costs</div>
          <div class="metric-value">${formatCurrency(data.costs?.storage || 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Marketing</div>
          <div class="metric-value">${formatCurrency(data.costs?.marketing || 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Administrative</div>
          <div class="metric-value">${formatCurrency(data.costs?.administrative || 0)}</div>
        </div>
      </div>
    </div>

    ${data.byAssetType && data.byAssetType.length > 0 ? `
    <!-- Profitability by Asset Type -->
    <div class="card">
      <h3 class="card-title">Profitability by Asset Type</h3>
      <table>
        <thead>
          <tr>
            <th>Asset Type</th>
            <th class="text-right">Revenue</th>
            <th class="text-right">Costs</th>
            <th class="text-right">Profit</th>
            <th class="text-right">Margin</th>
            <th class="text-right">ROI</th>
          </tr>
        </thead>
        <tbody>
          ${data.byAssetType.map((item: any) => `
            <tr>
              <td class="capitalize font-semibold">${item.assetType}</td>
              <td class="text-right">${formatCurrency(item.revenue)}</td>
              <td class="text-right">${formatCurrency(item.costs)}</td>
              <td class="text-right font-bold ${item.profit >= 0 ? 'text-green' : 'text-red'}">
                ${formatCurrency(item.profit)}
              </td>
              <td class="text-right ${item.margin >= 0 ? 'text-green' : 'text-red'}">
                ${formatPercent(item.margin)}
              </td>
              <td class="text-right ${item.roi >= 0 ? 'text-green' : 'text-red'}">
                ${formatPercent(item.roi)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- ROI Analysis -->
    <div class="card">
      <h3 class="card-title">ROI Analysis</h3>
      <div class="grid grid-cols-3">
        <div class="metric-card">
          <div class="metric-label">Overall ROI</div>
          <div class="metric-value ${(data.roi?.overall || 0) >= 0 ? 'text-green' : 'text-red'}">
            ${formatPercent(data.roi?.overall || 0)}
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg ROI per Case</div>
          <div class="metric-value">${formatPercent(data.roi?.perCase || 0)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg ROI per Auction</div>
          <div class="metric-value">${formatPercent(data.roi?.perAuction || 0)}</div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// GENERIC REPORT (Fallback for all other report types)
// ============================================================================
export function generateGenericContent(data: any, formatCurrency: Function, formatPercent: Function, formatDate: Function): string {
  let content = '';

  // Summary section if available
  if (data.summary) {
    content += `
    <div class="card">
      <h3 class="card-title">Summary</h3>
      <div class="grid grid-cols-4">
        ${Object.entries(data.summary).map(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          const formattedValue = typeof value === 'number' 
            ? (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('value')
              ? formatCurrency(value)
              : key.toLowerCase().includes('rate') || key.toLowerCase().includes('percent') || key.toLowerCase().includes('margin')
              ? formatPercent(value)
              : value.toLocaleString())
            : value;
          
          return `
            <div class="metric-card">
              <div class="metric-label">${label}</div>
              <div class="metric-value">${formattedValue}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    `;
  }

  // Metrics section if available
  if (data.metrics) {
    content += `
    <div class="card">
      <h3 class="card-title">Key Metrics</h3>
      <div class="grid grid-cols-4">
        ${Object.entries(data.metrics).map(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          const formattedValue = typeof value === 'number'
            ? (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('value')
              ? formatCurrency(value)
              : key.toLowerCase().includes('rate') || key.toLowerCase().includes('percent') || key.toLowerCase().includes('margin')
              ? formatPercent(value)
              : value.toLocaleString())
            : value;
          
          return `
            <div class="metric-card">
              <div class="metric-label">${label}</div>
              <div class="metric-value">${formattedValue}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    `;
  }

  // Table data if available
  if (data.data && Array.isArray(data.data) && data.data.length > 0) {
    const firstRow = data.data[0];
    const columns = Object.keys(firstRow);
    
    content += `
    <div class="card">
      <h3 class="card-title">Detailed Data</h3>
      <table>
        <thead>
          <tr>
            ${columns.map(col => `
              <th class="${col.toLowerCase().includes('amount') || col.toLowerCase().includes('revenue') || col.toLowerCase().includes('cost') || col.toLowerCase().includes('value') ? 'text-right' : ''}">${col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.data.slice(0, 50).map((row: any) => `
            <tr>
              ${columns.map(col => {
                const value = row[col];
                const isNumeric = typeof value === 'number';
                const isCurrency = col.toLowerCase().includes('amount') || col.toLowerCase().includes('revenue') || col.toLowerCase().includes('cost') || col.toLowerCase().includes('value');
                const isPercent = col.toLowerCase().includes('rate') || col.toLowerCase().includes('percent') || col.toLowerCase().includes('margin');
                const isDate = col.toLowerCase().includes('date') || col.toLowerCase().includes('time');
                
                let formattedValue = value;
                if (isNumeric && isCurrency) {
                  formattedValue = formatCurrency(value);
                } else if (isNumeric && isPercent) {
                  formattedValue = formatPercent(value);
                } else if (isDate && value) {
                  formattedValue = formatDate(value);
                } else if (isNumeric) {
                  formattedValue = value.toLocaleString();
                }
                
                return `<td class="${isCurrency || isPercent || isNumeric ? 'text-right' : ''}">${formattedValue || '-'}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    `;
  }

  // If no structured data, show raw data
  if (!content) {
    content = `
    <div class="card">
      <h3 class="card-title">Report Data</h3>
      <pre style="white-space: pre-wrap; word-wrap: break-word; font-size: 0.875rem; background: #f9fafb; padding: 1rem; border-radius: 0.375rem; overflow-x: auto;">
${JSON.stringify(data, null, 2)}
      </pre>
    </div>
    `;
  }

  return content;
}
