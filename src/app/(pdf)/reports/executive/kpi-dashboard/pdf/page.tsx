/**
 * KPI Dashboard PDF View
 * Clean, print-optimized version for PDF export
 * No navigation, filters, or UI chrome - just the report content
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { PDFLayout } from '@/components/reports/common/pdf-layout';

export default function KPIDashboardPDFPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      // Get filters from URL params
      const params = new URLSearchParams();
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/reports/executive/kpi-dashboard?${params}`);
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

  const KPICard = ({ title, value, subtitle, trend }: any) => (
    <Card className="pdf-no-break">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {trend !== undefined && (
            <div className={`flex items-center ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              <span className="ml-1 font-semibold">{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Preparing report for PDF export...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">Failed to load report data</p>
      </div>
    );
  }

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const dateRange = startDate && endDate 
    ? `${new Date(startDate).toLocaleDateString('en-NG')} - ${new Date(endDate).toLocaleDateString('en-NG')}`
    : 'All Time';

  return (
    <PDFLayout 
      reportTitle="KPI Dashboard" 
      reportSubtitle={`Performance Period: ${dateRange}`}
    >
      {/* Signal that report is ready for PDF capture */}
      <div data-report-ready="true" className="space-y-6">
        {/* Financial KPIs */}
        <div className="pdf-no-break">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Financial KPIs</h2>
          <div className="grid grid-cols-4 gap-4">
            <KPICard
              title="Total Revenue"
              value={`₦${reportData.financial.totalRevenue.toLocaleString()}`}
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
          </div>
        </div>

        {/* Operational KPIs */}
        <div className="pdf-no-break">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Operational KPIs</h2>
          <div className="grid grid-cols-4 gap-4">
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
          </div>
        </div>

        {/* Performance KPIs */}
        <div className="pdf-no-break">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Performance KPIs</h2>
          <div className="grid grid-cols-4 gap-4">
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
          </div>
        </div>

        {/* Detailed Breakdowns */}
        {reportData.breakdowns && (
          <div className="space-y-6">
            {/* Cases Breakdown */}
            {reportData.breakdowns.cases && reportData.breakdowns.cases.length > 0 && (
              <div className="pdf-page-break">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Cases Breakdown</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Claim Ref</th>
                            <th className="text-left p-2">Adjuster</th>
                            <th className="text-left p-2">Asset Type</th>
                            <th className="text-right p-2">Market Value</th>
                            <th className="text-right p-2">Processing Time</th>
                            <th className="text-right p-2">Revenue</th>
                            <th className="text-left p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.breakdowns.cases.map((c: any) => (
                            <tr key={c.id} className="border-b">
                              <td className="p-2">{c.claimReference}</td>
                              <td className="p-2">{c.adjusterName}</td>
                              <td className="p-2 capitalize">{c.assetType}</td>
                              <td className="text-right p-2">₦{parseFloat(c.marketValue || '0').toLocaleString()}</td>
                              <td className="text-right p-2">{c.processingTime}h</td>
                              <td className="text-right p-2">₦{parseFloat(c.revenue || '0').toLocaleString()}</td>
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
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Auctions Breakdown */}
            {reportData.breakdowns.auctions && reportData.breakdowns.auctions.length > 0 && (
              <div className="pdf-page-break">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Auctions Breakdown</h3>
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
                          {reportData.breakdowns.auctions.map((a: any) => (
                            <tr key={a.id} className="border-b">
                              <td className="p-2">{a.caseReference}</td>
                              <td className="text-right p-2">{a.uniqueBidders}</td>
                              <td className="text-right p-2">{a.totalBids}</td>
                              <td className="text-right p-2">₦{parseFloat(a.startingBid || '0').toLocaleString()}</td>
                              <td className="text-right p-2">₦{parseFloat(a.winningBid || '0').toLocaleString()}</td>
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
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Adjusters Breakdown */}
            {reportData.breakdowns.adjusters && reportData.breakdowns.adjusters.length > 0 && (
              <div className="pdf-page-break">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Adjusters Breakdown</h3>
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
                          {reportData.breakdowns.adjusters.map((adj: any) => (
                            <tr key={adj.id} className="border-b">
                              <td className="p-2">{adj.name}</td>
                              <td className="text-right p-2">{adj.totalCases}</td>
                              <td className="text-right p-2 text-green-600">{adj.approved}</td>
                              <td className="text-right p-2 text-red-600">{adj.rejected}</td>
                              <td className="text-right p-2">{adj.approvalRate}%</td>
                              <td className="text-right p-2">{adj.avgProcessingTime}h</td>
                              <td className="text-right p-2">₦{parseFloat(adj.revenue || '0').toLocaleString()}</td>
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
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Vendors Breakdown */}
            {reportData.breakdowns.vendors && reportData.breakdowns.vendors.length > 0 && (
              <div className="pdf-page-break">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold mb-4">Vendors Breakdown</h3>
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
                          {reportData.breakdowns.vendors.map((v: any) => (
                            <tr key={v.id} className="border-b">
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
                              <td className="text-right p-2">₦{parseFloat(v.totalSpent || '0').toLocaleString()}</td>
                              <td className="text-right p-2">₦{parseFloat(v.avgBid || '0').toLocaleString()}</td>
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
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </PDFLayout>
  );
}
