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
  totalRevenue: number;
  recoveryRate: number;
  trends: Array<{ period: string; revenue: number; recoveryRate: number }>;
  byAssetType: Array<{ assetType: string; revenue: number; count: number }>;
  byRegion: Array<{ region: string; revenue: number; count: number }>;
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
    totalRevenue: data.totalRevenue || 0,
    recoveryRate: data.recoveryRate || 0,
    trends: data.trends || [],
    byAssetType: data.byAssetType || [],
    byRegion: data.byRegion || [],
  };

  // Calculate trend direction
  const trendDirection = safeData.trends.length >= 2
    ? safeData.trends[safeData.trends.length - 1].revenue > safeData.trends[safeData.trends.length - 2].revenue
      ? 'up'
      : 'down'
    : 'neutral';

  // Chart data for salvage recovery trends
  const trendChartData = {
    labels: safeData.trends.map(t => t?.period || 'N/A'),
    datasets: [
      {
        label: 'Salvage Recovered (₦)',
        data: safeData.trends.map(t => t?.revenue || 0),
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
        data: safeData.byAssetType.map(a => a?.revenue || 0),
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Salvage Recovered
            </CardTitle>
            <Banknote className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{safeData.totalRevenue.toLocaleString()}
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
              Recovery Rate
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeData.recoveryRate.toFixed(2)}%
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Of claim payouts recovered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Cases
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeData.byAssetType.reduce((sum, a) => sum + a.count, 0)}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Across all asset types
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
                      ₦{(asset?.revenue || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600">
                      ₦{Math.round((asset?.revenue || 0) / (asset?.count || 1)).toLocaleString()} avg
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
                  <p className="font-bold">₦{(region?.revenue || 0).toLocaleString()}</p>
                  <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-[#800020] h-2 rounded-full"
                      style={{
                        width: `${safeData.totalRevenue > 0 ? ((region?.revenue || 0) / safeData.totalRevenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
