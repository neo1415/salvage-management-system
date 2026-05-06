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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

  const handleExport = async (format: 'pdf' | 'excel' | 'csv' | 'print') => {
    // Handle browser print separately
    if (format === 'print') {
      window.print();
      return;
    }

    setIsExporting(true);
    setShowMenu(false);

    try {
      // For PDF, use client-side jspdf + html2canvas
      if (format === 'pdf') {
        await generateClientSidePDF();
        showSuccess('Success', 'PDF report downloaded successfully');
        return;
      }

      // For Excel and CSV
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

      // Download as file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('Success', `Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      showError('Error', 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const generateClientSidePDF = async () => {
    try {
      // Find the report content element
      const reportElement = document.querySelector('[data-report-content]') as HTMLElement;
      
      if (!reportElement) {
        console.error('Report content element not found');
        throw new Error('Report content not found. Please ensure the report has loaded.');
      }

      // Store original styles
      const originalOverflow = document.body.style.overflow;
      
      // Temporarily adjust styles for full capture
      document.body.style.overflow = 'visible';

      // Wait for any animations or lazy-loaded content
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the full content as canvas with higher quality
      const canvas = await html2canvas(reportElement, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        allowTaint: false,
        windowWidth: reportElement.scrollWidth,
        windowHeight: reportElement.scrollHeight,
      });

      // Restore original styles
      document.body.style.overflow = originalOverflow;

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      
      // A4 dimensions in mm
      const pdfWidth = 210;
      const pdfHeight = 297;
      
      // Margins and spacing
      const marginLeft = 15;
      const marginRight = 15;
      const letterheadHeight = 35; // Burgundy header
      const footerHeight = 15; // Footer space
      
      // First page has title, subsequent pages don't
      const firstPageContentTop = 54; // 35 (letterhead) + 13 (title) + 6 (spacing)
      const otherPageContentTop = 40; // 35 (letterhead) + 5 (spacing)
      
      // Usable content area per page
      const contentWidth = pdfWidth - marginLeft - marginRight;
      const firstPageContentHeight = pdfHeight - firstPageContentTop - footerHeight;
      const otherPageContentHeight = pdfHeight - otherPageContentTop - footerHeight;
      
      // Calculate how the image scales to fit the PDF width
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Calculate number of pages needed
      let remainingHeight = imgHeight;
      let pageCount = 0;
      
      // First page
      if (remainingHeight > 0) {
        pageCount++;
        remainingHeight -= firstPageContentHeight;
      }
      
      // Subsequent pages
      while (remainingHeight > 0) {
        pageCount++;
        remainingHeight -= otherPageContentHeight;
      }
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Get current date
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Track position in the image
      let position = 0;
      
      // Add pages
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        if (pageNum > 1) {
          pdf.addPage();
        }
        
        // Add letterhead on every page
        // Burgundy header bar
        pdf.setFillColor(128, 0, 32); // #800020
        pdf.rect(0, 0, pdfWidth, letterheadHeight, 'F');
        
        // Company name (centered)
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('NEM Insurance Plc', pdfWidth / 2, 12, { align: 'center' });
        
        // Company address (centered)
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text('199, Ikorodu Road, Obanikoro Lagos', pdfWidth / 2, 20, { align: 'center' });
        
        // Contact details (centered)
        pdf.setFontSize(8);
        pdf.text('Call Us: 234-02-014489560 | E-mail: nemsupport@nem-insurance.com', pdfWidth / 2, 27, { align: 'center' });
        
        // Report title and date (on first page only, below letterhead)
        if (pageNum === 1) {
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          const reportTitle = reportType.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
          pdf.text(reportTitle, pdfWidth / 2, 42, { align: 'center' });
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Generated on: ${currentDate}`, pdfWidth / 2, 48, { align: 'center' });
        }
        
        // Determine content area for this page
        const contentTop = pageNum === 1 ? firstPageContentTop : otherPageContentTop;
        const contentHeight = pageNum === 1 ? firstPageContentHeight : otherPageContentHeight;
        
        // Add the image slice for this page
        pdf.addImage(
          imgData,
          'PNG',
          marginLeft,
          contentTop - position,
          imgWidth,
          imgHeight
        );
        
        // Move position for next page
        position += contentHeight;
        
        // Add footer with page numbers
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        pdf.setFont('helvetica', 'normal');
        
        // Page number (centered)
        const pageText = `Page ${pageNum} of ${pageCount}`;
        const pageTextWidth = pdf.getTextWidth(pageText);
        pdf.text(pageText, (pdfWidth - pageTextWidth) / 2, pdfHeight - 10);
        
        // Footer text (left)
        pdf.text('Confidential - For Internal Use Only', marginLeft, pdfHeight - 10);
        
        // Date (right)
        const dateWidth = pdf.getTextWidth(currentDate);
        pdf.text(currentDate, pdfWidth - marginRight - dateWidth, pdfHeight - 10);
      }
      
      // Download the PDF
      const filename = `${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
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
              onClick={() => handleExport('pdf')}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-[#800020]" />
              <div>
                <div className="font-medium">Export as PDF</div>
                <div className="text-xs text-gray-500">Professional format with letterhead</div>
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
