'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DataLoadingState } from '@/components/ui/loading-states';
import { StatCard, StatGrid, StatTile, MetricValue } from '@/components/ui/stat-card';

interface EscrowReportSummary {
  totalPayments: number;
  totalAmount: number;
  autoReleased: number;
  manualReleased: number;
  failed: number;
  automationSuccessRate: number;
  allDocumentsSigned: number;
  partialDocumentsSigned: number;
  noDocumentsSigned: number;
  documentCompletionRate: number;
  avgProcessingTimeHours: number;
  dateRange: {
    start: string;
    end: string;
  };
}

interface TimeSeriesData {
  date: string;
  count: number;
  amount: number;
}

interface DetailedPayment {
  paymentId: string;
  claimReference: string;
  assetType: string;
  vendorName: string;
  amount: number;
  status: string;
  escrowStatus: string | null;
  autoVerified: boolean;
  createdAt: string;
  verifiedAt: string | null;
  documentsSigned: number;
  totalDocuments: number;
  processingTimeHours: number | null;
}

export default function EscrowPerformanceReportPage() {
  const [summary, setSummary] = useState<EscrowReportSummary | null>(null);
  const hasReportDataRef = useRef(false);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [detailedPayments, setDetailedPayments] = useState<DetailedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Date range filters
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const fetchReport = useCallback(async () => {
    const showFullPageLoader = !hasReportDataRef.current;
    try {
      if (showFullPageLoader) {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (dateFrom) params.append('startDate', new Date(dateFrom).toISOString());
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        params.append('endDate', endDate.toISOString());
      }

      const response = await fetch(`/api/reports/escrow-performance?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }

      const result = await response.json();
      setSummary(result.data.summary);
      setTimeSeriesData(result.data.timeSeriesData);
      setDetailedPayments(result.data.detailedPayments);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportToPDF = async () => {
    setExporting(true);
    try {
      window.print();
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = () => {
    if (!detailedPayments.length) return;

    // CSV headers
    const headers = [
      'Claim Reference',
      'Vendor',
      'Asset Type',
      'Amount (₦)',
      'Status',
      'Escrow Status',
      'Auto Verified',
      'Documents Signed',
      'Processing Time (hours)',
      'Created At',
      'Verified At',
    ];

    // CSV rows
    const rows = detailedPayments.map((payment) => [
      payment.claimReference,
      payment.vendorName,
      payment.assetType,
      payment.amount.toFixed(2),
      payment.status,
      payment.escrowStatus || 'N/A',
      payment.autoVerified ? 'Yes' : 'No',
      `${payment.documentsSigned}/${payment.totalDocuments}`,
      payment.processingTimeHours?.toFixed(2) || 'N/A',
      new Date(payment.createdAt).toLocaleString('en-US'),
      payment.verifiedAt ? new Date(payment.verifiedAt).toLocaleString('en-US') : 'N/A',
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `escrow-performance-report-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !summary) {
    return <DataLoadingState label="Escrow performance report" variant="report" />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Escrow Payment Performance Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track automation success rates and processing metrics
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToPDF}
            disabled={exporting}
            className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors disabled:opacity-50"
          >
            📄 Export PDF
          </button>
          <button
            onClick={exportToExcel}
            disabled={!detailedPayments.length}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Date Range</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              id="date-from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              id="date-to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchReport}
              className="w-full px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <StatGrid className="lg:grid-cols-4">
        <StatCard
          title="Total Payments"
          value={summary.totalPayments}
          subtitle={`₦${summary.totalAmount.toLocaleString()} processed`}
          className="shadow"
        />
        <StatCard
          title="Automation Rate"
          value={`${summary.automationSuccessRate.toFixed(1)}%`}
          subtitle={`${summary.autoReleased} auto / ${summary.manualReleased} manual`}
          valueClassName="text-green-600"
          className="shadow"
        />
        <StatCard
          title="Document Completion"
          value={`${summary.documentCompletionRate.toFixed(1)}%`}
          subtitle={`${summary.allDocumentsSigned} completed all docs`}
          valueClassName="text-purple-600"
          className="shadow"
        />
        <StatCard
          title="Avg Processing Time"
          value={`${summary.avgProcessingTimeHours.toFixed(1)}h`}
          subtitle={`${summary.failed} failed releases`}
          valueClassName="text-orange-600"
          className="shadow"
        />
      </StatGrid>

      {/* Automation Success Rate Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Automation Success Rate</h2>
        <div className="flex items-center justify-center space-x-8">
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {/* Auto-released segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#10b981"
                strokeWidth="20"
                strokeDasharray={`${summary.automationSuccessRate * 2.51} 251`}
              />
              {/* Manual segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="20"
                strokeDasharray={`${((summary.manualReleased / summary.totalPayments) * 100) * 2.51} 251`}
                strokeDashoffset={`-${summary.automationSuccessRate * 2.51}`}
              />
              {/* Failed segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#ef4444"
                strokeWidth="20"
                strokeDasharray={`${((summary.failed / summary.totalPayments) * 100) * 2.51} 251`}
                strokeDashoffset={`-${(summary.automationSuccessRate + ((summary.manualReleased / summary.totalPayments) * 100)) * 2.51}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MetricValue className="text-gray-900">{summary.automationSuccessRate.toFixed(0)}%</MetricValue>
                <p className="text-xs text-gray-500">Auto</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-700">
                Auto-Released: {summary.autoReleased} ({summary.automationSuccessRate.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm text-gray-700">
                Manual: {summary.manualReleased} ({((summary.manualReleased / summary.totalPayments) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-700">
                Failed: {summary.failed} ({((summary.failed / summary.totalPayments) * 100).toFixed(1)}%)
              </span>
            </div>
            {summary.automationSuccessRate >= 90 ? (
              <div className="flex items-center space-x-2 text-green-600 text-sm font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Target achieved! (90%+)</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-yellow-600 text-sm font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Below 90% target</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payments Over Time Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Escrow Payments Over Time</h2>
        {timeSeriesData.length > 0 ? (
          <div className="space-y-4">
            <div className="h-64 flex items-end justify-between gap-2">
              {timeSeriesData.map((data, index) => {
                const maxCount = Math.max(...timeSeriesData.map(d => d.count));
                const height = (data.count / maxCount) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center">
                      <div
                        className="w-full bg-[var(--brand-primary)] rounded-t hover:bg-[var(--brand-primary-hover)] transition-colors cursor-pointer relative group"
                        style={{ height: `${height}%`, minHeight: data.count > 0 ? '20px' : '0' }}
                        title={`${data.date}: ${data.count} payments, ₦${data.amount.toLocaleString()}`}
                      >
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {data.count} payments<br />₦{data.amount.toLocaleString()}
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 mt-2 transform -rotate-45 origin-top-left">
                        {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-center text-sm text-gray-600">
              Daily escrow wallet payments
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No payment data available for the selected date range
          </div>
        )}
      </div>

      {/* Document Signing Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Signing Status</h2>
        <StatGrid className="md:grid-cols-3">
          <StatTile
            title="All Documents Signed"
            value={summary.allDocumentsSigned}
            subtitle={`${summary.documentCompletionRate.toFixed(1)}% completion rate`}
            className="bg-green-50 border-green-200"
            valueClassName="text-green-900"
          />
          <StatTile
            title="Partial Signing"
            value={summary.partialDocumentsSigned}
            subtitle={`${((summary.partialDocumentsSigned / summary.totalPayments) * 100).toFixed(1)}% of total`}
            className="bg-yellow-50 border-yellow-200"
            valueClassName="text-yellow-900"
          />
          <StatTile
            title="No Documents Signed"
            value={summary.noDocumentsSigned}
            subtitle={`${((summary.noDocumentsSigned / summary.totalPayments) * 100).toFixed(1)}% of total`}
            className="bg-red-50 border-red-200"
            valueClassName="text-red-900"
          />
        </StatGrid>
      </div>

      {/* Detailed Payments Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Detailed Payment List</h2>
          <p className="text-sm text-gray-500 mt-1">
            {detailedPayments.length} payment{detailedPayments.length !== 1 ? 's' : ''} found
          </p>
        </div>

        <div className="overflow-x-auto">
          {detailedPayments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No payments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No escrow wallet payments in the selected date range.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Claim Reference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processing Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detailedPayments.map((payment) => (
                  <tr key={payment.paymentId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{payment.claimReference}</div>
                      <div className="text-xs text-gray-500">{payment.assetType}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.vendorName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₦{payment.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payment.status === 'verified' ? 'bg-green-100 text-green-800' :
                          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {payment.status}
                        </span>
                        {payment.autoVerified && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            🤖 Auto
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payment.documentsSigned}/{payment.totalDocuments}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div
                          className={`h-1.5 rounded-full ${
                            payment.documentsSigned === payment.totalDocuments ? 'bg-green-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${(payment.documentsSigned / payment.totalDocuments) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payment.processingTimeHours !== null
                          ? `${payment.processingTimeHours.toFixed(1)}h`
                          : 'Pending'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(payment.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(payment.createdAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
