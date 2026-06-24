'use client';

import { useState, useEffect } from 'react';
import { useReportFetchState } from '@/hooks/use-report-fetch-state';
import { DataLoadingState, DataRefreshingHint } from '@/components/ui/loading-states';
import { useAppRouter } from '@/hooks/use-app-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { defaultReportFilters, loadReportFromApi } from '@/components/reports/common/report-fetch';
import { ExportButton } from '@/components/reports/common/export-button';
import { PaginatedReportRows } from '@/components/reports/common/paginated-report-table';
import { formatReportCurrency } from '@/components/reports/common/report-currency';
import { ReportSummaryGrid, ReportSummaryStat } from '@/components/reports/common/report-ui';
import {
  AuctionBreakdownTable,
  AuctionCategoryBreakdownSection,
} from '@/components/reports/common/auction-breakdown-table';
import { mapAuctionListToBreakdownRow } from '@/features/reports/utils/auction-breakdown';

export default function AuctionPerformancePage() {
  const router = useAppRouter();
  const { loading, isRefreshing, startFetch, endFetch, markHasData, isBusy } =
    useReportFetchState();
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters());

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async (force = false) => {
    startFetch();
    try {
      const result = await loadReportFromApi('/api/reports/operational/auction-performance', filters, { force });
      if (result.status === 'success') {
        setReportData(result.data);
        markHasData();
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      endFetch();
    }
  };

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
              <h1 className="text-3xl font-bold">Auction Performance</h1>
              <p className="text-muted-foreground">Monitor auction success rates and bidding activity</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => fetchReport()} variant="outline" size="sm" disabled={isBusy}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {reportData && <ExportButton reportType="auction-performance" reportData={reportData} filters={filters} />}
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
          <DataLoadingState label="Auction performance" variant="report" className="no-print" />
        )}

        {isRefreshing && reportData && <DataRefreshingHint />}

        {reportData && (
          <div data-report-content className="grid gap-6">
          {/* Enhanced Summary Cards */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Summary</h3>
              <ReportSummaryGrid>
                <ReportSummaryStat label="Total Auctions" value={reportData.summary?.totalAuctions || 0} />
                <ReportSummaryStat label="Success Rate" value={`${reportData.summary?.successRate || 0}%`} />
                <ReportSummaryStat label="Avg Bids/Auction" value={reportData.summary?.averageBidsPerAuction || 0} />
                <ReportSummaryStat label="Avg Bidders" value={reportData.summary?.averageUniqueBidders || 0} />
                <ReportSummaryStat label="Reserve Met Rate" value={`${reportData.summary?.reserveMetRate || 0}%`} />
                <ReportSummaryStat label="Avg Duration" value={`${reportData.summary?.averageDurationHours || 0}h`} />
                <ReportSummaryStat label="Total Revenue" value={formatReportCurrency(reportData.summary?.totalRevenue || 0)} />
                <ReportSummaryStat label="Avg Winning Bid" value={formatReportCurrency(reportData.summary?.averageWinningBid || 0)} />
                <ReportSummaryStat label="Price Realization" value={`${reportData.summary?.priceRealizationRate || 0}%`} />
                <ReportSummaryStat label="Unique Vendors" value={reportData.summary?.uniqueVendorsParticipating || 0} />
                <ReportSummaryStat label="Vendor Engagement" value={`${reportData.summary?.vendorEngagementRate || 0}%`} />
              </ReportSummaryGrid>
            </CardContent>
          </Card>

          {/* Asset Type Performance */}
          {reportData.byAssetType && reportData.byAssetType.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Performance by Asset Type</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Asset Type</th>
                        <th className="text-right p-2">Count</th>
                        <th className="text-right p-2">Success Rate</th>
                        <th className="text-right p-2">Avg Bids</th>
                        <th className="text-right p-2">Reserve Met</th>
                        <th className="text-right p-2">Total Revenue</th>
                        <th className="text-right p-2">Avg Winning Bid</th>
                        <th className="text-right p-2">Competitive</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.byAssetType.map((item: any) => (
                        <tr key={item.assetType} className="border-b">
                          <td className="p-2 capitalize">{item.assetType}</td>
                          <td className="text-right p-2">{item.count}</td>
                          <td className="text-right p-2">{item.successRate}%</td>
                          <td className="text-right p-2">{item.averageBids}</td>
                          <td className="text-right p-2">{item.reserveMetRate}%</td>
                          <td className="text-right p-2">{formatReportCurrency(item.totalRevenue)}</td>
                          <td className="text-right p-2">{formatReportCurrency(item.averageWinningBid)}</td>
                          <td className="text-right p-2">{item.competitiveAuctions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Branch Performance */}
          {reportData.byBranch && reportData.byBranch.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Performance by Branch</h3>
                <PaginatedReportRows rows={reportData.byBranch} label="branches">
                  {(rows, startIndex) => (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Branch</th>
                            <th className="text-right p-2">Auctions</th>
                            <th className="text-right p-2">Successful</th>
                            <th className="text-right p-2">Success Rate</th>
                            <th className="text-right p-2">Revenue</th>
                            <th className="text-right p-2">Avg Winning Bid</th>
                            <th className="text-right p-2">Avg Bids</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((branch: any, index: number) => (
                            <tr key={`${branch.branchName}-${startIndex + index}`} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium">{branch.branchName || 'Unassigned'}</td>
                              <td className="text-right p-2">{branch.auctionCount || 0}</td>
                              <td className="text-right p-2">{branch.successfulAuctions || 0}</td>
                              <td className="text-right p-2">{branch.successRate || 0}%</td>
                              <td className="text-right p-2 font-semibold">{formatReportCurrency(branch.totalRevenue || 0)}</td>
                              <td className="text-right p-2">{formatReportCurrency(branch.averageWinningBid || 0)}</td>
                              <td className="text-right p-2">{branch.averageBids || 0}</td>
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

          {reportData.byBroker && reportData.byBroker.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Performance by Broker / Agency</h3>
                <PaginatedReportRows rows={reportData.byBroker} label="channels">
                  {(rows, startIndex) => (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Channel</th>
                            <th className="text-left p-2">Type</th>
                            <th className="text-right p-2">Auctions</th>
                            <th className="text-right p-2">Successful</th>
                            <th className="text-right p-2">Success Rate</th>
                            <th className="text-right p-2">Revenue</th>
                            <th className="text-right p-2">Avg Winning Bid</th>
                            <th className="text-right p-2">Avg Bids</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((broker: any, index: number) => (
                            <tr key={`${broker.channelName}-${startIndex + index}`} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium">{broker.channelName || 'Unassigned'}</td>
                              <td className="p-2 capitalize">{broker.channelType}</td>
                              <td className="text-right p-2">{broker.auctionCount || 0}</td>
                              <td className="text-right p-2">{broker.successfulAuctions || 0}</td>
                              <td className="text-right p-2">{broker.successRate || 0}%</td>
                              <td className="text-right p-2 font-semibold">{formatReportCurrency(broker.totalRevenue || 0)}</td>
                              <td className="text-right p-2">{formatReportCurrency(broker.averageWinningBid || 0)}</td>
                              <td className="text-right p-2">{broker.averageBids || 0}</td>
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

          {reportData.branchBreakdown && reportData.branchBreakdown.length > 0 && (
            <AuctionCategoryBreakdownSection
              groups={reportData.branchBreakdown}
              nameColumnLabel="Branch"
            />
          )}

          {reportData.brokerBreakdown && reportData.brokerBreakdown.length > 0 && (
            <AuctionCategoryBreakdownSection
              groups={reportData.brokerBreakdown}
              nameColumnLabel="Broker / Agency"
            />
          )}

          {/* Financial Metrics */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Financial Metrics</h3>
              <ReportSummaryGrid className="mb-6">
                <ReportSummaryStat label="Total Revenue" value={formatReportCurrency(reportData.financialMetrics?.totalRevenue || 0)} />
                <ReportSummaryStat label="Avg Winning Bid" value={formatReportCurrency(reportData.financialMetrics?.averageWinningBid || 0)} />
                <ReportSummaryStat label="Avg Reserve Price" value={formatReportCurrency(reportData.financialMetrics?.averageReservePrice || 0)} />
                <ReportSummaryStat label="Price Realization" value={`${reportData.financialMetrics?.priceRealizationRate || 0}%`} />
              </ReportSummaryGrid>
              {reportData.financialMetrics?.revenueByAssetType && reportData.financialMetrics.revenueByAssetType.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Revenue by Asset Type</h4>
                  <div className="space-y-2">
                    {reportData.financialMetrics.revenueByAssetType.map((item: any) => (
                      <div key={item.assetType} className="flex justify-between items-center">
                        <span className="capitalize">{item.assetType}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold">{formatReportCurrency(item.revenue)}</span>
                          <span className="text-sm text-muted-foreground">({item.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bidding Metrics */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Bidding Metrics</h3>
              <ReportSummaryGrid>
                <ReportSummaryStat label="Total Bids" value={reportData.bidding?.totalBids || 0} />
                <ReportSummaryStat label="Avg Bids/Auction" value={reportData.bidding?.averageBidsPerAuction || 0} />
                <ReportSummaryStat label="Competitive Auctions" value={reportData.bidding?.competitiveAuctions || 0} />
                <ReportSummaryStat label="Single Bidder" value={reportData.bidding?.singleBidderAuctions || 0} />
                <ReportSummaryStat label="No Bids" value={reportData.bidding?.noBidAuctions || 0} />
                <ReportSummaryStat label="Bidding Wars" value={reportData.bidding?.biddingWarFrequency || 0} />
                <ReportSummaryStat label="Avg Bid Increment" value={formatReportCurrency(reportData.bidding?.averageBidIncrement || 0)} />
                <ReportSummaryStat label="Bid Density (bids/hr)" value={reportData.bidding?.bidDensity || 0} />
              </ReportSummaryGrid>
            </CardContent>
          </Card>

          {/* Timing Analysis */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Timing Analysis</h3>
              <ReportSummaryGrid>
                <ReportSummaryStat label="Avg Duration" value={`${reportData.timing?.averageDuration || 0}h`} />
                <ReportSummaryStat label="Shortest" value={`${reportData.timing?.shortestDuration || 0}h`} />
                <ReportSummaryStat label="Longest" value={`${reportData.timing?.longestDuration || 0}h`} />
                <ReportSummaryStat label="Avg Time to 1st Bid" value={`${reportData.timing?.averageTimeToFirstBid || 0}m`} />
                <ReportSummaryStat label="Last Minute Bidding" value={`${reportData.timing?.lastMinuteBiddingRate || 0}%`} />
              </ReportSummaryGrid>
            </CardContent>
          </Card>

          {/* Vendor Participation */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Vendor Participation</h3>
              <ReportSummaryGrid>
                <ReportSummaryStat label="Unique Vendors" value={reportData.vendorParticipation?.uniqueVendors || 0} />
                <ReportSummaryStat label="Avg Vendors/Auction" value={reportData.vendorParticipation?.averageVendorsPerAuction || 0} />
                <ReportSummaryStat label="Repeat Bidder Rate" value={`${reportData.vendorParticipation?.repeatBidderRate || 0}%`} />
                <ReportSummaryStat label="New vs Returning" value={reportData.vendorParticipation?.newVsReturningRatio || 0} />
              </ReportSummaryGrid>
            </CardContent>
          </Card>

          {/* Competition Levels */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Competition Levels</h3>
              <ReportSummaryGrid>
                <ReportSummaryStat label="No Bids" value={reportData.competitionLevels?.noBids || 0} />
                <ReportSummaryStat label="1 Bidder" value={reportData.competitionLevels?.oneBidder || 0} />
                <ReportSummaryStat label="2-3 Bidders" value={reportData.competitionLevels?.twoToThreeBidders || 0} />
                <ReportSummaryStat label="4+ Bidders" value={reportData.competitionLevels?.fourPlusBidders || 0} />
              </ReportSummaryGrid>
            </CardContent>
          </Card>

          {/* Detailed Auction List */}
          {reportData.auctionList && reportData.auctionList.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Detailed Auction List</h3>
                <AuctionBreakdownTable
                  rows={reportData.auctionList.map((auction: any) =>
                    mapAuctionListToBreakdownRow(auction)
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Insights & Recommendations */}
          {reportData.insights && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Insights & Recommendations</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {reportData.insights.bestPerforming && reportData.insights.bestPerforming.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        Best Performing
                      </h4>
                      <div className="space-y-3">
                        {reportData.insights.bestPerforming.map((item: any, idx: number) => (
                          <div key={idx} className="p-3 bg-green-50 rounded-lg">
                            <p className="font-semibold text-sm">{item.metric}</p>
                            <p className="text-lg font-bold text-green-700">{item.value}</p>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {reportData.insights.underperforming && reportData.insights.underperforming.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        Underperforming
                      </h4>
                      <div className="space-y-3">
                        {reportData.insights.underperforming.map((item: any, idx: number) => (
                          <div key={idx} className="p-3 bg-red-50 rounded-lg">
                            <p className="font-semibold text-sm">{item.metric}</p>
                            <p className="text-lg font-bold text-red-700">{item.value}</p>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {reportData.insights.recommendations && reportData.insights.recommendations.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-blue-600" />
                      Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {reportData.insights.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          </div>
        )}
      </div>
    </>
  );
}
