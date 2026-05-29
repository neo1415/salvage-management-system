/**
 * PDF Template Service
 * 
 * Provides standardized letterhead and footer for all PDF documents.
 * Ensures consistent active-brand presentation across exports, reports, and legal documents.
 * 
 * Requirements: 21.1, 21.2, 21.3, 21.4
 */

import { jsPDF } from 'jspdf';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';

// Logo dimensions (optimized for professional letterhead)
const LOGO_WIDTH = 35;
const LOGO_HEIGHT = 35;

type PdfBranding = {
  brandName: string;
  legalName: string;
  supportEmail: string;
  supportPhone?: string;
  primaryColor: string;
  accentColor: string;
  logoPath: string;
  addressLine1: string;
  addressLine2: string;
  useBrandLetterhead: boolean;
};

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.slice(1) : '800020';
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
}

async function getPdfBranding(): Promise<PdfBranding> {
  if (typeof window !== 'undefined') {
    return {
      ...DEFAULT_BUSINESS_POLICY.branding,
      addressLine1: DEFAULT_BUSINESS_POLICY.legal.addressLine1,
      addressLine2: DEFAULT_BUSINESS_POLICY.legal.addressLine2,
      useBrandLetterhead: DEFAULT_BUSINESS_POLICY.documents.useBrandLetterhead,
    };
  }

  try {
    const { businessPolicyService } = await import('@/features/business-policy/business-policy.service');
    const policy = await businessPolicyService.getEffectivePolicy();
    return {
      ...policy.branding,
      addressLine1: policy.legal.addressLine1,
      addressLine2: policy.legal.addressLine2,
      useBrandLetterhead: policy.documents.useBrandLetterhead,
    };
  } catch (error) {
    console.warn(
      '[PDFTemplate] Business policy unavailable; using default branding',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      ...DEFAULT_BUSINESS_POLICY.branding,
      addressLine1: DEFAULT_BUSINESS_POLICY.legal.addressLine1,
      addressLine2: DEFAULT_BUSINESS_POLICY.legal.addressLine2,
      useBrandLetterhead: DEFAULT_BUSINESS_POLICY.documents.useBrandLetterhead,
    };
  }
}

/**
 * Load the configured brand logo as a base64 data URL.
 * 
 * Handles both client-side and server-side contexts with proper fallbacks
 */
async function getLogoDataURL(logoPath: string): Promise<string> {
  try {
    let logoUrl: string;

    if (typeof window !== 'undefined') {
      logoUrl = /^https?:\/\//i.test(logoPath) ? logoPath : `${window.location.origin}${logoPath}`;
    } else {
      const { getAppUrl } = await import('@/features/notifications/templates/email-urls');
      logoUrl = /^https?:\/\//i.test(logoPath) ? logoPath : `${getAppUrl()}${logoPath}`;
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
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64Logo = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64Logo}`;
  } catch (error) {
    // Log error but don't throw - allow PDF generation to continue without logo
    console.error('Failed to load brand logo:', error instanceof Error ? error.message : 'Unknown error');
    return ''; // Return empty string if logo can't be loaded (offline or error)
  }
}

export class PDFTemplateService {
  /**
   * Add standardized active-brand letterhead.
   * 
   * @param doc - jsPDF document instance
   * @param title - Document title (e.g., "BILL OF SALE", "EXPORT REPORT")
   */
  static async addLetterhead(doc: jsPDF, title: string): Promise<void> {
    const pageWidth = doc.internal.pageSize.getWidth();
    const branding = await getPdfBranding();
    const primary = hexToRgb(branding.primaryColor);
    const accent = hexToRgb(branding.accentColor);

    if (!branding.useBrandLetterhead) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, 22, { align: 'center' });
      doc.setDrawColor(primary[0], primary[1], primary[2]);
      doc.setLineWidth(0.5);
      doc.line(20, 30, pageWidth - 20, 30);
      return;
    }
    
    // Burgundy header bar
    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Add NEM logo (top-left of header)
    const logoDataURL = await getLogoDataURL(branding.logoPath);
    if (logoDataURL) {
      try {
        doc.addImage(logoDataURL, imageFormatFromDataUrl(logoDataURL), 15, 7.5, LOGO_WIDTH, LOGO_HEIGHT);
      } catch (error) {
        console.error('Failed to add logo to PDF:', error);
      }
    }
    
    // Company name and title (centered, to the right of logo)
    doc.setTextColor(255, 255, 255); // White text
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(branding.legalName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });
    
    // Gold accent line
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(1);
    doc.line(pageWidth / 2 - 60, 25, pageWidth / 2 + 60, 25);
    
    // Document title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, 35, { align: 'center' });
    
    // Company contact line (small text at bottom of header)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const supportLine = [
      branding.supportPhone ? `Tel: ${branding.supportPhone}` : null,
      `Email: ${branding.supportEmail}`,
    ].filter(Boolean).join(' | ');
    doc.text(supportLine, pageWidth / 2, 45, { align: 'center' });
    
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
  static async addFooter(doc: jsPDF, additionalInfo?: string): Promise<void> {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const branding = await getPdfBranding();
    const primary = hexToRgb(branding.primaryColor);
    
    // Footer position - fixed at bottom with proper margin (increased spacing)
    const footerY = pageHeight - 25;
    
    // Thin brand-color line above footer
    doc.setDrawColor(primary[0], primary[1], primary[2]);
    doc.setLineWidth(0.5);
    doc.line(20, footerY - 8, pageWidth - 20, footerY - 8);
    
    // Footer text with better spacing
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    
    // Line 1: Company name and address
    const address = [branding.addressLine1, branding.addressLine2].filter(Boolean).join(', ');
    doc.text(address ? `${branding.legalName} | ${address}` : branding.legalName, pageWidth / 2, footerY, { align: 'center' });
    
    // Line 2: Contact information (increased spacing from 4 to 5)
    const contactLine = [
      branding.supportPhone ? `Tel: ${branding.supportPhone}` : null,
      `Email: ${branding.supportEmail}`,
    ].filter(Boolean).join(' | ');
    doc.text(contactLine, pageWidth / 2, footerY + 5, { align: 'center' });
    
    // Line 3: Generation timestamp (increased spacing from 8 to 10)
    const timestamp = `Generated: ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}`;
    const footerText = additionalInfo ? `${timestamp} | ${additionalInfo}` : timestamp;
    doc.text(footerText, pageWidth / 2, footerY + 10, { align: 'center' });
  }
  
  /**
   * Get the maximum Y position for content to avoid footer overlap
   * 
   * @param doc - jsPDF document instance
   * @returns Maximum Y position for content
   */
  static getMaxContentY(doc: jsPDF): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    // Reserve 45px for footer (25px footer height + 20px spacing)
    return pageHeight - 45;
  }
}
