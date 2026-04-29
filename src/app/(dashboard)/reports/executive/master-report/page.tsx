'use client';

/**
 * Master Report Page
 * Comprehensive Executive Dashboard - 2026 BI Best Practices
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Download, Calendar } from 'lucide-react';
import { MasterReportContent } from '@/components/reports/executive/master-report-content';
import { MasterReportData } from '@/features/reports/executive/services/master-report.service';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { usePDFExport } from '@/hooks/use-pdf-export';

export default function MasterReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<MasterReportData | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date(2026, 1, 1)); // Feb 1, 2026
  const [endDate, setEndDate] = useState<Date>(new Date());

  const { exportToPDF, isExporting } = usePDFExport({
    reportType: 'master-report',
    onSuccess: () => {
      // Optional: Show success message
    },
    onError: (error) => {
      alert(`Failed to export report: ${error.message}`);
    },
  });

  useEffect(() => {
    fetchMasterReport();
  }, []);

  const fetchMasterReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/reports/executive/master-report?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
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

  const handleExport = () => {
    if (reportData) {
      exportToPDF(reportData, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-12 w-12 animate-spin text-[#800020]" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
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
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
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
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={fetchMasterReport} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleExport} className="bg-[#800020] hover:bg-[#600018]" disabled={isExporting || !reportData}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {reportData && <MasterReportContent data={reportData} />}
    </div>
  );
}
