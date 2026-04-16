'use client';

/**
 * Revenue Analysis Report Page
 * Task 10: Financial Reports UI
 * 
 * Displays comprehensive revenue analysis with filters and export
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { ReportFiltersComponent, ReportFilters } from '@/components/reports/common/report-filters';
import { ExportButton } from '@/components/reports/common/export-button';
import { RevenueAnalysisReport } from '@/components/reports/financial/revenue-analysis-report';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { subDays } from 'date-fns';

export default function RevenueAnalysisPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
    groupBy: 'month',
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.assetTypes?.length) params.append('assetTypes', filters.assetTypes.join(','));
      if (filters.regions?.length) params.append('regions', filters.regions.join(','));
      if (filters.groupBy) params.append('groupBy', filters.groupBy);

      const response = await fetch(`/api/reports/financial/revenue-analysis?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch report');
      }

      const result = await response.json();
      setReportData(result.data);
    } catch (err) {
      console.error('Report fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchReport();
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: subDays(new Date(), 30),
      endDate: new Date(),
      groupBy: 'month',
    });
    setTimeout(() => fetchReport(), 100);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            onClick={fetchReport}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {reportData && (
            <ExportButton
              reportType="revenue-analysis"
              reportData={reportData}
              filters={filters}
              disabled={loading}
            />
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <ReportFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            showAssetTypes={true}
            showRegions={true}
            showStatus={false}
            showGroupBy={true}
          />
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Report Content */}
      {reportData && (
        <RevenueAnalysisReport data={reportData} loading={loading} />
      )}

      {/* Loading State */}
      {loading && !reportData && (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-12 w-12 animate-spin text-[#800020] mx-auto mb-4" />
            <p className="text-lg font-medium">Generating Report...</p>
            <p className="text-gray-600 mt-2">This may take a few moments</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
