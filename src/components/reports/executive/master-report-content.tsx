'use client';

/**
 * Master Report Content Component
 * Comprehensive executive dashboard following 2026 BI best practices
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, TrendingDown, Banknote, FileText, 
  Clock, CheckCircle, Users, Award, Activity,
  BarChart3, PieChart, LineChart
} from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { MasterReportData } from '@/features/reports/executive/services/master-report.service';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MasterReportContentProps {
  data: MasterReportData;
}

export function MasterReportContent({ data }: MasterReportContentProps) {
  const formatCurrency = (amount: number) => `₦${amount.toLocaleString()}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="space-y-8">
      {/* EXECUTIVE SUMMARY - Top 7 KPIs */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-[#800020]">Executive Summary</h2>
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
          <Card className="border-l-4 border-l-[#800020]">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.executiveSummary.totalRevenue)}</p>
                  <div className="flex items-center mt-1">
                    {data.executiveSummary.revenueGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                    )}
                    <span className={`text-sm ${data.executiveSummary.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(Math.abs(data.executiveSummary.revenueGrowth))} growth
                    </span>
                  </div>
                </div>
                <Banknote className="h-8 w-8 text-[#800020] opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Cases</p>
                  <p className="text-2xl font-bold">{data.executiveSummary.totalCases}</p>
                  <div className="flex items-center mt-1">
                    {data.executiveSummary.caseGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                    )}
                    <span className={`text-sm ${data.executiveSummary.caseGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(Math.abs(data.executiveSummary.caseGrowth))}
                    </span>
                  </div>
                </div>
                <FileText className="h-8 w-8 text-[#800020] opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Auction Success</p>
                  <p className="text-2xl font-bold">{formatPercent(data.executiveSummary.auctionSuccessRate)}</p>
                  <p className="text-xs text-gray-500 mt-1">Closed with winner</p>
                </div>
                <CheckCircle className="h-8 w-8 text-[#800020] opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Processing</p>
                  <p className="text-2xl font-bold">{data.executiveSummary.avgProcessingTime.toFixed(1)}</p>
                  <p className="text-xs text-gray-500 mt-1">days</p>
                </div>
                <Clock className="h-8 w-8 text-[#800020] opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">System Health</p>
                  <p className="text-2xl font-bold">{data.executiveSummary.systemHealth}</p>
                  <p className="text-xs text-gray-500 mt-1">score</p>
                </div>
                <Activity className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Team Size</p>
                  <p className="text-2xl font-bold">{data.performance.teamMetrics.totalAdjusters}</p>
                  <p className="text-xs text-gray-500 mt-1">adjusters</p>
                </div>
                <Users className="h-8 w-8 text-[#800020] opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Quality Score</p>
                  <p className="text-2xl font-bold">{data.performance.teamMetrics.avgQualityScore.toFixed(1)}</p>
                  <p className="text-xs text-gray-500 mt-1">average</p>
                </div>
                <Award className="h-8 w-8 text-[#800020] opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FINANCIAL SECTION */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-[#800020]">Financial Performance</h2>
        
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Gross Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(data.financial.profitability.grossProfit)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Profit Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatPercent(data.financial.profitability.profitMargin)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.financial.profitability.netProfit)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Revenue Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <Line
                  data={{
                    labels: data.financial.revenue.byMonth.map(m => m.month),
                    datasets: [{
                      label: 'Revenue',
                      data: data.financial.revenue.byMonth.map(m => m.amount),
                      borderColor: '#800020',
                      backgroundColor: 'rgba(128, 0, 32, 0.1)',
                      fill: true,
                      tension: 0.4,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => `₦${(value as number).toLocaleString()}`,
                        },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Revenue by Asset Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <Doughnut
                  data={{
                    labels: data.financial.revenue.byAssetType.map(a => a.assetType),
                    datasets: [{
                      data: data.financial.revenue.byAssetType.map(a => a.amount),
                      backgroundColor: [
                        '#800020',
                        '#A00028',
                        '#C00030',
                        '#E00038',
                        '#FF4444',
                      ],
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'right' },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Revenue Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Claim Reference</th>
                    <th className="text-left py-2 px-4">Asset Type</th>
                    <th className="text-right py-2 px-4">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.financial.revenue.topCases.map((c, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 font-medium">{c.claimRef}</td>
                      <td className="py-2 px-4 capitalize">{c.assetType}</td>
                      <td className="py-2 px-4 text-right font-bold">{formatCurrency(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Recovery Rate Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Average Recovery Rate</p>
              <p className="text-3xl font-bold">{formatPercent(data.financial.recovery.averageRate)}</p>
              <p className="text-xs text-gray-500">of market value</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-2">By Asset Type</h4>
                {data.financial.recovery.byAssetType.map((a, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b">
                    <span className="capitalize">{a.assetType}</span>
                    <span className="font-bold">{formatPercent(a.rate)}</span>
                  </div>
                ))}
              </div>
              <div className="h-48">
                <Line
                  data={{
                    labels: data.financial.recovery.trend.map(t => t.month),
                    datasets: [{
                      label: 'Recovery Rate %',
                      data: data.financial.recovery.trend.map(t => t.rate),
                      borderColor: '#800020',
                      backgroundColor: 'rgba(128, 0, 32, 0.1)',
                      fill: true,
                      tension: 0.4,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* OPERATIONAL SECTION */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-[#800020]">Operational Performance</h2>
        
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <Card>
            <CardHeader>
              <CardTitle>Cases Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold mb-4">{data.operational.cases.total}</p>
              <div className="space-y-2">
                {data.operational.cases.byStatus.map((s, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm capitalize">{s.status.replace('_', ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.count}</span>
                      <span className="text-xs text-gray-500">({formatPercent(s.percentage)})</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auctions Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold mb-4">{data.operational.auctions.total}</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Active</span>
                  <span className="font-semibold">{data.operational.auctions.active}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Closed</span>
                  <span className="font-semibold">{data.operational.auctions.closed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Success Rate</span>
                  <span className="font-semibold text-green-600">{formatPercent(data.operational.auctions.successRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Competitive Rate</span>
                  <span className="font-semibold">{formatPercent(data.operational.auctions.competitiveRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Avg Bidders</span>
                  <span className="font-semibold">{data.operational.auctions.avgBidders.toFixed(1)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold mb-4">{data.operational.documents.totalGenerated}</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Completion Rate</span>
                  <span className="font-semibold text-green-600">{formatPercent(data.operational.documents.completionRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Avg Time</span>
                  <span className="font-semibold">{data.operational.documents.avgTimeToComplete.toFixed(1)}h</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Cases by Asset Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar
                data={{
                  labels: data.operational.cases.byAssetType.map(a => a.assetType),
                  datasets: [
                    {
                      label: 'Case Count',
                      data: data.operational.cases.byAssetType.map(a => a.count),
                      backgroundColor: '#800020',
                      yAxisID: 'y',
                    },
                    {
                      label: 'Avg Processing Time (days)',
                      data: data.operational.cases.byAssetType.map(a => a.avgTime),
                      backgroundColor: '#C00030',
                      yAxisID: 'y1',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      type: 'linear',
                      display: true,
                      position: 'left',
                      title: { display: true, text: 'Case Count' },
                    },
                    y1: {
                      type: 'linear',
                      display: true,
                      position: 'right',
                      title: { display: true, text: 'Avg Days' },
                      grid: { drawOnChartArea: false },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Auctions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Claim Reference</th>
                    <th className="text-center py-2 px-4">Bidders</th>
                    <th className="text-center py-2 px-4">Total Bids</th>
                    <th className="text-right py-2 px-4">Winning Bid</th>
                  </tr>
                </thead>
                <tbody>
                  {data.operational.auctions.topAuctions.map((a, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 font-medium">{a.claimRef}</td>
                      <td className="py-2 px-4 text-center">{a.bidders}</td>
                      <td className="py-2 px-4 text-center">{a.bids}</td>
                      <td className="py-2 px-4 text-right font-bold">{formatCurrency(parseFloat(a.winningBid))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* PERFORMANCE SECTION */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-[#800020]">Team Performance</h2>
        
        <div className="grid gap-4 md:grid-cols-4 mb-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Total Adjusters</p>
              <p className="text-3xl font-bold">{data.performance.teamMetrics.totalAdjusters}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Avg Quality Score</p>
              <p className="text-3xl font-bold">{data.performance.teamMetrics.avgQualityScore.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Top Performer</p>
              <p className="text-lg font-bold truncate">{data.performance.teamMetrics.topPerformer}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Active Vendors</p>
              <p className="text-3xl font-bold">{data.performance.teamMetrics.activeVendors}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Claims Adjusters Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Name</th>
                    <th className="text-center py-2 px-4">Cases</th>
                    <th className="text-center py-2 px-4">Approval Rate</th>
                    <th className="text-center py-2 px-4">Avg Time (days)</th>
                    <th className="text-right py-2 px-4">Revenue</th>
                    <th className="text-center py-2 px-4">Quality Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.performance.adjusters.map((adj, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 font-medium">{adj.name}</td>
                      <td className="py-2 px-4 text-center">{adj.casesProcessed}</td>
                      <td className="py-2 px-4 text-center">
                        <span className={adj.approvalRate >= 80 ? 'text-green-600 font-semibold' : ''}>
                          {formatPercent(adj.approvalRate)}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-center">{adj.avgProcessingTime.toFixed(1)}</td>
                      <td className="py-2 px-4 text-right font-bold">{formatCurrency(adj.revenue)}</td>
                      <td className="py-2 px-4 text-center">
                        <span className={`font-semibold ${
                          adj.qualityScore >= 80 ? 'text-green-600' :
                          adj.qualityScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {adj.qualityScore.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Business Name</th>
                    <th className="text-center py-2 px-4">Tier</th>
                    <th className="text-center py-2 px-4">Participated</th>
                    <th className="text-center py-2 px-4">Won</th>
                    <th className="text-center py-2 px-4">Win Rate</th>
                    <th className="text-right py-2 px-4">Total Spent</th>
                    <th className="text-right py-2 px-4">Avg Bid</th>
                    <th className="text-center py-2 px-4">Payment Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.performance.vendors.map((v, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 font-medium">{v.businessName}</td>
                      <td className="py-2 px-4 text-center">
                        <span className="px-2 py-1 bg-gray-100 rounded text-sm">Tier {v.tier}</span>
                      </td>
                      <td className="py-2 px-4 text-center">{v.auctionsParticipated}</td>
                      <td className="py-2 px-4 text-center">{v.auctionsWon}</td>
                      <td className="py-2 px-4 text-center">
                        <span className={v.winRate >= 50 ? 'text-green-600 font-semibold' : ''}>
                          {formatPercent(v.winRate)}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right font-bold">{formatCurrency(v.totalSpent)}</td>
                      <td className="py-2 px-4 text-right">{formatCurrency(v.avgBid)}</td>
                      <td className="py-2 px-4 text-center">
                        <span className={v.paymentRate >= 90 ? 'text-green-600 font-semibold' : ''}>
                          {formatPercent(v.paymentRate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* AUCTION INTELLIGENCE SECTION */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-[#800020]">Auction Intelligence</h2>
        
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <Card>
            <CardHeader>
              <CardTitle>Bidding Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Total Bids</p>
                  <p className="text-2xl font-bold">{data.auctionIntelligence.bidding.totalBids}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Bids per Auction</p>
                  <p className="text-2xl font-bold">{data.auctionIntelligence.bidding.avgBidsPerAuction.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Competition Level</p>
                  <p className={`text-xl font-bold ${
                    data.auctionIntelligence.bidding.competitionLevel === 'High' ? 'text-green-600' :
                    data.auctionIntelligence.bidding.competitionLevel === 'Medium' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {data.auctionIntelligence.bidding.competitionLevel}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Avg Starting Bid</p>
                  <p className="text-xl font-bold">{formatCurrency(data.auctionIntelligence.pricing.avgStartingBid)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Winning Bid</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(data.auctionIntelligence.pricing.avgWinningBid)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Price Increase</p>
                  <p className="text-xl font-bold">{formatCurrency(data.auctionIntelligence.pricing.avgPriceIncrease)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timing Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Avg Duration</p>
                  <p className="text-2xl font-bold">{data.auctionIntelligence.timing.avgAuctionDuration.toFixed(1)}h</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Extension Rate</p>
                  <p className="text-xl font-bold">{formatPercent(data.auctionIntelligence.timing.extensionRate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Closure Success</p>
                  <p className="text-xl font-bold text-green-600">{formatPercent(data.auctionIntelligence.timing.closureSuccessRate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {data.auctionIntelligence.bidding.peakBiddingHours.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Peak Bidding Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <Bar
                  data={{
                    labels: data.auctionIntelligence.bidding.peakBiddingHours.map(h => `${h.hour}:00`),
                    datasets: [{
                      label: 'Bid Count',
                      data: data.auctionIntelligence.bidding.peakBiddingHours.map(h => h.count),
                      backgroundColor: '#800020',
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* SYSTEM HEALTH SECTION */}
      <section>
        <h2 className="text-2xl font-bold mb-4 text-[#800020]">System Health & Compliance</h2>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Data Quality</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Complete Cases</p>
                  <p className="text-2xl font-bold">{data.systemHealth.dataQuality.completeCases}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Missing Data</p>
                  <p className="text-2xl font-bold text-red-600">{data.systemHealth.dataQuality.missingData}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Quality Score</p>
                  <p className="text-2xl font-bold text-green-600">{formatPercent(data.systemHealth.dataQuality.dataQualityScore)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Avg Response Time</p>
                  <p className="text-2xl font-bold">{data.systemHealth.performance.avgApiResponseTime}ms</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold">{formatPercent(data.systemHealth.performance.errorRate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Uptime</p>
                  <p className="text-2xl font-bold text-green-600">{formatPercent(data.systemHealth.performance.uptime)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Audit Coverage</p>
                  <p className="text-2xl font-bold">{formatPercent(data.systemHealth.compliance.auditTrailCoverage)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Security Incidents</p>
                  <p className="text-2xl font-bold">{data.systemHealth.compliance.securityIncidents}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Compliance Score</p>
                  <p className="text-2xl font-bold text-green-600">{data.systemHealth.compliance.complianceScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* METADATA */}
      <Card className="mt-8">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div>
              <p>Report Version: {data.metadata.reportVersion}</p>
              <p>Date Range: {new Date(data.metadata.dateRange.start).toLocaleDateString()} - {new Date(data.metadata.dateRange.end).toLocaleDateString()}</p>
            </div>
            <p>Generated: {new Date(data.metadata.generatedAt).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
