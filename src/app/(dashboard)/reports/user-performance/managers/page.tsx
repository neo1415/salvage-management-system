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
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
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

      <Card>
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">Loading manager metrics...</div>
          </CardContent>
        </Card>
      )}

      {!loading && reportData && (
        <div className="grid gap-6">
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
  );
}
