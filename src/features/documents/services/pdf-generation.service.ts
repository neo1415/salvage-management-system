/**
 * PDF Generation Service
 * 
 * Generates professional PDF documents for salvage auctions:
 * - Bill of Sale
 * - Release & Waiver of Liability
 * - Pickup Authorization
 * - Salvage Certificate
 * 
 * Uses jsPDF for client-side PDF generation with QR codes for verification.
 * Uses the active business policy branding for logo, colors, and letterhead.
 * 
 * Requirements: 21.1, 21.2, 21.5, 21.6
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { businessPolicyService } from '@/features/business-policy';
import { PDFTemplateService } from './pdf-template.service';

const CONTENT_MARGIN_X = 20;
const SIGNATURE_WIDTH = 65;
const SIGNATURE_HEIGHT = 28;

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

async function moveToNewDocumentPage(doc: jsPDF, title: string): Promise<number> {
  await PDFTemplateService.addFooter(doc);
  doc.addPage();
  await PDFTemplateService.addLetterhead(doc, title);
  return 60;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.slice(1) : '111827';
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function readableTextColor([r, g, b]: [number, number, number]): [number, number, number] {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? [17, 24, 39] : [255, 255, 255];
}

export interface BillOfSaleData {
  // Transaction details
  transactionId: string;
  transactionDate: string;
  
  // Buyer information
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerBvn?: string; // Last 4 digits only
  
  // Seller information
  sellerName: string;
  sellerAddress: string;
  sellerContact: string;
  
  // Asset information
  assetType: string;
  assetDescription: string;
  assetCondition: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  
  // Financial information
  salePrice: number;
  paymentMethod: string;
  paymentReference?: string;
  
  // Pickup information
  pickupLocation: string;
  pickupDeadline: string;
  
  // Signature information (optional - added when signed)
  signatureData?: string;
  signedDate?: string;
  
  // Verification
  verificationUrl: string;
  disclaimerTitle?: string;
  disclaimerBody?: string;
}

export interface LiabilityWaiverData {
  // Vendor information
  vendorName: string;
  vendorEmail: string;
  vendorPhone: string;
  vendorBvn?: string;
  
  // Asset information
  assetDescription: string;
  assetCondition: string;
  
  // Transaction information
  auctionId: string;
  transactionDate: string;
  
  // Signature information (optional - added when signed)
  signatureData?: string;
  signedDate?: string;
  
  // Verification
  verificationUrl: string;
  clauses?: Array<{
    title: string;
    body: string;
  }>;
}

export interface PickupAuthorizationData {
  // Authorization details
  authorizationCode: string;
  auctionId: string;
  
  // Vendor information
  vendorName: string;
  vendorPhone: string;
  
  // Asset information
  assetDescription: string;
  
  // Pickup details
  pickupLocation: string;
  pickupDeadline: string;
  pickupContact: string;
  
  // Payment information
  paymentAmount: number;
  paymentReference: string;
  paymentDate: string;
  
  // Verification
  verificationUrl: string;
}

export interface SalvageCertificateData {
  // Vehicle information
  vin: string;
  make: string;
  model: string;
  year: number;
  
  // Damage information
  damageAssessment: string;
  totalLossDeclaration: boolean;
  
  // Insurance information
  claimReference: string;
  insuranceCompany: string;
  
  // Transaction information
  saleDate: string;
  buyerName: string;
  
  // Verification
  verificationUrl: string;
}

/**
 * Generate Bill of Sale PDF
 */
export async function generateBillOfSalePDF(data: BillOfSaleData): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const policy = await businessPolicyService.getEffectivePolicy();
  const disclaimerTitle = data.disclaimerTitle || policy.documents.billOfSaleDisclaimerTitle;
  const disclaimerBody = data.disclaimerBody || policy.documents.billOfSaleDisclaimerBody;
  
  // Add professional letterhead with logo using PDFTemplateService
  await PDFTemplateService.addLetterhead(doc, 'BILL OF SALE');
  
  // Transaction details
  let yPos = 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Transaction ID: ${data.transactionId}`, 20, yPos);
  doc.text(`Date: ${data.transactionDate}`, pageWidth - 20, yPos, { align: 'right' });
  
  // Seller information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SELLER INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${data.sellerName}`, 20, yPos);
  yPos += 6;
  doc.text(`Address: ${data.sellerAddress}`, 20, yPos);
  yPos += 6;
  doc.text(`Contact: ${data.sellerContact}`, 20, yPos);
  
  // Buyer information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('BUYER INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${data.buyerName}`, 20, yPos);
  yPos += 6;
  doc.text(`Email: ${data.buyerEmail}`, 20, yPos);
  yPos += 6;
  doc.text(`Phone: ${data.buyerPhone}`, 20, yPos);
  if (data.buyerBvn) {
    yPos += 6;
    doc.text(`BVN: ****${data.buyerBvn}`, 20, yPos);
  }
  
  // Asset information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('ASSET INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Type: ${data.assetType}`, 20, yPos);
  yPos += 6;
  doc.text(`Description: ${data.assetDescription}`, 20, yPos);
  yPos += 6;
  doc.text(`Condition: ${data.assetCondition}`, 20, yPos);
  
  if (data.vin) {
    yPos += 6;
    doc.text(`VIN: ${data.vin}`, 20, yPos);
  }
  if (data.make && data.model && data.year) {
    yPos += 6;
    doc.text(`Vehicle: ${data.year} ${data.make} ${data.model}`, 20, yPos);
  }
  
  // Financial information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('FINANCIAL INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Sale Price: NGN ${data.salePrice.toLocaleString()}`, 20, yPos);
  yPos += 6;
  doc.text(`Payment Method: ${data.paymentMethod}`, 20, yPos);
  if (data.paymentReference) {
    yPos += 6;
    doc.text(`Payment Reference: ${data.paymentReference}`, 20, yPos);
  }
  
  // Pickup information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PICKUP INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Location: ${data.pickupLocation}`, 20, yPos);
  yPos += 6;
  doc.text(`Deadline: ${data.pickupDeadline}`, 20, yPos);
  
  // Configurable sale disclaimer
  yPos += 15;
  doc.setFillColor(255, 243, 205); // Light yellow
  const disclaimerLines = doc.splitTextToSize(disclaimerBody, pageWidth - 40);
  doc.rect(15, yPos - 5, pageWidth - 30, Math.max(20, disclaimerLines.length * 5 + 11), 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(disclaimerTitle.toUpperCase(), 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(disclaimerLines, 20, yPos);
  yPos += disclaimerLines.length * 5;
  
  // Get max content Y to avoid footer overlap using PDFTemplateService
  const maxContentY = PDFTemplateService.getMaxContentY(doc);
  
  // Signature section
  yPos += 20;

  const requiredSpace = data.signatureData ? 55 : 45;
  if (yPos + requiredSpace > maxContentY) {
    yPos = await moveToNewDocumentPage(doc, 'BILL OF SALE');
  }

  if (data.signatureData) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Buyer Signature:', 20, yPos);
    yPos += 6;
    
    try {
      doc.addImage(data.signatureData, 'PNG', 20, yPos, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
      yPos += SIGNATURE_HEIGHT + 4;
    } catch (error) {
      console.error('Error adding signature to PDF:', error);
      // Fallback to signature line if image fails
      yPos += SIGNATURE_HEIGHT + 4;
    }
    
    // Signature line and label
    doc.line(20, yPos, 100, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Buyer Signature', 20, yPos);
    
    // Add signed date
    if (data.signedDate) {
      doc.text(`Date: ${data.signedDate}`, 20, yPos + 5);
    }
  }
  
  // Add professional footer using PDFTemplateService (anchored at bottom)
  await PDFTemplateService.addFooter(doc);
  
  // Convert to buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

/**
 * Generate Liability Waiver PDF
 */
export async function generateLiabilityWaiverPDF(data: LiabilityWaiverData): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const textWidth = pageWidth - CONTENT_MARGIN_X * 2;
  const policy = await businessPolicyService.getEffectivePolicy();
  const clauses = data.clauses?.length ? data.clauses : policy.documents.liabilityWaiverClauses;
  
  // Add professional letterhead with logo using PDFTemplateService
  await PDFTemplateService.addLetterhead(doc, 'RELEASE & WAIVER OF LIABILITY');
  
  // Vendor information
  let yPos = 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`I, ${data.vendorName}, hereby acknowledge and agree:`, CONTENT_MARGIN_X, yPos);
  
  yPos += 15;
  for (const [index, clause] of clauses.entries()) {
    const bodyLines = doc.splitTextToSize(clause.body, textWidth);
    const neededSpace = 6 + bodyLines.length * 5 + 10;
    if (yPos + neededSpace > PDFTemplateService.getMaxContentY(doc)) {
      yPos = await moveToNewDocumentPage(doc, 'RELEASE & WAIVER OF LIABILITY');
    }

    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${clause.title.toUpperCase()}`, CONTENT_MARGIN_X, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    yPos = addWrappedText(doc, clause.body, CONTENT_MARGIN_X, yPos, textWidth);
    yPos += 10;
  }
  
  // Get max content Y to avoid footer overlap using PDFTemplateService
  const maxContentY = PDFTemplateService.getMaxContentY(doc);
  
  // Signature section. Move to a fresh page when the legal text reaches the footer.
  yPos += 20;

  const requiredSpace = data.signatureData ? 70 : 75;
  if (yPos + requiredSpace > maxContentY) {
    yPos = await moveToNewDocumentPage(doc, 'RELEASE & WAIVER OF LIABILITY');
  }
  
  // If signature data is provided, add the signature image
  if (data.signatureData) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Vendor Signature:', 20, yPos);
    yPos += 6;
    
    try {
      doc.addImage(data.signatureData, 'PNG', 20, yPos, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
      yPos += SIGNATURE_HEIGHT + 4;
    } catch (error) {
      console.error('Error adding signature to PDF:', error);
      // Fallback to signature line if image fails
      yPos += SIGNATURE_HEIGHT + 4;
    }
    
    // Signature line and label
    doc.line(20, yPos, 100, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Vendor Signature', 20, yPos);
    
    // Add signed date
    if (data.signedDate) {
      doc.text(`Date: ${data.signedDate}`, 20, yPos + 5);
    }
  } else {
    // No signature yet - show signature line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Vendor Signature:', 20, yPos);
    yPos += 45;
    
    doc.line(20, yPos, 100, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Vendor Signature', 20, yPos);
    doc.text('Date: ___/___/______', 20, yPos + 5);
  }
  
  // Vendor details below signature (with proper spacing)
  yPos += 10;
  doc.setFontSize(8);
  doc.text(`Name: ${data.vendorName}`, 20, yPos);
  yPos += 4;
  doc.text(`Email: ${data.vendorEmail}`, 20, yPos);
  yPos += 4;
  doc.text(`Phone: ${data.vendorPhone}`, 20, yPos);
  if (data.vendorBvn) {
    yPos += 4;
    doc.text(`BVN: ****${data.vendorBvn}`, 20, yPos);
  }
  
  // Add professional footer using PDFTemplateService (anchored at bottom)
  await PDFTemplateService.addFooter(doc);
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

/**
 * Generate Pickup Authorization PDF
 */
export async function generatePickupAuthorizationPDF(data: PickupAuthorizationData): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const policy = await businessPolicyService.getPublicPolicy();
  const primary = hexToRgb(policy.branding.primaryColor);
  const primaryText = readableTextColor(primary);
  
  // Add professional letterhead with logo using PDFTemplateService
  await PDFTemplateService.addLetterhead(doc, 'PICKUP AUTHORIZATION');
  
  // Authorization code (prominent with active brand background)
  let yPos = 65;
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(15, yPos - 10, pageWidth - 30, 25, 'F');
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryText[0], primaryText[1], primaryText[2]);
  doc.text(`Authorization Code: ${data.authorizationCode}`, pageWidth / 2, yPos, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Vendor information
  yPos += 25;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTHORIZED VENDOR', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Name: ${data.vendorName}`, 20, yPos);
  yPos += 6;
  doc.text(`Phone: ${data.vendorPhone}`, 20, yPos);
  
  // Asset information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('ASSET INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Description: ${data.assetDescription}`, 20, yPos);
  yPos += 6;
  doc.text(`Auction ID: ${data.auctionId}`, 20, yPos);
  
  // Payment information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PAYMENT CONFIRMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Amount Paid: NGN ${data.paymentAmount.toLocaleString()}`, 20, yPos);
  yPos += 6;
  doc.text(`Payment Reference: ${data.paymentReference}`, 20, yPos);
  yPos += 6;
  doc.text(`Payment Date: ${data.paymentDate}`, 20, yPos);
  
  // Pickup details
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PICKUP DETAILS', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Location: ${data.pickupLocation}`, 20, yPos);
  yPos += 6;
  doc.text(`Contact: ${data.pickupContact}`, 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Deadline: ${data.pickupDeadline}`, 20, yPos);
  
  // Important notice
  yPos += 15;
  doc.setFillColor(255, 243, 205);
  doc.rect(15, yPos - 5, pageWidth - 30, 25, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('IMPORTANT NOTICE', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('• Present this authorization and valid ID at pickup location', 20, yPos);
  yPos += 5;
  doc.text('• Pickup must be completed before deadline to avoid storage fees', 20, yPos);
  yPos += 5;
  doc.text('• Authorization code must match system records', 20, yPos);
  
  // Get max content Y to avoid footer overlap using PDFTemplateService
  const maxContentY = PDFTemplateService.getMaxContentY(doc);
  
  // QR Code section - centered, positioned above footer
  yPos += 20;
  
  // Ensure QR code doesn't overlap footer
  if (yPos + 80 > maxContentY) {
    yPos = maxContentY - 80;
  }
  
  const qrCodeDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    width: 80,
    margin: 1,
  });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan to verify authorization', pageWidth / 2, yPos, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('and view pickup details', pageWidth / 2, yPos + 4, { align: 'center' });
  
  // Add QR code (80x80px max, centered)
  doc.addImage(qrCodeDataUrl, 'PNG', pageWidth / 2 - 15, yPos + 8, 30, 30);
  
  // Add professional footer using PDFTemplateService
  await PDFTemplateService.addFooter(doc);
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}

/**
 * Generate Salvage Certificate PDF (for vehicles only)
 */
export async function generateSalvageCertificatePDF(data: SalvageCertificateData): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Add professional letterhead with logo using PDFTemplateService
  await PDFTemplateService.addLetterhead(doc, 'SALVAGE CERTIFICATE');
  
  // Vehicle information
  let yPos = 65;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('VEHICLE INFORMATION', 20, yPos);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`VIN: ${data.vin}`, 20, yPos);
  yPos += 6;
  doc.text(`Make: ${data.make}`, 20, yPos);
  yPos += 6;
  doc.text(`Model: ${data.model}`, 20, yPos);
  yPos += 6;
  doc.text(`Year: ${data.year}`, 20, yPos);
  
  // Damage assessment
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DAMAGE ASSESSMENT', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const damageText = doc.splitTextToSize(data.damageAssessment, pageWidth - 40);
  doc.text(damageText, 20, yPos);
  
  // Total loss declaration
  yPos += damageText.length * 6 + 10;
  if (data.totalLossDeclaration) {
    doc.setFillColor(255, 0, 0, 0.1);
    doc.rect(15, yPos - 5, pageWidth - 30, 15, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 0, 0);
    doc.text('TOTAL LOSS - NOT ROADWORTHY', 20, yPos);
    doc.setTextColor(0, 0, 0);
  }
  
  // Insurance information
  yPos += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('INSURANCE INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Claim Reference: ${data.claimReference}`, 20, yPos);
  yPos += 6;
  doc.text(`Insurance Company: ${data.insuranceCompany}`, 20, yPos);
  
  // Sale information
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SALE INFORMATION', 20, yPos);
  
  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Sale Date: ${data.saleDate}`, 20, yPos);
  yPos += 6;
  doc.text(`Buyer: ${data.buyerName}`, 20, yPos);
  
  // Disclaimer
  yPos += 15;
  doc.setFillColor(255, 243, 205);
  doc.rect(15, yPos - 5, pageWidth - 30, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SALVAGE VEHICLE NOTICE', 20, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('This vehicle has been declared a total loss and is sold for parts/repair only.', 20, yPos);
  yPos += 5;
  doc.text('It may not be roadworthy and requires inspection before use.', 20, yPos);
  
  // Get max content Y to avoid footer overlap using PDFTemplateService
  const maxContentY = PDFTemplateService.getMaxContentY(doc);
  
  // QR Code section - positioned above footer with proper spacing
  yPos += 20;
  
  // Ensure QR code doesn't overlap footer
  if (yPos + 80 > maxContentY) {
    yPos = maxContentY - 80;
  }
  
  const qrCodeDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    width: 80,
    margin: 1,
  });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan to verify certificate', pageWidth - 50, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('authenticity online', pageWidth - 50, yPos + 4);
  
  // Add QR code (80x80px max, positioned in bottom-right, above footer)
  doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - 50, yPos + 8, 30, 30);
  
  // Add professional footer using PDFTemplateService
  await PDFTemplateService.addFooter(doc);
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return pdfBuffer;
}
