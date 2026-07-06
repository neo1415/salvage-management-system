'use client';

/**
 * Master Report Page
 * Comprehensive Executive Dashboard - 2026 BI Best Practices
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReportFetchState } from '@/hooks/use-report-fetch-state';
import { DataLoadingState, DataRefreshingHint } from '@/components/ui/loading-states';
import { useAppRouter } from '@/hooks/use-app-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Calendar } from 'lucide-react';
import { MasterReportContent } from '@/components/reports/executive/master-report-content';
import { MasterReportData } from '@/features/reports/executive/services/master-report.service';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ExportButton } from '@/components/reports/common/export-button';
import { defaultReportFilters, loadReportFromApi } from '@/components/reports/common/report-fetch';

export default function MasterReportPage() {
  const router = useAppRouter();
  const { loading, isRefreshing, startFetch, endFetch, markHasData, isBusy } =
    useReportFetchState();
  const [reportData, setReportData] = useState<MasterReportData | null>(null);
  const defaultRange = defaultReportFilters();
  const [startDate, setStartDate] = useState<Date | undefined>(defaultRange.startDate);
  const [endDate, setEndDate] = useState<Date | undefined>(defaultRange.endDate);
  const [branchText, setBranchText] = useState('');
  const [brokerText, setBrokerText] = useState('');

  const selectedBranches = useMemo(
    () => branchText.split(',').map((branch) => branch.trim()).filter(Boolean),
    [branchText]
  );

  const selectedBrokers = useMemo(
    () => brokerText.split(',').map((broker) => broker.trim()).filter(Boolean),
    [brokerText]
  );

  const fetchMasterReport = useCallback(async (force = false) => {
    startFetch();
    try {
      const result = await loadReportFromApi(
        '/api/reports/executive/master-report',
        { startDate, endDate, branches: selectedBranches, brokers: selectedBrokers },
        { force }
      );

      if (result.success) {
        setReportData(result.data as MasterReportData);
        markHasData();
      } else {
        console.error('Failed to fetch master report:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch master report:', error);
    } finally {
      endFetch();
    }
  }, [endDate, endFetch, markHasData, selectedBranches, selectedBrokers, startDate, startFetch]);

  useEffect(() => { void fetchMasterReport(); }, [fetchMasterReport]);

  if (loading && !reportData) {
    return (
      <div className="container mx-auto py-6">
        <DataLoadingState label="Master report" variant="report" />
      </div>
    );
  }

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
          .space-y-6 > *, .space-y-8 > * {
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

          /* Charts */
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
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/reports')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Master Report</h1>
              <p className="text-muted-foreground">Comprehensive executive dashboard</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  {startDate && endDate ? `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}` : 'All time'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Start Date</p>
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (date instanceof Date) {
                          setStartDate(date);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">End Date</p>
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        if (date instanceof Date) {
                          setEndDate(date);
                        }
                      }}
                    />
                  </div>
                  <Button onClick={() => fetchMasterReport()} className="w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)]">
                    Apply Dates
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStartDate(undefined);
                      setEndDate(undefined);
                    }}
                    className="w-full"
                  >
                    Reset to All Time
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <input
              type="text"
              value={branchText}
              onChange={(event) => setBranchText(event.target.value)}
              placeholder="Branches"
              className="h-9 w-48 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
              aria-label="Filter by branches"
            />
            <input
              type="text"
              value={brokerText}
              onChange={(event) => setBrokerText(event.target.value)}
              placeholder="Brokers"
              className="h-9 w-48 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
              aria-label="Filter by brokers"
            />
            <Button onClick={() => fetchMasterReport()} variant="outline" size="sm" disabled={isBusy}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {reportData && (
              <ExportButton
                reportType="master-report"
                reportData={reportData}
                filters={{ startDate, endDate, branches: selectedBranches, brokers: selectedBrokers }}
                disabled={isBusy}
              />
            )}
          </div>
        </div>

        {isRefreshing && reportData && <DataRefreshingHint />}

        {reportData && (
          <div data-report-content>
            <MasterReportContent data={reportData} />
          </div>
        )}
      </div>
    </>
  );
}
