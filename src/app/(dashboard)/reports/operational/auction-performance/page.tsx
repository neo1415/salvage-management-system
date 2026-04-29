'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';
import { subDays } from 'date-fns';

export default function AuctionPerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());

      const response = await fetch(`/api/reports/operational/auction-performance?${params}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        setReportData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
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
          <Button onClick={fetchReport} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {reportData && <ExportButton reportType="auction-performance" reportData={reportData} filters={filters} />}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ReportFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onApply={fetchReport}
            onReset={() => setFilters({ startDate: subDays(new Date(), 30), endDate: new Date() })}
            showAssetTypes={false}
            showRegions={false}
          />
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">Loading auction performance data...</div>
          </CardContent>
        </Card>
      )}

      {!loading && reportData && (
        <div className="grid gap-6">
          {/* Enhanced Summary Cards */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Auctions</p>
                  <p className="text-2xl font-bold">{reportData.summary?.totalAuctions || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{reportData.summary?.successRate || 0}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Bids/Auction</p>
                  <p className="text-2xl font-bold">{reportData.summary?.averageBidsPerAuction || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Bidders</p>
                  <p className="text-2xl font-bold">{reportData.summary?.averageUniqueBidders || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reserve Met Rate</p>
                  <p className="text-2xl font-bold">{reportData.summary?.reserveMetRate || 0}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-2xl font-bold">{reportData.summary?.averageDurationHours || 0}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(reportData.summary?.totalRevenue || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Winning Bid</p>
                  <p className="text-2xl font-bold">{formatCurrency(reportData.summary?.averageWinningBid || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Price Realization</p>
                  <p className="text-2xl font-bold">{reportData.summary?.priceRealizationRate || 0}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unique Vendors</p>
                  <p className="text-2xl font-bold">{reportData.summary?.uniqueVendorsParticipating || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendor Engagement</p>
                  <p className="text-2xl font-bold">{reportData.summary?.vendorEngagementRate || 0}%</p>
                </div>
              </div>
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
                          <td className="text-right p-2">{formatCurrency(item.totalRevenue)}</td>
                          <td className="text-right p-2">{formatCurrency(item.averageWinningBid)}</td>
                          <td className="text-right p-2">{item.competitiveAuctions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Metrics */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Financial Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(reportData.financialMetrics?.totalRevenue || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Winning Bid</p>
                  <p className="text-2xl font-bold">{formatCurrency(reportData.financialMetrics?.averageWinningBid || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Reserve Price</p>
                  <p className="text-2xl font-bold">{formatCurrency(reportData.financialMetrics?.averageReservePrice || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Price Realization</p>
                  <p className="text-2xl font-bold">{reportData.financialMetrics?.priceRealizationRate || 0}%</p>
                </div>
              </div>
              {reportData.financialMetrics?.revenueByAssetType && reportData.financialMetrics.revenueByAssetType.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Revenue by Asset Type</h4>
                  <div className="space-y-2">
                    {reportData.financialMetrics.revenueByAssetType.map((item: any) => (
                      <div key={item.assetType} className="flex justify-between items-center">
                        <span className="capitalize">{item.assetType}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold">{formatCurrency(item.revenue)}</span>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Bids</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.totalBids || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Bids/Auction</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.averageBidsPerAuction || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Competitive Auctions</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.competitiveAuctions || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Single Bidder</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.singleBidderAuctions || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">No Bids</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.noBidAuctions || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bidding Wars</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.biddingWarFrequency || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Bid Increment</p>
                  <p className="text-2xl font-bold">{formatCurrency(reportData.bidding?.averageBidIncrement || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bid Density (bids/hr)</p>
                  <p className="text-2xl font-bold">{reportData.bidding?.bidDensity || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timing Analysis */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Timing Analysis</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-2xl font-bold">{reportData.timing?.averageDuration || 0}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Shortest</p>
                  <p className="text-2xl font-bold">{reportData.timing?.shortestDuration || 0}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Longest</p>
                  <p className="text-2xl font-bold">{reportData.timing?.longestDuration || 0}h</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Time to 1st Bid</p>
                  <p className="text-2xl font-bold">{reportData.timing?.averageTimeToFirstBid || 0}m</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Minute Bidding</p>
                  <p className="text-2xl font-bold">{reportData.timing?.lastMinuteBiddingRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Participation */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Vendor Participation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Vendors</p>
                  <p className="text-2xl font-bold">{reportData.vendorParticipation?.uniqueVendors || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Vendors/Auction</p>
                  <p className="text-2xl font-bold">{reportData.vendorParticipation?.averageVendorsPerAuction || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Repeat Bidder Rate</p>
                  <p className="text-2xl font-bold">{reportData.vendorParticipation?.repeatBidderRate || 0}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">New vs Returning</p>
                  <p className="text-2xl font-bold">{reportData.vendorParticipation?.newVsReturningRatio || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Competition Levels */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Competition Levels</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">No Bids</p>
                  <p className="text-2xl font-bold">{reportData.competitionLevels?.noBids || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">1 Bidder</p>
                  <p className="text-2xl font-bold">{reportData.competitionLevels?.oneBidder || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">2-3 Bidders</p>
                  <p className="text-2xl font-bold">{reportData.competitionLevels?.twoToThreeBidders || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">4+ Bidders</p>
                  <p className="text-2xl font-bold">{reportData.competitionLevels?.fourPlusBidders || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Auction List */}
          {reportData.auctionList && reportData.auctionList.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Detailed Auction List</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Claim Ref</th>
                        <th className="text-left p-2">Asset Type</th>
                        <th className="text-left p-2">Start Time</th>
                        <th className="text-right p-2">Duration (h)</th>
                        <th className="text-right p-2">Bids</th>
                        <th className="text-right p-2">Bidders</th>
                        <th className="text-right p-2">Winning Bid</th>
                        <th className="text-right p-2">Reserve</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.auctionList.slice(0, 50).map((auction: any) => (
                        <tr key={auction.auctionId} className="border-b hover:bg-muted/50">
                          <td className="p-2">{auction.claimReference}</td>
                          <td className="p-2 capitalize">{auction.assetType}</td>
                          <td className="p-2">{new Date(auction.startTime).toLocaleDateString()}</td>
                          <td className="text-right p-2">{auction.durationHours}</td>
                          <td className="text-right p-2">{auction.bidCount}</td>
                          <td className="text-right p-2">{auction.uniqueBidders}</td>
                          <td className="text-right p-2">
                            {auction.winningBid ? formatCurrency(auction.winningBid) : '-'}
                          </td>
                          <td className="text-right p-2">{formatCurrency(auction.reservePrice)}</td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              auction.isSuccessful ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {auction.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
  );
}
