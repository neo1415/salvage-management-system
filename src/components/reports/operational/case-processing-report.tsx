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
    averageProcessingTimeHours: number;
    approvalRate: number;
    pendingCases: number;
    approvedCases: number;
    rejectedCases: number;
  };
  byStatus: Array<{ status: string; count: number; percentage: number }>;
  byAssetType: Array<{ assetType: string; count: number; averageProcessingTime: number; approvalRate: number }>;
  trend: Array<{ date: string; count: number; approved: number; rejected: number }>;
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
      <div className="grid gap-4 md:grid-cols-3">
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
            <div className="text-2xl font-bold">{data.summary.averageProcessingTimeHours.toFixed(1)} hours</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Approval Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.approvalRate.toFixed(1)}%</div>
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

      <Card>
        <CardHeader>
          <CardTitle>By Asset Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.byAssetType.map((asset) => (
              <div key={asset.assetType} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium capitalize">{asset.assetType}</p>
                  <p className="text-sm text-gray-600">{asset.count} cases</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{asset.averageProcessingTime.toFixed(1)} hours</p>
                  <p className="text-xs text-gray-600">avg time</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
