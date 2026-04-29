/**
 * PDF Export Hook
 * Reusable hook for exporting reports to PDF using Puppeteer
 * 
 * This hook captures the current page as a PDF with full styling and charts
 */

import { useState } from 'react';

interface UsePDFExportOptions {
  reportType: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function usePDFExport({ reportType, onSuccess, onError }: UsePDFExportOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async (data?: any, filters?: { startDate?: string; endDate?: string }) => {
    setIsExporting(true);

    try {
      // Get the current page URL (this will be rendered by Puppeteer)
      const currentUrl = window.location.pathname + window.location.search;

      const response = await fetch('/api/reports/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          reportUrl: currentUrl, // Send the current page URL
          filters,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(errorData.error || 'Export failed');
      }

      // Download the PDF file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch 
        ? filenameMatch[1] 
        : `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onSuccess?.();
    } catch (error) {
      console.error('PDF export failed:', error);
      onError?.(error instanceof Error ? error : new Error('Export failed'));
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportToPDF,
    isExporting,
  };
}
