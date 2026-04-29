'use client';

/**
 * Export Button Component
 * 
 * Reusable export button with dropdown for PDF, Excel, CSV formats
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet, FileCode } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface ExportButtonProps {
  reportType: string;
  reportData: any;
  filters: any;
  disabled?: boolean;
}

export function ExportButton({ reportType, reportData, filters, disabled }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { error: showError, success: showSuccess } = useToast();

  const handleExport = async (format: 'pdf' | 'excel' | 'csv' | 'print' | 'pdf-html') => {
    // Handle browser print separately
    if (format === 'print') {
      window.print();
      return;
    }

    setIsExporting(true);
    setShowMenu(false);

    try {
      // For HTML-to-PDF, send report type and filters to generate from live page
      if (format === 'pdf-html') {
        const response = await fetch('/api/reports/export/pdf-html', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reportType,
            filters,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || 'Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showSuccess('Success', 'PDF with full layout downloaded successfully');
        return;
      }

      const response = await fetch(`/api/reports/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType,
          data: reportData,
          filters,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // For PDF, download the file directly
      if (format === 'pdf') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get filename from Content-Disposition header or generate one
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showSuccess('Success', 'PDF report downloaded successfully');
      } else {
        // For Excel and CSV, download as file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;
        a.click();
        window.URL.revokeObjectURL(url);
        showSuccess('Success', `Report exported as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      showError('Error', 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <Button
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled || isExporting}
        variant="outline"
        size="sm"
        className="bg-[#800020] text-white hover:bg-[#600018]"
      >
        <Download className="mr-2 h-4 w-4" />
        {isExporting ? 'Exporting...' : 'Export'}
      </Button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10">
          <div className="py-1">
            <button
              onClick={() => handleExport('pdf-html')}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-[#800020]" />
              <div>
                <div className="font-medium">Export as PDF (Full Layout)</div>
                <div className="text-xs text-gray-500">Includes all charts & tables</div>
              </div>
            </button>
            <button
              onClick={() => handleExport('print')}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-blue-600" />
              <div>
                <div className="font-medium">Print to PDF</div>
                <div className="text-xs text-gray-500">Use browser print dialog</div>
              </div>
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              onClick={() => handleExport('excel')}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Export as Excel
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FileCode className="h-4 w-4 text-blue-600" />
              Export as CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
