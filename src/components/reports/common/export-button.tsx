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

  const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
    setIsExporting(true);
    setShowMenu(false);

    try {
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

      // For PDF, open HTML in new window for printing
      if (format === 'pdf') {
        const html = await response.text();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          showSuccess('Success', 'Report opened in new window. Click "Print to PDF" button to save.');
        } else {
          showError('Error', 'Please allow popups to export PDF');
        }
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
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
          <div className="py-1">
            <button
              onClick={() => handleExport('pdf')}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-red-600" />
              Export as PDF
            </button>
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
