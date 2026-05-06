'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';
import { subDays } from 'date-fns';

export default function ManagerMetricsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
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

      const response = await fetch(`/api/reports/user-performance/managers?${params}`);
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
              <h1 className="text-3xl font-bold">Manager Performance</h1>
              <p className="text-muted-foreground">Monitor team productivity and operational efficiency</p>
            </div>
          </div>
          <div className="flex gap-2">
            {reportData && <ExportButton reportType="manager-metrics" reportData={reportData} filters={filters} />}
          </div>
        </div>

        <Card className="no-print">
          <CardContent className="pt-6">
            <ReportFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onApply={fetchReport}
              onReset={() => setFilters({ startDate: subDays(new Date(), 30), endDate: new Date() })}
              showAssetTypes={false}
              showRegions={false}
            />
          </CardContent>
        </Card>

        {loading && (
          <Card className="no-print">
            <CardContent className="pt-6">
              <div className="text-center py-8">Loading manager metrics...</div>
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
                    <p className="text-sm text-muted-foreground">Cases Managed</p>
                    <p className="text-2xl font-bold">{reportData.summary?.totalCasesManaged || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue Generated</p>
                    <p className="text-2xl font-bold">₦{(reportData.summary?.totalRevenueGenerated || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Team Productivity</p>
                    <p className="text-2xl font-bold">{reportData.summary?.teamProductivity || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Operational Efficiency</p>
                    <p className="text-2xl font-bold">{reportData.summary?.operationalEfficiency || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Team Performance</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Size</p>
                    <p className="text-xl font-bold">{reportData.teamPerformance?.adjusters || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Cases/Adjuster</p>
                    <p className="text-xl font-bold">{reportData.teamPerformance?.averageCasesPerAdjuster || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Team Approval Rate</p>
                    <p className="text-xl font-bold">{reportData.teamPerformance?.teamApprovalRate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Team Recovery Rate</p>
                    <p className="text-xl font-bold">{reportData.teamPerformance?.teamRecoveryRate || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
