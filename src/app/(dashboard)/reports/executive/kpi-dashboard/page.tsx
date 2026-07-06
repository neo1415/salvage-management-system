'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReportFetchState } from '@/hooks/use-report-fetch-state';
import { DataLoadingState, DataRefreshingHint } from '@/components/ui/loading-states';
import { useAppRouter } from '@/hooks/use-app-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { defaultReportFilters, loadReportFromApi } from '@/components/reports/common/report-fetch';
import { ExportButton } from '@/components/reports/common/export-button';
import { PaginatedReportRows } from '@/components/reports/common/paginated-report-table';
import { formatReportCurrency } from '@/components/reports/common/report-currency';
import { MetricGrid, ReportKPICard } from '@/components/reports/common/report-ui';
import type { KPIDashboardReport } from '@/features/reports/executive/services/kpi-dashboard.service';

export default function KPIDashboardPage() {
  const router = useAppRouter();
  const { loading, isRefreshing, startFetch, endFetch, markHasData } =
    useReportFetchState();
  const [reportData, setReportData] = useState<KPIDashboardReport | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters());

  const fetchReport = useCallback(async (force = false) => {
    startFetch();
    try {
      const result = await loadReportFromApi('/api/reports/executive/kpi-dashboard', filters, { force });
      if (result.status === 'success' && result.data) {
        setReportData(result.data as KPIDashboardReport);
        markHasData();
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      endFetch();
    }
  }, [endFetch, filters, markHasData, startFetch]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const KPICard = ReportKPICard;

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          /* Hide UI elements */
          nav, header, footer, .no-print,
          button, [role="button"],
          .sidebar, .navigation,
          input, select, textarea,
          [role="navigation"],
          [role="banner"],
          [role="complementary"] {
            display: none !important;
          }

          /* Reset body and html */
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Container adjustments */
          .container {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Page setup */
          @page {
            size: A4 portrait;
            margin: 15mm;
          }

          /* Report content */
          [data-report-content] {
            display: block !important;
            width: 100% !important;
            overflow: visible !important;
            page-break-after: auto;
          }

          /* Cards and sections */
          .space-y-6 > * {
            page-break-inside: avoid;
            margin-bottom: 10px !important;
          }

          /* Grid layouts */
          .grid {
            display: grid !important;
            page-break-inside: avoid;
          }

          /* Cards */
          [class*="card"], [class*="Card"] {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 10px !important;
            box-shadow: none !important;
            border: 1px solid #ddd !important;
          }

          /* Tables */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }

          thead {
            display: table-header-group;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          th, td {
            padding: 6px !important;
            border: 1px solid #ddd !important;
            font-size: 10px !important;
          }

          /* Ensure all content is visible */
          * {
            overflow: visible !important;
            box-sizing: border-box !important;
          }

          /* Remove shadows and transitions */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">KPI Dashboard</h1>
              <p className="text-muted-foreground">Monitor key performance indicators and executive-level metrics</p>
            </div>
          </div>
          <div className="flex gap-2">
            {reportData && <ExportButton reportType="kpi-dashboard" reportData={reportData} filters={filters} />}
          </div>
        </div>

        <Card className="no-print">
          <CardContent className="pt-6">
            <ReportFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onApply={fetchReport}
              onReset={() => setFilters(defaultReportFilters())}
              showAssetTypes={true}
              showRegions={false}
              showBranches={true}
              showBrokers={true}
            />
          </CardContent>
        </Card>

        {loading && !reportData && (
          <DataLoadingState label="KPI dashboard" variant="report" className="no-print" />
        )}

        {isRefreshing && reportData && <DataRefreshingHint />}

      {reportData && (
        <div data-report-content className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Financial KPIs</h2>
            <MetricGrid>
              <KPICard
                title="Total Revenue"
                value={formatReportCurrency(reportData.financial.totalRevenue)}
                trend={reportData.financial.revenueGrowth}
              />
              <KPICard
                title="Recovery Rate"
                value={`${reportData.financial.averageRecoveryRate}%`}
                subtitle="Avg % of market value"
              />
              <KPICard
                title="Profit Margin"
                value={`${reportData.financial.profitMargin}%`}
                subtitle="After operational costs"
              />
              <KPICard
                title="Revenue Growth"
                value={`${reportData.financial.revenueGrowth >= 0 ? '+' : ''}${reportData.financial.revenueGrowth}%`}
                subtitle="vs previous period"
              />
            </MetricGrid>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Operational KPIs</h2>
            <MetricGrid>
              <KPICard
                title="Total Cases"
                value={reportData.operational.totalCases}
                subtitle="Processed in period"
              />
              <KPICard
                title="Processing Time"
                value={`${reportData.operational.caseProcessingTime}h`}
                subtitle="Average hours"
              />
              <KPICard
                title="Auction Success"
                value={`${reportData.operational.auctionSuccessRate}%`}
                subtitle="Closed with winner"
              />
              <KPICard
                title="Vendor Participation"
                value={`${reportData.operational.vendorParticipationRate}%`}
                subtitle="Auctions with bids"
              />
            </MetricGrid>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Performance KPIs</h2>
            <MetricGrid>
              <KPICard
                title="Top Adjuster"
                value={reportData.performance.topAdjusterPerformance}
                subtitle="Cases processed"
              />
              <KPICard
                title="Avg Adjuster"
                value={reportData.performance.averageAdjusterPerformance}
                subtitle="Cases per adjuster"
              />
              <KPICard
                title="Payment Verification"
                value={`${reportData.performance.paymentVerificationRate}%`}
                subtitle="Auto-verified"
              />
              <KPICard
                title="Document Completion"
                value={`${reportData.performance.documentCompletionRate}%`}
                subtitle="On-time completion"
              />
            </MetricGrid>
          </div>

          {/* Detailed Breakdowns */}
          {reportData.breakdowns && (
            <div className="space-y-6">
              {/* Cases Breakdown */}
              {reportData.breakdowns.cases && reportData.breakdowns.cases.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Cases Breakdown</h3>
                    <PaginatedReportRows rows={reportData.breakdowns.cases} label="cases">
                      {(rows, startIndex) => (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Claim Ref</th>
                            <th className="text-left p-2">Policy</th>
                            <th className="text-left p-2">Broker / Agency</th>
                            <th className="text-left p-2">Adjuster</th>
                            <th className="text-left p-2">Branch</th>
                            <th className="text-left p-2">Asset Type</th>
                            <th className="text-right p-2">Market Value</th>
                            <th className="text-right p-2">Processing Time</th>
                            <th className="text-right p-2">Revenue</th>
                            <th className="text-left p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((c, index) => (
                            <tr key={`case-${c.id}-${startIndex + index}`} className="border-b hover:bg-gray-50">
                              <td className="p-2">{c.claimReference}</td>
                              <td className="p-2">{c.policyNumber || '—'}</td>
                              <td className="p-2">{c.channelLabel || '—'}</td>
                              <td className="p-2">{c.adjusterName}</td>
                              <td className="p-2">{c.branchName || 'Unassigned'}</td>
                              <td className="p-2 capitalize">{c.assetType}</td>
                              <td className="text-right p-2">{formatReportCurrency(parseFloat(c.marketValue || '0'))}</td>
                              <td className="text-right p-2">{c.processingTime}h</td>
                              <td className="text-right p-2">{formatReportCurrency(parseFloat(c.revenue || '0'))}</td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  c.status === 'sold' ? 'bg-green-100 text-green-800' :
                                  c.status === 'active_auction' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      )}
                    </PaginatedReportRows>
                  </CardContent>
                </Card>
              )}

              {/* Branches Breakdown */}
              {reportData.breakdowns.branches && reportData.breakdowns.branches.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Branch Recovery Breakdown</h3>
                    <PaginatedReportRows rows={reportData.breakdowns.branches} label="branches">
                      {(rows, startIndex) => (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-2">Branch</th>
                                <th className="text-right p-2">Cases</th>
                                <th className="text-right p-2">Sold</th>
                                <th className="text-right p-2">Claims Value</th>
                                <th className="text-right p-2">Verified Recovery</th>
                                <th className="text-right p-2">Recovery Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((branch, index) => (
                                <tr key={`branch-${branch.branchName}-${startIndex + index}`} className="border-b hover:bg-gray-50">
                                  <td className="p-2 font-medium">{branch.branchName || 'Unassigned'}</td>
                                  <td className="text-right p-2">{branch.totalCases || 0}</td>
                                  <td className="text-right p-2">{branch.soldCases || 0}</td>
                                  <td className="text-right p-2">{formatReportCurrency(branch.claimsValue || 0)}</td>
                                  <td className="text-right p-2 font-semibold">{formatReportCurrency(branch.verifiedRecovery || 0)}</td>
                                  <td className="text-right p-2">{branch.recoveryRate || 0}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </PaginatedReportRows>
                  </CardContent>
                </Card>
              )}

              {/* Auctions Breakdown */}
              {reportData.breakdowns.auctions && reportData.breakdowns.auctions.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Auctions Breakdown</h3>
                    <PaginatedReportRows rows={reportData.breakdowns.auctions} label="auctions">
                      {(rows, startIndex) => (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Case Ref</th>
                            <th className="text-right p-2">Bidders</th>
                            <th className="text-right p-2">Total Bids</th>
                            <th className="text-right p-2">Starting Bid</th>
                            <th className="text-right p-2">Winning Bid</th>
                            <th className="text-left p-2">Winner</th>
                            <th className="text-left p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((a, index) => (
                            <tr key={`auction-${a.id}-${startIndex + index}`} className="border-b hover:bg-gray-50">
                              <td className="p-2">{a.caseReference}</td>
                              <td className="text-right p-2">{a.uniqueBidders}</td>
                              <td className="text-right p-2">{a.totalBids}</td>
                              <td className="text-right p-2">{formatReportCurrency(parseFloat(a.startingBid || '0'))}</td>
                              <td className="text-right p-2">{formatReportCurrency(parseFloat(a.winningBid || '0'))}</td>
                              <td className="p-2">{a.winnerName || '-'}</td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  a.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                                  a.status === 'active' ? 'bg-green-100 text-green-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {a.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      )}
                    </PaginatedReportRows>
                  </CardContent>
                </Card>
              )}

              {/* Adjusters Breakdown */}
              {reportData.breakdowns.adjusters && reportData.breakdowns.adjusters.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Adjusters Breakdown</h3>
                    <PaginatedReportRows rows={reportData.breakdowns.adjusters} label="adjusters">
                      {(rows, startIndex) => (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Adjuster</th>
                            <th className="text-right p-2">Cases</th>
                            <th className="text-right p-2">Approved</th>
                            <th className="text-right p-2">Rejected</th>
                            <th className="text-right p-2">Approval Rate</th>
                            <th className="text-right p-2">Avg Time</th>
                            <th className="text-right p-2">Revenue</th>
                            <th className="text-right p-2">Quality Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((adj, index) => (
                            <tr key={`adjuster-${adj.id}-${startIndex + index}`} className="border-b hover:bg-gray-50">
                              <td className="p-2">{adj.name}</td>
                              <td className="text-right p-2">{adj.totalCases}</td>
                              <td className="text-right p-2 text-green-600">{adj.approved}</td>
                              <td className="text-right p-2 text-red-600">{adj.rejected}</td>
                              <td className="text-right p-2">{adj.approvalRate}%</td>
                              <td className="text-right p-2">{adj.avgProcessingTime}h</td>
                              <td className="text-right p-2">{formatReportCurrency(adj.revenue || 0)}</td>
                              <td className="text-right p-2">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  adj.qualityScore >= 80 ? 'bg-green-100 text-green-800' :
                                  adj.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {adj.qualityScore}/100
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      )}
                    </PaginatedReportRows>
                  </CardContent>
                </Card>
              )}

              {/* Vendors Breakdown */}
              {reportData.breakdowns.vendors && reportData.breakdowns.vendors.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Vendors Breakdown</h3>
                    <PaginatedReportRows rows={reportData.breakdowns.vendors} label="vendors">
                      {(rows, startIndex) => (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Vendor</th>
                            <th className="text-left p-2">Tier</th>
                            <th className="text-right p-2">Participated</th>
                            <th className="text-right p-2">Won</th>
                            <th className="text-right p-2">Win Rate</th>
                            <th className="text-right p-2">Total Spent</th>
                            <th className="text-right p-2">Avg Bid</th>
                            <th className="text-right p-2">Payment Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((v, index) => (
                            <tr key={`vendor-${v.id}-${startIndex + index}`} className="border-b hover:bg-gray-50">
                              <td className="p-2">{v.businessName}</td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  v.tier === 1 ? 'bg-yellow-100 text-yellow-800' :
                                  v.tier === 2 ? 'bg-gray-100 text-gray-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  Tier {v.tier}
                                </span>
                              </td>
                              <td className="text-right p-2">{v.auctionsParticipated}</td>
                              <td className="text-right p-2">{v.auctionsWon}</td>
                              <td className="text-right p-2">{v.winRate}%</td>
                              <td className="text-right p-2">{formatReportCurrency(v.totalSpent || 0)}</td>
                              <td className="text-right p-2">{formatReportCurrency(v.avgBid || 0)}</td>
                              <td className="text-right p-2">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  v.paymentRate >= 90 ? 'bg-green-100 text-green-800' :
                                  v.paymentRate >= 70 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {v.paymentRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      )}
                    </PaginatedReportRows>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
