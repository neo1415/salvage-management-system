/**
 * Export Service
 * 
 * Provides CSV and PDF export functionality with RFC 4180 compliance.
 * Uses PDFTemplateService for standardized PDF branding.
 * 
 * Requirements: 12.2, 12.3, 23.1, 23.2, 23.3
 */

import { jsPDF } from 'jspdf';

export interface ExportColumn {
  key: string;
  header: string;
  format?: (value: any) => string;
}

export interface ExportOptions {
  filename: string;
  columns: ExportColumn[];
  data: any[];
  title?: string; // For PDF
}

export class ExportService {
  /**
   * Generate CSV export
   * Implements RFC 4180 standard with proper escaping
   * 
   * @param options - Export configuration
   * @returns CSV string with headers and data
   */
  static generateCSV(options: ExportOptions): string {
    const { columns, data } = options;
    
    // Header row
    const headers = columns.map(col => this.escapeCSVField(col.header));
    const rows = [headers.join(',')];
    
    // Data rows
    for (const item of data) {
      const row = columns.map(col => {
        const value = item[col.key];
        const formatted = col.format ? col.format(value) : String(value ?? '');
        return this.escapeCSVField(formatted);
      });
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }
  
  /**
   * Escape CSV field according to RFC 4180
   * Fields containing comma, quote, or newline are wrapped in quotes
   * Internal quotes are escaped by doubling them
   * 
   * @param field - Field value to escape
   * @returns Escaped field value
   */
  private static escapeCSVField(field: string): string {
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
  
  /**
   * Generate PDF export with standardized letterhead/footer
   * Uses PDFTemplateService for consistent branding
   * 
   * @param options - Export configuration
   * @returns PDF buffer
   */
  static async generatePDF(options: ExportOptions): Promise<Buffer> {
    // Dynamic import to avoid bundling for client-side
    const { PDFTemplateService } = await import('@/features/documents/services/pdf-template.service');
    
    const doc = new jsPDF();
    const { columns, data, title } = options;
    
    // Add letterhead
    await PDFTemplateService.addLetterhead(doc, title || 'Export');
    
    // Add table data
    let y = 60; // Start below letterhead
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxY = PDFTemplateService.getMaxContentY(doc);
    
    // Add headers
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    let x = 20;
    const columnWidth = 40; // Fixed column width for simplicity
    
    for (const col of columns) {
      doc.text(col.header, x, y);
      x += columnWidth;
    }
    
    y += 7;
    doc.setFont('helvetica', 'normal');
    
    // Add data rows
    for (const item of data) {
      if (y > maxY) {
        // Add footer to current page
        PDFTemplateService.addFooter(doc);
        // Start new page
        doc.addPage();
        await PDFTemplateService.addLetterhead(doc, title || 'Export');
        y = 60;
        
        // Re-add headers on new page
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        x = 20;
        for (const col of columns) {
          doc.text(col.header, x, y);
          x += columnWidth;
        }
        y += 7;
        doc.setFont('helvetica', 'normal');
      }
      
      x = 20;
      for (const col of columns) {
        const value = item[col.key];
        const formatted = col.format ? col.format(value) : String(value ?? '');
        // Truncate long values to fit in column
        const truncated = formatted.length > 30 ? formatted.substring(0, 27) + '...' : formatted;
        doc.text(truncated, x, y);
        x += columnWidth;
      }
      y += 7;
    }
    
    // Add footer to last page
    PDFTemplateService.addFooter(doc);
    
    return Buffer.from(doc.output('arraybuffer'));
  }
  
  /**
   * Generate filename with date suffix
   * Format: {basename}-{YYYY-MM-DD}.{extension}
   * 
   * @param basename - Base filename (e.g., "finance-payments")
   * @param extension - File extension (e.g., "csv", "pdf")
   * @returns Formatted filename
   */
  static generateFilename(basename: string, extension: string): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${basename}-${date}.${extension}`;
  }
}
