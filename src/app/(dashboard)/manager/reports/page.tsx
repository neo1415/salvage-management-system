'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Manager Reports Page
 * 
 * Allows Salvage Managers to generate and share reports:
 * - Recovery Summary: Total cases, recovery rates, asset type breakdown
 * - Vendor Rankings: Top vendors by performance metrics
 * - Payment Aging: Payment status and overdue analysis
 * 
 * Features:
 * - Date range picker for filtering
 * - Generate PDF button
 * - Native mobile share (WhatsApp, Email, SMS)
 * 
 * Requirements: 33, NFR5.3
 */
export default function ReportsPage() {
  const router = useRouter();
  const [reportType, setReportType] = useState<'recovery-summary' | 'vendor-rankings' | 'payment-aging'>('recovery-summary');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default: last 30 days
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);

  const reportOptions = [
    {
      value: 'recovery-summary',
      label: 'Recovery Summary',
      description: 'Total cases, recovery rates, and asset type breakdown',
      icon: '📊',
    },
    {
      value: 'vendor-rankings',
      label: 'Vendor Rankings',
      description: 'Top vendors by bids, wins, and performance',
      icon: '🏆',
    },
    {
      value: 'payment-aging',
      label: 'Payment Aging',
      description: 'Payment status, overdue analysis, and aging buckets',
      icon: '💰',
    },
  ];

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setError(null);
    setReportData(null);

    try {
      // Validate date range
      if (new Date(startDate) > new Date(endDate)) {
        throw new Error('Start date must be before end date');
      }

      // Fetch report data from API
      const response = await fetch(
        `/api/reports/${reportType}?startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate report');
      }

      const result = await response.json();
      setReportData(result.data);
    } catch (err) {
      console.error('Report generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!reportData) return;

    setIsGenerating(true);
    setError(null);

    try {
      const reportTitles = {
        'recovery-summary': 'Recovery Summary Report',
        'vendor-rankings': 'Vendor Rankings Report',
        'payment-aging': 'Payment Aging Report',
      };

      // Generate PDF via API
      const response = await fetch('/api/reports/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType,
          data: reportData,
          title: reportTitles[reportType],
          dateRange: { start: startDate, end: endDate },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate PDF');
      }

      // Get HTML content
      const htmlContent = await response.text();

      // Create a blob and open in new window for printing/saving
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Open in new window
      const printWindow = window.open(url, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          // Auto-print after a short delay
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }

      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('PDF generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!reportData) return;

    const reportTitles = {
      'recovery-summary': 'Recovery Summary Report',
      'vendor-rankings': 'Vendor Rankings Report',
      'payment-aging': 'Payment Aging Report',
    };

    const title = reportTitles[reportType];
    const text = `${title}\nPeriod: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}\n\nGenerated from NEM Insurance Salvage Management System`;

    // Check if Web Share API is available (mobile browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled or failed:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(text);
        alert('Report details copied to clipboard! You can now paste and share via WhatsApp, Email, or SMS.');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        alert('Sharing not supported on this device. Please use the PDF option.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-white hover:text-gray-200"
            aria-label="Go back"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold">Reports</h1>
            <p className="text-sm text-gray-200">Generate and share insights</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Report Type Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Select Report Type
          </label>
          <div className="space-y-3">
            {reportOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setReportType(option.value as any)}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  reportType === option.value
                    ? 'border-[#800020] bg-[#800020] bg-opacity-5'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{option.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {option.label}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {option.description}
                    </div>
                  </div>
                  {reportType === option.value && (
                    <svg
                      className="w-6 h-6 text-[#800020] flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Picker */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Date Range
          </label>
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              />
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
              <strong>Period:</strong>{' '}
              {new Date(startDate).toLocaleDateString()} -{' '}
              {new Date(endDate).toLocaleDateString()} (
              {Math.ceil(
                (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )}{' '}
              days)
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Generate Report Button */}
        <button
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="w-full bg-[#800020] text-white py-4 rounded-lg font-semibold hover:bg-[#600018] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating Report...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Generate Report
            </span>
          )}
        </button>

        {/* Report Actions (shown after report is generated) */}
        {reportData && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    Report Generated Successfully
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    You can now generate PDF or share the report
                  </p>
                </div>
              </div>
            </div>

            {/* Generate PDF Button */}
            <button
              onClick={handleGeneratePDF}
              disabled={isGenerating}
              className="w-full bg-white border-2 border-[#800020] text-[#800020] py-4 rounded-lg font-semibold hover:bg-[#800020] hover:text-white disabled:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Generate PDF
              </span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShare}
              disabled={isGenerating}
              className="w-full bg-[#FFD700] text-[#800020] py-4 rounded-lg font-semibold hover:bg-[#FFC700] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Share Report
              </span>
            </button>

            {/* Share Info */}
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded text-center">
              Share via WhatsApp, Email, SMS, or other apps
            </div>
          </div>
        )}

        {/* Report Preview (optional - show summary) */}
        {reportData && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Report Preview</h3>
            <div className="space-y-2 text-sm">
              {reportType === 'recovery-summary' && reportData.summary && (
                <>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Total Cases:</span>
                    <span className="font-semibold">{reportData.summary.totalCases}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Recovery Rate:</span>
                    <span className="font-semibold text-green-600">
                      {reportData.summary.averageRecoveryRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Market Value:</span>
                    <span className="font-semibold">
                      ₦{reportData.summary.totalMarketValue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Recovery Value:</span>
                    <span className="font-semibold text-[#800020]">
                      ₦{reportData.summary.totalRecoveryValue.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
              {reportType === 'vendor-rankings' && reportData.rankings && (
                <>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Total Vendors:</span>
                    <span className="font-semibold">{reportData.totalVendors}</span>
                  </div>
                  <div className="py-2">
                    <span className="text-gray-600">Top 3 Vendors:</span>
                    <ol className="mt-2 space-y-1 ml-4">
                      {reportData.rankings.slice(0, 3).map((vendor: {
                        vendorId: string;
                        rank: number;
                        businessName: string;
                        totalWins: number;
                        totalSpent: number;
                      }) => (
                        <li key={vendor.vendorId} className="text-xs">
                          <span className="font-semibold">#{vendor.rank}</span>{' '}
                          {vendor.businessName} - ₦{vendor.totalSpent.toLocaleString()}
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
              {reportType === 'payment-aging' && reportData.summary && (
                <>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Total Payments:</span>
                    <span className="font-semibold">{reportData.summary.totalPayments}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Pending:</span>
                    <span className="font-semibold text-orange-600">
                      {reportData.summary.statusCounts.pending}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">Overdue:</span>
                    <span className="font-semibold text-red-600">
                      {reportData.summary.statusCounts.overdue}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Auto-Verification Rate:</span>
                    <span className="font-semibold text-green-600">
                      {reportData.summary.autoVerificationRate.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
