'use client';

import { useState, useEffect } from 'react';
import { useReportFetchState } from '@/hooks/use-report-fetch-state';
import { DataLoadingState, DataRefreshingHint } from '@/components/ui/loading-states';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { defaultReportFilters, loadReportFromApi } from '@/components/reports/common/report-fetch';
import { ExportButton } from '@/components/reports/common/export-button';
import { PaginatedReportRows } from '@/components/reports/common/paginated-report-table';

export default function VendorSpendingPage() {
  const router = useRouter();
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
      const result = await loadReportFromApi('/api/reports/financial/vendor-spending', filters, { force });
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
              <h1 className="text-3xl font-bold">Vendor Spending Analysis</h1>
              <p className="text-muted-foreground">Monitor vendor spending patterns and trends</p>
            </div>
          </div>
          <div className="flex gap-2">
            {reportData && <ExportButton reportType="vendor-spending" reportData={reportData} filters={filters} />}
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
          <DataLoadingState label="Vendor spending" variant="report" className="no-print" />
        )}

        {isRefreshing && reportData && <DataRefreshingHint />}

        {reportData && (
          <div data-report-content className="grid gap-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Vendors</p>
                    <p className="text-2xl font-bold">{reportData.summary?.totalVendors || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Spending</p>
                    <p className="text-2xl font-bold">₦{(reportData.summary?.totalSpent || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Spending/Vendor</p>
                    <p className="text-2xl font-bold">₦{(reportData.summary?.averageSpendPerVendor || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Top Vendor Share</p>
                    <p className="text-2xl font-bold">{reportData.summary?.topSpenderPercentage || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Top Vendors by Spending</h3>
                <PaginatedReportRows rows={reportData.topSpenders || []} label="vendors">
                  {(rows, startIndex) => (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Rank</th>
                        <th className="text-left p-2">Vendor</th>
                        <th className="text-left p-2">Tier</th>
                        <th className="text-right p-2">Total Spent</th>
                        <th className="text-right p-2">Transactions</th>
                        <th className="text-right p-2">Avg Transaction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((vendor: any, index: number) => (
                        <tr key={vendor.vendorId} className="border-b">
                          <td className="p-2">{startIndex + index + 1}</td>
                          <td className="p-2">{vendor.vendorName}</td>
                          <td className="p-2 capitalize">{vendor.tier}</td>
                          <td className="text-right p-2">₦{(vendor.totalSpent || 0).toLocaleString()}</td>
                          <td className="text-right p-2">{vendor.transactionCount || 0}</td>
                          <td className="text-right p-2">₦{(vendor.averageTransaction || 0).toLocaleString()}</td>
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
