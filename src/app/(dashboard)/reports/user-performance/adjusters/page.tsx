'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReportFetchState } from '@/hooks/use-report-fetch-state';
import { DataLoadingState, DataRefreshingHint } from '@/components/ui/loading-states';
import { useAppRouter } from '@/hooks/use-app-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { defaultReportFilters, loadReportFromApi } from '@/components/reports/common/report-fetch';
import { ExportButton } from '@/components/reports/common/export-button';
import { formatReportCurrency } from '@/components/reports/common/report-currency';
import { PaginatedReportRows } from '@/components/reports/common/paginated-report-table';
import { ReportSummaryGrid, ReportSummaryStat } from '@/components/reports/common/report-ui';
import type { AdjusterMetricsReport } from '@/features/reports/user-performance/services';

export default function AdjusterMetricsPage() {
  const router = useAppRouter();
  const { loading, isRefreshing, startFetch, endFetch, markHasData } =
    useReportFetchState();
  const [reportData, setReportData] = useState<AdjusterMetricsReport | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters());

  const fetchReport = useCallback(async (force = false) => {
    startFetch();
    try {
      const result = await loadReportFromApi('/api/reports/user-performance/adjusters', filters, { force });
      if (result.status === 'success' && result.data) {
        setReportData(result.data as AdjusterMetricsReport);
        markHasData();
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      endFetch();
    }
  }, [endFetch, filters, markHasData, startFetch]);

  useEffect(() => { void fetchReport(); }, [fetchReport]);

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

          /* Page setup */
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

          /* Tables */
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
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Adjuster Performance</h1>
              <p className="text-muted-foreground">Monitor adjuster productivity and quality metrics</p>
            </div>
          </div>
          <div className="flex gap-2">
            {reportData && <ExportButton reportType="adjuster-metrics" reportData={reportData} filters={filters} />}
          </div>
        </div>

        <Card className="no-print">
          <CardContent className="pt-6">
            <ReportFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onApply={fetchReport}
              onReset={() => setFilters(defaultReportFilters())}
              showAssetTypes={false}
              showRegions={false}
            />
          </CardContent>
        </Card>

        {loading && !reportData && (
          <DataLoadingState label="Adjuster performance" variant="report" className="no-print" />
        )}

        {isRefreshing && reportData && <DataRefreshingHint />}

        {reportData && (
          <div data-report-content className="grid gap-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <ReportSummaryGrid>
                  <ReportSummaryStat label="Total Adjusters" value={reportData.summary?.totalAdjusters || 0} />
                  <ReportSummaryStat label="Cases Processed" value={reportData.summary?.totalCasesProcessed || 0} />
                  <ReportSummaryStat label="Avg Approval Rate" value={`${reportData.summary?.averageApprovalRate || 0}%`} />
                  <ReportSummaryStat label="Revenue Generated" value={formatReportCurrency(reportData.summary?.totalRevenueGenerated || 0)} />
                </ReportSummaryGrid>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Top Performers</h3>
                <PaginatedReportRows rows={reportData.adjusterPerformance || []} label="adjusters">
                  {(rows) => (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Adjuster</th>
                        <th className="text-right p-2">Cases</th>
                        <th className="text-right p-2">Approval Rate</th>
                        <th className="text-right p-2">Recovery Rate</th>
                        <th className="text-right p-2">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((adj) => (
                        <tr key={adj.adjusterId} className="border-b">
                          <td className="p-2">{adj.adjusterName}</td>
                          <td className="text-right p-2">{adj.casesProcessed}</td>
                          <td className="text-right p-2">{adj.approvalRate}%</td>
                          <td className="text-right p-2">{adj.recoveryRate}%</td>
                          <td className="text-right p-2">{adj.performanceScore}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  )}
                </PaginatedReportRows>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
