'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';

export default function AdjusterMetricsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: undefined,
    endDate: undefined,
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());

      const response = await fetch(`/api/reports/user-performance/adjusters?${params}`);
      const result = await response.json();
      
      if (result.status === 'success') {
        setReportData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
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
              onReset={() => setFilters({ startDate: undefined, endDate: undefined })}
              showAssetTypes={false}
              showRegions={false}
            />
          </CardContent>
        </Card>

        {loading && (
          <Card className="no-print">
            <CardContent className="pt-6">
              <div className="text-center py-8">Loading adjuster metrics...</div>
            </CardContent>
          </Card>
        )}

        {!loading && reportData && (
          <div data-report-content className="grid gap-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Adjusters</p>
                    <p className="text-2xl font-bold">{reportData.summary?.totalAdjusters || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cases Processed</p>
                    <p className="text-2xl font-bold">{reportData.summary?.totalCasesProcessed || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Approval Rate</p>
                    <p className="text-2xl font-bold">{reportData.summary?.averageApprovalRate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue Generated</p>
                    <p className="text-2xl font-bold">₦{(reportData.summary?.totalRevenueGenerated || 0).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Top Performers</h3>
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
                      {(reportData.adjusterPerformance || []).slice(0, 10).map((adj: any) => (
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
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
