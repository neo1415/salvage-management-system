'use client';

/**
 * My Performance Report Component
 * Task 23: User Performance Reports UI
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, FileText, Clock, Award } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface MyPerformanceData {
  casesProcessed: number;
  avgProcessingTime: number;
  approvalRate: number;
  qualityScore: number;
  trends: Array<{ period: string; cases: number; quality: number }>;
  revenueContribution: number;
  teamBreakdown?: Array<{
    adjusterId: string;
    adjusterName: string;
    casesSubmitted: number;
    casesApproved: number;
    casesRejected: number;
    approvalRate: number;
    avgProcessingTime: number;
    revenue: number;
  }>;
  pendingApproval?: number;
}

interface MyPerformanceReportProps {
  data: MyPerformanceData;
  loading?: boolean;
}

export function MyPerformanceReport({ data, loading }: MyPerformanceReportProps) {
  if (loading) {
    return <div>Loading...</div>;
  }

  const isManagerView = !!data.teamBreakdown;

  // Memoize chart data to prevent recreation on every render
  const trendChartData = useMemo(() => ({
    labels: data.trends.map(t => t.period),
    datasets: [
      {
        label: 'Cases Processed',
        data: data.trends.map(t => t.cases),
        borderColor: '#800020',
        yAxisID: 'y',
      },
      {
        label: 'Quality Score',
        data: data.trends.map(t => t.quality),
        borderColor: '#FFD700',
        yAxisID: 'y1',
      },
    ],
  }), [data.trends]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { type: 'linear' as const, position: 'left' as const },
      y1: { type: 'linear' as const, position: 'right' as const, grid: { drawOnChartArea: false } },
    },
  }), []);

  return (
    <div className="space-y-6">
      {isManagerView && data.pendingApproval !== undefined && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">{data.pendingApproval}</div>
            <p className="text-sm text-yellow-700 mt-2">Cases awaiting your review</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {isManagerView ? 'Team Cases' : 'Cases Processed'}
            </CardTitle>
            <FileText className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.casesProcessed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.avgProcessingTime.toFixed(1)} days</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {isManagerView ? 'Team Approval Rate' : 'Approval Rate'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.approvalRate.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Quality Score</CardTitle>
            <Award className="h-4 w-4 text-[#800020]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.qualityScore.toFixed(1)}/100</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <Line 
              data={trendChartData} 
              options={chartOptions}
            />
          </div>
        </CardContent>
      </Card>

      {isManagerView && data.teamBreakdown && data.teamBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team Breakdown by Adjuster</CardTitle>
          </CardHeader>
          <CardContent>
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
                  </tr>
                </thead>
                <tbody>
                  {data.teamBreakdown.map((adjuster) => (
                    <tr key={adjuster.adjusterId} className="border-b hover:bg-gray-50">
                      <td className="p-2">{adjuster.adjusterName}</td>
                      <td className="text-right p-2">{adjuster.casesSubmitted}</td>
                      <td className="text-right p-2 text-green-600">{adjuster.casesApproved}</td>
                      <td className="text-right p-2 text-red-600">{adjuster.casesRejected}</td>
                      <td className="text-right p-2">{adjuster.approvalRate.toFixed(1)}%</td>
                      <td className="text-right p-2">{adjuster.avgProcessingTime.toFixed(1)}d</td>
                      <td className="text-right p-2">₦{adjuster.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Revenue Contribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-[#800020]">
            ₦{data.revenueContribution.toLocaleString()}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {isManagerView ? 'Total revenue from team cases that sold' : 'Total revenue from your processed cases'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
