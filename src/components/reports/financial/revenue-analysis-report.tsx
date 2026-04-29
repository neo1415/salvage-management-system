'use client';

/**
 * Revenue Analysis Report Component
 * Task 10: Financial Reports UI
 * 
 * Displays revenue metrics, recovery rates, trends, and breakdowns
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Banknote, BarChart3 } from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RevenueAnalysisData {
  summary: {
    totalCases: number;
    totalClaimsPaid: number;
    totalSalvageRecovered: number;
    totalRegistrationFees: number;
    totalRevenue: number;
    totalNetLoss: number;
    averageRecoveryRate: number;
  };
  byAssetType: Array<{
    assetType: string;
    count: number;
    claimsPaid: number;
    salvageRecovered: number;
    netLoss: number;
    recoveryRate: number;
  }>;
  byRegion?: Array<{
    region: string;
    count: number;
    claimsPaid: number;
    salvageRecovered: number;
    recoveryRate: number;
  }>;
  itemBreakdown: Array<{
    claimReference: string;
    assetType: string;
    marketValue: number;
    salvageRecovery: number;
    netLoss: number;
    recoveryRate: number;
    region: string;
    date: string;
  }>;
  registrationFees: Array<{
    vendorName: string;
    amount: number;
    paymentMethod: string;
    date: string;
    status: string;
  }>;
  trend: Array<{
    date: string;
    claimsPaid: number;
    salvageRecovered: number;
    recoveryRate: number;
    count: number;
  }>;
}

interface RevenueAnalysisReportProps {
  data: RevenueAnalysisData;
  loading?: boolean;
}

export function RevenueAnalysisReport({ data, loading }: RevenueAnalysisReportProps) {
  if (loading || !data) {
    return <RevenueAnalysisSkeleton />;
  }

  // Ensure data has required properties with defaults
  const safeData = {
    summary: data.summary || {
      totalCases: 0,
      totalClaimsPaid: 0,
      totalSalvageRecovered: 0,
      totalRegistrationFees: 0,
      totalRevenue: 0,
      totalNetLoss: 0,
      averageRecoveryRate: 0,
    },
    byAssetType: data.byAssetType || [],
    byRegion: data.byRegion || [],
    itemBreakdown: data.itemBreakdown || [],
    registrationFees: data.registrationFees || [],
    trend: data.trend || [],
  };

  // Calculate trend direction
  const trendDirection = safeData.trend.length >= 2
    ? safeData.trend[safeData.trend.length - 1].salvageRecovered > safeData.trend[safeData.trend.length - 2].salvageRecovered
      ? 'up'
      : 'down'
    : 'neutral';

  // Chart data for salvage recovery trends
  const trendChartData = {
    labels: safeData.trend.map(t => t?.date || 'N/A'),
    datasets: [
      {
        label: 'Salvage Recovered (₦)',
        data: safeData.trend.map(t => t?.salvageRecovered || 0),
        borderColor: '#800020',
        backgroundColor: 'rgba(128, 0, 32, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Chart data for asset type breakdown
  const assetTypeChartData = {
    labels: safeData.byAssetType.map(a => a?.assetType || 'Unknown'),
    datasets: [
      {
        label: 'Salvage Recovered by Asset Type (₦)',
        data: safeData.byAssetType.map(a => a?.salvageRecovered || 0),
        backgroundColor: ['#800020', '#A00028', '#C00030', '#E00038'],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        type: 'linear' as const,
        beginAtZero: true,
      },
      x: {
        type: 'category' as const,
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Revenue
            </CardTitle>
            <Banknote className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{safeData.summary.totalRevenue.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
              {trendDirection === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}>
                {trendDirection === 'up' ? 'Increasing' : 'Decreasing'} trend
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Salvage Recovered
            </CardTitle>
            <Banknote className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{safeData.summary.totalSalvageRecovered.toLocaleString()}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              From {safeData.summary.totalCases} cases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Registration Fees
            </CardTitle>
            <Banknote className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{safeData.summary.totalRegistrationFees.toLocaleString()}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {safeData.registrationFees.length} payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Recovery Rate
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeData.summary.averageRecoveryRate.toFixed(2)}%
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Of claim payouts recovered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Salvage Recovery Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Salvage Recovery Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Line data={trendChartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Asset Type Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Salvage Recovery by Asset Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar data={assetTypeChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset Type Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {safeData.byAssetType.map((asset, index) => (
                <div key={asset?.assetType || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium capitalize">{asset?.assetType || 'Unknown'}</p>
                    <p className="text-sm text-gray-600">{asset?.count || 0} cases</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#800020]">
                      ₦{(asset?.salvageRecovered || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600">
                      ₦{Math.round((asset?.salvageRecovered || 0) / (asset?.count || 1)).toLocaleString()} avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regional Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Salvage Recovery by Region</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {safeData.byRegion.map((region, index) => (
              <div key={region?.region || index} className="flex items-center justify-between p-3 border-b last:border-0">
                <div className="flex-1">
                  <p className="font-medium">{region?.region || 'Unknown'}</p>
                  <p className="text-sm text-gray-600">{region?.count || 0} cases</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">₦{(region?.salvageRecovered || 0).toLocaleString()}</p>
                  <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-[#800020] h-2 rounded-full"
                      style={{
                        width: `${safeData.summary.totalSalvageRecovered > 0 ? ((region?.salvageRecovered || 0) / safeData.summary.totalSalvageRecovered) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Item Breakdown Table */}
      {safeData.itemBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Item Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Claim Reference</th>
                    <th className="text-left p-2 font-medium">Asset Type</th>
                    <th className="text-right p-2 font-medium">Market Value</th>
                    <th className="text-right p-2 font-medium">Salvage Recovery</th>
                    <th className="text-right p-2 font-medium">Net Loss</th>
                    <th className="text-right p-2 font-medium">Recovery Rate</th>
                    <th className="text-left p-2 font-medium">Region</th>
                    <th className="text-left p-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {safeData.itemBreakdown.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{item.claimReference}</td>
                      <td className="p-2 capitalize">{item.assetType}</td>
                      <td className="p-2 text-right">₦{item.marketValue.toLocaleString()}</td>
                      <td className="p-2 text-right text-green-600">₦{item.salvageRecovery.toLocaleString()}</td>
                      <td className="p-2 text-right text-red-600">₦{item.netLoss.toLocaleString()}</td>
                      <td className="p-2 text-right">{item.recoveryRate.toFixed(2)}%</td>
                      <td className="p-2">{item.region}</td>
                      <td className="p-2">{new Date(item.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration Fees Table */}
      {safeData.registrationFees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registration Fees Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Vendor Name</th>
                    <th className="text-right p-2 font-medium">Amount</th>
                    <th className="text-left p-2 font-medium">Payment Method</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {safeData.registrationFees.map((fee, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{fee.vendorName}</td>
                      <td className="p-2 text-right text-green-600">₦{fee.amount.toLocaleString()}</td>
                      <td className="p-2 capitalize">{fee.paymentMethod}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          fee.status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {fee.status}
                        </span>
                      </td>
                      <td className="p-2">{new Date(fee.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RevenueAnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse" />
              <div className="h-8 bg-gray-200 rounded w-32 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    </div>
  );
}
