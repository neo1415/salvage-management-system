'use client';

/**
 * Revenue Analysis Report Page
 * Task 10: Financial Reports UI
 * 
 * Displays comprehensive revenue analysis with filters and export
 */

import { useState, useEffect } from 'react';
import { useReportFetchState } from '@/hooks/use-report-fetch-state';
import { DataLoadingState, DataRefreshingHint } from '@/components/ui/loading-states';
import { useSession } from 'next-auth/react';
import { useAppRouter } from '@/hooks/use-app-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';
import { RevenueAnalysisReport } from '@/components/reports/financial/revenue-analysis-report';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { defaultReportFilters, loadReportFromApi } from '@/components/reports/common/report-fetch';

export default function RevenueAnalysisPage() {
  const { data: session } = useSession();
  const router = useAppRouter();
  const { loading, isRefreshing, startFetch, endFetch, markHasData, isBusy } =
    useReportFetchState();
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  
  const [filters, setFilters] = useState<ReportFilters>({
    ...defaultReportFilters(),
    groupBy: 'month',
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async (force = false) => {
    startFetch();
    setError(null);

    try {
      const extraParams: Record<string, string> = {};
      if (filters.assetTypes?.length) extraParams.assetTypes = filters.assetTypes.join(',');
      if (filters.regions?.length) extraParams.regions = filters.regions.join(',');
      if (filters.branches?.length) extraParams.branches = filters.branches.join(',');
      if (filters.groupBy) extraParams.groupBy = filters.groupBy;

      const result = await loadReportFromApi(
        '/api/reports/financial/revenue-analysis',
        filters,
        { force, extraParams }
      );

      if (result.data) {
        setReportData(result.data);
        markHasData();
      } else {
        throw new Error('Failed to fetch report');
      }
    } catch (err) {
      console.error('Report fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch report');
    } finally {
      endFetch();
    }
  };

  const handleApplyFilters = () => {
    fetchReport();
  };

  const handleResetFilters = () => {
    setFilters({
      ...defaultReportFilters(),
      groupBy: 'month',
    });
    setTimeout(() => fetchReport(true), 100);
  };

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          /* Hide UI elements */
          nav, header, footer, .no-print,
          button, [role="button"],
          .sidebar, .navigation,
          input, select, textarea,
          [role="navigation"],
          [role="banner"],
          [role="complementary"] {
            display: none !important;
          }

          /* Reset body and html */
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Container adjustments */
          .container {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Page setup - allow content to flow across pages */
          @page {
            size: A4 portrait;
            margin: 15mm;
          }

          /* Report content */
          [data-report-content] {
            display: block !important;
            width: 100% !important;
            overflow: visible !important;
            page-break-after: auto;
          }

          /* Cards and sections */
          .space-y-6 > * {
            page-break-inside: avoid;
            margin-bottom: 10px !important;
          }

          /* Grid layouts */
          .grid {
            display: grid !important;
            page-break-inside: avoid;
          }

          /* Cards */
          [class*="card"], [class*="Card"] {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 10px !important;
            box-shadow: none !important;
            border: 1px solid #ddd !important;
          }

          /* Tables - allow to break across pages */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
          }

          thead {
            display: table-header-group;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          th, td {
            padding: 6px !important;
            border: 1px solid #ddd !important;
            font-size: 10px !important;
          }

          /* Charts - make smaller for print */
          canvas {
            max-width: 100% !important;
            max-height: 200px !important;
            page-break-inside: avoid;
          }

          /* Ensure all content is visible */
          * {
            overflow: visible !important;
            box-sizing: border-box !important;
          }

          /* Remove shadows and transitions */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/reports')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Salvage Recovery Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Salvage recovery rates, net loss, and performance trends
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchReport()}
            variant="outline"
            size="sm"
            disabled={isBusy}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {reportData && (
            <ExportButton
              reportType="revenue-analysis"
              reportData={reportData}
              filters={filters}
              disabled={isBusy}
            />
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="pt-6">
          <ReportFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            showAssetTypes={true}
            showRegions={true}
            showBranches={true}
            showBrokers={true}
            showStatus={false}
            showGroupBy={true}
          />
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="no-print">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Report Content */}
      {isRefreshing && reportData && <DataRefreshingHint />}

      {reportData && (
        <div data-report-content>
          <RevenueAnalysisReport data={reportData} loading={isRefreshing} />
        </div>
      )}

      {/* Loading State */}
      {loading && !reportData && (
        <DataLoadingState label="Salvage recovery analysis" variant="report" className="no-print" />
      )}
    </div>
    </>
  );
}
