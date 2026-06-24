'use client';

import { useState, useEffect } from 'react';
import { useReportFetchState } from '@/hooks/use-report-fetch-state';
import { DataLoadingState, DataRefreshingHint } from '@/components/ui/loading-states';
import { useAppRouter } from '@/hooks/use-app-router';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { defaultReportFilters, loadReportFromApi } from '@/components/reports/common/report-fetch';
import { ExportButton } from '@/components/reports/common/export-button';
import { formatReportCurrency } from '@/components/reports/common/report-currency';
import { ReportSummaryGrid, ReportSummaryStat } from '@/components/reports/common/report-ui';
import {
  FinancialBreakdownSection,
  FinancialDetailTable,
} from '@/components/reports/common/financial-detail-table';
import { PaginatedReportRows } from '@/components/reports/common/paginated-report-table';

type ProfitabilityBranchRow = {
  label: string;
  count: number;
  claimsPaid: number;
  salvageRecovered: number;
  netLoss: number;
  recoveryRate: number;
};

type ProfitabilityBrokerRow = {
  label: string;
  channelType: string;
  count: number;
  claimsPaid: number;
  salvageRecovered: number;
  recoveryRate: number;
};

export default function ProfitabilityPage() {
  const router = useAppRouter();
  const { loading, isRefreshing, startFetch, endFetch, markHasData, isBusy } =
    useReportFetchState();
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFilters>(defaultReportFilters());

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async (force = false) => {
    startFetch();
    try {
      const result = await loadReportFromApi('/api/reports/financial/profitability', filters, { force });
      if (result.status === 'success') {
        setReportData(result.data);
        markHasData();
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      endFetch();
    }
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
              <h1 className="text-3xl font-bold">Profitability Analysis</h1>
              <p className="text-muted-foreground">Monitor profit margins and ROI across operations</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => fetchReport()} variant="outline" size="sm" disabled={isBusy}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {reportData && <ExportButton reportType="profitability" reportData={reportData} filters={filters} />}
          </div>
        </div>

        <Card className="no-print">
          <CardContent className="pt-6">
            <ReportFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onApply={fetchReport}
              onReset={() => setFilters(defaultReportFilters())}
              showAssetTypes={true}
              showRegions={false}
              showBranches={true}
              showBrokers={true}
            />
          </CardContent>
        </Card>

        {loading && !reportData && (
          <DataLoadingState label="Profitability" variant="report" className="no-print" />
        )}

        {isRefreshing && reportData && <DataRefreshingHint />}

        {reportData && (
          <div data-report-content className="grid gap-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <ReportSummaryGrid>
                  <ReportSummaryStat label="Total Cases" value={reportData.summary?.totalCases || 0} />
                  <ReportSummaryStat label="Salvage Recovered" value={formatReportCurrency(reportData.summary?.totalSalvageRecovered || 0)} />
                  <ReportSummaryStat label="Recovery Rate" value={`${reportData.summary?.averageRecoveryRate || 0}%`} />
                  <ReportSummaryStat label="ROI" value={`${reportData.summary?.roi || 0}%`} />
                </ReportSummaryGrid>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">By Asset Type</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Asset Type</th>
                        <th className="text-right p-2">Count</th>
                        <th className="text-right p-2">Claims Paid</th>
                        <th className="text-right p-2">Salvage Recovered</th>
                        <th className="text-right p-2">Net Loss</th>
                        <th className="text-right p-2">Recovery Rate</th>
                        <th className="text-right p-2">ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.byAssetType || []).map((data: any) => (
                        <tr key={data.assetType} className="border-b">
                          <td className="p-2 capitalize">{data.assetType}</td>
                          <td className="text-right p-2">{data.count || 0}</td>
                          <td className="text-right p-2">{formatReportCurrency(data.claimsPaid || 0)}</td>
                          <td className="text-right p-2">{formatReportCurrency(data.salvageRecovered || 0)}</td>
                          <td className="text-right p-2">{formatReportCurrency(data.netLoss || 0)}</td>
                          <td className="text-right p-2">{data.recoveryRate || 0}%</td>
                          <td className="text-right p-2">{data.roi || 0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Profit Distribution</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Profitable</p>
                    <p className="text-xl font-bold text-green-600">{reportData.profitDistribution?.profitable || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Break Even</p>
                    <p className="text-xl font-bold text-yellow-600">{reportData.profitDistribution?.breakEven || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Loss</p>
                    <p className="text-xl font-bold text-red-600">{reportData.profitDistribution?.loss || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {reportData.byBranch?.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">By Branch</h3>
                  <PaginatedReportRows<ProfitabilityBranchRow> rows={reportData.byBranch} label="branches">
                    {(rows, startIndex) => (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Branch</th>
                              <th className="text-right p-2">Count</th>
                              <th className="text-right p-2">Claims Paid</th>
                              <th className="text-right p-2">Salvage Recovered</th>
                              <th className="text-right p-2">Net Loss</th>
                              <th className="text-right p-2">Recovery Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((branch, index) => (
                              <tr key={`${branch.label}-${startIndex + index}`} className="border-b">
                                <td className="p-2 font-medium">{branch.label}</td>
                                <td className="text-right p-2">{branch.count}</td>
                                <td className="text-right p-2">{formatReportCurrency(branch.claimsPaid)}</td>
                                <td className="text-right p-2">{formatReportCurrency(branch.salvageRecovered)}</td>
                                <td className="text-right p-2">{formatReportCurrency(branch.netLoss)}</td>
                                <td className="text-right p-2">{branch.recoveryRate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </PaginatedReportRows>
                </CardContent>
              </Card>
            )}

            {reportData.byBroker?.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">By Broker / Agency</h3>
                  <PaginatedReportRows<ProfitabilityBrokerRow> rows={reportData.byBroker} label="channels">
                    {(rows, startIndex) => (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Channel</th>
                              <th className="text-left p-2">Type</th>
                              <th className="text-right p-2">Count</th>
                              <th className="text-right p-2">Claims Paid</th>
                              <th className="text-right p-2">Salvage Recovered</th>
                              <th className="text-right p-2">Recovery Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((broker, index) => (
                              <tr key={`${broker.label}-${startIndex + index}`} className="border-b">
                                <td className="p-2 font-medium">{broker.label}</td>
                                <td className="p-2 capitalize">{broker.channelType}</td>
                                <td className="text-right p-2">{broker.count}</td>
                                <td className="text-right p-2">{formatReportCurrency(broker.claimsPaid)}</td>
                                <td className="text-right p-2">{formatReportCurrency(broker.salvageRecovered)}</td>
                                <td className="text-right p-2">{broker.recoveryRate}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </PaginatedReportRows>
                </CardContent>
              </Card>
            )}

            {reportData.branchBreakdown?.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Branch breakdown</h3>
                <FinancialBreakdownSection groups={reportData.branchBreakdown} nameColumnLabel="Branch" />
              </div>
            )}

            {reportData.brokerBreakdown?.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Broker / agency breakdown</h3>
                <FinancialBreakdownSection groups={reportData.brokerBreakdown} nameColumnLabel="Channel" />
              </div>
            )}

            {reportData.itemBreakdown && reportData.itemBreakdown.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Detailed Item Breakdown</h3>
                  <FinancialDetailTable rows={reportData.itemBreakdown} />
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
