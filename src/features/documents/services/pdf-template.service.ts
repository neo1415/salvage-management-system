/**
 * PDF Template Service
 * 
 * Provides standardized letterhead and footer for all PDF documents.
 * Ensures consistent NEM Insurance branding across exports, reports, and legal documents.
 * 
 * Requirements: 21.1, 21.2, 21.3, 21.4
 */

import { jsPDF } from 'jspdf';

// NEM Insurance Brand Colors
const NEM_BURGUNDY = '#800020';
const NEM_GOLD = '#FFD700';

// Logo dimensions (optimized for professional letterhead)
const LOGO_WIDTH = 35;
const LOGO_HEIGHT = 35;

/**
 * Load NEM Insurance logo as base64 data URL
 * Logo is loaded from public/icons/Nem-insurance-Logo.jpg
 * 
 * Handles both client-side and server-side contexts with proper fallbacks
 */
async function getNEMLogoDataURL(): Promise<string> {
  try {
    // Determine the base URL based on environment
    let logoUrl: string;
    
    if (typeof window !== 'undefined') {
      // Client-side: use window.location.origin
      logoUrl = `${window.location.origin}/icons/Nem-insurance-Logo.jpg`;
    } else {
      // Server-side: use environment variable or construct from request
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';
      logoUrl = `${appUrl}/icons/Nem-insurance-Logo.jpg`;
    }
    
    // Validate URL before fetching
    try {
      new URL(logoUrl);
    } catch (urlError) {
      console.error('Invalid logo URL:', logoUrl);
      return ''; // Return empty string for invalid URL
    }
    
    const response = await fetch(logoUrl, {
      // Add timeout and cache control
      signal: AbortSignal.timeout(5000), // 5 second timeout
      cache: 'force-cache',
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch logo (${response.status}): ${logoUrl}`);
      return ''; // Return empty string if fetch fails
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64Logo = Buffer.from(arrayBuffer).toString('base64');
    return `data:image/jpeg;base64,${base64Logo}`;
  } catch (error) {
    // Log error but don't throw - allow PDF generation to continue without logo
    console.error('Failed to load NEM logo:', error instanceof Error ? error.message : 'Unknown error');
    return ''; // Return empty string if logo can't be loaded (offline or error)
  }
}

export class PDFTemplateService {
  /**
   * Add standardized NEM Insurance letterhead
   * Same format as Bill of Sale with burgundy header, logo, and company info
   * 
   * @param doc - jsPDF document instance
   * @param title - Document title (e.g., "BILL OF SALE", "EXPORT REPORT")
   */
  static async addLetterhead(doc: jsPDF, title: string): Promise<void> {
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Burgundy header bar
    doc.setFillColor(128, 0, 32); // NEM burgundy
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Add NEM logo (top-left of header)
    const logoDataURL = await getNEMLogoDataURL();
    if (logoDataURL) {
      try {
        doc.addImage(logoDataURL, 'JPEG', 15, 7.5, LOGO_WIDTH, LOGO_HEIGHT);
      } catch (error) {
        console.error('Failed to add logo to PDF:', error);
      }
    }
    
    // Company name and title (centered, to the right of logo)
    doc.setTextColor(255, 255, 255); // White text
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('NEM INSURANCE PLC', pageWidth / 2, 20, { align: 'center' });
    
    // Gold accent line
    doc.setDrawColor(255, 215, 0); // Gold
    doc.setLineWidth(1);
    doc.line(pageWidth / 2 - 60, 25, pageWidth / 2 + 60, 25);
    
    // Document title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, 35, { align: 'center' });
    
    // Company address (small text at bottom of header)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('199 Ikorodu Road, Obanikoro, Lagos, Nigeria | Tel: 234-02-014489560', pageWidth / 2, 45, { align: 'center' });
    
    // Reset text color for document body
    doc.setTextColor(0, 0, 0);
  }
  
  /**
   * Add standardized footer with company information and generation timestamp
   * Same format as Bill of Sale
   * 
   * @param doc - jsPDF document instance
   * @param additionalInfo - Optional additional information to display in footer
   */
  static addFooter(doc: jsPDF, additionalInfo?: string): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Footer position - fixed at bottom with proper margin
    const footerY = pageHeight - 20;
    
    // Thin burgundy line above footer
    doc.setDrawColor(128, 0, 32);
    doc.setLineWidth(0.5);
    doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
    
    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('NEM Insurance Plc | 199 Ikorodu Road, Obanikoro, Lagos, Nigeria', pageWidth / 2, footerY, { align: 'center' });
    doc.text('Tel: 234-02-014489560 | Email: nemsupport@nem-insurance.com', pageWidth / 2, footerY + 4, { align: 'center' });
    
    // Generation timestamp
    const timestamp = `Generated: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}`;
    const footerText = additionalInfo ? `${timestamp} | ${additionalInfo}` : timestamp;
    doc.text(footerText, pageWidth / 2, footerY + 8, { align: 'center' });
  }
  
  /**
   * Get the maximum Y position for content to avoid footer overlap
   * 
   * @param doc - jsPDF document instance
   * @returns Maximum Y position for content
   */
  static getMaxContentY(doc: jsPDF): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    // Reserve 35px for footer (20px footer height + 15px spacing)
    return pageHeight - 35;
  }
}
