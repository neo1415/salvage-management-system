'use client';

/**
 * Case Processing Report Component
 * Task 17: Operational Reports UI
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Clock, CheckCircle } from 'lucide-react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CaseProcessingData {
  summary: {
    totalCases: number;
    averageProcessingTimeDays: number;
    approvalRate: number;
    pendingCases: number;
    approvedCases: number;
    soldCases: number;
    activeAuctionCases: number;
    cancelledCases: number;
    totalMarketValue: number;
    totalSalvageValue: number;
    averageMarketValue: number;
    averageSalvageValue: number;
  };
  byStatus: Array<{ status: string; count: number; percentage: number }>;
  byAssetType: Array<{
    assetType: string;
    count: number;
    averageProcessingTime: number;
    approvalRate: number;
    totalMarketValue: number;
    totalSalvageValue: number;
    averageMarketValue: number;
    cases: Array<{
      claimReference: string;
      status: string;
      marketValue: number;
      salvageValue: number;
      processingDays: number;
      createdAt: string;
    }>;
  }>;
  trend: Array<{ date: string; count: number; approved: number; sold: number }>;
  byAdjuster: Array<{ adjusterId: string; adjusterName: string; casesProcessed: number; averageProcessingTime: number; approvalRate: number }>;
}

interface CaseProcessingReportProps {
  data: CaseProcessingData;
  loading?: boolean;
}

export function CaseProcessingReport({ data, loading }: CaseProcessingReportProps) {
  if (loading) {
    return <div>Loading...</div>;
  }

  if (!data || !data.byStatus || !data.byAssetType || !data.trend) {
    return <div>No data available</div>;
  }

  const statusChartData = {
    labels: data.byStatus.map(s => s.status),
    datasets: [{
      label: 'Cases by Status',
      data: data.byStatus.map(s => s.count),
      backgroundColor: ['#800020', '#A00028', '#C00030', '#E00038'],
    }],
  };

  const trendChartData = {
    labels: data.trend.map(t => t.date),
    datasets: [{
      label: 'Cases Processed',
      data: data.trend.map(t => t.count),
      borderColor: '#800020',
      backgroundColor: 'rgba(128, 0, 32, 0.1)',
      fill: true,
    }],
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Cases</CardTitle>
            <FileText className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalCases}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.summary.averageProcessingTimeDays ?? 0).toFixed(1)} days
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Approval Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.summary.approvalRate ?? 0).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Market Value</CardTitle>
            <FileText className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₦{(data.summary.totalMarketValue ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Salvage Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₦{(data.summary.totalSalvageValue ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Avg Market Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₦{(data.summary.averageMarketValue ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Avg Salvage Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">₦{(data.summary.averageSalvageValue ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cases by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Bar data={statusChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Line data={trendChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {data.byAssetType.map((asset) => (
        <Card key={asset.assetType}>
          <CardHeader>
            <CardTitle className="capitalize">{asset.assetType} Cases ({asset.count})</CardTitle>
            <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
              <div>
                <p className="text-gray-600">Total Market Value</p>
                <p className="font-bold text-lg">₦{asset.totalMarketValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Total Salvage Value</p>
                <p className="font-bold text-lg">₦{asset.totalSalvageValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Avg Processing Time</p>
                <p className="font-bold text-lg">{(asset.averageProcessingTime ?? 0).toFixed(1)} days</p>
              </div>
              <div>
                <p className="text-gray-600">Approval Rate</p>
                <p className="font-bold text-lg">{(asset.approvalRate ?? 0).toFixed(1)}%</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Claim Reference</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-right py-2 px-3">Market Value</th>
                    <th className="text-right py-2 px-3">Salvage Value</th>
                    <th className="text-right py-2 px-3">Processing Days</th>
                    <th className="text-left py-2 px-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {asset.cases.map((caseItem) => (
                    <tr key={caseItem.claimReference} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{caseItem.claimReference}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          caseItem.status === 'sold' ? 'bg-green-100 text-green-800' :
                          caseItem.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                          caseItem.status === 'active_auction' ? 'bg-yellow-100 text-yellow-800' :
                          caseItem.status === 'pending_approval' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {caseItem.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-medium">₦{caseItem.marketValue.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">₦{caseItem.salvageValue.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{(caseItem.processingDays ?? 0).toFixed(1)}</td>
                      <td className="py-2 px-3">{caseItem.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
