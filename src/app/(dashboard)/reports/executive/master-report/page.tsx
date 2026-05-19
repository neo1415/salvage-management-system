'use client';

/**
 * Master Report Page
 * Comprehensive Executive Dashboard - 2026 BI Best Practices
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Calendar } from 'lucide-react';
import { MasterReportContent } from '@/components/reports/executive/master-report-content';
import { MasterReportData } from '@/features/reports/executive/services/master-report.service';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ExportButton } from '@/components/reports/common/export-button';
import { ReportLoadingState } from '@/components/reports/common/report-ui';

export default function MasterReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<MasterReportData | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchMasterReport();
  }, []);

  const fetchMasterReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      const response = await fetch(`/api/reports/executive/master-report?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setReportData(result.data);
      } else {
        console.error('Failed to fetch master report:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch master report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <ReportLoadingState label="Loading master report" />
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
                  <Button onClick={fetchMasterReport} className="w-full bg-[#800020] hover:bg-[#600018]">
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
            <Button onClick={fetchMasterReport} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {reportData && (
              <ExportButton
                reportType="master-report"
                reportData={reportData}
                filters={{ startDate, endDate }}
                disabled={loading}
              />
            )}
          </div>
        </div>

        {reportData && (
          <div data-report-content>
            <MasterReportContent data={reportData} />
          </div>
        )}
      </div>
    </>
  );
}
